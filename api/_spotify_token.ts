// Shared Spotify client-credentials token.
//
// Used by scan-artists (direct Spotify search path), search-apple (ISRC
// cross-verification of Apple matches per R12), and any future module that
// needs a server-side Spotify access token.
//
// Client Credentials flow — no user scope, read-only catalog access.
// Module-scoped cache gives us automatic reuse across calls within one
// Vercel function invocation.

const TOKEN_URL = 'https://accounts.spotify.com/api/token';

let cachedToken: { token: string; expiresAt: number } | null = null;

/** Get a Spotify Client Credentials access token (server-side only). */
export async function getSpotifyClientToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Spotify credentials not configured');

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Spotify token fetch failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000, // 1 min buffer
  };
  return data.access_token;
}
