import type { VercelRequest, VercelResponse } from '@vercel/node';

const ND_API = process.env.ND_API_BASE_URL || 'https://nd-api.nd-api.workers.dev';

interface NDProfile {
  profile: {
    id: string;
    name: string;
    tier: string;
    tier_display: string;
    arc: string;
    arc_display: string;
    archetype: string;
    archetype_display: string;
    spotify_genres: string[];
    spotify_monthly_listeners: number;
    spotify_followers: number;
    spotify_popularity: number;
    genre: { primary: string; secondary: string };
    camp: { name: string; community_id: number } | null;
    tags: { id: string; label: string; appearances?: number }[];
    velocity: { momentum: string } | null;
    tier_evidence: { credits: number; charting_songs: number; no1_songs: number };
    nashville_relevant: boolean;
  };
}

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
}

/** The browse categories — each with a label, description, and classification logic */
const CATEGORIES = [
  {
    id: 'breaking-through',
    name: 'Breaking Through',
    description: 'Rising artists gaining serious momentum right now',
    emoji: '\uD83D\uDE80',
    filter: (p: NDProfile['profile']) =>
      ['emerging', 'developing', 'active'].includes(p.tier) &&
      p.arc === 'growing' &&
      (p.spotify_monthly_listeners > 50000 || p.spotify_popularity > 30),
  },
  {
    id: 'the-establishment',
    name: 'The Establishment',
    description: 'Nashville\'s proven hitmakers and chart-toppers',
    emoji: '\uD83C\uDFC6',
    filter: (p: NDProfile['profile']) =>
      p.tier === 'marquee' && p.tier_evidence.no1_songs >= 1,
  },
  {
    id: 'songwriters-round',
    name: 'Songwriter\'s Round',
    description: 'The craft — writers who built Nashville from the Bluebird to the Ryman',
    emoji: '\u270D\uFE0F',
    filter: (p: NDProfile['profile']) =>
      p.archetype.includes('writer') &&
      p.tier_evidence.credits >= 30 &&
      p.tags.some(t => ['bluebird_cafe', 'listening_room', 'pin_drop'].includes(t.id)),
  },
  {
    id: 'neon-rhinestones',
    name: 'Neon & Rhinestones',
    description: 'Country-pop crossover — glam, hooks, and radio shine',
    emoji: '\u2728',
    filter: (p: NDProfile['profile']) =>
      p.spotify_genres.some(g =>
        g.includes('country pop') || g.includes('pop country') || g.includes('contemporary country'),
      ) && p.spotify_popularity >= 40,
  },
  {
    id: 'outlaw-spirit',
    name: 'Outlaw Spirit',
    description: 'The raw side — americana, red dirt, outlaw, and roots',
    emoji: '\uD83E\uDE76',
    filter: (p: NDProfile['profile']) =>
      p.spotify_genres.some(g =>
        g.includes('outlaw') || g.includes('americana') || g.includes('red dirt') ||
        g.includes('texas country') || g.includes('country rock'),
      ),
  },
  {
    id: 'fresh-ink',
    name: 'Fresh Ink',
    description: 'Brand new to the scene — first credits in the last 2 years',
    emoji: '\uD83C\uDD95',
    filter: (p: NDProfile['profile']) =>
      ['emerging', 'developing'].includes(p.tier) &&
      p.tier_evidence.credits <= 10 &&
      p.tier_evidence.credits >= 1,
  },
  {
    id: 'stadium-country',
    name: 'Stadium Country',
    description: 'Arena-filling, anthem-making superstars',
    emoji: '\uD83C\uDFDF\uFE0F',
    filter: (p: NDProfile['profile']) =>
      p.spotify_monthly_listeners > 5000000 ||
      (p.tier === 'marquee' && p.spotify_popularity >= 70),
  },
  {
    id: 'whiskey-jam-alumni',
    name: 'Whiskey Jam Alumni',
    description: 'Artists who came up through Nashville\'s legendary Monday night showcase',
    emoji: '\uD83E\uDD43',
    filter: (p: NDProfile['profile']) =>
      p.tags.some(t => t.id === 'whiskey_jam' && (t.appearances || 0) >= 2),
  },
  {
    id: 'opry-circle',
    name: 'The Opry Circle',
    description: 'Grand Ole Opry members and frequent performers',
    emoji: '\uD83C\uDFB5',
    filter: (p: NDProfile['profile']) =>
      p.tags.some(t => t.id === 'opry_member' || (t.id === 'grand_ole_opry' && (t.appearances || 0) >= 3)),
  },
  {
    id: 'sleeping-giants',
    name: 'Sleeping Giants',
    description: 'Prolific writers with deep catalogs you haven\'t discovered yet',
    emoji: '\uD83D\uDCA4',
    filter: (p: NDProfile['profile']) =>
      p.tier_evidence.credits >= 50 &&
      p.spotify_monthly_listeners < 500000 &&
      p.archetype.includes('writer'),
  },
];

