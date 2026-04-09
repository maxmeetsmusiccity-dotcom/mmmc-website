import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Instagram handle auto-discovery.
 * Searches the web for an artist's Instagram profile and validates the match.
 *
 * POST /api/discover-instagram
 * Body: { artist_name: string, spotify_followers?: number }
 * Returns: { handle: string | null, confidence: 'high' | 'medium' | 'low', source: string }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { artist_name, spotify_followers } = req.body || {};
  if (!artist_name) {
    return res.status(400).json({ error: 'Missing artist_name' });
  }

  try {
    // Try common Instagram handle patterns
    const candidates = generateCandidates(artist_name);

    // For now, return the best guess candidate without live validation
    // (Live IG API scraping requires Apify or similar — will be added later)
    const bestGuess = candidates[0];

    return res.status(200).json({
      handle: bestGuess || null,
      confidence: 'low',
      source: 'nmf_pattern_guess',
      candidates,
      note: 'Pattern-based guess only. Manual verification recommended.',
    });
  } catch (e) {
    console.error('[discover-instagram] Error:', e);
    return res.status(500).json({ error: 'Discovery failed' });
  }
}

function generateCandidates(name: string): string[] {
  const clean = name.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const parts = clean.split(/\s+/);
  const candidates: string[] = [];

  // Common patterns: firstname_lastname, firstnamelastname, firstlast_music
  if (parts.length >= 2) {
    candidates.push(parts.join(''));           // kaitlinbutts
    candidates.push(parts.join('_'));          // kaitlin_butts
    candidates.push(parts.join('.'));          // kaitlin.butts
    candidates.push(parts.join('') + 'music');  // kaitlinbuttsmusic
    candidates.push(parts[0] + parts[parts.length - 1]); // kaitlinbutts (redundant but handles middle names)
  } else {
    candidates.push(clean);
    candidates.push(clean + 'music');
    candidates.push(clean + 'official');
  }

  return [...new Set(candidates)];
}
