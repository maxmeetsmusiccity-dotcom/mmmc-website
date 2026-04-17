// Pre-scan token health probe (R10 + R11 support).
//
// Purpose: cheap, fast detection of rate-limit or auth failures on Spotify +
// Apple before committing to a 20+ minute scan cascade. The April 17 2026
// incident proved that running a full scan while tokens are poisoned EXTENDS
// the rate-limit window and burns the rest of the overnight budget. A 5s
// probe up front catches it and lets the cron abort cleanly.
//
// Returns 200 when both platforms are healthy; 503 if either is degraded, so
// callers (the cron, CI, a human) can branch on HTTP status alone. Full
// per-platform telemetry is in the JSON body for diagnostics.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSpotifyClientToken } from './_spotify_token.js';
import { getAppleDeveloperToken } from './_apple_token.js';

const SPOTIFY_API = 'https://api.spotify.com/v1';
const APPLE_API = 'https://api.music.apple.com/v1/catalog/us';
const PROBE_TIMEOUT_MS = 5000;

// Stable artist IDs for endpoint-specific probes. Lainey Wilson picked because
// she's the canonical "healthy Nashville artist" — reliably present on both
// platforms with an active catalog. Use /albums NOT /search: Spotify applies
// per-endpoint quotas, so /search can return 200 while /albums is 429. The
// scan hammers /albums, so that's the endpoint whose health matters.
const SPOTIFY_PROBE_ARTIST_ID = '6tPHARSq45lQ8BSALCfkFC'; // Lainey Wilson
const APPLE_PROBE_ARTIST_ID = '907166363';                // Lainey Wilson

const SCAN_SECRET = process.env.SCAN_SECRET || '';

function isAuthorized(req: VercelRequest): boolean {
  const auth = req.headers.authorization;
  if (SCAN_SECRET && auth === `Bearer ${SCAN_SECRET}`) return true;
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true;
  return false;
}

export interface ProbeOutcome {
  ok: boolean;
  status: number | null;        // HTTP status from the catalog probe; null on network error
  latency_ms: number;
  error?: string;               // 'timeout' | 'token_failed' | 'network_error' | http code
  retry_after_seconds?: number; // when Retry-After header is present
}

async function probeWithTimeout(url: string, init: RequestInit): Promise<{ resp: Response | null; latency_ms: number; aborted: boolean; netError?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  const start = Date.now();
  try {
    const resp = await fetch(url, { ...init, signal: controller.signal });
    return { resp, latency_ms: Date.now() - start, aborted: false };
  } catch (e) {
    const isAbort = (e as Error).name === 'AbortError';
    return { resp: null, latency_ms: Date.now() - start, aborted: isAbort, netError: isAbort ? 'timeout' : (e as Error).message };
  } finally {
    clearTimeout(timer);
  }
}

async function probeSpotify(): Promise<ProbeOutcome> {
  let token: string;
  const tokenStart = Date.now();
  try {
    token = await getSpotifyClientToken();
  } catch (e) {
    return { ok: false, status: null, latency_ms: Date.now() - tokenStart, error: `token_failed:${(e as Error).message}` };
  }
  const { resp, latency_ms, aborted, netError } = await probeWithTimeout(
    `${SPOTIFY_API}/artists/${SPOTIFY_PROBE_ARTIST_ID}/albums?market=US&limit=1`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!resp) return { ok: false, status: null, latency_ms, error: aborted ? 'timeout' : (netError || 'network_error') };
  const retryAfter = parseInt(resp.headers.get('retry-after') || '', 10);
  return {
    ok: resp.ok,
    status: resp.status,
    latency_ms,
    error: resp.ok ? undefined : `http_${resp.status}`,
    retry_after_seconds: isFinite(retryAfter) ? retryAfter : undefined,
  };
}

async function probeApple(): Promise<ProbeOutcome> {
  let token: string;
  const tokenStart = Date.now();
  try {
    token = await getAppleDeveloperToken();
  } catch (e) {
    return { ok: false, status: null, latency_ms: Date.now() - tokenStart, error: `token_failed:${(e as Error).message}` };
  }
  const { resp, latency_ms, aborted, netError } = await probeWithTimeout(
    `${APPLE_API}/artists/${APPLE_PROBE_ARTIST_ID}/albums?limit=1&sort=-releaseDate`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!resp) return { ok: false, status: null, latency_ms, error: aborted ? 'timeout' : (netError || 'network_error') };
  const retryAfter = parseInt(resp.headers.get('retry-after') || '', 10);
  return {
    ok: resp.ok,
    status: resp.status,
    latency_ms,
    error: resp.ok ? undefined : `http_${resp.status}`,
    retry_after_seconds: isFinite(retryAfter) ? retryAfter : undefined,
  };
}

export interface HealthReport {
  spotify_ok: boolean;
  apple_ok: boolean;
  spotify: ProbeOutcome;
  apple: ProbeOutcome;
  tested_at: string;
}

/** Run both platform probes in parallel. In-process helper reused by the cron
 *  pre-flight so it doesn't pay an extra HTTP round-trip to self-call. */
export async function runHealthProbe(): Promise<HealthReport> {
  const [spotify, apple] = await Promise.all([probeSpotify(), probeApple()]);
  return {
    spotify_ok: spotify.ok,
    apple_ok: apple.ok,
    spotify,
    apple,
    tested_at: new Date().toISOString(),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'GET or POST only' });
  }
  if (!isAuthorized(req)) return res.status(401).json({ error: 'Authentication required' });

  const report = await runHealthProbe();
  const statusCode = report.spotify_ok && report.apple_ok ? 200 : 503;
  res.setHeader('Cache-Control', 'no-store');
  return res.status(statusCode).json(report);
}
