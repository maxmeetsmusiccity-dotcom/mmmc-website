import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { startAuth, exchangeCode, getToken, clearToken } from '../lib/auth';
import {
  fetchFollowedArtists,
  fetchNewReleases,
  getLastFriday,
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
  type TargetCount,
  TARGET_COUNTS,
  buildSlots,
  shuffleSlideGroup,
  reorderInSlideGroup,
  getSlideGroup,
} from '../lib/selection';
import { downloadJSON, downloadCSV, downloadArt } from '../lib/downloads';
import { saveWeek, saveFeatures, getFeatureCounts, type NMFWeek } from '../lib/supabase';
import { batchResolveAppleMusic } from '../lib/apple-music';
import ClusterCard from '../components/ClusterCard';
import SlideGroup from '../components/SlideGroup';
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

type Phase = 'auth' | 'ready' | 'scanning' | 'results';
type FilterKey = 'all' | 'single' | 'album';
type SortKey = 'date' | 'artist' | 'title';
type ViewMode = 'browse' | 'selected' | 'history';

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

export default function NewMusicFriday() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [token, setToken] = useState<string | null>(getToken());
  const [phase, setPhase] = useState<Phase>('auth');
  const [allTracks, setAllTracks] = useState<TrackItem[]>([]);
  const [releases, setReleases] = useState<ReleaseCluster[]>([]);
  const [selections, setSelections] = useState<SelectionSlot[]>([]);
  const [targetCount, setTargetCount] = useState<TargetCount>(32);
  const [scanStatus, setScanStatus] = useState('');
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });
  const [filter, setFilter] = useState<FilterKey>('all');
  const [sort, setSort] = useState<SortKey>('date');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('browse');
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

  // Handle OAuth callback
  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      setSearchParams({}, { replace: true });
      exchangeCode(code)
        .then(t => { setToken(t); setError(''); })
        .catch(e => setError(`Auth failed: ${e.message}`));
    }
  }, [searchParams, setSearchParams]);

  // On mount: try to load cached results. NEVER auto-scan.
  useEffect(() => {
    const cached = sessionStorage.getItem(`nmf_scan_${weekDate}`);
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
    // No session cache — try Supabase
    import('../lib/supabase').then(({ getWeek }) => {
      getWeek(weekDate).then(week => {
        if (week?.all_releases && Array.isArray(week.all_releases) && (week.all_releases as TrackItem[]).length > 0) {
          const tracks = week.all_releases as TrackItem[];
          setAllTracks(tracks);
          setReleases(groupIntoReleases(tracks));
          setPhase('results');
          setLastScanned(week.updated_at || week.created_at || null);
          sessionStorage.setItem(`nmf_scan_${weekDate}`, JSON.stringify({ tracks, timestamp: week.updated_at }));
          if (week.selections && Array.isArray(week.selections)) {
            setSelections(buildSlots(week.selections as SelectionSlot[]));
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
      // Pre-scan health check — detect rate limit before scanning
      setScanStatus('Checking Spotify status...');
      const health = await checkScanHealth(tkn);
      if (!health.ok) {
        setRateLimited(true);
        const retryAfter = health.retryAfter || 60;
        setError(`Spotify is rate limiting your app. Try again in ${retryAfter} seconds.`);
        setPhase('ready');
        return;
      }

      setScanStatus('Fetching followed artists...');
      const artists = await fetchFollowedArtists(tkn, (cur, tot) => {
        setScanProgress({ current: cur, total: tot });
        setScanStatus(`Loaded ${cur} artists...`);
      });

      const cutoff = getLastFriday();
      setScanStatus(`Scanning releases since ${cutoff}...`);
      setScanProgress({ current: 0, total: artists.length });

      const result = await fetchNewReleases(artists, tkn, cutoff, (cur, tot, releasesFound, status) => {
        setScanProgress({ current: cur, total: tot });
        const elapsed = (Date.now() - scanStart) / 1000;
        const statusDot = status === 'green' ? '🟢' : status === 'yellow' ? '🟡' : '🔴';
        if (status === 'red') {
          setScanStatus(`${statusDot} Rate limited — saving ${releasesFound} releases found so far`);
        } else if (cur >= 30 && cur < tot) {
          const rate = cur / elapsed;
          const remaining = (tot - cur) / rate;
          const eta = remaining < 10 ? 'Almost done...'
            : remaining < 60 ? `~${Math.round(remaining)}s remaining`
            : `~${Math.floor(remaining / 60)}m ${Math.round(remaining % 60)}s remaining`;
          setScanStatus(`${statusDot} ${cur}/${tot} artists · ${releasesFound} releases · ${eta}`);
        } else {
          setScanStatus(`${statusDot} ${cur}/${tot} artists · ${releasesFound} releases`);
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
        try {
          sessionStorage.setItem(`nmf_scan_${weekDate}`, JSON.stringify({ tracks, timestamp: now }));
        } catch { /* storage full, ignore */ }
        saveWeek({ week_date: weekDate, all_releases: tracks, playlist_master_pushed: false, carousel_generated: false });
      } else if (failCount > totalArtists * 0.5) {
        setError(`Spotify rate limit hit — ${failCount}/${totalArtists} artists failed. Wait 30-60 minutes and try again.`);
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
  }, []);

  // Selection helpers
  const selectionByAlbum = useMemo(() => {
    const map = new Map<string, SelectionSlot>();
    for (const s of selections) map.set(s.albumId, s);
    return map;
  }, [selections]);

  const handleSelectRelease = useCallback((cluster: ReleaseCluster, trackId?: string) => {
    setSelections(prev => {
      // Already selected? Update track choice
      const existing = prev.findIndex(s => s.albumId === cluster.album_spotify_id);
      if (existing >= 0) {
        if (!trackId) return prev; // same click, ignore
        const newTrack = cluster.tracks.find(t => t.track_id === trackId);
        if (!newTrack) return prev;
        const updated = [...prev];
        updated[existing] = { ...updated[existing], track: newTrack };
        return buildSlots(updated);
      }

      // New selection
      const chosenTrackId = trackId || cluster.titleTrackId;
      const track = cluster.tracks.find(t => t.track_id === chosenTrackId) || cluster.tracks[0];

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

  const handleDeselect = useCallback((albumId: string) => {
    setSelections(prev => buildSlots(prev.filter(s => s.albumId !== albumId)));
  }, []);

  const handleShuffle = useCallback((slideGroup: number) => {
    setSelections(prev => shuffleSlideGroup(prev, slideGroup));
  }, []);

  const handleReorder = useCallback((slideGroup: number, fromPos: number, toPos: number) => {
    setSelections(prev => reorderInSlideGroup(prev, slideGroup, fromPos, toPos));
  }, []);

  const handleSetCoverFeature = useCallback((trackId: string) => {
    setSelections(prev => prev.map(s => ({
      ...s,
      isCoverFeature: s.track.track_id === trackId,
    })));
  }, []);

  // Filtered releases for browse mode
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

  // Release counts for filter labels
  const singleCount = useMemo(() => releases.filter(r => r.isSingle).length, [releases]);
  const albumCount = useMemo(() => releases.filter(r => !r.isSingle).length, [releases]);

  // Slide groups for selected view
  const slideGroups = useMemo(() => {
    const groups: SelectionSlot[][] = [];
    for (const slot of selections) {
      while (groups.length < slot.slideGroup) groups.push([]);
      groups[slot.slideGroup - 1].push(slot);
    }
    return groups;
  }, [selections]);

  // Selected tracks for downloads/playlist
  const selectedTracks = useMemo(() => selections.map(s => s.track), [selections]);

  const weekDate = getLastFriday();

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
    // Save to history
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
    await saveWeek(week);
    // Save individual features for the archive
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
    setViewMode('browse');
  };

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
          {token && phase === 'results' && (
            <>
              <button className="btn btn-sm" onClick={() => runScan(token)}>Re-scan</button>
              <button className="btn btn-sm" onClick={() => { localStorage.removeItem('nmf_followed_artists'); runScan(token); }} title="Re-fetch followed artists from Spotify">Refresh Follows</button>
            </>
          )}
          {token && (
            <button className="btn btn-sm btn-danger" onClick={handleDisconnect}>Disconnect</button>
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

      {/* Ready Phase — token received, waiting for explicit scan */}
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
                  <button className="btn btn-gold" onClick={() => token && runScan(token)} style={{ fontSize: '1rem', padding: '14px 32px' }}>
                    Scan New Releases
                  </button>
                  <button className="btn" onClick={loadDemo}>
                    Try Demo
                  </button>
                </div>
              </div>
            )}

            {/* Apple Music source */}
            {activeSource === 'apple-music' && (
              <div style={{ marginTop: 16 }}>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 16, fontSize: '0.85rem' }}>
                  Scan your Apple Music library for new releases.
                </p>
                <button
                  className="btn"
                  onClick={async () => {
                    try {
                      const { authorizeAppleMusic, scanAppleMusicLibrary } = await import('../lib/sources/apple-music');
                      await authorizeAppleMusic();
                      setPhase('scanning');
                      setScanStatus('Scanning Apple Music library...');
                      const cutoff = getLastFriday();
                      const tracks = await scanAppleMusicLibrary({
                        cutoffDate: cutoff,
                        onProgress: (cur, tot, found) => {
                          setScanProgress({ current: cur, total: tot });
                          setScanStatus(`Apple Music: ${cur}/${tot} artists · ${found} releases`);
                        },
                        onReleasesFound: (tracks) => {
                          setAllTracks(tracks);
                          setReleases(groupIntoReleases(tracks));
                        },
                      });
                      setAllTracks(tracks);
                      setReleases(groupIntoReleases(tracks));
                      setPhase('results');
                      setLastScanned(new Date().toISOString());
                    } catch (e) {
                      setError(`Apple Music: ${(e as Error).message}`);
                      setPhase('ready');
                    }
                  }}
                  style={{ fontSize: '1rem', padding: '14px 32px' }}
                >
                  Connect Apple Music
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
          <span>Demo mode — showing sample data. Connect Spotify and scan to see your real releases.</span>
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

      {/* Results Phase */}
      {phase === 'results' && (
        <>
          {/* Selection bar */}
          <div className="selection-bar" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span className="mono" style={{
                  fontSize: '1.5rem', fontWeight: 700,
                  color: selections.length > targetCount ? 'var(--mmmc-red)' : selections.length > 0 ? 'var(--gold)' : 'var(--text-muted)',
                }}>
                  {selections.length}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  / {targetCount} selected
                </span>
                {selections.length > targetCount && (
                  <span style={{ color: 'var(--mmmc-red)', fontSize: '0.75rem', fontWeight: 600 }}>Over limit!</span>
                )}
              </div>

              {/* Target count selector */}
              <select
                value={targetCount}
                onChange={e => setTargetCount(Number(e.target.value) as TargetCount)}
                style={{
                  background: 'var(--midnight)', border: '1px solid var(--midnight-border)',
                  borderRadius: 8, color: 'var(--text-secondary)', padding: '4px 8px',
                  fontSize: '0.75rem', fontFamily: 'var(--font-mono)',
                }}
              >
                {TARGET_COUNTS.map(n => (
                  <option key={n} value={n}>{n} tracks ({n / 8} slides)</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                {singleCount} singles, {albumCount} albums/EPs
              </span>
              <button
                className={`filter-pill ${viewMode === 'browse' ? 'active' : ''}`}
                onClick={() => setViewMode('browse')}
              >
                Browse
              </button>
              <button
                className={`filter-pill ${viewMode === 'selected' ? 'active' : ''}`}
                onClick={() => setViewMode('selected')}
              >
                Selected ({selections.length})
              </button>
              <button
                className={`filter-pill ${viewMode === 'history' ? 'active' : ''}`}
                onClick={() => setViewMode('history')}
              >
                History
              </button>
              <Link to="/newmusicfriday/archive" className="filter-pill" style={{ textDecoration: 'none' }}>
                Archive
              </Link>
            </div>
          </div>

          {/* Browse mode */}
          {viewMode === 'browse' && (
            <>
              <FilterBar
                filter={filter} sort={sort} search={search}
                onFilterChange={setFilter} onSortChange={setSort} onSearchChange={setSearch}
              />

              {/* Download bar */}
              <div style={{
                padding: '12px 24px', borderBottom: '1px solid var(--midnight-border)',
                display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
              }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginRight: 8 }}>All:</span>
                <button className="btn btn-sm" onClick={async () => { setArtDownloading(true); try { await downloadArt(allTracks); } finally { setArtDownloading(false); } }} disabled={artDownloading}>
                  {artDownloading ? 'Downloading...' : 'Download All Art'}
                </button>
                <button className="btn btn-sm" onClick={() => downloadJSON(allTracks, 'nmf-all-tracks.json')}>JSON</button>
                <button className="btn btn-sm" onClick={() => downloadCSV(allTracks, 'nmf-all-tracks.csv')}>CSV</button>

                {selections.length > 0 && (
                  <>
                    <span style={{ color: 'var(--midnight-border)', margin: '0 4px' }}>|</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginRight: 8 }}>Selected:</span>
                    <button className="btn btn-sm" onClick={async () => { setArtDownloading(true); try { await downloadArt(selectedTracks); } finally { setArtDownloading(false); } }} disabled={artDownloading}>
                      Download Selected Art
                    </button>
                    <button className="btn btn-sm" onClick={() => downloadJSON(selectedTracks, 'nmf-curated.json')}>JSON</button>
                    <button className="btn btn-sm" onClick={() => downloadCSV(selectedTracks, 'nmf-curated.csv')}>CSV</button>
                  </>
                )}
              </div>

              {/* Playlist management moved to Selected tab */}

              {/* Release grid */}
              <div style={{ padding: 24, paddingBottom: selections.length > 0 ? 96 : 24 }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 16 }}>
                  <span className="mono">{filteredReleases.length}</span> releases
                  {search && ` matching "${search}"`}
                </p>
                <div className="release-grid">
                  {filteredReleases.map(cluster => (
                    <ClusterCard
                      key={cluster.album_spotify_id}
                      cluster={cluster}
                      selectionSlot={selectionByAlbum.get(cluster.album_spotify_id) || null}
                      hasSelections={selections.length > 0}
                      onSelectRelease={handleSelectRelease}
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
                      {rateLimited ? '429' : '🎵'}
                    </div>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', marginBottom: 8 }}>
                      {rateLimited ? 'Spotify Rate Limited' : 'No releases found this week'}
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 24, maxWidth: 440, margin: '0 auto 24px', lineHeight: 1.6 }}>
                      {rateLimited
                        ? `Spotify throttled the scan — most artist checks failed. Wait 30-60 minutes and try again, or load a saved week from History.`
                        : `Scanned ${artistCount || '~800'} followed artists for releases since last Friday. If this seems wrong, try re-scanning in a few minutes.`
                      }
                    </p>
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                      {token && (
                        <button className="btn btn-sm btn-gold" onClick={() => runScan(token)}>Re-scan</button>
                      )}
                      <button className="btn btn-sm" onClick={() => setViewMode('history')}>Load from History</button>
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
            </>
          )}

          {/* Selected / Slide view */}
          {viewMode === 'selected' && (
            <div style={{ padding: 24 }}>
              {selections.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 48 }}>
                  No tracks selected yet. Switch to Browse to start selecting.
                </p>
              ) : (
                <>
                  {/* 3-step progress */}
                  {(() => {
                    const step1 = selections.length >= 8;
                    const step2 = selections.some(s => s.isCoverFeature);
                    return (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20,
                        padding: '12px 16px', borderRadius: 10,
                        background: 'var(--midnight)', border: '1px solid var(--midnight-border)',
                        fontSize: '0.8rem', flexWrap: 'wrap',
                      }}>
                        <span style={{ color: step1 ? '#3DA877' : 'var(--text-muted)' }}>
                          {step1 ? '✓' : '1.'} Select tracks
                        </span>
                        <span style={{ color: 'var(--midnight-border)' }}>→</span>
                        <span style={{ color: step2 ? '#3DA877' : step1 ? 'var(--gold)' : 'var(--text-muted)' }}>
                          {step2 ? '✓' : '★'} Set cover feature
                        </span>
                        <span style={{ color: 'var(--midnight-border)' }}>→</span>
                        <span style={{ color: step1 && step2 ? 'var(--gold)' : 'var(--text-muted)' }}>
                          3. Generate Carousel
                        </span>
                        {!step2 && step1 && (
                          <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--gold)', fontStyle: 'italic' }}>
                            ★ Tap the star on any card in Browse to set a cover feature
                          </span>
                        )}
                      </div>
                    );
                  })()}

                  {/* Download/export bar */}
                  <div style={{
                    display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 24,
                  }}>
                    <button className="btn btn-sm" onClick={async () => { setArtDownloading(true); try { await downloadArt(selectedTracks); } finally { setArtDownloading(false); } }} disabled={artDownloading}>
                      Download Art
                    </button>
                    <button className="btn btn-sm" onClick={() => downloadJSON(selectedTracks, 'nmf-curated.json')}>JSON</button>
                    <button className="btn btn-sm" onClick={() => downloadCSV(selectedTracks, 'nmf-curated.csv')}>CSV</button>
                    <button className="btn btn-sm" onClick={async () => {
                      await navigator.clipboard.writeText(JSON.stringify(selectedTracks, null, 2));
                      setCopied(true); setTimeout(() => setCopied(false), 2000);
                    }}>{copied ? 'Copied!' : 'Copy Manifest'}</button>
                  </div>

                  {/* Slide groups */}
                  {slideGroups.map((slots, i) => (
                    <SlideGroup
                      key={i}
                      slideNumber={i + 1}
                      slots={slots}
                      onShuffle={() => handleShuffle(i + 1)}
                      onReorder={(from, to) => handleReorder(i + 1, from, to)}
                      onSetCoverFeature={handleSetCoverFeature}
                      onDeselect={handleDeselect}
                    />
                  ))}

                  {/* Carousel generation — new unified panel */}
                  <CarouselPreviewPanel
                    selectedTracks={selectedTracks}
                    coverFeature={selections.find(s => s.isCoverFeature) || null}
                  />

                  {/* Instagram tags — collapsible */}
                  <details style={{ marginTop: 24, borderTop: '1px solid var(--midnight-border)', paddingTop: 16 }}>
                    <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>
                      Instagram Tags ▸
                    </summary>
                    <TagBlocks slideGroups={slideGroups} />
                  </details>

                  {/* Playlist push — collapsible */}
                  <details style={{ marginTop: 16, borderTop: '1px solid var(--midnight-border)', paddingTop: 16 }}>
                    <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>
                      Push to Spotify ▸
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
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Connect Spotify to push to playlist.</p>
                      )}
                    </div>
                  </details>

                  {/* Cross-platform export */}
                  <details style={{ marginTop: 16, borderTop: '1px solid var(--midnight-border)', paddingTop: 16 }}>
                    <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>
                      Cross-Platform Export ▸
                    </summary>
                    <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {['twitter', 'tiktok', 'facebook'].map(p => (
                        <button key={p} className="btn btn-sm" onClick={async () => {
                          const { generatePlatformImage } = await import('../lib/cross-platform');
                          const blob = await generatePlatformImage(selections.map(s => s), weekDate, p as 'twitter' | 'tiktok' | 'facebook');
                          const { downloadBlob } = await import('../lib/canvas-grid');
                          downloadBlob(blob, `nmf-${p}-${weekDate}.png`);
                        }}>
                          {p === 'twitter' ? 'Twitter/X (1200x675)' : p === 'tiktok' ? 'TikTok (1080x1920)' : 'Facebook (1200x630)'}
                        </button>
                      ))}
                    </div>
                  </details>

                  {/* Embed widget */}
                  <EmbedWidget />

                  {/* Save to history */}
                  <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--midnight-border)' }}>
                    <button className="btn btn-gold" onClick={() => handleSaveWeek()}>
                      Save Week to History
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* History view */}
          {viewMode === 'history' && (
            <WeekHistory onLoadWeek={handleLoadWeek} currentWeekDate={weekDate} />
          )}

          {/* Floating action bar */}
          {selections.length > 0 && viewMode === 'browse' && (
            <div style={{
              position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
              background: 'linear-gradient(to top, var(--midnight) 70%, transparent)',
              padding: '20px 32px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ color: 'var(--gold)', fontWeight: 600, fontSize: '0.9rem' }}>
                {selections.length} selected
                {selections.length >= 8
                  ? ` · ${Math.floor(selections.length / 8)} slide${Math.floor(selections.length / 8) > 1 ? 's' : ''} ready`
                  : ` · ${8 - (selections.length % 8)} more for next slide`}
                {!selections.some(s => s.isCoverFeature) && ' · ★ Set a cover feature'}
              </div>
              <button className="btn btn-gold" onClick={() => setViewMode('selected')}>
                Build Carousel ({selections.length}) →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
