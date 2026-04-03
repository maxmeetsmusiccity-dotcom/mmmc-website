const CANVA_CLIENT_ID = 'OC-AZ1TvjSadyjJ';
const CANVA_SCOPES = 'design:content:read design:content:write asset:read asset:write';

function generateRandomString(length: number): string {
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values, v => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[v % 62]).join('');
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(plain));
}

function base64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function startCanvaAuth(): Promise<void> {
  const verifier = generateRandomString(128);
  const challenge = base64url(await sha256(verifier));
  sessionStorage.setItem('canva_pkce_verifier', verifier);

  const redirectUri = window.location.hostname === 'localhost'
    ? `${window.location.origin}/newmusicfriday`
    : 'https://maxmeetsmusiccity.com/newmusicfriday';

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CANVA_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: CANVA_SCOPES,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state: 'canva',
  });

  window.location.href = `https://www.canva.com/api/oauth/authorize?${params}`;
}

export async function exchangeCanvaCode(code: string): Promise<string> {
  const verifier = sessionStorage.getItem('canva_pkce_verifier');
  if (!verifier) throw new Error('Missing Canva PKCE verifier');

  const redirectUri = window.location.hostname === 'localhost'
    ? `${window.location.origin}/newmusicfriday`
    : 'https://maxmeetsmusiccity.com/newmusicfriday';

  const res = await fetch('/api/canva-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      code_verifier: verifier,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.description || err.error || `Canva token exchange failed: ${res.status}`);
  }

  const data = await res.json();
  sessionStorage.removeItem('canva_pkce_verifier');
  sessionStorage.setItem('canva_token', data.access_token);
  return data.access_token;
}

export function getCanvaToken(): string | null {
  return sessionStorage.getItem('canva_token');
}

export function clearCanvaToken(): void {
  sessionStorage.removeItem('canva_token');
  sessionStorage.removeItem('canva_pkce_verifier');
}

/** Upload a blob as a Canva asset. Returns asset ID when ready. */
export async function uploadCanvaAsset(token: string, blob: Blob, name: string): Promise<string> {
  const nameBase64 = btoa(name);
  const buffer = await blob.arrayBuffer();

  const res = await fetch('https://api.canva.com/rest/v1/asset-uploads', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
      'Asset-Upload-Metadata': JSON.stringify({ name_base64: nameBase64 }),
    },
    body: buffer,
  });

  if (!res.ok) throw new Error(`Canva upload failed: ${res.status}`);
  const data = await res.json();
  const jobId = data.job?.id;
  if (!jobId) throw new Error('No job ID from Canva upload');

  // Poll for completion
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const pollRes = await fetch(`https://api.canva.com/rest/v1/asset-uploads/${jobId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!pollRes.ok) continue;
    const pollData = await pollRes.json();
    if (pollData.job?.status === 'success' && pollData.job?.asset?.id) {
      return pollData.job.asset.id;
    }
    if (pollData.job?.status === 'failed') {
      throw new Error('Canva asset upload failed');
    }
  }
  throw new Error('Canva asset upload timed out');
}
