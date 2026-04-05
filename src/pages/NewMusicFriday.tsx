import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { startAuth, exchangeCode, getToken, clearToken, refreshToken, isTokenExpired } from '../lib/auth';
import {
  fetchFollowedArtists,
  fetchNewReleases,
  getLastFriday,
  getScanCutoff,
  groupIntoReleases,
  replacePlaylistTracks,
  appendPlaylistTracks,
  getPlaylistName,
  createPlaylist,
  type TrackItem,
  type ReleaseCluster,
} from '../lib/spotify';
import {
  type SelectionSlot,
  buildSlots,
  getSlideGroup,
} from '../lib/selection';
import { downloadJSON, downloadCSV, downloadArt } from '../lib/downloads';
import { saveWeek, saveFeatures, getFeatureCounts, type NMFWeek } from '../lib/supabase';
import { batchResolveAppleMusic } from '../lib/apple-music';
import ClusterCard from '../components/ClusterCard';
import FilterBar from '../components/FilterBar';
import PlaylistCreate from '../components/PlaylistCreate';
import CarouselPreviewPanel from '../components/CarouselPreviewPanel';
import TagBlocks from '../components/TagBlocks';
import WeekHistory from '../components/WeekHistory';
import EmbedWidget from '../components/EmbedWidget';
import ProductNav from '../components/ProductNav';
import SourceSelector from '../components/SourceSelector';
import ManualImport from '../components/ManualImport';
import type { MusicSource } from '../lib/sources/types';
import { checkScanHealth } from '../lib/spotify';
import { useAuth } from '../lib/auth-context';

type Phase = 'auth' | 'ready' | 'scanning' | 'results';
type FilterKey = 'all' | 'single' | 'album';
type SortKey = 'date' | 'artist' | 'title';

const PLAYLIST_ID = '0ve1vYFkWoRaElCmfkw2IB';

const DEMO_TRACKS: TrackItem[] = [
  { track_id: 'demo1', track_uri: 'spotify:track:demo1', track_name: 'Never Wanted To Know', track_number: 1, artist_names: 'Ashley Cooke', artist_id: '0z2HJSBPqJRBEHFMkKFBOk', artist_spotify_url: '', artist_genres: ['country'], artist_followers: 500000, album_name: 'Never Wanted To Know', album_spotify_id: 'demoalb1', album_type: 'single', album_spotify_url: '', cover_art_300: 'https://picsum.photos/seed/cooke/300/300', cover_art_640: 'https://picsum.photos/seed/cooke/640/640', cover_art_64: 'https://picsum.photos/seed/cooke/64/64', release_date: '2026-04-03', total_tracks: 1, track_spotify_url: 'https://open.spotify.com/track/demo1', duration_ms: 198000, explicit: false },
  { track_id: 'demo2', track_uri: 'spotify:track:demo2', track_name: 'Come Back To Me', track_number: 1, artist_names: 'Ella Langley', artist_id: '2FMVNblFGRxPijkMjXMHgi', artist_spotify_url: '', artist_genres: ['country'], artist_followers: 300000, album_name: 'Come Back To Me', album_spotify_id: 'demoalb2', album_type: 'single', album_spotify_url: '', cover_art_300: 'https://picsum.photos/seed/langley/300/300', cover_art_640: 'https://picsum.photos/seed/langley/640/640', cover_art_64: 'https://picsum.photos/seed/langley/64/64', release_date: '2026-04-03', total_tracks: 1, track_spotify_url: 'https://open.spotify.com/track/demo2', duration_ms: 210000, explicit: false },
  { track_id: 'demo3', track_uri: 'spotify:track:demo3', track_name: 'Gold Rush', track_number: 1, artist_names: 'Carter Faith', artist_id: '4GNCsORqGEfXpXp80sxhPK', artist_spotify_url: '', artist_genres: ['country'], artist_followers: 150000, album_name: 'Gold Rush', album_spotify_id: 'demoalb3', album_type: 'single', album_spotify_url: '', cover_art_300: 'https://picsum.photos/seed/faith/300/300', cover_art_640: 'https://picsum.photos/seed/faith/640/640', cover_art_64: 'https://picsum.photos/seed/faith/64/64', release_date: '2026-04-03', total_tracks: 1, track_spotify_url: 'https://open.spotify.com/track/demo3', duration_ms: 223000, explicit: false },
  { track_id: 'demo4', track_uri: 'spotify:track:demo4', track_name: 'Waitin On You', track_number: 1, artist_names: 'Tigirlily Gold', artist_id: '3uch1TRjfeaPL1JVcYqoOl', artist_spotify_url: '', artist_genres: ['country'], artist_followers: 200000, album_name: 'Waitin On You', album_spotify_id: 'demoalb4', album_type: 'single', album_spotify_url: '', cover_art_300: 'https://picsum.photos/seed/tigirlily/300/300', cover_art_640: 'https://picsum.photos/seed/tigirlily/640/640', cover_art_64: 'https://picsum.photos/seed/tigirlily/64/64', release_date: '2026-04-03', total_tracks: 1, track_spotify_url: 'https://open.spotify.com/track/demo4', duration_ms: 187000, explicit: false },
  { track_id: 'demo5', track_uri: 'spotify:track:demo5', track_name: 'Heartbreak Hotel', track_number: 1, artist_names: 'Lainey Wilson', artist_id: '7oKoJgRTlG5pFRBbbJGJuC', artist_spotify_url: '', artist_genres: ['country'], artist_followers: 800000, album_name: 'Heartbreak Hotel', album_spotify_id: 'demoalb5', album_type: 'single', album_spotify_url: '', cover_art_300: 'https://picsum.photos/seed/wilson/300/300', cover_art_640: 'https://picsum.photos/seed/wilson/640/640', cover_art_64: 'https://picsum.photos/seed/wilson/64/64', release_date: '2026-04-04', total_tracks: 1, track_spotify_url: 'https://open.spotify.com/track/demo5', duration_ms: 201000, explicit: false },
  { track_id: 'demo6', track_uri: 'spotify:track:demo6', track_name: 'Sand In My Boots', track_number: 1, artist_names: 'Morgan Wallen', artist_id: '4oUHIQIBe0LHzYfvXNW4QM', artist_spotify_url: '', artist_genres: ['country'], artist_followers: 2000000, album_name: 'Sand In My Boots', album_spotify_id: 'demoalb6', album_type: 'single', album_spotify_url: '', cover_art_300: 'https://picsum.photos/seed/wallen/300/300', cover_art_640: 'https://picsum.photos/seed/wallen/640/640', cover_art_64: 'https://picsum.photos/seed/wallen/64/64', release_date: '2026-04-04', total_tracks: 1, track_spotify_url: 'https://open.spotify.com/track/demo6', duration_ms: 234000, explicit: false },
  { track_id: 'demo7', track_uri: 'spotify:track:demo7', track_name: 'Burn It Down', track_number: 1, artist_names: 'Zach Bryan', artist_id: '40ZNYROS4zLfyyBSs2PGe2', artist_spotify_url: '', artist_genres: ['country'], artist_followers: 3000000, album_name: 'Burn It Down', album_spotify_id: 'demoalb7', album_type: 'single', album_spotify_url: '', cover_art_300: 'https://picsum.photos/seed/bryan/300/300', cover_art_640: 'https://picsum.photos/seed/bryan/640/640', cover_art_64: 'https://picsum.photos/seed/bryan/64/64', release_date: '2026-04-04', total_tracks: 1, track_spotify_url: 'https://open.spotify.com/track/demo7', duration_ms: 219000, explicit: false },
  { track_id: 'demo8', track_uri: 'spotify:track:demo8', track_name: 'Take It Easy', track_number: 1, artist_names: 'Kelsea Ballerini', artist_id: '3RqBeV12Tt7A8xH3zBDMYa', artist_spotify_url: '', artist_genres: ['country'], artist_followers: 1000000, album_name: 'Take It Easy', album_spotify_id: 'demoalb8', album_type: 'single', album_spotify_url: '', cover_art_300: 'https://picsum.photos/seed/ballerini/300/300', cover_art_640: 'https://picsum.photos/seed/ballerini/640/640', cover_art_64: 'https://picsum.photos/seed/ballerini/64/64', release_date: '2026-04-04', total_tracks: 1, track_spotify_url: 'https://open.spotify.com/track/demo8', duration_ms: 195000, explicit: false },
];

