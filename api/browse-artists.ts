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

/** Category definitions — used as fallback when R2 file doesn't exist yet */
const FALLBACK_CATEGORIES = [
  { id: 'breaking-through', name: 'Breaking Through', description: 'Rising artists gaining serious momentum right now', emoji: '\uD83D\uDE80' },
  { id: 'the-establishment', name: 'The Establishment', description: 'Nashville\'s proven hitmakers and chart-toppers', emoji: '\uD83C\uDFC6' },
  { id: 'songwriters-round', name: 'Songwriter\'s Round', description: 'The writers behind the hits', emoji: '\u270D\uFE0F' },
  { id: 'neon-rhinestones', name: 'Neon & Rhinestones', description: 'Country-pop crossover artists', emoji: '\u2728' },
  { id: 'outlaw-spirit', name: 'Outlaw Spirit', description: 'Americana, red dirt, and roots rebels', emoji: '\uD83E\uDD20' },
  { id: 'fresh-ink', name: 'Fresh Ink', description: 'Newest voices on Music Row', emoji: '\uD83C\uDF31' },
  { id: 'stadium-country', name: 'Stadium Country', description: 'Arena-filling superstars', emoji: '\uD83C\uDFDF\uFE0F' },
  { id: 'whiskey-jam-alumni', name: 'Whiskey Jam Alumni', description: 'Graduated from Nashville\'s premier showcase', emoji: '\uD83E\uDD43' },
  { id: 'opry-circle', name: 'Opry Circle', description: 'Grand Ole Opry members and regulars', emoji: '\uD83C\uDFB6' },
  { id: 'sleeping-giants', name: 'Sleeping Giants', description: 'Prolific writers flying under the radar', emoji: '\uD83D\uDCA4' },
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
          id: c.id, name: c.name, description: c.description, emoji: c.emoji,
        })),
        source: 'fallback',
        message: 'Browse index not yet generated. Categories available but artist lists require a cascade run.',
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
  if (!category && !searchQuery) {
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=120');
    return res.status(200).json({
      categories: Object.entries(data.categories || {}).map(([id, cat]) => ({
        id, ...cat,
      })),
      total_artists: data.artists?.length || 0,
      generated_at: data.generated_at,
      source: 'r2',
    });
  }

  let artists = data.artists || [];

  // ── Search mode ──
  if (searchQuery) {
    artists = artists.filter(a =>
      a.name.toLowerCase().includes(searchQuery) ||
      (a.spotify_genres || []).some(g => g.toLowerCase().includes(searchQuery)) ||
      (a.camp_name || '').toLowerCase().includes(searchQuery)
    );

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    return res.status(200).json({
      query: searchQuery,
      results: artists.slice(0, 50),
      total: artists.length,
      source: 'r2',
    });
  }

  // ── Category mode ──
  const catMeta = data.categories?.[category!];
  if (!catMeta) {
    return res.status(400).json({
      error: `Unknown category: ${category}`,
      categories: Object.keys(data.categories || {}),
    });
  }

  const matched = artists
    .filter(a => (a.categories || []).includes(category!))
    .sort((a, b) => b.monthly_listeners - a.monthly_listeners)
    .slice(0, 50);

  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=120');
  return res.status(200).json({
    category: { id: category, ...catMeta },
    artists: matched,
    total: matched.length,
    source: 'r2',
  });
}
