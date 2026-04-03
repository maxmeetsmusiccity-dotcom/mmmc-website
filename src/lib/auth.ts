const CLIENT_ID = 'a510c84b66164834a9aeda12aa2da47b';
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
  sessionStorage.setItem('pkce_verifier', verifier);

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
  const verifier = sessionStorage.getItem('pkce_verifier');
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
  sessionStorage.removeItem('pkce_verifier');
  sessionStorage.setItem('spotify_token', data.access_token);
  return data.access_token;
}

export function getToken(): string | null {
  return sessionStorage.getItem('spotify_token');
}

export function clearToken(): void {
  sessionStorage.removeItem('spotify_token');
  sessionStorage.removeItem('pkce_verifier');
}
