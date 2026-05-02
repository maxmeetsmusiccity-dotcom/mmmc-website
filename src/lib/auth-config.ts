/**
 * Multi-product auth configuration for MMMC Enterprises.
 *
 * All MMMC products share Supabase project kpwklxrcysokuyjhuhun.
 * Each product MUST declare its own auth boundaries so OAuth redirects
 * land on the correct site. Supabase validates the redirectTo URL
 * against its dashboard Allow List — if the URL isn't listed, it falls
 * back to the Site URL (which may be a different product).
 *
 * This file is the single source of truth for NMF's auth identity.
 * CWC, Smart Archive, and future products each maintain their own
 * equivalent file in their respective repos.
 */

export interface ProductAuthConfig {
  /** Short product identifier (used in storage keys, logging). */
  productId: string;
  /** Human-readable product name. */
  productName: string;
  /**
   * Canonical production origins for this product.
   * Used for post-auth validation: if we land on an origin that isn't
   * in this list, the redirect went to the wrong product.
   */
  canonicalOrigins: string[];
  /**
   * Local dev origins (added to redirect allow list but not validated
   * against in production).
   */
  devOrigins: string[];
  /**
   * Product-specific localStorage key prefix for Supabase auth tokens.
   * Prevents token collision if two MMMC products ever share a domain.
   */
  storageKey: string;
}

export const NMF_AUTH_CONFIG: ProductAuthConfig = {
  productId: 'nmf',
  productName: 'NMF Curator Studio',
  canonicalOrigins: [
    'https://newmusicfriday.app',
  ],
  devOrigins: [
    'http://localhost:5173',
    'http://localhost:4173',
    'http://localhost:3000',
  ],
  storageKey: 'sb-nmf-auth-token',
};

/**
 * All MMMC products that share this Supabase project.
 * Used to generate the complete Redirect URLs allow list and to
 * detect cross-product redirect errors.
 */
export const MMMC_PRODUCTS: ProductAuthConfig[] = [
  NMF_AUTH_CONFIG,
  {
    productId: 'cwc',
    productName: 'CoWrite Compass',
    canonicalOrigins: ['https://cowritecompass.com'],
    devOrigins: ['http://localhost:3001'],
    storageKey: 'sb-cwc-auth-token',
  },
  {
    productId: 'nd',
    productName: 'Nashville Decoder',
    canonicalOrigins: ['https://nashvilledecoder.com', 'https://nashvilledecoder.io', 'https://nashvilledecoder.app'],
    devOrigins: [],
    storageKey: 'sb-nd-auth-token',
  },
];

/**
 * Build the OAuth redirectTo URL for this product.
 * In production, uses the canonical origin. In dev, uses current origin.
 */
export function getRedirectUrl(): string {
  if (typeof window === 'undefined') return '';
  const origin = window.location.origin;
  const path = window.location.pathname;

  // In dev, use whatever origin the dev server is on
  if (NMF_AUTH_CONFIG.devOrigins.some(o => origin.startsWith(o))) {
    return `${origin}${path}`;
  }

  // In production, always use the canonical origin to prevent misrouting
  const canonical = NMF_AUTH_CONFIG.canonicalOrigins[0];
  if (canonical && !NMF_AUTH_CONFIG.canonicalOrigins.includes(origin)) {
    console.warn(
      `[AUTH] Current origin ${origin} is not in NMF's canonical origins. ` +
      `Redirecting to ${canonical}${path} instead.`
    );
    return `${canonical}${path}`;
  }

  return `${origin}${path}`;
}

/**
 * Check if the current page load looks like a cross-product auth redirect.
 * Returns the product that likely owns this origin, or null if it's ours.
 */
export function detectCrossProductRedirect(): ProductAuthConfig | null {
  if (typeof window === 'undefined') return null;
  const origin = window.location.origin;

  // If we're on our own origin (prod or dev), no cross-product issue
  const isOurs =
    NMF_AUTH_CONFIG.canonicalOrigins.includes(origin) ||
    NMF_AUTH_CONFIG.devOrigins.some(o => origin.startsWith(o));
  if (isOurs) return null;

  // Check if we're on another MMMC product's origin
  for (const product of MMMC_PRODUCTS) {
    if (product.productId === NMF_AUTH_CONFIG.productId) continue;
    if (product.canonicalOrigins.includes(origin)) return product;
  }

  return null;
}

/**
 * Generate the full list of redirect URLs that must be configured in
 * the Supabase dashboard (Authentication → URL Configuration → Redirect URLs).
 */
export function generateRequiredRedirectUrls(): string[] {
  const urls: string[] = [];
  for (const product of MMMC_PRODUCTS) {
    for (const origin of product.canonicalOrigins) {
      urls.push(`${origin}/**`);
    }
    for (const origin of product.devOrigins) {
      urls.push(`${origin}/**`);
    }
  }
  return urls;
}
