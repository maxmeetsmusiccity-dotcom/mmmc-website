import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { getClientIp, isRateLimited } from './_rateLimit';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const APIFY_TOKEN = process.env.APIFY_TOKEN || '';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

type ConfidenceLabel = 'confirmed' | 'likely' | 'unverified' | 'contested' | 'rejected';

interface EnrichmentResult {
  artist_name: string;
  pg_id: string | null;
  instagram: {
    handle: string | null;
    confidence_label: ConfidenceLabel;
    bio: string | null;
    followers: number | null;
    verified: boolean;
    sources: string[];
    evidence: string;
  };
  intelligence: {
    recent_news: Array<{ headline: string; url: string; category: string }>;
    label: string | null;
    tour_active: boolean | null;
  };
  merge_signals: Array<{ type: string; detail: string }>;
}

// ─── Apify Helpers ─────────────────────────────────────────

async function apifyGoogleSearch(query: string): Promise<Array<{ title: string; url: string; description: string }>> {
  if (!APIFY_TOKEN) return [];
  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/apify~google-search-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=30`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queries: query, maxPagesPerQuery: 1, resultsPerPage: 5 }),
      },
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data) || !data[0]) return [];
    return (data[0].organicResults || []).map((r: any) => ({
      title: r.title || '',
      url: r.url || '',
      description: r.description || '',
    }));
  } catch { return []; }
}

async function apifyInstagramProfile(handle: string): Promise<{
  username: string; fullName: string; biography: string;
  followersCount: number; isVerified: boolean; isBusinessAccount: boolean;
  businessCategoryName: string; externalUrl: string;
} | null> {
  if (!APIFY_TOKEN || !handle) return null;
  const cleanHandle = handle.replace(/^@/, '');
  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=30`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernames: [cleanHandle] }),
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || !data[0]) return null;
    return data[0];
  } catch { return null; }
}

// ─── Claude Synthesis ──────────────────────────────────────

async function claudeSynthesize(
  artistName: string,
  knownData: Record<string, unknown>,
  googleResults: Array<{ title: string; url: string; description: string }>,
  igProfile: Record<string, unknown> | null,
): Promise<{
  handle: string | null;
  confidence_label: ConfidenceLabel;
  evidence: string;
  news: Array<{ headline: string; url: string; category: string }>;
  label: string | null;
  merge_flags: string[];
}> {
  if (!ANTHROPIC_API_KEY) {
    // Fallback: basic heuristic without Claude
    const igResult = googleResults.find(r => r.url.includes('instagram.com/') && !r.url.includes('/p/'));
    const handle = igResult ? igResult.url.match(/instagram\.com\/([^/?]+)/)?.[1] || null : null;
    return {
      handle: handle ? `@${handle}` : null,
      confidence_label: handle ? 'unverified' : 'rejected',
      evidence: handle ? `Google search found ${igResult?.url}` : 'No Instagram profile found in search results',
      news: [],
      label: null,
      merge_flags: [],
    };
  }

  const systemPrompt = `You are a Nashville music industry research agent. You verify Instagram handles and extract intelligence for country/Americana/Christian music artists.

RULES:
1. Name disambiguation is critical. Cross-reference the bio against known data.
2. The bio must plausibly match a Nashville music professional. Wrong person = rejected.
3. Use these categorical confidence labels:
   - confirmed: handle exists + bio matches artist identity + corroborating evidence
   - likely: handle exists + bio is plausible but limited corroboration
   - unverified: handle found but can't confirm it's the right person
   - contested: multiple candidates or conflicting signals
   - rejected: handle doesn't exist, or bio clearly belongs to someone else
4. Flag potential merge signals: same handle on different artists, or same artist with different handles.
5. Extract any news: recent releases, label deals, tour activity, collaborations.

Respond with ONLY valid JSON, no markdown.`;

  const userPrompt = `Research this artist and return structured data:

ARTIST: ${artistName}
KNOWN DATA: ${JSON.stringify(knownData)}

GOOGLE SEARCH RESULTS:
${googleResults.map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.description}`).join('\n\n')}

INSTAGRAM PROFILE DATA:
${igProfile ? JSON.stringify(igProfile, null, 2) : 'Not yet validated'}

Return JSON with this exact structure:
{
  "handle": "@handle or null",
  "confidence_label": "confirmed|likely|unverified|contested|rejected",
  "evidence": "one sentence explaining the confidence decision",
  "news": [{"headline": "...", "url": "...", "category": "release|tour|deal|award|collab|other"}],
  "label": "record label name or null",
  "merge_flags": ["description of any identity issues found"]
}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!res.ok) {
      console.error('[enrich] Claude API error:', res.status);
      // Fallback to heuristic
      const igResult = googleResults.find(r => r.url.includes('instagram.com/') && !r.url.includes('/p/'));
      const handle = igResult ? igResult.url.match(/instagram\.com\/([^/?]+)/)?.[1] || null : null;
      return {
        handle: handle ? `@${handle}` : null,
        confidence_label: handle ? 'unverified' : 'rejected',
        evidence: 'Claude unavailable; heuristic match only',
        news: [], label: null, merge_flags: [],
      };
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || '{}';
    const parsed = JSON.parse(text);
    return {
      handle: parsed.handle || null,
      confidence_label: parsed.confidence_label || 'unverified',
      evidence: parsed.evidence || '',
      news: Array.isArray(parsed.news) ? parsed.news : [],
      label: parsed.label || null,
      merge_flags: Array.isArray(parsed.merge_flags) ? parsed.merge_flags : [],
    };
  } catch (e) {
    console.error('[enrich] Claude synthesis error:', e);
    return { handle: null, confidence_label: 'rejected', evidence: 'Synthesis failed', news: [], label: null, merge_flags: [] };
  }
}

