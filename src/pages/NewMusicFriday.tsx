import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { startAuth, exchangeCode, getToken, clearToken } from '../lib/auth';
import {
  fetchFollowedArtists,
  fetchNewReleases,
  getLastFriday,
  replacePlaylistTracks,
  appendPlaylistTracks,
  getPlaylistName,
  type TrackItem,
} from '../lib/spotify';
import { downloadJSON, downloadCSV, downloadArt } from '../lib/downloads';
import ReleaseCard from '../components/ReleaseCard';
import SelectionBar from '../components/SelectionBar';
import FilterBar from '../components/FilterBar';
import PlaylistPush from '../components/PlaylistPush';

type Phase = 'auth' | 'scanning' | 'results';
type SortKey = 'date' | 'artist' | 'title';
type FilterKey = 'all' | 'single' | 'album';

const PLAYLIST_ID = '0ve1vYFkWoRaElCmfkw2IB';

export default function NewMusicFriday() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [token, setToken] = useState<string | null>(getToken());
  const [phase, setPhase] = useState<Phase>(token ? 'auth' : 'auth');
  const [tracks, setTracks] = useState<TrackItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [scanStatus, setScanStatus] = useState('');
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });
  const [filter, setFilter] = useState<FilterKey>('all');
  const [sort, setSort] = useState<SortKey>('date');
  const [search, setSearch] = useState('');
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [error, setError] = useState('');
  const [artDownloading, setArtDownloading] = useState(false);

  // Handle OAuth callback
  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      setSearchParams({}, { replace: true });
      exchangeCode(code)
        .then(t => {
          setToken(t);
          setError('');
        })
        .catch(e => setError(`Auth failed: ${e.message}`));
    }
  }, [searchParams, setSearchParams]);

  // Auto-start scan when token arrives
  useEffect(() => {
    if (token && phase === 'auth' && tracks.length === 0) {
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

      const results = await fetchNewReleases(artists, tkn, cutoff, (cur, tot) => {
        setScanProgress({ current: cur, total: tot });
        setScanStatus(`Scanning: ${cur}/${tot} artists checked`);
      });

      setTracks(results);
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

  const toggleSelect = useCallback((trackId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(trackId)) {
        next.delete(trackId);
      } else {
        if (next.size >= 32) {
          // Soft cap — allow but we'll show warning
        }
        next.add(trackId);
      }
      return next;
    });
  }, []);

  const filteredTracks = useMemo(() => {
    let result = [...tracks];

    // Filter by type
    if (filter === 'single') {
      result = result.filter(t => t.album_type === 'single' && t.total_tracks === 1);
    } else if (filter === 'album') {
      result = result.filter(t => t.album_type === 'album' || t.total_tracks > 1);
    }

    // Search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(t =>
        t.track_name.toLowerCase().includes(q) ||
        t.artist_names.toLowerCase().includes(q) ||
        t.album_name.toLowerCase().includes(q)
      );
    }

    // Show selected only
    if (showSelectedOnly) {
      result = result.filter(t => selected.has(t.track_id));
    }

    // Sort
    if (sort === 'artist') {
      result.sort((a, b) => a.artist_names.localeCompare(b.artist_names));
    } else if (sort === 'title') {
      result.sort((a, b) => a.track_name.localeCompare(b.track_name));
    }
    // 'date' is default sort from API

    return result;
  }, [tracks, filter, sort, search, showSelectedOnly, selected]);

  const selectedTracks = useMemo(
    () => tracks.filter(t => selected.has(t.track_id)),
    [tracks, selected],
  );

  const handleDisconnect = () => {
    clearToken();
    setToken(null);
    setPhase('auth');
    setTracks([]);
    setSelected(new Set());
  };

  const handleDownloadAllArt = async () => {
    setArtDownloading(true);
    try {
      await downloadArt(tracks);
    } finally {
      setArtDownloading(false);
    }
  };

  const handleDownloadSelectedArt = async () => {
    setArtDownloading(true);
    try {
      await downloadArt(selectedTracks);
    } finally {
      setArtDownloading(false);
    }
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
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link to="/" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            MMMC
          </Link>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.25rem',
            fontWeight: 600,
          }}>
            New Music Friday
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {token && phase === 'results' && (
            <button className="btn btn-sm" onClick={() => runScan(token)}>
              Re-scan
            </button>
          )}
          {token && (
            <button className="btn btn-sm btn-danger" onClick={handleDisconnect}>
              Disconnect
            </button>
          )}
        </div>
      </header>

      {error && (
        <div style={{
          padding: '12px 24px',
          background: 'rgba(204, 53, 53, 0.1)',
          borderBottom: '1px solid var(--mmmc-red)',
          color: '#E04A4A',
          fontSize: '0.875rem',
        }}>
          {error}
        </div>
      )}

      {/* Auth Phase */}
      {phase === 'auth' && !token && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          padding: 24,
          textAlign: 'center',
        }}>
          <div className="animate-float-up" style={{ maxWidth: 400 }}>
            <h2 style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.75rem',
              marginBottom: 12,
            }}>
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
                        // Try to extract code from URL
                        try {
                          const url = new URL(val);
                          const code = url.searchParams.get('code');
                          if (code) {
                            exchangeCode(code).then(t => { setToken(t); setError(''); }).catch(err => setError(err.message));
                            return;
                          }
                        } catch { /* not a URL */ }
                        // Try as raw token
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
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          padding: 24,
          textAlign: 'center',
        }}>
          <div style={{ maxWidth: 480, width: '100%' }}>
            <h2 style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.5rem',
              marginBottom: 24,
            }}>
              Scanning<span style={{ color: 'var(--gold)' }}>...</span>
            </h2>
            <div className="progress-bar" style={{ marginBottom: 16 }}>
              <div
                className="progress-bar-fill"
                style={{
                  width: scanProgress.total > 0
                    ? `${(scanProgress.current / scanProgress.total) * 100}%`
                    : '0%',
                }}
              />
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
          <SelectionBar
            selectedCount={selected.size}
            totalTracks={tracks.length}
            showSelectedOnly={showSelectedOnly}
            onToggleShowSelected={() => setShowSelectedOnly(v => !v)}
          />

          {/* Filter/sort/search bar */}
          <FilterBar
            filter={filter}
            sort={sort}
            search={search}
            onFilterChange={setFilter}
            onSortChange={setSort}
            onSearchChange={setSearch}
          />

          {/* Download bar — all */}
          <div style={{
            padding: '12px 24px',
            borderBottom: '1px solid var(--midnight-border)',
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginRight: 8 }}>All:</span>
            <button className="btn btn-sm" onClick={handleDownloadAllArt} disabled={artDownloading}>
              {artDownloading ? 'Downloading...' : 'Download All Art'}
            </button>
            <button className="btn btn-sm" onClick={() => downloadJSON(tracks, 'nmf-all-tracks.json')}>
              JSON
            </button>
            <button className="btn btn-sm" onClick={() => downloadCSV(tracks, 'nmf-all-tracks.csv')}>
              CSV
            </button>

            {selected.size > 0 && (
              <>
                <span style={{ color: 'var(--midnight-border)', margin: '0 4px' }}>|</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginRight: 8 }}>Selected:</span>
                <button className="btn btn-sm" onClick={handleDownloadSelectedArt} disabled={artDownloading}>
                  Download Selected Art
                </button>
                <button className="btn btn-sm" onClick={() => downloadJSON(selectedTracks, 'nmf-curated.json')}>
                  JSON
                </button>
                <button className="btn btn-sm" onClick={() => downloadCSV(selectedTracks, 'nmf-curated.csv')}>
                  CSV
                </button>
              </>
            )}
          </div>

          {/* Playlist push */}
          {selected.size > 0 && token && (
            <PlaylistPush
              selectedCount={selected.size}
              token={token}
              playlistId={PLAYLIST_ID}
              onPush={handlePlaylistPush}
              getPlaylistName={() => getPlaylistName(token, PLAYLIST_ID)}
            />
          )}

          {/* Track grid */}
          <div style={{ padding: 24 }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 16 }}>
              <span className="mono">{filteredTracks.length}</span> tracks
              {search && ` matching "${search}"`}
              {showSelectedOnly && ' (selected only)'}
            </p>
            <div className="release-grid">
              {filteredTracks.map(track => (
                <ReleaseCard
                  key={track.track_id}
                  track={track}
                  isSelected={selected.has(track.track_id)}
                  hasSelections={selected.size > 0}
                  onToggle={() => toggleSelect(track.track_id)}
                />
              ))}
            </div>
            {filteredTracks.length === 0 && (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 48, fontSize: '1rem' }}>
                {tracks.length === 0 ? 'No new releases found since last Friday.' : 'No tracks match your filters.'}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
