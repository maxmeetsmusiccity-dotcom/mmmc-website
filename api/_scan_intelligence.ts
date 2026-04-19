// NMF scan intelligence — the two-way loop.
//
// R13: every scan emits findings back to ND via
// `nmf_scan_intelligence__YYYY-MM-DD.json`. Over weekly cycles, the scan
// becomes a sensor that makes ND's data quality improve automatically.
//
// This module defines the schema and the emission helpers. The cron handler
// accumulates signals as it scans, then calls `emitIntelligence()` at the end.
//
// Emission target: a Supabase staging table `nmf_scan_intelligence`. Thread A
// polls this table during the cascade and ingests it into ND. (A future
// optimization is direct R2 upload via the nd-api Worker; staging table keeps
// the boundary clean for now — Thread A remains the sole writer to ND.)

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let cachedClient: SupabaseClient | null = null;
function sb(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  if (!cachedClient) cachedClient = createClient(SUPABASE_URL, SUPABASE_KEY);
  return cachedClient;
}

// ── Schema ─────────────────────────────────────────────────────────────

/** An Apple artist ID discovered during this scan. Confirmed via ISRC match
 *  against the artist's known Spotify catalog. */
export interface AppleIdDiscovery {
  pg_id?: string | null;            // canonical ND id, when known
  spotify_artist_id?: string | null; // anchor identity
  nashville_name: string;            // name as stored in R2 universe
  apple_artist_id: string;
  apple_display_name: string;
  confirmation: 'isrc_match' | 'exact_name' | 'spotify_bound_rejected';
  matching_isrcs?: string[];         // ISRCs that matched Spotify <-> Apple
}

/** An Apple match that failed ISRC cross-verification (likely pollution). */
export interface AppleRejection {
  nashville_name: string;
  spotify_artist_id?: string | null;
  apple_artist_id_rejected: string;
  apple_display_name_rejected: string;
  reason: 'no_isrc_overlap' | 'spotify_not_resolvable' | 'apple_no_albums';
}

/** A Spotify artist ID from R2 that no longer resolves (stale ND data). */
export interface StaleSpotifyId {
  pg_id?: string | null;
  nashville_name: string;
  spotify_artist_id_stale: string;
  http_status: number;               // 404, 400, etc
}

/** Two or more Nashville-universe artists appearing as performers on the
 *  same track. The FRESHEST possible co-write signal. */
export interface CollaborationSignal {
  track_id: string;                  // platform track id (apple_isrc_*, spotify id)
  track_name: string;
  album_name: string | null;
  release_date: string | null;
  source: 'spotify' | 'apple';
  participants: Array<{
    pg_id?: string | null;
    spotify_artist_id?: string | null;
    name: string;                    // name as appeared on the track
    role: 'primary_performer' | 'feature' | 'composer_credit';
  }>;
  raw_artist_string?: string;        // original comma-separated credit line
  raw_composer_string?: string;      // Apple's composerName if present
}

/** Per-artist release velocity in this scan window. */
export interface ReleaseVelocity {
  pg_id?: string | null;
  nashville_name: string;
  tracks_this_scan: number;
  albums_this_scan: number;
  earliest_release_date: string | null;
  latest_release_date: string | null;
}

/** Apple `composerName` extracted per track — emitted as a credit-edge
 *  CANDIDATE (not a confirmed co-write) so Alpha's M20 Credit Corroboration
 *  Agent can cross-reference against MusicBrainz / ISWC / Spotscraper. Zeta
 *  is the raw-signal emitter; corroboration lives in the cascade. */
export interface AppleComposerCredit {
  track_id: string;                  // apple_isrc_* or apple_track_*
  track_name: string;
  primary_artist_id: string | null;  // performer's Apple artist ID
  primary_artist_name: string;
  composer_names: string[];          // split from ta.composerName by ,/&/feat
  source: 'apple_composer_field';
  release_date: string | null;
}

/** Split Apple's composerName string into candidate names. Conservative —
 *  handles the common `Name1, Name2 & Name3` shape without swallowing single
 *  hyphenated names. */
export function extractComposerCandidates(composerName: string | null | undefined): string[] {
  if (!composerName) return [];
  // Lookahead on (space|end|,|&) after the optional `.` so `feat. ` splits but
  // `featuring` stays intact. Trailing `\b` alone fails because `.` then space
  // is non-word→non-word (no boundary).
  return String(composerName)
    .split(/,|&|\bfeat\.?(?=\s|$|,|&)|\bft\.?(?=\s|$|,|&)/gi)
    .map(s => s.trim())
    .filter(s => s.length > 0 && s.length <= 120);
}

/** Rate-limit / scan-health incidents for this run. */
export interface RateLimitIncident {
  platform: 'spotify' | 'apple';
  endpoint: string;
  http_status: number;
  retry_after_seconds: number | null;
  artists_affected: number;
  handler_budget_exhausted: boolean;
}

