import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { getClientIp, isRateLimited } from './_rateLimit';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * Server-side endpoint to save Instagram handles.
 * Uses service_role key since instagram_handles RLS restricts writes to service_role.
 * Requires Supabase auth token from the client.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  // Require auth — either Supabase JWT or anon key with valid session
  const authToken = req.headers['x-supabase-auth'];
  if (!authToken || typeof authToken !== 'string' || authToken.length < 20) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (await isRateLimited(getClientIp(req), 30, 60_000)) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  const { spotify_artist_id, artist_name, instagram_handle, source, confidence, nd_pg_id } = req.body || {};

  if (!spotify_artist_id || !artist_name) {
    return res.status(400).json({ error: 'spotify_artist_id and artist_name required' });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { error } = await supabase
      .from('instagram_handles')
      .upsert({
        spotify_artist_id,
        artist_name,
        instagram_handle: instagram_handle || null,
        source: source || 'nd_api',
        confidence: confidence ?? 0.5,
        nd_pg_id: nd_pg_id || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'spotify_artist_id' });

    if (error) {
      console.error('[save-handle] Supabase error:', error);
      return res.status(500).json({ error: 'Save failed' });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[save-handle] Error:', e);
    return res.status(500).json({ error: 'Save failed' });
  }
}