// ─── Main Enrichment Pipeline ──────────────────────────────

async function enrichArtist(
  artistName: string,
  pgId: string | null,
  spotifyId: string | null,
  knownData: Record<string, unknown>,
): Promise<EnrichmentResult> {
  const result: EnrichmentResult = {
    artist_name: artistName,
    pg_id: pgId,
    instagram: {
      handle: null, confidence_label: 'rejected', bio: null,
      followers: null, verified: false, sources: [], evidence: '',
    },
    intelligence: { recent_news: [], label: null, tour_active: null },
    merge_signals: [],
  };

  // Step 1: Check Supabase cache
  if (spotifyId && SUPABASE_URL && SUPABASE_KEY) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { data } = await supabase
      .from('instagram_handles')
      .select('*')
      .eq('spotify_artist_id', spotifyId)
      .single();

    if (data?.instagram_handle && data.source?.includes('confirmed')) {
      result.instagram = {
        handle: data.instagram_handle,
        confidence_label: 'confirmed',
        bio: null, followers: null, verified: false,
        sources: ['cache'], evidence: 'Previously confirmed handle from cache',
      };
      return result; // Already confirmed — skip enrichment
    }
  }

  // Step 2: Google search for Instagram handle + news
  const googleResults = await apifyGoogleSearch(
    `"${artistName}" instagram site:instagram.com Nashville songwriter country`
  );
  if (googleResults.length > 0) result.instagram.sources.push('google');

  // Step 3: Extract candidate handle from Google results
  const igCandidate = googleResults.find(r =>
    r.url.includes('instagram.com/') && !r.url.includes('/p/') && !r.url.includes('/reel/')
  );
  const candidateHandle = igCandidate?.url.match(/instagram\.com\/([^/?#]+)/)?.[1];

  // Step 4: Validate candidate via Apify Instagram Profile
  let igProfile = null;
  if (candidateHandle) {
    igProfile = await apifyInstagramProfile(candidateHandle);
    if (igProfile) {
      result.instagram.sources.push('apify_ig');
      result.instagram.bio = igProfile.biography;
      result.instagram.followers = igProfile.followersCount;
      result.instagram.verified = igProfile.isVerified;
    }
  }

  // Step 5: Claude synthesis — score confidence, extract intelligence
  const synthesis = await claudeSynthesize(
    artistName,
    { ...knownData, pg_id: pgId, spotify_id: spotifyId },
    googleResults,
    igProfile,
  );

  result.instagram.handle = synthesis.handle;
  result.instagram.confidence_label = synthesis.confidence_label;
  result.instagram.evidence = synthesis.evidence;
  result.intelligence.recent_news = synthesis.news;
  result.intelligence.label = synthesis.label;

  // Step 6: Check for merge signals
  if (synthesis.merge_flags.length > 0) {
    for (const flag of synthesis.merge_flags) {
      result.merge_signals.push({ type: 'flag', detail: flag });
    }
  }

  // Check if this handle is already assigned to a different entity
  if (result.instagram.handle && SUPABASE_URL && SUPABASE_KEY) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const cleanHandle = result.instagram.handle.replace(/^@/, '');
    const { data: existing } = await supabase
      .from('instagram_handles')
      .select('spotify_artist_id, artist_name')
      .eq('instagram_handle', `@${cleanHandle}`);

    if (existing && existing.length > 0) {
      const otherId = existing[0].spotify_artist_id;
      if (otherId !== spotifyId && otherId !== pgId) {
        result.merge_signals.push({
          type: 'duplicate_handle',
          detail: `Handle @${cleanHandle} already assigned to ${existing[0].artist_name} (${otherId}). Possible merge candidate.`,
        });
        result.instagram.confidence_label = 'contested';
      }
    }
  }

  // Step 7: Write to Supabase cache (as proposal, not confirmed)
  if (result.instagram.handle && SUPABASE_URL && SUPABASE_KEY) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const key = spotifyId || pgId || `lookup:${artistName}`;
    await supabase.from('instagram_handles').upsert({
      spotify_artist_id: key,
      artist_name: artistName,
      instagram_handle: result.instagram.handle,
      nd_pg_id: pgId,
      source: `research_agent:${result.instagram.confidence_label}`,
      confidence: result.instagram.confidence_label === 'confirmed' ? 0.95
        : result.instagram.confidence_label === 'likely' ? 0.8
        : result.instagram.confidence_label === 'unverified' ? 0.5
        : result.instagram.confidence_label === 'contested' ? 0.3
        : 0.1,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'spotify_artist_id' });
  }

  return result;
}

// ─── API Handler ───────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  // Require auth
  const authToken = req.headers['x-supabase-auth'];
  if (!authToken || typeof authToken !== 'string' || authToken.length < 20) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (isRateLimited(getClientIp(req), 10, 60_000)) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  const { artist_name, pg_id, spotify_id, known_data } = req.body || {};
  if (!artist_name) {
    return res.status(400).json({ error: 'artist_name required' });
  }

  try {
    const result = await enrichArtist(
      artist_name,
      pg_id || null,
      spotify_id || null,
      known_data || {},
    );

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(result);
  } catch (e) {
    console.error('[enrich-artist] Error:', e);
    return res.status(500).json({ error: 'Enrichment failed' });
  }
}
