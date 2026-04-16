import { useState, useEffect, useRef, useMemo } from 'react';
import ComingSoon from './ComingSoon';
import type { TrackItem } from '../lib/spotify';
import { NASHVILLE_SEED_ARTISTS, releasesToTrackItems, type NashvilleRelease } from '../lib/sources/nashville';
import { supabase } from '../lib/supabase';

interface ShowcaseCategory {
  id: string;
  name: string;
  emoji: string;
  type: string;
  count: number;
}

interface Props {
  showcases: ShowcaseCategory[];
  onImport: (tracks: TrackItem[]) => void;
  activeShowcase: string | null;
  onActiveShowcaseChange: (id: string | null) => void;
}

export default function NashvilleReleases({ showcases, onImport, activeShowcase, onActiveShowcaseChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [releases, setReleases] = useState<NashvilleRelease[]>([]);
  const [week, setWeek] = useState('');
  const [error, setError] = useState('');
  const [generatedAt, setGeneratedAt] = useState('');
  const [progress, setProgress] = useState({ current: 0, total: 0, found: 0 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const scanning = useRef(false);

  // Week selector
  const [availableWeeks, setAvailableWeeks] = useState<string[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);

  // Sort state
  const [sortBy, setSortBy] = useState<'artist' | 'date' | 'title'>('artist');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Progressive rendering — start with 50 artists, load more on demand
  const [renderLimit, setRenderLimit] = useState(50);

  // Search — queries full Nashville universe via API when 3+ chars
  const [searchQuery, setSearchQuery] = useState('');
  const [universeResults, setUniverseResults] = useState<{ name: string; hasRelease: boolean }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // View mode: list or grid tiles
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [tileSize, setTileSize] = useState(() => {
    try { return parseInt(localStorage.getItem('nr_tile_size') || '160'); } catch { return 160; }
  });

  // On narrow viewports, force 2-column grid instead of auto-fill with unpredictable sizing
  const isMobileGrid = typeof window !== 'undefined' && window.innerWidth < 500;
  const effectiveTileSize = isMobileGrid ? Math.min(tileSize, 140) : tileSize;

  // Coming Soon toggle — shows future-dated releases
  const [showComingSoon, setShowComingSoon] = useState(false);

  // Wave 7 Block 8 — Instagram handles. Max's hand-labeled handles live
  // in the `instagram_handles` Supabase table (per memory:
  // feedback_social_handle_trust — his hand labels are ground truth, MB
  // / Wikidata / LLM handles are not trusted). The old "📎 Add handle"
  // admin affordance + handle input form + session-local confirmation
  // set have all been ripped out in favor of simply *displaying* the
  // known handle underneath the artist name on each tile. If no handle
  // is on file, render nothing — no placeholder, no prompt to add one.
  const [igHandles, setIgHandles] = useState<Map<string, string>>(new Map());

  // Showcase filter state — lifted to parent so it survives remounts
  const [showcaseArtists, setShowcaseArtists] = useState<Set<string>>(new Set());
  const [loadingShowcase, setLoadingShowcase] = useState(false);

  // Fetch ALL showcase artist lists — with localStorage data cache (stale-while-revalidate)
  const SHOWCASE_CACHE_KEY = 'showcase_artists_data_cache';
  const SHOWCASE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  const [allShowcaseArtists, setAllShowcaseArtists] = useState<Map<string, Set<string>>>(() => {
    // Hydrate from cache immediately for instant rendering
    try {
      const raw = localStorage.getItem(SHOWCASE_CACHE_KEY);
      if (raw) {
        const { data, timestamp } = JSON.parse(raw);
        if (Date.now() - timestamp < SHOWCASE_CACHE_TTL && data) {
          const map = new Map<string, Set<string>>();
          for (const [k, v] of Object.entries(data)) map.set(k, new Set(v as string[]));
          return map;
        }
      }
    } catch { /* no cache */ }
    return new Map();
  });
  useEffect(() => {
    if (showcases.length === 0) return;
    let cancelled = false;
    const fetched = new Map<string, Set<string>>();
    Promise.all(
      showcases.filter(s => s.type === 'showcase').map(s =>
        fetch(`/api/browse-artists?category=${s.id}`)
          .then(r => r.json())
          .then(d => {
            const names = new Set<string>((d.artists || []).map((a: { name: string }) => a.name.toLowerCase()));
            fetched.set(s.id, names);
          })
          .catch(() => {})
      )
    ).then(() => {
      if (!cancelled) {
        setAllShowcaseArtists(fetched);
        // Persist to localStorage for instant hydration next time
        try {
          const serializable: Record<string, string[]> = {};
          for (const [k, v] of fetched) serializable[k] = [...v];
          localStorage.setItem(SHOWCASE_CACHE_KEY, JSON.stringify({ data: serializable, timestamp: Date.now() }));
        } catch { /* quota */ }
      }
    });
    return () => { cancelled = true; };
  }, [showcases]);

  // When a showcase is selected, use pre-fetched artist list (or fetch on demand)
  useEffect(() => {
    if (!activeShowcase) { setShowcaseArtists(new Set()); return; }
    const cached = allShowcaseArtists.get(activeShowcase);
    if (cached) { setShowcaseArtists(cached); return; }
    setLoadingShowcase(true);
    fetch(`/api/browse-artists?category=${activeShowcase}`)
      .then(r => r.json())
      .then(d => {
        const names = new Set<string>((d.artists || []).map((a: { name: string }) => a.name.toLowerCase()));
        setShowcaseArtists(names);
      })
      .catch(() => setShowcaseArtists(new Set()))
      .finally(() => setLoadingShowcase(false));
  }, [activeShowcase, allShowcaseArtists]);

  // Debounced search across the full Nashville universe
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (searchQuery.length < 3) { setUniverseResults([]); return; }
    setSearchLoading(true);
    searchTimer.current = setTimeout(() => {
      fetch(`/api/browse-artists?q=${encodeURIComponent(searchQuery.trim())}`)
        .then(r => r.json())
        .then(d => {
          const releaseArtists = new Set(
            releases.map(r => (r.artist_name || '').split(/,|feat\.|ft\./i)[0].trim().toLowerCase())
          );
          const results = ((d.results || []) as { name: string }[]).map(a => ({
            name: a.name,
            hasRelease: releaseArtists.has(a.name.toLowerCase()),
          }));
          // Sort: artists with releases first
          results.sort((a, b) => (b.hasRelease ? 1 : 0) - (a.hasRelease ? 1 : 0));
          setUniverseResults(results);
        })
        .catch(() => setUniverseResults([]))
        .finally(() => setSearchLoading(false));
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchQuery, releases]);

  const runScan = async () => {
    if (scanning.current) return;
    scanning.current = true;
    setLoading(true);
    setError('');
    setReleases([]);

    // Build full artist universe: seed artists first, then all showcase artists from R2
    const seedSet = new Set(NASHVILLE_SEED_ARTISTS.map(n => n.toLowerCase()));
    const universeNames = [...NASHVILLE_SEED_ARTISTS];
    for (const artistSet of allShowcaseArtists.values()) {
      for (const name of artistSet) {
        if (!seedSet.has(name)) {
          seedSet.add(name);
          // Capitalize for display — the set stores lowercase
          universeNames.push(name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '));
        }
      }
    }

    const totalArtists = universeNames.length;
    const allReleases: NashvilleRelease[] = [];
    const seenKeys = new Set<string>(); // dedup across Spotify + Apple
    setProgress({ current: 0, total: totalArtists, found: 0 });

    // Target Friday: use selected week or compute last Friday
    const targetFriday = selectedWeek || undefined;

    // Scan both Spotify and Apple Music in parallel batches
    const spotifyBatchSize = 50; // scan-artists accepts up to 200
    const appleBatchSize = 50;   // search-apple accepts up to 100

    const addTrack = (t: any) => {
      const key = `${(t.artist_names || '').toLowerCase()}|${(t.album_name || '').toLowerCase()}`;
      if (seenKeys.has(key)) return;
      seenKeys.add(key);
      allReleases.push({
        pg_id: t.artist_id || '',
        artist_name: t.artist_names,
        track_name: t.track_name,
        album_name: t.album_name,
        release_type: t.album_type || 'single',
        release_date: t.release_date,
        spotify_track_id: t.track_id || '',
        spotify_track_uri: t.track_uri || '',
        spotify_album_id: t.album_spotify_id || '',
        cover_art_url: t.cover_art_640 || '',
        cover_art_300: t.cover_art_300 || '',
        track_number: t.track_number || 1,
        duration_ms: t.duration_ms || 0,
        explicit: t.explicit || false,
        total_tracks: t.total_tracks || 1,
        is_charting: false,
        composer_name: t.composer_name || null,
      });
    };

    for (let i = 0; i < totalArtists; i += spotifyBatchSize) {
      const batch = universeNames.slice(i, i + spotifyBatchSize);
      setProgress({ current: Math.min(i + spotifyBatchSize, totalArtists), total: totalArtists, found: allReleases.length });

      // Run Spotify + Apple Music in parallel for each batch
      const body = { artistNames: batch, ...(targetFriday ? { targetFriday } : {}) };
      const [spotifyResp, appleResp] = await Promise.allSettled([
        fetch('/api/scan-artists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch('/api/search-apple', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, artistNames: batch.slice(0, appleBatchSize) }),
        }).then(r => r.ok ? r.json() : null).catch(() => null),
      ]);

      const spotifyData = spotifyResp.status === 'fulfilled' ? spotifyResp.value : null;
      const appleData = appleResp.status === 'fulfilled' ? appleResp.value : null;

      if (spotifyData?.tracks) for (const t of spotifyData.tracks) addTrack(t);
      if (appleData?.tracks) for (const t of appleData.tracks) addTrack(t);
    }

    setReleases(allReleases);
    setWeek(targetFriday || new Date().toISOString().split('T')[0]);
    setGeneratedAt(new Date().toISOString());
    setProgress({ current: totalArtists, total: totalArtists, found: allReleases.length });
    if (allReleases.length === 0) setError('No new releases found this week from Nashville artists.');
    setLoading(false);
    scanning.current = false;
  };

  // On mount: check Supabase cache for this week's releases
  useEffect(() => {
    (async () => {
      try {
        if (!supabase) return;
        // Fetch available weeks
        const { data: weekRows } = await supabase
          .from('weekly_nashville_releases')
          .select('scan_week')
          .order('scan_week', { ascending: false });
        if (weekRows) {
          const uniqueWeeks = [...new Set(weekRows.map(r => r.scan_week))];
          setAvailableWeeks(uniqueWeeks);
          if (!selectedWeek && uniqueWeeks.length > 0) setSelectedWeek(uniqueWeeks[0]);
        }
        // Load releases for selected week (or most recent)
        const weekFilter = selectedWeek || (weekRows?.[0]?.scan_week);
        let query = supabase.from('weekly_nashville_releases').select('*').order('artist_name');
        if (weekFilter) query = query.eq('scan_week', weekFilter);
        const { data, error: err } = await query;
        if (!err && data && data.length > 0) {
          const mapped: NashvilleRelease[] = data.map(r => ({
            pg_id: r.spotify_artist_id || '',
            artist_name: r.artist_name,
            track_name: r.track_name,
            album_name: r.album_name,
            release_type: r.album_type || 'single',
            release_date: r.release_date,
            spotify_track_id: r.track_id,
            spotify_album_id: r.album_id || '',
            cover_art_url: r.cover_art_640 || '',
            cover_art_300: r.cover_art_300 || '',
            track_number: r.track_number || 1,
            duration_ms: r.duration_ms || 0,
            explicit: r.explicit || false,
            total_tracks: r.total_tracks || 1,
            is_charting: false,
            composer_name: r.composer_name || null,
          }));
          setReleases(mapped);
          setWeek(data[0]?.scan_week || '');
          setGeneratedAt(data[0]?.scanned_at || '');
        }
      } catch { /* no cache, user can trigger scan */ }
    })();
  }, [selectedWeek]);

  // Split current vs future releases — use selected week's dates (not always today)
  const today = new Date().toISOString().split('T')[0];
  // When viewing a past week, use that week's Friday as the reference point
  const viewingWeek = selectedWeek || (() => {
    const d = new Date();
    const day = d.getDay();
    const diff = day >= 5 ? day - 5 : day + 2;
    d.setDate(d.getDate() - diff);
    return d.toISOString().split('T')[0];
  })();
  // Show releases from Thursday before the viewing week through today
  const weekCutoff = new Date(viewingWeek);
  weekCutoff.setDate(weekCutoff.getDate() - 1); // Include Thursday night drops
  const cutoffStr = weekCutoff.toISOString().split('T')[0];
  // This Week: released between last Thursday and today (not future-dated)
  const currentReleases = releases.filter(r => {
    const rd = r.release_date || '';
    return rd >= cutoffStr && rd <= today;
  });
  // Coming Soon: anything with a release date after today
  const comingSoonReleases = releases.filter(r => (r.release_date || '') > today);

  // Apply showcase + search filters to the active set
  const filtered = (() => {
    let list = showComingSoon ? comingSoonReleases : currentReleases;
    if (activeShowcase && showcaseArtists.size > 0) {
      list = list.filter(r => {
        const primary = (r.artist_name || '').split(/,|feat\.|ft\./i)[0].trim().toLowerCase();
        return showcaseArtists.has(primary);
      });
    }
    if (searchQuery.length >= 2) {
      const q = searchQuery.toLowerCase();
      list = list.filter(r =>
        r.artist_name.toLowerCase().includes(q) ||
        r.track_name.toLowerCase().includes(q) ||
        r.album_name.toLowerCase().includes(q)
      );
    }
    return list;
  })();

  // Count releases (unique albums) vs tracks (individual songs)
  const countStats = (items: NashvilleRelease[]) => {
    const albumIds = new Set(items.map(r => r.spotify_album_id || `${r.artist_name}_${r.album_name}`));
    return { releases: albumIds.size, tracks: items.length };
  };
  const filteredStats = countStats(filtered);

  // Per-showcase stats: count releases/tracks for each showcase against current releases
  const baseReleases = showComingSoon ? comingSoonReleases : currentReleases;
  const showcaseStats = useMemo(() => {
    if (allShowcaseArtists.size === 0 || baseReleases.length === 0) return new Map<string, { releases: number; tracks: number }>();
    const stats = new Map<string, { releases: number; tracks: number }>();
    for (const [scId, artistSet] of allShowcaseArtists) {
      const matched = baseReleases.filter(r => {
        const primary = (r.artist_name || '').split(/,|feat\.|ft\./i)[0].trim().toLowerCase();
        return artistSet.has(primary);
      });
      const albumIds = new Set(matched.map(r => r.spotify_album_id || `${r.artist_name}_${r.album_name}`));
      stats.set(scId, { releases: albumIds.size, tracks: matched.length });
    }
    return stats;
  }, [allShowcaseArtists, baseReleases]);

  // Sort showcases by this week's representation (most releases first)
  const sortedShowcases = useMemo(() => {
    return [...showcases].sort((a, b) => {
      const aStats = showcaseStats.get(a.id);
      const bStats = showcaseStats.get(b.id);
      return (bStats?.releases || 0) - (aStats?.releases || 0);
    });
  }, [showcases, showcaseStats]);

  // Group by album
  const albumGroups = (() => {
    const map = new Map<string, NashvilleRelease[]>();
    for (const r of filtered) {
      const key = r.spotify_album_id || `${r.artist_name}_${r.album_name}`;
      const arr = map.get(key) || [];
      arr.push(r);
      map.set(key, arr);
    }
    const groups = [...map.entries()].map(([key, tracks]) => ({
      key,
      album: tracks[0].album_name,
      artist: tracks[0].artist_name,
      type: tracks[0].release_type,
      cover: tracks[0].cover_art_300,
      date: tracks[0].release_date,
      tracks,
    }));
    // Apply sort to album groups (used by grid view)
    const dir = sortDir === 'asc' ? 1 : -1;
    if (sortBy === 'artist') groups.sort((a, b) => dir * a.artist.localeCompare(b.artist));
    else if (sortBy === 'date') groups.sort((a, b) => dir * (a.date || '').localeCompare(b.date || ''));
    else if (sortBy === 'title') groups.sort((a, b) => dir * a.album.localeCompare(b.album));
    return groups;
  })();

  // Group by artist → releases
  const artistGroups = (() => {
    const map = new Map<string, typeof albumGroups>();
    for (const g of albumGroups) {
      const artistKey = (g.artist || '').split(/,|feat\.|ft\./i)[0].trim();
      const arr = map.get(artistKey) || [];
      arr.push(g);
      map.set(artistKey, arr);
    }
    const artists = [...map.entries()].map(([name, releases]) => ({
      name,
      releases: releases.sort((a, b) => (a.date || '').localeCompare(b.date || '')),
      cover: releases[0].cover,
      trackCount: releases.reduce((sum, r) => sum + r.tracks.length, 0),
    }));
    const dir = sortDir === 'asc' ? 1 : -1;
    if (sortBy === 'artist') artists.sort((a, b) => dir * a.name.localeCompare(b.name));
    else if (sortBy === 'date') artists.sort((a, b) => dir * (a.releases[0]?.date || '').localeCompare(b.releases[0]?.date || ''));
    else if (sortBy === 'title') artists.sort((a, b) => dir * (a.releases[0]?.album || '').localeCompare(b.releases[0]?.album || ''));
    return artists;
  })();

  // Flat album list used by selectAll
  void albumGroups; // referenced by artistGroups

  // Wave 7 Block 8 — bulk-fetch Instagram handles for every primary
  // artist currently in view. Max's ground-truth handles live in the
  // `instagram_handles` Supabase table. One query per artistGroups
  // change, keyed on the lowercased artist name (matches how the
  // display code looks them up).
  useEffect(() => {
    if (!supabase || artistGroups.length === 0) return;
    let cancelled = false;
    const names = artistGroups.map(a => a.name);
    (async () => {
      try {
        const { data } = await supabase
          .from('instagram_handles')
          .select('artist_name, instagram_handle')
          .in('artist_name', names);
        if (cancelled || !data) return;
        const next = new Map<string, string>();
        for (const row of data) {
          const key = (row.artist_name || '').toLowerCase();
          if (key && row.instagram_handle) next.set(key, row.instagram_handle);
        }
        setIgHandles(next);
      } catch { /* table missing or offline — show nothing */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artistGroups.length, JSON.stringify(artistGroups.map(a => a.name))]);

  // Selected items with track names for the persistence bar
  const selectedItems = (() => {
    const items: { trackId: string; artist: string; track: string }[] = [];
    for (const trackId of selected) {
      const r = releases.find(rel => rel.spotify_track_id === trackId);
      if (r) items.push({ trackId, artist: (r.artist_name || '').split(/,|feat\./i)[0].trim(), track: r.track_name });
    }
    return items;
  })();

  const toggleSelect = (trackId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(trackId)) next.delete(trackId); else next.add(trackId);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(filtered.map(r => r.spotify_track_id)));
  };

  const handleImportSelected = () => {
    const toImport = selected.size > 0
      ? filtered.filter(r => selected.has(r.spotify_track_id))
      : filtered;
    onImport(releasesToTrackItems(toImport));
  };

  // Showcase filter dropdown — Wave 7 Block 6: bumped min-height to 44px
  // per Apple HIG (was 41px, off by 3). Added aria-label for accessibility.
  const showcaseDropdown = showcases.length > 0 ? (
    <select
      value={activeShowcase || ''}
      onChange={e => onActiveShowcaseChange(e.target.value || null)}
      aria-label="Filter by showcase"
      style={{
        background: 'var(--midnight)', border: '1px solid var(--midnight-border)',
        borderRadius: 8, color: 'var(--text-secondary)', padding: '10px 12px',
        fontSize: 'var(--fs-sm)', fontFamily: 'var(--font-mono)',
        width: '100%', marginBottom: 12, minHeight: 44,
      }}
    >
      <option value="">All Nashville ({filteredStats.releases} releases, {filteredStats.tracks} tracks)</option>
      {sortedShowcases.map(s => {
        const stats = showcaseStats.get(s.id);
        const label = stats && stats.releases > 0
          ? `${s.emoji} ${s.name} (${stats.releases} releases, ${stats.tracks} tracks)`
          : `${s.emoji} ${s.name}`;
        return <option key={s.id} value={s.id}>{label}</option>;
      })}
    </select>
  ) : null;

  const showcasePills = showcaseDropdown;

  if (!loading && releases.length === 0 && !error) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        {showcasePills}
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-lg)', marginBottom: 12 }}>
          Scan {allShowcaseArtists.size > 0 ? (() => { const s = new Set(NASHVILLE_SEED_ARTISTS.map(n => n.toLowerCase())); for (const set of allShowcaseArtists.values()) for (const n of set) s.add(n); return s.size; })().toLocaleString() : NASHVILLE_SEED_ARTISTS.length} Nashville artists for new releases (Spotify + Apple Music).
        </p>
        <button
          className="btn btn-gold"
          onClick={runScan}
          style={{ fontSize: 'var(--fs-lg)', padding: '14px 32px' }}
        >
          Scan Nashville Releases
        </button>
        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: 12 }}>
          Searches Spotify and Apple Music catalogs. Covers all showcase artists from ND. Takes a few minutes for the full universe.
        </p>
      </div>
    );
  }

  if (loading) {
    const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <p style={{ color: 'var(--gold)', fontSize: 'var(--fs-lg)', fontWeight: 600, marginBottom: 12 }}>
          Scanning Nashville Artists...
        </p>
        <div className="progress-bar" style={{ marginBottom: 12, maxWidth: 400, margin: '0 auto 12px' }}>
          <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <p className="mono" style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-md)' }}>
          {progress.current}/{progress.total} {progress.total === 1 ? 'artist' : 'artists'} scanned &middot; {progress.found} {progress.found === 1 ? 'release' : 'releases'} found
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-xs)', marginTop: 8 }}>
          {pct < 30 ? 'Getting started...' : pct < 70 ? 'Making progress...' : 'Almost done...'}
        </p>
      </div>
    );
  }

  if (error && releases.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)', marginBottom: 8 }}>{error}</p>
        <button className="btn btn-sm" onClick={runScan} style={{ marginTop: 8 }}>Try Again</button>
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'left' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <span style={{ fontSize: 'var(--fs-lg)', fontWeight: 600 }}>
            Nashville Releases
          </span>
          {availableWeeks.length > 1 ? (
            <select
              value={selectedWeek || ''}
              onChange={e => setSelectedWeek(e.target.value)}
              aria-label="Select scan week"
              style={{
                fontSize: 'var(--fs-sm)', color: 'var(--text-muted)',
                background: 'var(--midnight)', border: '1px solid var(--midnight-border)',
                borderRadius: 6, padding: isMobileGrid ? '8px 10px' : '2px 6px',
                marginLeft: 8,
                minHeight: isMobileGrid ? 44 : undefined,
              }}>
              {availableWeeks.map(w => <option key={w} value={w}>Week of {w}</option>)}
            </select>
          ) : week && <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginLeft: 8 }}>Week of {week}</span>}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={selectAll} style={{ fontSize: 'var(--fs-sm)', color: 'var(--steel)', cursor: 'pointer', background: 'none', border: 'none', fontWeight: 600 }}>
            Select All
          </button>
          {selected.size > 0 && (
            <button onClick={() => setSelected(new Set())} style={{ fontSize: 'var(--fs-sm)', color: 'var(--mmmc-red)', cursor: 'pointer', background: 'none', border: 'none', fontWeight: 600 }}>
              Clear ({selected.size})
            </button>
          )}
          <button
            onClick={handleImportSelected}
            disabled={filtered.length === 0}
            style={{
              padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'var(--gold)', color: '#000', fontWeight: 600, fontSize: 'var(--fs-sm)',
              opacity: filtered.length === 0 ? 0.4 : 1,
            }}
          >
            Import {selected.size > 0 ? `${selected.size} tracks` : `${filteredStats.releases} releases`}
          </button>
        </div>
      </div>

      {/* Selection persistence bar */}
      {selectedItems.length > 0 && (
        <div style={{
          padding: '8px 12px', marginBottom: 10, borderRadius: 8,
          background: 'rgba(212,168,67,0.08)', border: '1px solid var(--gold-dark)',
          display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--gold)', fontWeight: 600 }}>
            {selectedItems.length} selected:
          </span>
          {selectedItems.map(item => (
            <span key={item.trackId} style={{
              fontSize: 'var(--fs-2xs)', background: 'var(--gold)', color: 'var(--midnight)',
              padding: '2px 8px', borderRadius: 10, fontWeight: 600,
              display: 'inline-flex', alignItems: 'center', gap: 4, maxWidth: 200,
            }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.artist} — {item.track}
              </span>
              <button onClick={() => toggleSelect(item.trackId)} style={{
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--midnight)',
                fontSize: 12, lineHeight: 1, padding: '4px', minWidth: 24, minHeight: 24,
              }}>&times;</button>
            </span>
          ))}
          <button onClick={() => setSelected(new Set())}
            style={{ fontSize: 'var(--fs-2xs)', color: 'var(--mmmc-red)', cursor: 'pointer', marginLeft: 'auto', background: 'none', border: 'none' }}>
            Clear All
          </button>
        </div>
      )}

      {/* Search + View toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
        <input
          type="text"
          className="search-input"
          placeholder="Search artists, tracks, albums..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ flex: 1, fontSize: 'var(--fs-sm)', padding: '8px 12px', minWidth: 0 }}
        />
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          <button
            onClick={() => setViewMode('list')}
            title="List view"
            style={{
              padding: '6px 10px', borderRadius: '6px 0 0 6px', cursor: 'pointer',
              background: viewMode === 'list' ? 'var(--midnight-hover)' : 'var(--midnight)',
              border: viewMode === 'list' ? '1px solid var(--gold)' : '1px solid var(--midnight-border)',
              color: viewMode === 'list' ? 'var(--gold)' : 'var(--text-muted)',
              fontSize: 'var(--fs-sm)',
            }}
          >☰</button>
          <button
            onClick={() => setViewMode('grid')}
            title="Grid view"
            style={{
              padding: '6px 10px', borderRadius: '0 6px 6px 0', cursor: 'pointer',
              background: viewMode === 'grid' ? 'var(--midnight-hover)' : 'var(--midnight)',
              border: viewMode === 'grid' ? '1px solid var(--gold)' : '1px solid var(--midnight-border)',
              color: viewMode === 'grid' ? 'var(--gold)' : 'var(--text-muted)',
              fontSize: 'var(--fs-sm)',
            }}
          >⊞</button>
        </div>
        {viewMode === 'grid' && !isMobileGrid && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <button onClick={() => { const v = Math.max(100, tileSize - 30); setTileSize(v); localStorage.setItem('nr_tile_size', String(v)); }}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14 }}>&#8722;</button>
            <input type="range" min="100" max="250" value={tileSize}
              onChange={e => { const v = Number(e.target.value); setTileSize(v); localStorage.setItem('nr_tile_size', String(v)); }}
              onDoubleClick={() => { setTileSize(160); localStorage.setItem('nr_tile_size', '160'); }}
              style={{ width: 50 }} title={`Tile size: ${tileSize}px`} />
            <button onClick={() => { const v = Math.min(250, tileSize + 30); setTileSize(v); localStorage.setItem('nr_tile_size', String(v)); }}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14 }}>+</button>
          </div>
        )}
      </div>

      {/* View toggle: This Week / Coming Soon — Wave 7 Block 7: added
          flexWrap so long track-count labels can spill to a second row
          on narrow viewports instead of overflowing horizontally. Touch
          targets are already handled by the global .filter-pill rule
          at global.css line 458 (min-height: 44px at max-width: 767px). */}
      {comingSoonReleases.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          <button className={`filter-pill ${!showComingSoon ? 'active' : ''}`}
            onClick={() => setShowComingSoon(false)}
            style={{ fontSize: 'var(--fs-xs)', padding: '4px 12px' }}>
            This Week ({currentReleases.length} {currentReleases.length === 1 ? 'track' : 'tracks'})
          </button>
          <button className={`filter-pill ${showComingSoon ? 'active' : ''}`}
            onClick={() => setShowComingSoon(true)}
            style={{ fontSize: 'var(--fs-xs)', padding: '4px 12px' }}>
            🔮 Coming Soon ({comingSoonReleases.length})
          </button>
        </div>
      )}

      {/* Coming Soon section — only when Coming Soon tab is active */}
      {showComingSoon && comingSoonReleases.length > 0 && (
        <ComingSoon
          releases={comingSoonReleases.map(r => ({
            artist_name: r.artist_name,
            album_name: r.album_name,
            track_name: r.track_name,
            release_date: r.release_date,
            cover_art_url: r.cover_art_url,
            cover_art_300: r.cover_art_300,
            release_type: r.release_type,
            spotify_track_id: r.spotify_track_id,
            spotify_album_id: r.spotify_album_id,
          }))}
          showcaseArtists={allShowcaseArtists}
          showcases={showcases.filter(s => s.type === 'showcase')}
        />
      )}

      {/* This Week grid view — hidden when Coming Soon is active */}
      {!showComingSoon && (<>
      {/* Sort controls */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)' }}>Sort:</span>
        {(['artist', 'date', 'title'] as const).map(s => (
          <button key={s}
            className={`filter-pill ${sortBy === s ? 'active' : ''}`}
            onClick={() => { if (sortBy === s) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortBy(s); setSortDir('asc'); } }}
            style={{ fontSize: 'var(--fs-2xs)', padding: isMobileGrid ? '8px 14px' : '2px 8px' }}>
            {s.charAt(0).toUpperCase() + s.slice(1)} {sortBy === s ? (sortDir === 'asc' ? '↑' : '↓') : ''}
          </button>
        ))}
      </div>

      {/* Showcase filter dropdown */}
      {showcasePills}
      {loadingShowcase && (
        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginBottom: 8 }}>Loading...</p>
      )}

      {/* Release/track count */}
      {releases.length > 0 && (
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginBottom: 12 }}>
          {`${filteredStats.releases} releases (${filteredStats.tracks} tracks)`}
        </div>
      )}

      {/* Empty state for showcase filter */}
      {activeShowcase && filtered.length === 0 && !loadingShowcase && (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
          No releases this week from {showcases.find(s => s.id === activeShowcase)?.name} artists.
        </div>
      )}

      {/* Universe search results (when searching 3+ chars) */}
      {searchQuery.length >= 3 && (universeResults.length > 0 || searchLoading) && (
        <div style={{ maxHeight: 400, overflowY: 'auto', marginBottom: 12 }}>
          {searchLoading && (
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', padding: 8 }}>Searching Nashville universe...</p>
          )}
          {universeResults.map(r => {
            if (r.hasRelease) return null; // already shown in the release list below
            return (
              <div key={r.name} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 4px',
                borderBottom: '1px solid var(--midnight-border)',
                opacity: 0.6, cursor: 'default',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--midnight-border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)',
                }}>—</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
                    {r.name}
                  </div>
                  <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    No new music this week
                  </div>
                </div>
              </div>
            );
          })}
          {!searchLoading && universeResults.length === 0 && (
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', padding: 8 }}>
              No artists found matching "{searchQuery}"
            </p>
          )}
        </div>
      )}

      {/* Release list / grid — grouped by artist → release → tracks */}
      <div style={isMobileGrid ? {} : { maxHeight: 600, overflowY: 'auto' }}>
        {viewMode === 'grid' ? (
          /* ── Grid tile view ── */
          <div style={{ display: 'grid', gridTemplateColumns: isMobileGrid ? 'repeat(2, minmax(0, 1fr))' : `repeat(auto-fill, minmax(${effectiveTileSize}px, 1fr))`, gap: 10 }}>
            {artistGroups.slice(0, renderLimit).map(artist => {
              const allArtistTracks = artist.releases.flatMap(r => r.tracks);
              const hasSelection = allArtistTracks.some(t => selected.has(t.spotify_track_id));
              const isSingleTrack = allArtistTracks.length === 1;
              const isExpanded = expanded.has(`artist:${artist.name}`);
              return (
                <div key={artist.name} style={{ position: 'relative', alignSelf: 'start' }}>
                  <div
                    onClick={() => {
                      if (isSingleTrack) toggleSelect(allArtistTracks[0].spotify_track_id);
                      else setExpanded(prev => { const key = `artist:${artist.name}`; const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });
                    }}
                    style={{
                      borderRadius: 8, overflow: 'hidden', cursor: 'pointer',
                      border: hasSelection ? '2px solid var(--gold)' : '2px solid transparent',
                      background: hasSelection ? 'rgba(212,168,67,0.06)' : 'var(--midnight)',
                    }}>
                    <div style={{ position: 'relative' }}>
                      <img src={artist.cover || ''} alt=""
                        style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }}
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      {artist.releases.length > 1 && (
                        <span style={{
                          position: 'absolute', top: 6, right: 6, background: 'var(--gold)', color: 'var(--midnight)',
                          fontSize: 'var(--fs-3xs)', fontWeight: 700, padding: '1px 6px', borderRadius: 10,
                        }}>
                          {artist.releases.length} releases
                        </span>
                      )}
                    </div>
                    <div style={{ padding: '6px 8px' }}>
                      <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        color: hasSelection ? 'var(--gold)' : 'var(--text-primary)' }}>
                        {artist.name}
                      </div>
                      <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {artist.trackCount} {artist.trackCount === 1 ? 'track' : 'tracks'}
                        {artist.releases.length > 1 && ` · ${artist.releases.length} releases`}
                      </div>
                      {/* Wave 7 Block 8 — display the known Instagram handle
                          from the `instagram_handles` Supabase table. Max's
                          hand labels are ground truth. If no handle is on
                          file for this artist, render nothing (no placeholder,
                          no "Add handle" affordance). Tapping the handle
                          opens the artist's Instagram profile in a new tab. */}
                      {(() => {
                        const handle = igHandles.get(artist.name.toLowerCase());
                        if (!handle) return null;
                        return (
                          <a
                            href={`https://instagram.com/${handle.replace(/^@/, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            style={{
                              fontSize: 'var(--fs-3xs)',
                              color: 'var(--steel)',
                              textDecoration: 'none',
                              marginTop: 2,
                              display: 'block',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}>
                            @{handle.replace(/^@/, '')}
                          </a>
                        );
                      })()}
                    </div>
                  </div>
                  {/* Artist track picker — shows all releases grouped by album */}
                  {!isSingleTrack && isExpanded && (<>
                    <div onClick={(e) => { e.stopPropagation(); setExpanded(prev => { const n = new Set(prev); n.delete(`artist:${artist.name}`); return n; }); }}
                      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.5)' }} />
                    <div style={{
                      position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
                      zIndex: 101, width: 'min(440px, 90vw)', maxHeight: '75vh',
                      background: 'var(--midnight-raised)', borderRadius: 12,
                      border: '2px solid var(--gold-dark)',
                      display: 'flex', flexDirection: 'column',
                      boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--midnight-border)' }}>
                        {artist.cover && <img src={artist.cover} alt="" style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0 }} />}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--gold)' }}>{artist.name}</div>
                          <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)' }}>{artist.releases.length} {artist.releases.length === 1 ? 'release' : 'releases'} · {artist.trackCount} tracks</div>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); setExpanded(prev => { const n = new Set(prev); n.delete(`artist:${artist.name}`); return n; }); }}
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '0 4px', flexShrink: 0 }}>
                          &times;
                        </button>
                      </div>
                      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
                        {artist.releases.map(rel => (
                          <div key={rel.key}>
                            {/* Release header */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0 4px', borderBottom: '1px solid var(--midnight-border)' }}>
                              {rel.cover && <img src={rel.cover} alt="" style={{ width: 32, height: 32, borderRadius: 4, flexShrink: 0 }} />}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rel.album}</div>
                                <div style={{ fontSize: 'var(--fs-3xs)', color: 'var(--text-muted)' }}>{rel.type} · {rel.date} · {rel.tracks.length} {rel.tracks.length === 1 ? 'track' : 'tracks'}</div>
                              </div>
                            </div>
                            {/* Tracks in this release */}
                            {rel.tracks.sort((a, b) => (a.track_number || 0) - (b.track_number || 0)).map(t => (
                              <div key={t.spotify_track_id}
                                onClick={(e) => { e.stopPropagation(); toggleSelect(t.spotify_track_id); }}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 10, padding: '6px 4px 6px 40px',
                                  cursor: 'pointer', fontSize: 'var(--fs-sm)',
                                  borderBottom: '1px solid rgba(255,255,255,0.03)',
                                }}>
                                <div style={{
                                  width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                                  border: selected.has(t.spotify_track_id) ? '2px solid var(--gold)' : '2px solid var(--midnight-border)',
                                  background: selected.has(t.spotify_track_id) ? 'var(--gold)' : 'transparent',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: 11, color: 'var(--midnight)', fontWeight: 700,
                                }}>
                                  {selected.has(t.spotify_track_id) && '\u2713'}
                                </div>
                                <span style={{ color: 'var(--text-muted)', width: 20, textAlign: 'right', flexShrink: 0, fontSize: 'var(--fs-2xs)' }}>{t.track_number}</span>
                                <span style={{ flex: 1, color: selected.has(t.spotify_track_id) ? 'var(--gold)' : 'var(--text-primary)' }}>
                                  {t.track_name}
                                </span>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>)}
                </div>
              );
            })}
          </div>
        ) : (
          /* ── List view (grouped by artist) ── */
          artistGroups.slice(0, renderLimit).map(artist => (
          <div key={artist.name} style={{ marginBottom: 12 }}>
            {/* Artist header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0',
              borderBottom: '1px solid var(--midnight-border)',
            }}>
              {artist.cover && (
                <img src={artist.cover} alt="" style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0 }} />
              )}
              <span style={{ fontWeight: 700, fontSize: 'var(--fs-md)', color: 'var(--text-primary)' }}>
                {artist.name}
              </span>
              <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)' }}>
                {artist.releases.length} {artist.releases.length === 1 ? 'release' : 'releases'} · {artist.trackCount} {artist.trackCount === 1 ? 'track' : 'tracks'}
              </span>
            </div>
            {/* Releases for this artist */}
            {artist.releases.map(g => {
          const isSingle = g.tracks.length === 1;
          const isExpanded = expanded.has(g.key);
          const titleTrack = g.tracks[0];
          const isSelected = g.tracks.some(t => selected.has(t.spotify_track_id));
          const allSelected = g.tracks.every(t => selected.has(t.spotify_track_id));

          return (
            <div key={g.key} style={{
              borderBottom: '1px solid var(--midnight-border)',
              background: isSelected ? 'rgba(212,168,67,0.06)' : 'transparent',
            }}>
              {/* Album/Single row */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
                cursor: 'pointer',
              }}
                onClick={() => {
                  if (isSingle) {
                    toggleSelect(titleTrack.spotify_track_id);
                  } else {
                    setExpanded(prev => {
                      const next = new Set(prev);
                      if (next.has(g.key)) next.delete(g.key); else next.add(g.key);
                      return next;
                    });
                  }
                }}
              >
                {/* Checkbox */}
                <div style={{
                  width: 20, height: 20, borderRadius: 4, flexShrink: 0,
                  border: allSelected ? '2px solid var(--gold)' : '2px solid var(--midnight-border)',
                  background: allSelected ? 'var(--gold)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, color: 'var(--midnight)',
                }}>
                  {allSelected && '\u2713'}
                </div>

                {g.cover && (
                  <img src={g.cover} alt="" style={{ width: 44, height: 44, borderRadius: 4, flexShrink: 0 }}
                    onError={e => { (e.target as HTMLImageElement).src = '/placeholder-album.svg'; (e.target as HTMLImageElement).onerror = null; }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 'var(--fs-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {isSingle ? titleTrack.track_name : g.album}
                  </div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {g.artist}
                    <span style={{ marginLeft: 6, fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {g.type}
                    </span>
                    {!isSingle && <span> &middot; {g.tracks.length} {g.tracks.length === 1 ? 'track' : 'tracks'}</span>}
                  </div>
                </div>
                {!isSingle && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setExpanded(prev => { const n = new Set(prev); if (n.has(g.key)) n.delete(g.key); else n.add(g.key); return n; }); }}
                    style={{ color: 'var(--gold)', fontSize: 'var(--fs-xs)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, padding: '4px 8px' }}
                  >
                    {isExpanded ? '\u25BE Collapse' : '\u25B8 Expand Tracks'}
                  </button>
                )}
                <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)', flexShrink: 0, width: 50, textAlign: 'right' }}>
                  {g.date?.slice(5) || ''}
                </span>
              </div>

              {/* Expanded tracks for albums/EPs */}
              {!isSingle && isExpanded && (
                <div style={{ paddingLeft: 36, paddingBottom: 8 }}>
                  {[...g.tracks].sort((a, b) => (a.track_number || 0) - (b.track_number || 0)).map(t => (
                    <div key={t.spotify_track_id} style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0',
                      cursor: 'pointer', fontSize: 'var(--fs-xs)',
                    }} onClick={(e) => { e.stopPropagation(); toggleSelect(t.spotify_track_id); }}>
                      <div style={{
                        width: 16, height: 16, borderRadius: 3, flexShrink: 0,
                        border: selected.has(t.spotify_track_id) ? '2px solid var(--gold)' : '2px solid var(--midnight-border)',
                        background: selected.has(t.spotify_track_id) ? 'var(--gold)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, color: 'var(--midnight)',
                      }}>
                        {selected.has(t.spotify_track_id) && '\u2713'}
                      </div>
                      <span style={{ color: 'var(--text-muted)', width: 20, textAlign: 'right' }}>{t.track_number}</span>
                      <span style={{ color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.track_name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
          </div>
        ))
        )}
        {/* Show more button when there are more artists beyond the render limit */}
        {artistGroups.length > renderLimit && (
          <button
            onClick={() => setRenderLimit(prev => prev + 50)}
            className="btn btn-sm"
            style={{ width: '100%', justifyContent: 'center', marginTop: 12, fontSize: 'var(--fs-sm)' }}
          >
            Show more ({artistGroups.length - renderLimit} remaining)
          </button>
        )}
      </div>

      {generatedAt && (
        <div style={{ marginTop: 8, fontSize: 'var(--fs-3xs)', color: 'var(--text-muted)' }}>
          Data generated: {new Date(generatedAt).toLocaleDateString()}
        </div>
      )}
      </>)}
    </div>
  );
}
