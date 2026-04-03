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
import ClusterCard from '../components/ClusterCard';
import SlideGroup from '../components/SlideGroup';
import FilterBar from '../components/FilterBar';
import PlaylistPush from '../components/PlaylistPush';

type Phase = 'auth' | 'scanning' | 'results';
type FilterKey = 'all' | 'single' | 'album';
type SortKey = 'date' | 'artist' | 'title';
type ViewMode = 'browse' | 'selected';

const PLAYLIST_ID = '0ve1vYFkWoRaElCmfkw2IB';

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

  // Auto-start scan when token arrives
  useEffect(() => {
    if (token && phase === 'auth' && allTracks.length === 0) {
      runScan(token);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const runScan = useCallback(async (tkn: string) => {
    setPhase('scanning');
    setError('');
    try {
      setScanStatus('Fetching followed artists...');
      const artists = await fetchFollowedArtists(tkn, (cur, tot) => {
        setScanProgress({ current: cur, total: tot });
        setScanStatus(`Loaded ${cur} artists...`);
      });

      const cutoff = getLastFriday();
      setScanStatus(`Scanning releases since ${cutoff}...`);
      setScanProgress({ current: 0, total: artists.length });

      const tracks = await fetchNewReleases(artists, tkn, cutoff, (cur, tot) => {
        setScanProgress({ current: cur, total: tot });
        setScanStatus(`Scanning: ${cur}/${tot} artists checked`);
      });

      setAllTracks(tracks);
      setReleases(groupIntoReleases(tracks));
      setPhase('results');
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
          <Link to="/" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>MMMC</Link>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 600 }}>
            New Music Friday
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {token && phase === 'results' && (
            <button className="btn btn-sm" onClick={() => runScan(token)}>Re-scan</button>
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

              {/* Playlist push */}
              {selections.length > 0 && token && (
                <PlaylistPush
                  selectedCount={selections.length}
                  onPush={handlePlaylistPush}
                  getPlaylistName={() => getPlaylistName(token, PLAYLIST_ID)}
                />
              )}

              {/* Release grid */}
              <div style={{ padding: 24 }}>
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
                    />
                  ))}
                </div>
                {filteredReleases.length === 0 && (
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 48 }}>
                    {releases.length === 0 ? 'No new releases found since last Friday.' : 'No releases match your filters.'}
                  </p>
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
                  {/* Download/push bar for selected */}
                  <div style={{
                    display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 24,
                  }}>
                    <button className="btn btn-sm" onClick={async () => { setArtDownloading(true); try { await downloadArt(selectedTracks); } finally { setArtDownloading(false); } }} disabled={artDownloading}>
                      Download Selected Art
                    </button>
                    <button className="btn btn-sm" onClick={() => downloadJSON(selectedTracks, 'nmf-curated.json')}>JSON</button>
                    <button className="btn btn-sm" onClick={() => downloadCSV(selectedTracks, 'nmf-curated.csv')}>CSV</button>
                    {token && (
                      <button className="btn btn-gold btn-sm" onClick={() => handlePlaylistPush('replace')}>
                        Push to Playlist (Replace)
                      </button>
                    )}
                  </div>

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
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