/* ------------------------------------------------------------------ */
/*  Main Component                                                    */
/* ------------------------------------------------------------------ */

export default function NewMusicFriday() {
  const { user, isGuest, signOut } = useAuth();
  const userId = user?.id || null;
  const [searchParams, setSearchParams] = useSearchParams();
  const [token, setToken] = useState<string | null>(getToken());
  const [phase, setPhase] = useState<Phase>('auth');
  const [allTracks, setAllTracks] = useState<TrackItem[]>([]);
  const [releases, setReleases] = useState<ReleaseCluster[]>([]);
  const [selections, setSelections] = useState<SelectionSlot[]>([]);
  const [targetCount, setTargetCount] = useState(32);
  const [scanStatus, setScanStatus] = useState('');
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });
  const [filter, setFilter] = useState<FilterKey>('all');
  const [sort, setSort] = useState<SortKey>('date');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [artDownloading, setArtDownloading] = useState(false);
  const [artistCount, setArtistCount] = useState(0);
  const [rateLimited, setRateLimited] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [appleEnriching, setAppleEnriching] = useState(false);
  const [featureCounts, setFeatureCounts] = useState<Map<string, number>>(new Map());
  const [activeSource, setActiveSource] = useState<MusicSource['id']>('spotify');
  const [tracksPerSlide, setTracksPerSlide] = useState(8);

  // Shift-click multi-select tracking
  const lastClickedIdx = useRef<number>(-1);

  // Step section refs for scroll-to
  const step1Ref = useRef<HTMLElement>(null);
  const step2Ref = useRef<HTMLElement>(null);
  const step3Ref = useRef<HTMLElement>(null);
  const step4Ref = useRef<HTMLElement>(null);
  const step5Ref = useRef<HTMLElement>(null);

  const weekDate = getLastFriday();


  // Handle OAuth callback
  useEffect(() => {
    const code = searchParams.get('code');
    const oauthError = searchParams.get('error');
    if (oauthError) {
      setSearchParams({}, { replace: true });
      const desc = searchParams.get('error_description') || oauthError;
      setError(`Spotify access denied: ${desc}. This app is in development mode and limited to approved accounts. Use the Manual/CSV import instead.`);
      return;
    }
    if (code) {
      setSearchParams({}, { replace: true });
      exchangeCode(code)
        .then(t => { setToken(t); setError(''); })
        .catch(e => {
          const msg = e.message || 'Unknown error';
          if (msg.includes('invalid_grant') || msg.includes('access_denied') || msg.includes('invalid_client')) {
            setError(`Spotify connection failed: ${msg}. This app is in Spotify development mode (limited users). Use the Manual/CSV import tab to import your releases without Spotify.`);
          } else {
            setError(`Auth failed: ${msg}`);
          }
        });
    }
  }, [searchParams, setSearchParams]);

  // On mount: try to load cached results. Guests see empty state.
  useEffect(() => {
    // Guests/admin-bypass: no cached data, start fresh
    if (!userId) return;

    const cacheKey = `nmf_scan_${weekDate}_${userId}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        const { tracks, timestamp } = JSON.parse(cached);
        if (tracks?.length) {
          setAllTracks(tracks);
          setReleases(groupIntoReleases(tracks));
          setPhase('results');
          setLastScanned(timestamp);
          return;
        }
      } catch { /* corrupted cache */ }
    }
    // No session cache — try Supabase (scoped by user_id)
    import('../lib/supabase').then(({ getWeek }) => {
      getWeek(weekDate, userId).then(week => {
        if (week?.all_releases && Array.isArray(week.all_releases) && (week.all_releases as TrackItem[]).length > 0) {
          const tracks = week.all_releases as TrackItem[];
          const savedAt = week.updated_at || week.created_at || null;
          setAllTracks(tracks);
          setReleases(groupIntoReleases(tracks));
          setPhase('results');
          setLastScanned(savedAt);
          sessionStorage.setItem(cacheKey, JSON.stringify({ tracks, timestamp: savedAt }));
          if (week.selections && Array.isArray(week.selections)) {
            setSelections(buildSlots(week.selections as SelectionSlot[]));
          }
          // Staleness warning: if cached data is >24h old, nudge re-scan
          if (savedAt) {
            const ageMs = Date.now() - new Date(savedAt).getTime();
            if (ageMs > 24 * 60 * 60 * 1000) {
              setError('Loaded cached results from ' + new Date(savedAt).toLocaleString() + '. Consider re-scanning for the latest releases.');
            }
          }
        }
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When token arrives: move to ready (NOT scan). If we already have results, stay there.
  useEffect(() => {
    if (token && phase === 'auth') {
      setPhase('ready');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loadDemo = () => {
    setAllTracks(DEMO_TRACKS);
    setReleases(groupIntoReleases(DEMO_TRACKS));
    setIsDemoMode(true);
    setPhase('results');
    setError('');
  };

  const runScan = useCallback(async (tkn: string) => {
    setPhase('scanning');
    setError('');
    setRateLimited(false);
    const scanStart = Date.now();
    try {
      // Refresh token if expired
      let activeToken = tkn;
      if (isTokenExpired()) {
        setScanStatus('Refreshing Spotify token...');
        const refreshed = await refreshToken();
        if (refreshed) {
          activeToken = refreshed;
          setToken(refreshed);
        } else {
          setToken(null);
          setPhase('auth');
          setError('Session expired. Please reconnect Spotify.');
          return;
        }
      }

      // Pre-scan health check
      setScanStatus('Checking Spotify status...');
      const health = await checkScanHealth(activeToken);
      if (!health.ok) {
        setRateLimited(true);
        setError(health.message);
        setPhase('ready');
        return;
      }
      console.log(`[SCAN] Health check: ${health.message}`);

      setScanStatus('Fetching followed artists...');
      const artists = await fetchFollowedArtists(activeToken, (cur, tot) => {
        setScanProgress({ current: cur, total: tot });
        setScanStatus(`Loaded ${cur} artists...`);
      });

      const cutoff = getScanCutoff();
      setScanStatus(`Scanning releases since ${cutoff}...`);
      setScanProgress({ current: 0, total: artists.length });

      const result = await fetchNewReleases(artists, activeToken, cutoff, (cur, tot, releasesFound, status) => {
        setScanProgress({ current: cur, total: tot });
        const elapsed = (Date.now() - scanStart) / 1000;
        const statusDot = status === 'green' ? '\uD83D\uDFE2' : status === 'yellow' ? '\uD83D\uDFE1' : '\uD83D\uDD34';
        if (status === 'red') {
          setScanStatus(`${statusDot} Rate limited \u2014 saving ${releasesFound} release${releasesFound !== 1 ? 's' : ''} found so far`);
        } else if (cur >= 30 && cur < tot) {
          const rate = cur / elapsed;
          const remaining = (tot - cur) / rate;
          const eta = remaining < 10 ? 'Almost done...'
            : remaining < 60 ? `~${Math.round(remaining)}s remaining`
            : `~${Math.floor(remaining / 60)}m ${Math.round(remaining % 60)}s remaining`;
          setScanStatus(`${statusDot} ${cur}/${tot} artists \u00B7 ${releasesFound} release${releasesFound !== 1 ? 's' : ''} \u00B7 ${eta}`);
        } else {
          setScanStatus(`${statusDot} ${cur}/${tot} artists \u00B7 ${releasesFound} release${releasesFound !== 1 ? 's' : ''}`);
        }
      });

      const { tracks, failCount, totalArtists, rateLimited: wasRateLimited, retryAfterSeconds } = result;
      const now = new Date().toISOString();
      setAllTracks(tracks);
      setReleases(groupIntoReleases(tracks));
      setArtistCount(totalArtists);
      setLastScanned(now);
      setRateLimited(wasRateLimited);
      setPhase('results');

      if (wasRateLimited) {
        const mins = Math.ceil(retryAfterSeconds / 60);
        setError(`Rate limited after ${result.completedArtists}/${totalArtists} artists. Found ${tracks.length} releases. Try again in ~${mins} min.`);
      }

      // Background: query feature counts for "Previously Featured" badges
      const artistIds = [...new Set(tracks.map(t => t.artist_id).filter(Boolean))];
      if (artistIds.length > 0) {
        getFeatureCounts(artistIds).then(setFeatureCounts).catch(() => {});
      }

      // Background Apple Music enrichment (non-blocking)
      if (tracks.length > 0) {
        setAppleEnriching(true);
        batchResolveAppleMusic(tracks).then(appleMap => {
          setAllTracks(prev => prev.map(t => {
            const key = `${t.artist_names}::${t.track_name}`;
            const url = appleMap.get(key);
            return url ? { ...t, apple_music_url: url } : t;
          }));
          setAppleEnriching(false);
        }).catch(() => setAppleEnriching(false));
      }

      // Only cache if results > 0
      if (tracks.length > 0) {
        if (userId) {
          try {
            sessionStorage.setItem(`nmf_scan_${weekDate}_${userId}`, JSON.stringify({ tracks, timestamp: now }));
          } catch { /* storage full, ignore */ }
          saveWeek({ week_date: weekDate, all_releases: tracks, playlist_master_pushed: false, carousel_generated: false }, userId);
        }
      } else if (failCount > totalArtists * 0.5) {
        setError(`Spotify rate limit hit \u2014 ${failCount}/${totalArtists} artists failed. Wait 30-60 minutes and try again.`);
      } else {
        setError(`Scan found 0 releases since ${cutoff}. Try re-scanning.`);
      }
    } catch (e) {
      if ((e as Error).message === 'AUTH_EXPIRED') {
        setToken(null);
        setPhase('auth');
        setError('Session expired. Please reconnect.');
      } else {
        setError((e as Error).message);
        setPhase('auth');
      }
    }
  }, [weekDate]);

  // Selection helpers — keyed by track ID so multiple tracks per album can be selected
  const selectionByAlbum = useMemo(() => {
    const map = new Map<string, SelectionSlot>();
    for (const s of selections) {
      if (!map.has(s.albumId)) map.set(s.albumId, s);
    }
    return map;
  }, [selections]);

  /** All selected slots grouped by album ID (supports multi-track per album) */
  const selectionsByAlbum = useMemo(() => {
    const map = new Map<string, SelectionSlot[]>();
    for (const s of selections) {
      const arr = map.get(s.albumId) || [];
      arr.push(s);
      map.set(s.albumId, arr);
    }
    return map;
  }, [selections]);

  const handleSelectRelease = useCallback((cluster: ReleaseCluster, trackId?: string) => {
    setSelections(prev => {
      const chosenTrackId = trackId || cluster.titleTrackId;
      const track = cluster.tracks.find(t => t.track_id === chosenTrackId) || cluster.tracks[0];

      // Already selected this specific track? Deselect it
      const existingTrack = prev.findIndex(s => s.track.track_id === track.track_id);
      if (existingTrack >= 0) {
        return buildSlots(prev.filter((_, i) => i !== existingTrack));
      }

      // For singles (1 track): if album already selected, this is a deselect of the only track
      if (cluster.isSingle) {
        const existingAlbum = prev.findIndex(s => s.albumId === cluster.album_spotify_id);
        if (existingAlbum >= 0) {
          return buildSlots(prev.filter((_, i) => i !== existingAlbum));
        }
      }

      // Add new selection (allows multiple tracks from same album)
      const newSlot: SelectionSlot = {
        track,
        albumId: cluster.album_spotify_id,
        selectionNumber: prev.length + 1,
        slideGroup: getSlideGroup(prev.length + 1),
        positionInSlide: ((prev.length) % 8) + 1,
        isCoverFeature: false,
      };

      return buildSlots([...prev, newSlot]);
    });
  }, []);

  const handleDeselect = useCallback((albumId: string, trackId?: string) => {
    setSelections(prev => {
      if (trackId) {
        // Deselect specific track
        return buildSlots(prev.filter(s => s.track.track_id !== trackId));
      }
      // Deselect all tracks from this album
      return buildSlots(prev.filter(s => s.albumId !== albumId));
    });
  }, []);

  const handleSetCoverFeature = useCallback((trackId: string) => {
    setSelections(prev => prev.map(s => ({
      ...s,
      isCoverFeature: s.track.track_id === trackId,
    })));
  }, []);

  // Filtered releases for browse
  const filteredReleases = useMemo(() => {
    let result = [...releases];
    if (filter === 'single') result = result.filter(r => r.isSingle);
    else if (filter === 'album') result = result.filter(r => !r.isSingle);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        r.album_name.toLowerCase().includes(q) ||
        r.artist_names.toLowerCase().includes(q) ||
        r.tracks.some(t => t.track_name.toLowerCase().includes(q))
      );
    }
    if (sort === 'artist') result.sort((a, b) => a.artist_names.localeCompare(b.artist_names));
    else if (sort === 'title') result.sort((a, b) => a.album_name.localeCompare(b.album_name));
    return result;
  }, [releases, filter, sort, search]);

  // (filter counts shown inline in sticky bar via filteredReleases.length)

  // Slide groups for TagBlocks — follows tracksPerSlide from carousel config
  const slideGroups = useMemo(() => {
    const groups: SelectionSlot[][] = [];
    for (let i = 0; i < selections.length; i += tracksPerSlide) {
      groups.push(selections.slice(i, i + tracksPerSlide));
    }
    return groups;
  }, [selections, tracksPerSlide]);

  // Selected tracks for downloads/playlist
  const selectedTracks = useMemo(() => selections.map(s => s.track), [selections]);

  const handleDisconnect = () => {
    clearToken();
    setToken(null);
    setPhase('auth');
    setAllTracks([]);
    setReleases([]);
    setSelections([]);
  };

  const handlePlaylistPush = async (mode: 'replace' | 'append') => {
    if (!token) return;
    const uris = selectedTracks.map(t => t.track_uri);
    if (mode === 'replace') {
      await replacePlaylistTracks(token, PLAYLIST_ID, uris);
    } else {
      await appendPlaylistTracks(token, PLAYLIST_ID, uris);
    }
    await handleSaveWeek({ playlist_master_pushed: true });
  };

  const handleCreateAndPush = async (name: string, isPublic: boolean) => {
    if (!token) throw new Error('Not authenticated');
    const uris = selectedTracks.map(t => t.track_uri);
    const result = await createPlaylist(token, name, isPublic, uris);
    await handleSaveWeek({ playlist_new_id: result.id, playlist_new_url: result.url });
    return result;
  };

  const handleSaveWeek = async (extra: Partial<NMFWeek> = {}) => {
    if (!userId) return; // Guests don't persist to Supabase
    const week: NMFWeek = {
      week_date: weekDate,
      all_releases: allTracks,
      selections: selections,
      cover_feature: selections.find(s => s.isCoverFeature) || null,
      manifest_curated: selectedTracks,
      playlist_master_pushed: false,
      carousel_generated: false,
      ...extra,
    };
    await saveWeek(week, userId);
    const features = selections.map(s => ({
      week_date: weekDate,
      spotify_artist_id: s.track.artist_id,
      artist_name: s.track.artist_names,
      track_name: s.track.track_name,
      track_spotify_id: s.track.track_id,
      album_name: s.track.album_name,
      slide_number: s.slideGroup,
      slide_position: s.positionInSlide,
      was_cover_feature: s.isCoverFeature,
    }));
    await saveFeatures(features);
  };

  const handleLoadWeek = (week: NMFWeek) => {
    if (week.selections && Array.isArray(week.selections)) {
      setSelections(buildSlots(week.selections as SelectionSlot[]));
    }
    if (week.all_releases && Array.isArray(week.all_releases)) {
      setAllTracks(week.all_releases as TrackItem[]);
      setReleases(groupIntoReleases(week.all_releases as TrackItem[]));
    }
    setPhase('results');
  };

  /* ---------------------------------------------------------------- */
  /*  Render                                                          */
  /* ---------------------------------------------------------------- */

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header */}
      <header style={{
        padding: '16px 24px',
        borderBottom: '1px solid var(--midnight-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <ProductNav />
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 600 }}>
            New Music Friday
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {lastScanned && (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>
              Scanned {new Date(lastScanned).toLocaleString()}
            </span>
          )}
          {token && phase !== 'scanning' && (
            <>
              <button className="btn btn-sm" onClick={() => runScan(token)}>Re-scan</button>
              <button className="btn btn-sm" onClick={() => { localStorage.removeItem('nmf_followed_artists'); runScan(token); }} title="Re-fetch followed artists from Spotify">Refresh Follows</button>
            </>
          )}
          {token && (
            <button className="btn btn-sm btn-danger" onClick={handleDisconnect}>Disconnect</button>
          )}
          {/* Account info + sign out */}
          {user && (
            <>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.6rem' }}>{user.email}</span>
              <button className="btn btn-sm" onClick={signOut} style={{ fontSize: '0.65rem' }}>Sign Out</button>
            </>
          )}
          {!user && isGuest && (
            <button className="btn btn-sm" onClick={signOut} style={{ fontSize: '0.65rem' }}>Sign Out</button>
          )}
        </div>
      </header>

      {error && (
        <div style={{
          padding: '12px 24px', background: 'rgba(204, 53, 53, 0.1)',
          borderBottom: '1px solid var(--mmmc-red)', color: '#E04A4A', fontSize: '0.875rem',
        }}>
          {error}
        </div>
      )}

      {appleEnriching && (
        <div style={{
          padding: '6px 24px', background: 'rgba(94,142,168,0.1)',
          borderBottom: '1px solid var(--steel-dark)', color: 'var(--steel)', fontSize: '0.75rem',
        }}>
          Adding Apple Music links...
        </div>
      )}

      {/* Auth Phase */}
      {phase === 'auth' && !token && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '60vh', padding: 24, textAlign: 'center',
        }}>
          <div className="animate-float-up" style={{ maxWidth: 400 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', marginBottom: 12 }}>
              Connect <span style={{ color: 'var(--gold)' }}>Spotify</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>
              Scan your followed artists for new releases since last Friday.
            </p>
            <button className="btn btn-spotify" onClick={startAuth} style={{ fontSize: '1rem', padding: '14px 32px' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
              </svg>
              Connect Spotify
            </button>
            <button className="btn" onClick={loadDemo} style={{ fontSize: '1rem', padding: '14px 32px' }}>
              Try Demo
            </button>
            <div style={{ marginTop: 32 }}>
              <details style={{ textAlign: 'left' }}>
                <summary style={{ color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer' }}>
                  Manual token entry (if redirect fails)
                </summary>
                <div style={{ marginTop: 12 }}>
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Paste access token or full redirect URL..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = (e.target as HTMLInputElement).value.trim();
                        try {
                          const url = new URL(val);
                          const code = url.searchParams.get('code');
                          if (code) {
                            exchangeCode(code).then(t => { setToken(t); setError(''); }).catch(err => setError(err.message));
                            return;
                          }
                        } catch { /* not a URL */ }
                        if (val.length > 20) {
                          sessionStorage.setItem('spotify_token', val);
                          setToken(val);
                        }
                      }
                    }}
                  />
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: 8 }}>
                    Press Enter to submit. Accepts a full redirect URL with code= or a raw access token.
                  </p>
                </div>
              </details>
            </div>
          </div>
        </div>
      )}

      {/* Ready Phase -- token received, waiting for explicit scan */}
      {phase === 'ready' && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '60vh', padding: 24, textAlign: 'center',
        }}>
          <div className="animate-float-up" style={{ maxWidth: 560, width: '100%' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', marginBottom: 16 }}>
              Ready to <span style={{ color: 'var(--gold)' }}>Scan</span>
            </h2>

            <SourceSelector
              selected={activeSource}
              onSelect={setActiveSource}
              spotifyConnected={!!token}
              appleMusicConnected={false}
            />

            {/* Spotify source */}
            {activeSource === 'spotify' && (
              <div style={{ marginTop: 16 }}>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 16, fontSize: '0.85rem' }}>
                  Scan your followed artists for new releases since last Friday.
                </p>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button data-testid="scan-button" className="btn btn-gold" onClick={() => token && runScan(token)} style={{ fontSize: '1rem', padding: '14px 32px' }}>
                    Scan New Releases
                  </button>
                  <button className="btn" onClick={loadDemo}>
                    Try Demo
                  </button>
                </div>
              </div>
            )}

            {/* Apple Music source — coming soon */}
            {activeSource === 'apple-music' && (
              <div style={{ marginTop: 16 }}>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 16, fontSize: '0.85rem' }}>
                  Apple Music library scanning is coming soon. In the meantime, use Spotify or import a CSV manifest.
                </p>
                <button
                  className="btn"
                  disabled
                  style={{ fontSize: '1rem', padding: '14px 32px', opacity: 0.5, cursor: 'not-allowed' }}
                >
                  Coming Soon
                </button>
              </div>
            )}

            {/* Manual source */}
            {activeSource === 'manual' && (
              <div style={{ marginTop: 16, textAlign: 'left' }}>
                <ManualImport onImport={(tracks) => {
                  setAllTracks(tracks);
                  setReleases(groupIntoReleases(tracks));
                  setPhase('results');
                  setLastScanned(new Date().toISOString());
                  setIsDemoMode(false);
                }} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Demo mode banner */}
      {isDemoMode && (
        <div style={{
          background: 'rgba(212,168,67,0.12)', borderBottom: '1px solid var(--gold-dark)',
          padding: '8px 24px', fontSize: '0.8rem', color: 'var(--gold)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>Demo mode -- showing sample data. Connect Spotify and scan to see your real releases.</span>
          <button
            className="btn btn-sm"
            onClick={() => { setIsDemoMode(false); setAllTracks([]); setReleases([]); setSelections([]); setPhase(token ? 'ready' : 'auth'); }}
            style={{ fontSize: '0.7rem' }}
          >
            Exit Demo
          </button>
        </div>
      )}

      {/* Scanning Phase */}
      {phase === 'scanning' && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '60vh', padding: 24, textAlign: 'center',
        }}>
          <div style={{ maxWidth: 480, width: '100%' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', marginBottom: 24 }}>
              Scanning<span style={{ color: 'var(--gold)' }}>...</span>
            </h2>
            <div className="progress-bar" style={{ marginBottom: 16 }}>
              <div className="progress-bar-fill" style={{
                width: scanProgress.total > 0 ? `${(scanProgress.current / scanProgress.total) * 100}%` : '0%',
              }} />
            </div>
            <p className="mono" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              {scanStatus}
            </p>
          </div>
        </div>
      )}

      {/* Results Phase -- single scrollable page with 5 steps */}
      {phase === 'results' && (
        <>
          {/* ============================================================ */}
          {/*  STICKY TOOLBAR: counter + filters (consolidated 4→2 rows)    */}
          {/* ============================================================ */}
          <div style={{
            position: 'sticky', top: 0, zIndex: 20,
            background: 'var(--midnight)', borderBottom: '1px solid var(--midnight-border)',
          }}>
            {/* Row 1: Selection counter + target + filters + stats */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexWrap: 'wrap', gap: 8,
              padding: '10px 24px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="mono" style={{
                  fontSize: '1.4rem', fontWeight: 700,
                  color: selections.length > targetCount ? 'var(--mmmc-red)' : selections.length > 0 ? 'var(--gold)' : 'var(--text-muted)',
                }}>
                  {selections.length}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>/ {targetCount}</span>
                {selections.length > targetCount && (
                  <span style={{ color: 'var(--mmmc-red)', fontSize: '0.7rem', fontWeight: 600 }}>Over limit!</span>
                )}
                <select
                  value={targetCount}
                  onChange={e => setTargetCount(Number(e.target.value))}
                  style={{
                    background: 'var(--midnight)', border: '1px solid var(--midnight-border)',
                    borderRadius: 6, color: 'var(--text-secondary)', padding: '3px 6px',
                    fontSize: '0.7rem', fontFamily: 'var(--font-mono)',
                  }}
                >
                  {Array.from({ length: 50 }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>{n} track{n !== 1 ? 's' : ''}</option>
                  ))}
                </select>
                <span style={{ color: 'var(--midnight-border)', margin: '0 2px' }}>|</span>
                <FilterBar
                  filter={filter} sort={sort} search={search}
                  onFilterChange={setFilter} onSortChange={setSort} onSearchChange={setSearch}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                  {filteredReleases.length} releases ({allTracks.length} tracks)
                </span>
                <Link to="/newmusicfriday/archive" className="filter-pill" style={{ textDecoration: 'none', fontSize: '0.65rem' }}>
                  Archive
                </Link>
              </div>
            </div>

            {/* Row 2: Downloads (collapsed into a details for space) */}
            <div style={{
              padding: '4px 24px 8px',
              display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center',
              fontSize: '0.7rem',
            }}>
              <button className="btn btn-sm" style={{ fontSize: '0.65rem', padding: '3px 8px' }} onClick={() => downloadCSV(allTracks, 'nmf-all-tracks.csv')}>CSV</button>
              <button className="btn btn-sm" style={{ fontSize: '0.65rem', padding: '3px 8px' }} onClick={() => downloadJSON(allTracks, 'nmf-all-tracks.json')}>JSON</button>
              <button className="btn btn-sm" style={{ fontSize: '0.65rem', padding: '3px 8px' }} onClick={async () => { setArtDownloading(true); try { await downloadArt(allTracks); } finally { setArtDownloading(false); } }} disabled={artDownloading}>
                {artDownloading ? '...' : 'Art ZIP'}
              </button>
              {selections.length > 0 && (
                <>
                  <span style={{ color: 'var(--midnight-border)' }}>|</span>
                  <span style={{ color: 'var(--gold)', fontWeight: 600 }}>{selections.length} selected:</span>
                  <button className="btn btn-sm" style={{ fontSize: '0.65rem', padding: '3px 8px' }} onClick={() => downloadCSV(selectedTracks, 'nmf-curated.csv')}>CSV</button>
                  <button className="btn btn-sm" style={{ fontSize: '0.65rem', padding: '3px 8px' }} onClick={() => downloadJSON(selectedTracks, 'nmf-curated.json')}>JSON</button>
                  <button className="btn btn-sm" style={{ fontSize: '0.65rem', padding: '3px 8px' }} onClick={async () => {
                    await navigator.clipboard.writeText(JSON.stringify(selectedTracks, null, 2));
                    setCopied(true); setTimeout(() => setCopied(false), 2000);
                  }}>{copied ? 'Copied!' : 'Manifest'}</button>
                </>
              )}
            </div>
          </div>

          {/* ============================================================ */}
          {/*  STEP 1: SELECT TRACKS (scrollable grid below sticky bar)    */}
          {/* ============================================================ */}
          <section ref={step1Ref} style={{ scrollMarginTop: 120 }}>
            {/* Release grid */}
            <div style={{ padding: 24 }}>
              <div className="release-grid" data-testid="track-grid">
                {filteredReleases.map((cluster, idx) => (
                  <ClusterCard
                    key={cluster.album_spotify_id}
                    cluster={cluster}
                    selectionSlot={selectionByAlbum.get(cluster.album_spotify_id) || null}
                    selectedSlots={selectionsByAlbum.get(cluster.album_spotify_id)}
                    hasSelections={selections.length > 0}
                    onSelectRelease={(c, trackId) => {
                      // Shift-click: select range from last click to here
                      if (lastClickedIdx.current >= 0 && window.event && (window.event as KeyboardEvent).shiftKey) {
                        const start = Math.min(lastClickedIdx.current, idx);
                        const end = Math.max(lastClickedIdx.current, idx);
                        setSelections(prev => {
                          let updated = [...prev];
                          for (let i = start; i <= end; i++) {
                            const r = filteredReleases[i];
                            const alreadyHas = updated.some(s => s.albumId === r.album_spotify_id);
                            if (!alreadyHas) {
                              const track = r.tracks.find(t => t.track_id === r.titleTrackId) || r.tracks[0];
                              updated.push({
                                track, albumId: r.album_spotify_id,
                                selectionNumber: updated.length + 1,
                                slideGroup: getSlideGroup(updated.length + 1),
                                positionInSlide: ((updated.length) % 8) + 1,
                                isCoverFeature: false,
                              });
                            }
                          }
                          return buildSlots(updated);
                        });
                      } else {
                        handleSelectRelease(c, trackId);
                      }
                      lastClickedIdx.current = idx;
                    }}
                    onDeselect={handleDeselect}
                    onSetCoverFeature={handleSetCoverFeature}
                    featureCount={featureCounts.get(cluster.tracks[0]?.artist_id) || 0}
                  />
                ))}
              </div>
              {filteredReleases.length === 0 && releases.length > 0 && (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 48 }}>
                  No releases match your filters.
                </p>
              )}
              {releases.length === 0 && (
                <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>
                    {rateLimited ? '429' : '\uD83C\uDFB5'}
                  </div>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', marginBottom: 8 }}>
                    {rateLimited ? 'Spotify Rate Limited' : 'No releases found this week'}
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: 24, maxWidth: 440, margin: '0 auto 24px', lineHeight: 1.6 }}>
                    {rateLimited
                      ? 'Spotify throttled the scan \u2014 most artist checks failed. Wait 30-60 minutes and try again, or load a saved week from History.'
                      : `Scanned ${artistCount || '~800'} followed artists for releases since last Friday. If this seems wrong, try re-scanning in a few minutes.`
                    }
                  </p>
                  <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                    {token && (
                      <button className="btn btn-sm btn-gold" onClick={() => runScan(token)}>Re-scan</button>
                    )}
                  </div>
                  {/* Feature overview cards */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: 16, marginTop: 48, opacity: 0.5, maxWidth: 800, margin: '48px auto 0',
                  }}>
                    {[
                      { title: 'Scan Releases', desc: 'Finds new music from all your followed artists since last Friday' },
                      { title: 'Build Carousel', desc: 'Generates 1080x1080 Instagram carousel slides automatically' },
                      { title: 'Tag Blocks', desc: 'Auto-resolves Instagram handles for every artist featured' },
                      { title: 'Push to Playlist', desc: 'Updates your NMF Spotify playlist with one click' },
                    ].map(f => (
                      <div key={f.title} className="card" style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: 600, marginBottom: 4, fontSize: '0.85rem' }}>{f.title}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{f.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ============================================================ */}
          {/*  STEPS 2-5: CAROUSEL BUILDER (CarouselPreviewPanel)          */}
          {/*  Internally contains:                                        */}
          {/*    Step 2 - Configure Slides (TrackCount, Platform, Grid,    */}
          {/*             SlideSplitter)                                    */}
          {/*    Step 3 - Grid Slide Style (TemplateSelector)              */}
          {/*    Step 4 - Title Slide Style (TitleTemplatePicker)          */}
          {/*    Step 5 - Preview & Export                                 */}
          {/* ============================================================ */}
          {selections.length > 0 && (
            <section ref={step2Ref} style={{ scrollMarginTop: 16, padding: '0 24px 24px' }}>
              {/* Provide anchor refs for steps 3-5 that the breadcrumb can scroll to */}
              <div ref={step3Ref as React.RefObject<HTMLDivElement>} style={{ scrollMarginTop: 16 }} />
              <div ref={step4Ref as React.RefObject<HTMLDivElement>} style={{ scrollMarginTop: 16 }} />
              <div ref={step5Ref as React.RefObject<HTMLDivElement>} style={{ scrollMarginTop: 16 }} />

              <CarouselPreviewPanel
                selectedTracks={selectedTracks}
                coverFeature={selections.find(s => s.isCoverFeature) || null}
                onTracksPerSlideChange={setTracksPerSlide}
              />

              {/* Collapsible extras */}
              <details style={{ marginTop: 24, borderTop: '1px solid var(--midnight-border)', paddingTop: 16 }}>
                <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>
                  Instagram Tags
                </summary>
                <TagBlocks slideGroups={slideGroups} />
              </details>

              <details style={{ marginTop: 16, borderTop: '1px solid var(--midnight-border)', paddingTop: 16 }}>
                <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>
                  Push to Spotify
                </summary>
                <div style={{ marginTop: 12 }}>
                  {token ? (
                    <PlaylistCreate
                      selectedCount={selections.length}
                      weekDate={weekDate}
                      onCreateAndPush={handleCreateAndPush}
                      onPushMaster={handlePlaylistPush}
                      getPlaylistName={() => getPlaylistName(token, PLAYLIST_ID)}
                    />
                  ) : (
                    <>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Connect Spotify to push to a Spotify playlist.</p>
                    <button
                      className="btn btn-sm"
                      style={{ marginTop: 8 }}
                      onClick={async () => {
                        try {
                          const { authorizeAppleMusic } = await import('../lib/sources/apple-music');
                          await authorizeAppleMusic();
                          const music = (window as any).MusicKit?.getInstance();
                          if (!music) throw new Error('MusicKit not available');
                          // Create playlist
                          const name = `New Music Friday — ${new Date(weekDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
                          const trackIds = selectedTracks
                            .filter(t => t.apple_music_url)
                            .map(t => {
                              const match = t.apple_music_url?.match(/\/(\d+)$/);
                              return match ? { id: match[1], type: 'songs' as const } : null;
                            })
                            .filter(Boolean);
                          if (trackIds.length === 0) {
                            alert('No Apple Music track IDs found. Run Apple Music enrichment first.');
                            return;
                          }
                          await music.api.music('/v1/me/library/playlists', undefined, {
                            fetchOptions: {
                              method: 'POST',
                              body: JSON.stringify({
                                attributes: { name, description: 'Curated by Max Meets Music City' },
                                relationships: { tracks: { data: trackIds } },
                              }),
                            },
                          });
                          alert(`Created Apple Music playlist: ${name}`);
                        } catch (e) {
                          alert(`Apple Music error: ${(e as Error).message}`);
                        }
                      }}
                    >
                      Push to Apple Music
                    </button>
                    </>
                  )}
                </div>
              </details>

              <details style={{ marginTop: 16, borderTop: '1px solid var(--midnight-border)', paddingTop: 16 }}>
                <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>
                  Embed Widget
                </summary>
                <div style={{ marginTop: 12 }}>
                  <EmbedWidget />
                </div>
              </details>

              <details style={{ marginTop: 16, borderTop: '1px solid var(--midnight-border)', paddingTop: 16 }}>
                <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>
                  Import CSV Manifest
                </summary>
                <div style={{ marginTop: 12 }}>
                  <ManualImport onImport={(tracks) => {
                    setAllTracks(prev => {
                      const existingIds = new Set(prev.map(t => t.track_id));
                      const newTracks = tracks.filter(t => !existingIds.has(t.track_id));
                      const merged = [...prev, ...newTracks];
                      setReleases(groupIntoReleases(merged));
                      return merged;
                    });
                  }} />
                  <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    Import additional tracks from a CSV manifest. Duplicates are skipped.
                  </p>
                </div>
              </details>

              <details style={{ marginTop: 16, borderTop: '1px solid var(--midnight-border)', paddingTop: 16 }}>
                <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>
                  Week History
                </summary>
                <div style={{ marginTop: 12 }}>
                  <WeekHistory onLoadWeek={handleLoadWeek} currentWeekDate={weekDate} />
                </div>
              </details>

              <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--midnight-border)' }}>
                <button className="btn btn-gold" onClick={() => handleSaveWeek()}>
                  Save Week to History
                </button>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
