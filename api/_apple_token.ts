// Shared Apple Music developer JWT.
//
// Used by search-apple (catalog scanner) and scan-health (token health probe).
// Signed with the team's ES256 private key, issued for 12 hours, cached at
// module scope so one Vercel function invocation signs at most once.

import { SignJWT, importPKCS8 } from 'jose';

const TEAM_ID = process.env.APPLE_MUSIC_TEAM_ID || '';
const KEY_ID = process.env.APPLE_MUSIC_KEY_ID || process.env.APPLE_MUSIC_SEARCH_KEY_ID || '';

let cachedToken: { token: string; expiresAt: number } | null = null;

/** Get a signed Apple Music developer JWT (server-side only). */
export async function getAppleDeveloperToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.token;

  if (!TEAM_ID || !KEY_ID) throw new Error('APPLE_MUSIC_TEAM_ID or APPLE_MUSIC_KEY_ID not configured');
  const privateKeyPem = process.env.APPLE_MUSIC_PRIVATE_KEY;
  if (!privateKeyPem) throw new Error('APPLE_MUSIC_PRIVATE_KEY not configured');

  const privateKey = await importPKCS8(privateKeyPem, 'ES256');
  const now = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: KEY_ID })
    .setIssuer(TEAM_ID)
    .setIssuedAt(now)
    .setExpirationTime(now + 43200) // 12 hours
    .sign(privateKey);

  cachedToken = { token, expiresAt: Date.now() + 39600000 }; // 11 hours
  return token;
}
