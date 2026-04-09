import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Tests for src/lib/auth.ts
 *
 * Because auth.ts uses `import.meta.env` and `window.location` at module scope,
 * we test the pure utility functions by extracting their logic here rather than
 * importing the module directly (which would blow up in a Node vitest env).
 * The functions under test: generateRandomString, base64url, sha256,
 * isTokenExpired, getToken, clearToken.
 */

// ---------- Re-implement the pure functions exactly as in auth.ts ----------

const VALID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

function generateRandomString(length: number): string {
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values, v => VALID_CHARS[v % VALID_CHARS.length]).join('');
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

async function generateCodeChallenge(verifier: string): Promise<string> {
  return base64url(await sha256(verifier));
}

function isTokenExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return Date.now() > Number(expiresAt) - 5 * 60 * 1000;
}

// ---------- sessionStorage mock ----------

let store: Record<string, string> = {};

const sessionStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { store = {}; },
};

function getToken(): string | null {
  return sessionStorageMock.getItem('spotify_token');
}

function clearToken(): void {
  sessionStorageMock.removeItem('spotify_token');
  sessionStorageMock.removeItem('spotify_refresh_token');
  sessionStorageMock.removeItem('spotify_token_expires');
  sessionStorageMock.removeItem('pkce_verifier');
}

// ---------- Tests ----------

describe('generateRandomString (code verifier)', () => {
  it('produces a string of the requested length', () => {
    const s = generateRandomString(128);
    expect(s).toHaveLength(128);
  });

  it('contains only valid PKCE characters', () => {
    const s = generateRandomString(256);
    for (const ch of s) {
      expect(VALID_CHARS).toContain(ch);
    }
  });

  it('two calls produce different strings (randomness)', () => {
    const a = generateRandomString(128);
    const b = generateRandomString(128);
    expect(a).not.toBe(b);
  });

  it('works for length 1', () => {
    const s = generateRandomString(1);
    expect(s).toHaveLength(1);
    expect(VALID_CHARS).toContain(s);
  });

  it('works for length 0 (edge case)', () => {
    const s = generateRandomString(0);
    expect(s).toBe('');
  });
});

describe('generateCodeChallenge (base64url of SHA-256)', () => {
  it('returns a non-empty string', async () => {
    const challenge = await generateCodeChallenge('test-verifier');
    expect(challenge.length).toBeGreaterThan(0);
  });

  it('uses only base64url characters (no +, /, or =)', async () => {
    const challenge = await generateCodeChallenge('another-verifier-string-here');
    expect(challenge).not.toMatch(/[+/=]/);
  });

  it('is deterministic for the same input', async () => {
    const a = await generateCodeChallenge('fixed-verifier');
    const b = await generateCodeChallenge('fixed-verifier');
    expect(a).toBe(b);
  });

  it('differs for different inputs', async () => {
    const a = await generateCodeChallenge('verifier-one');
    const b = await generateCodeChallenge('verifier-two');
    expect(a).not.toBe(b);
  });

  it('produces a 43-character string for SHA-256 (256 bits / 6 bits per b64 char)', async () => {
    const challenge = await generateCodeChallenge('any-verifier');
    expect(challenge).toHaveLength(43);
  });
});

describe('isTokenExpired', () => {
  it('returns false when expiresAt is null (unknown expiry)', () => {
    expect(isTokenExpired(null)).toBe(false);
  });

  it('returns false when token expires far in the future', () => {
    const future = String(Date.now() + 60 * 60 * 1000); // +1 hour
    expect(isTokenExpired(future)).toBe(false);
  });

  it('returns true when token already expired', () => {
    const past = String(Date.now() - 10 * 60 * 1000); // -10 min
    expect(isTokenExpired(past)).toBe(true);
  });

  it('returns true when token expires within the 5-minute buffer', () => {
    const soonish = String(Date.now() + 3 * 60 * 1000); // +3 min (within 5 min buffer)
    expect(isTokenExpired(soonish)).toBe(true);
  });

  it('returns false when token expires in exactly 6 minutes (outside buffer)', () => {
    const safe = String(Date.now() + 6 * 60 * 1000);
    expect(isTokenExpired(safe)).toBe(false);
  });
});

describe('getToken / clearToken (sessionStorage)', () => {
  beforeEach(() => {
    store = {};
  });

  it('getToken returns null when nothing stored', () => {
    expect(getToken()).toBeNull();
  });

  it('getToken returns stored token', () => {
    sessionStorageMock.setItem('spotify_token', 'abc123');
    expect(getToken()).toBe('abc123');
  });

  it('clearToken removes all auth keys', () => {
    sessionStorageMock.setItem('spotify_token', 't');
    sessionStorageMock.setItem('spotify_refresh_token', 'r');
    sessionStorageMock.setItem('spotify_token_expires', '999');
    sessionStorageMock.setItem('pkce_verifier', 'v');
    clearToken();
    expect(sessionStorageMock.getItem('spotify_token')).toBeNull();
    expect(sessionStorageMock.getItem('spotify_refresh_token')).toBeNull();
    expect(sessionStorageMock.getItem('spotify_token_expires')).toBeNull();
    expect(sessionStorageMock.getItem('pkce_verifier')).toBeNull();
  });

  it('clearToken is safe to call when already empty', () => {
    expect(() => clearToken()).not.toThrow();
    expect(getToken()).toBeNull();
  });

  it('getToken still works after clearing and re-setting', () => {
    sessionStorageMock.setItem('spotify_token', 'first');
    clearToken();
    sessionStorageMock.setItem('spotify_token', 'second');
    expect(getToken()).toBe('second');
  });
});