/** Top-level intelligence artifact for one scan run. */
export interface ScanIntelligence {
  scan_week: string;
  generated_at: string;
  scanner: 'nmf_weekly_cron' | 'nmf_manual' | 'nmf_follow_list';
  scope: {
    universe_source: string;
    universe_generated_at?: string;
    artists_input: number;
    artists_with_releases: number;
    tracks_found: number;
  };
  apple_ids_discovered: AppleIdDiscovery[];
  apple_rejections: AppleRejection[];
  stale_spotify_ids: StaleSpotifyId[];
  collaboration_signals: CollaborationSignal[];
  composer_credits: AppleComposerCredit[];
  release_velocity: ReleaseVelocity[];
  rate_limit_incidents: RateLimitIncident[];
  notes?: string;
}

// ── Accumulator ────────────────────────────────────────────────────────

/** In-memory accumulator for signals during one handler invocation.
 *  Call .build() at end to produce the emitted artifact. */
export class IntelligenceAccumulator {
  private appleDiscoveries: AppleIdDiscovery[] = [];
  private appleRejections: AppleRejection[] = [];
  private staleSpotify: StaleSpotifyId[] = [];
  private collaborations: CollaborationSignal[] = [];
  private composerCredits: AppleComposerCredit[] = [];
  private rateLimit: RateLimitIncident[] = [];
  private releaseVelocityMap = new Map<string, ReleaseVelocity>();

  recordAppleDiscovery(d: AppleIdDiscovery) { this.appleDiscoveries.push(d); }
  recordAppleRejection(r: AppleRejection) { this.appleRejections.push(r); }
  recordStaleSpotify(s: StaleSpotifyId) { this.staleSpotify.push(s); }
  recordCollaboration(c: CollaborationSignal) { this.collaborations.push(c); }
  recordAppleComposerCredit(c: AppleComposerCredit) { this.composerCredits.push(c); }
  recordRateLimit(i: RateLimitIncident) { this.rateLimit.push(i); }

  recordTrack(artistName: string, pgId: string | null | undefined, releaseDate: string | null, albumId: string | null) {
    const key = (pgId || artistName).toLowerCase();
    const v = this.releaseVelocityMap.get(key) || {
      pg_id: pgId ?? null,
      nashville_name: artistName,
      tracks_this_scan: 0,
      albums_this_scan: 0,
      earliest_release_date: null,
      latest_release_date: null,
    };
    v.tracks_this_scan += 1;
    if (releaseDate) {
      if (!v.earliest_release_date || releaseDate < v.earliest_release_date) v.earliest_release_date = releaseDate;
      if (!v.latest_release_date || releaseDate > v.latest_release_date) v.latest_release_date = releaseDate;
    }
    // Album tallying is approximate here — albums are counted at emission time
    this.releaseVelocityMap.set(key, v);
  }

  build(meta: { scan_week: string; scanner: ScanIntelligence['scanner']; scope: ScanIntelligence['scope']; notes?: string }): ScanIntelligence {
    return {
      scan_week: meta.scan_week,
      generated_at: new Date().toISOString(),
      scanner: meta.scanner,
      scope: meta.scope,
      apple_ids_discovered: this.appleDiscoveries,
      apple_rejections: this.appleRejections,
      stale_spotify_ids: this.staleSpotify,
      collaboration_signals: this.collaborations,
      composer_credits: this.composerCredits,
      release_velocity: [...this.releaseVelocityMap.values()],
      rate_limit_incidents: this.rateLimit,
      notes: meta.notes,
    };
  }
}

// ── Emission ───────────────────────────────────────────────────────────

/** Persist the intelligence artifact to the staging table. Thread A's
 *  cascade polls this table and ingests new rows into ND. */
export async function emitIntelligence(artifact: ScanIntelligence): Promise<{ ok: boolean; rowId?: number; error?: string }> {
  const client = sb();
  if (!client) return { ok: false, error: 'supabase not configured' };
  const row: Record<string, any> = {
    scan_week: artifact.scan_week,
    generated_at: artifact.generated_at,
    scanner: artifact.scanner,
    artifact: artifact,                       // full JSON blob for ingest
    apple_ids_discovered_count: artifact.apple_ids_discovered.length,
    apple_rejections_count: artifact.apple_rejections.length,
    stale_spotify_ids_count: artifact.stale_spotify_ids.length,
    collaboration_signals_count: artifact.collaboration_signals.length,
    composer_credits_count: artifact.composer_credits.length,
    release_velocity_count: artifact.release_velocity.length,
    rate_limit_incidents_count: artifact.rate_limit_incidents.length,
    tracks_found: artifact.scope.tracks_found,
    ingested_by_cascade: false,               // Thread A flips this to true after ingest
  };
  const { data, error } = await client.from('nmf_scan_intelligence').insert(row).select('id').single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, rowId: (data as any)?.id };
}
