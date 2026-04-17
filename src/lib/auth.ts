const CLIENT_ID = (import.meta.env.VITE_SPOTIFY_CLIENT_ID || '').trim();
// No fallback — env var must be set in .env.local / Vercel
const REDIRECT_URI = window.location.hostname === 'localhost'
  ? `${window.location.origin}/newmusicfriday`
  : 'https://maxmeetsmusiccity.com/newmusicfriday';
const SCOPES = 'user-follow-read playlist-modify-public playlist-modify-private';

function generateRandomString(length: number): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values, v => possible[v % possible.length]).join('');
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  return crypto.subtle.digest('SHA-256', encoder.encode(plain));
}

function base64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function startAuth(): Promise<void> {
  const verifier = generateRandomString(128);
  const challenge = base64url(await sha256(verifier));
  // localStorage (not sessionStorage): sessionStorage is tab/session-scoped
  // and can be cleared during Spotify's redirect chain, especially in
  // incognito mode — produces "Missing PKCE verifier" on callback. The
  // verifier is single-use and deleted in exchangeCode on success.
  localStorage.setItem('pkce_verifier', verifier);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  });

  window.location.href = `https://accounts.spotify.com/authorize?${params}`;
}

export async function exchangeCode(code: string): Promise<string> {
  // Prefer localStorage (current). Fall back to sessionStorage for in-flight
  // auth flows started before the storage change so no user is stranded.
  const verifier = localStorage.getItem('pkce_verifier') || sessionStorage.getItem('pkce_verifier');
  if (!verifier) throw new Error('Missing PKCE verifier');

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Token exchange failed: ${err.error_description || res.status}`);
  }

  const data = await res.json();
  localStorage.removeItem('pkce_verifier');
  sessionStorage.removeItem('pkce_verifier'); // clear legacy key too
  sessionStorage.setItem('spotify_token', data.access_token);
  if (data.refresh_token) {
    sessionStorage.setItem('spotify_refresh_token', data.refresh_token);
  }
  // Store expiry time (expires_in is seconds from now)
  if (data.expires_in) {
    const expiresAt = Date.now() + data.expires_in * 1000;
    sessionStorage.setItem('spotify_token_expires', String(expiresAt));
  }
  return data.access_token;
}

/** Refresh the access token using the stored refresh token (PKCE flow) */
export async function refreshToken(): Promise<string | null> {
  const refresh = sessionStorage.getItem('spotify_refresh_token');
  if (!refresh) return null;

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: refresh,
    }),
  });

  if (!res.ok) {
    // Refresh failed — clear everything, user must re-auth
    clearToken();
    return null;
  }

  const data = await res.json();
  sessionStorage.setItem('spotify_token', data.access_token);
  if (data.refresh_token) {
    sessionStorage.setItem('spotify_refresh_token', data.refresh_token);
  }
  if (data.expires_in) {
    sessionStorage.setItem('spotify_token_expires', String(Date.now() + data.expires_in * 1000));
  }
  return data.access_token;
}

/** Check if the stored token is expired or about to expire (within 5 min) */
export function isTokenExpired(): boolean {
  const expiresAt = sessionStorage.getItem('spotify_token_expires');
  if (!expiresAt) return false; // unknown expiry, assume valid
  return Date.now() > Number(expiresAt) - 5 * 60 * 1000; // 5 min buffer
}

export function getToken(): string | null {
  return sessionStorage.getItem('spotify_token');
}

export function clearToken(): void {
  sessionStorage.removeItem('spotify_token');
  sessionStorage.removeItem('spotify_refresh_token');
  sessionStorage.removeItem('spotify_token_expires');
  sessionStorage.removeItem('pkce_verifier');
}