/** Fetch a batch of ND profiles by searching common names */
async function fetchArtistBatch(query: string, limit = 50): Promise<NDProfile['profile'][]> {
  const token = await generateNDToken();
  const authParam = token ? `&token=${token}` : '';
  const url = `${ND_API}/api/search?q=${encodeURIComponent(query)}&limit=${limit}${authParam}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const results = data.results || [];

    // Fetch full profiles for each result
    const profiles: NDProfile['profile'][] = [];
    for (const r of results.slice(0, limit)) {
      try {
        const profileUrl = `${ND_API}/api/profile/${r.pg_id}${token ? `?token=${token}` : ''}`;
        const profileRes = await fetch(profileUrl);
        if (profileRes.ok) {
          const profileData = await profileRes.json() as NDProfile;
          if (profileData.profile) profiles.push(profileData.profile);
        }
      } catch { /* skip */ }
      await new Promise(r => setTimeout(r, 50));
    }
    return profiles;
  } catch {
    return [];
  }
}

async function generateNDToken(): Promise<string | null> {
  const secret = process.env.ND_AUTH_TOKEN_SECRET;
  const username = process.env.ND_AUTH_USERNAME;
  if (!secret || !username) return null;

  const today = new Date().toISOString().split('T')[0];
  const payload = `${today}:${username.toLowerCase()}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

function profileToBrowseArtist(p: NDProfile['profile']): BrowseArtist {
  return {
    pg_id: p.id,
    name: p.name,
    tier: p.tier,
    tier_display: p.tier_display,
    arc_display: p.arc_display,
    archetype_display: p.archetype_display,
    spotify_genres: p.spotify_genres || [],
    monthly_listeners: p.spotify_monthly_listeners || 0,
    spotify_popularity: p.spotify_popularity || 0,
    camp_name: p.camp?.name || null,
    no1_songs: p.tier_evidence?.no1_songs || 0,
    credits: p.tier_evidence?.credits || 0,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // GET /api/browse-artists?category=breaking-through
  // GET /api/browse-artists (returns category list only)
  const category = req.query.category as string | undefined;
  const searchQuery = req.query.q as string | undefined;

  // If no category, return the category list
  if (!category && !searchQuery) {
    return res.status(200).json({
      categories: CATEGORIES.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description,
        emoji: c.emoji,
      })),
    });
  }

  // Search mode: search ND and return results with category tags
  if (searchQuery) {
    const profiles = await fetchArtistBatch(searchQuery, 20);
    const results = profiles.map(p => {
      const artist = profileToBrowseArtist(p);
      const matchedCategories = CATEGORIES
        .filter(c => c.filter(p))
        .map(c => ({ id: c.id, name: c.name, emoji: c.emoji }));
      return { ...artist, categories: matchedCategories };
    });

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    return res.status(200).json({ query: searchQuery, results });
  }

  // Category mode: we need to search for artists that match
  const cat = CATEGORIES.find(c => c.id === category);
  if (!cat) {
    return res.status(400).json({ error: `Unknown category: ${category}`, categories: CATEGORIES.map(c => c.id) });
  }

  // For now: search with broad queries that are likely to return artists in this category
  // In the future this should hit a pre-computed index
  // Search terms designed to pull real ND profiles that match each category's filter
  const searchTerms: Record<string, string[]> = {
    'breaking-through': ['ashley cooke', 'ella langley', 'nate smith', 'megan moroney', 'tyler hubbard', 'chayce beckham', 'mackenzie carpenter', 'country'],
    'the-establishment': ['luke combs', 'morgan wallen', 'thomas rhett', 'chris stapleton', 'luke bryan', 'jason aldean', 'carrie underwood', 'kenny chesney'],
    'songwriters-round': ['shane mcanally', 'lori mckenna', 'hillary lindsey', 'ross copperman', 'josh osborne', 'ashley gorley', 'songwriter'],
    'neon-rhinestones': ['kelsea ballerini', 'maren morris', 'carly pearce', 'gabby barrett', 'danielle bradbery', 'pop country'],
    'outlaw-spirit': ['tyler childers', 'sturgill simpson', 'jason isbell', 'colter wall', 'zach bryan', 'americana'],
    'fresh-ink': ['nashville new artist', 'debut', 'first single country', 'emerging artist'],
    'stadium-country': ['morgan wallen', 'luke combs', 'zach bryan', 'lainey wilson', 'chris stapleton', 'kenny chesney', 'eric church'],
    'whiskey-jam-alumni': ['sam hunt', 'maren morris', 'cole swindell', 'kip moore', 'whiskey jam'],
    'opry-circle': ['vince gill', 'reba mcentire', 'darius rucker', 'brad paisley', 'alan jackson', 'opry'],
    'sleeping-giants': ['songwriter nashville', 'publishing writer', 'credits nashville', 'nashville catalog'],
  };

  const terms = searchTerms[category] || ['nashville country'];
  const allProfiles: NDProfile['profile'][] = [];

  for (const term of terms) {
    const batch = await fetchArtistBatch(term, 30);
    allProfiles.push(...batch);
  }

  // Deduplicate by id
  const seen = new Set<string>();
  const unique = allProfiles.filter(p => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  // Filter by category logic
  const matched = unique
    .filter(p => cat.filter(p))
    .map(profileToBrowseArtist)
    .sort((a, b) => b.monthly_listeners - a.monthly_listeners)
    .slice(0, 50);

  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=120');
  return res.status(200).json({
    category: { id: cat.id, name: cat.name, description: cat.description, emoji: cat.emoji },
    artists: matched,
    total: matched.length,
  });
}
