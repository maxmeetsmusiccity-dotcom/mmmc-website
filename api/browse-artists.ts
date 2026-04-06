import type { VercelRequest, VercelResponse } from '@vercel/node';

const R2_BASE = 'https://pub-639573660a1e48d2b2075b4563f00cd3.r2.dev';

interface BrowseArtist {
  pg_id: string;
  name: string;
  tier: string;
  tier_display: string;
  arc_display: string;
  archetype_display: string;
  spotify_genres: string[];
  monthly_listeners: number;
  spotify_popularity: number;
  camp_name: string | null;
  no1_songs: number;
  credits: number;
  categories?: string[];
}

interface BrowseData {
  generated_at: string;
  categories: Record<string, { name: string; description: string; emoji: string; count: number }>;
  artists: BrowseArtist[];
}

/** Showcase + curated categories — used as fallback when R2 file doesn't exist yet */
const FALLBACK_CATEGORIES = [
  { id: 'whiskey_jam', name: 'Whiskey Jam', emoji: '\uD83E\uDD43', type: 'showcase' },
  { id: 'song_suffragettes', name: 'Song Suffragettes', emoji: '\uD83C\uDFA4', type: 'showcase' },
  { id: 'bluebird', name: 'Bluebird Cafe', emoji: '\uD83D\uDC26', type: 'showcase' },
  { id: 'listening_room', name: 'The Listening Room', emoji: '\uD83C\uDFA7', type: 'showcase' },
  { id: 'rowdy_round', name: 'Rowdy / Outside the Round', emoji: '\uD83C\uDFAF', type: 'showcase' },
  { id: 'rebel_rouser', name: 'Rebel Rouser', emoji: '\uD83D\uDD25', type: 'showcase' },
  { id: 'pindrop', name: 'PinDrop Writers Series', emoji: '\uD83D\uDCCC', type: 'showcase' },
  { id: 'nashville_tour_stop', name: 'Nashville Tour Stop', emoji: '\uD83D\uDE8C', type: 'showcase' },
  { id: 'opry', name: 'Grand Ole Opry', emoji: '\uD83C\uDFB6', type: 'showcase' },
  { id: 'marquee', name: 'Marquee Songwriters', emoji: '\uD83C\uDFC6', type: 'genre' },
  { id: 'camp_leaders', name: 'Camp Leaders', emoji: '\uD83C\uDFAA', type: 'genre' },
];

let _cachedData: BrowseData | null = null;
let _cacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

async function fetchBrowseData(): Promise<BrowseData | null> {
  if (_cachedData && Date.now() - _cacheTime < CACHE_TTL) return _cachedData;

  try {
    const res = await fetch(`${R2_BASE}/browse_artists.json`);
    if (!res.ok) return null;
    _cachedData = await res.json() as BrowseData;
    _cacheTime = Date.now();
    return _cachedData;
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const category = req.query.category as string | undefined;
  const searchQuery = (req.query.q as string | undefined)?.toLowerCase();

  const data = await fetchBrowseData();

  // ── No data on R2 yet: return fallback ──
  if (!data) {
    if (!category && !searchQuery) {
      return res.status(200).json({
        categories: FALLBACK_CATEGORIES.map(c => ({
          id: c.id, name: c.name, emoji: c.emoji, type: c.type,
        })),
        source: 'fallback',
        message: 'Artist data populates after the next cascade run. Search by name works now.',
      });
    }

    // Can't filter without data
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
    return res.status(200).json({
      artists: [],
      total: 0,
      source: 'fallback',
      message: 'Artist browse data not yet available. Will populate after next cascade run.',
    });
  }

  // ── No filters: return category index ──
  // Only expose showcases + curated ND categories (marquee, camp_leaders)
  const ALLOWED_GENRE_CATS = new Set(['marquee', 'camp_leaders']);

  if (!category && !searchQuery) {
    // Handle categories as array or object
    const allCats = Array.isArray(data.categories)
      ? data.categories.map((c: any) => ({
          id: c.id || c.name, name: c.name || c.id, emoji: c.emoji || '',
          type: c.type || '', count: c.count || (c.artists?.length || 0),
        }))
      : Object.entries(data.categories || {}).map(([id, cat]: [string, any]) => ({
          id, ...cat,
        }));

    // Filter: keep showcases + whitelisted genre categories
    const cats = allCats.filter((c: any) => c.type === 'showcase' || ALLOWED_GENRE_CATS.has(c.id));

    // Count total artists across all categories
    let totalArtists = data.artists?.length || 0;
    if (totalArtists === 0 && Array.isArray(data.categories)) {
      const seen = new Set<string>();
      for (const c of data.categories) {
        for (const a of (c.artists || [])) seen.add(a.name);
      }
      totalArtists = seen.size;
    }

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=120');
    return res.status(200).json({
      categories: cats,
      total_artists: totalArtists,
      generated_at: data.generated_at,
      source: 'r2',
    });
  }

  // Build flat artist list — R2 may have artists at top level OR nested in categories
  let artists: BrowseArtist[] = data.artists || [];
  const categoriesArr = Array.isArray(data.categories) ? data.categories : [];
  if (artists.length === 0 && categoriesArr.length > 0) {
    // Extract artists from category objects
    const seen = new Set<string>();
    for (const cat of categoriesArr) {
      for (const a of (cat.artists || [])) {
        if (!seen.has(a.name)) {
          seen.add(a.name);
          artists.push({ ...a, categories: [...(a.categories || []), cat.id || cat.name] });
        }
      }
    }
  }

  // ── Search mode ──
  if (searchQuery) {
    const filtered = artists.filter(a =>
      (a.name || '').toLowerCase().includes(searchQuery) ||
      (a.spotify_genres || []).some(g => g.toLowerCase().includes(searchQuery)) ||
      (a.camp_name || '').toLowerCase().includes(searchQuery)
    );

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    return res.status(200).json({
      query: searchQuery,
      results: filtered.slice(0, 100),
      total: filtered.length,
      source: 'r2',
    });
  }

  // ── Category mode ──
  // Find category in the array (not object lookup)
  const catObj = categoriesArr.find((c: any) => c.id === category || c.name === category);
  if (!catObj) {
    return res.status(400).json({
      error: `Unknown category: ${category}`,
      categories: categoriesArr.map((c: any) => c.id || c.name),
    });
  }

  // If category has its own artists array, use those directly — no cap for showcases
  const isShowcase = (catObj.type || '') === 'showcase';
  const matched = catObj.artists?.length > 0
    ? (isShowcase ? catObj.artists : catObj.artists.slice(0, 200))
    : artists.filter(a => (a.categories || []).includes(category!));

  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=120');
  return res.status(200).json({
    category: { id: category, name: catObj.name || category, emoji: catObj.emoji || '', type: catObj.type || '', count: matched.length },
    artists: matched,
    total: matched.length,
    source: 'r2',
  });
}
