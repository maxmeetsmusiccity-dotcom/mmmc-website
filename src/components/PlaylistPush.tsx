import { useState, useEffect } from 'react';

interface Props {
  selectedCount: number;
  onPush: (mode: 'replace' | 'append') => Promise<void>;
  getPlaylistName: () => Promise<string>;
}

export default function PlaylistPush({ selectedCount, onPush, getPlaylistName }: Props) {
  const [mode, setMode] = useState<'replace' | 'append'>('replace');
  const [showConfirm, setShowConfirm] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [result, setResult] = useState<'success' | 'error' | null>(null);
  const [playlistName, setPlaylistName] = useState('');

  useEffect(() => {
    getPlaylistName().then(setPlaylistName).catch(() => setPlaylistName('NMF Playlist'));
  }, [getPlaylistName]);

  const handleConfirm = async () => {
    setPushing(true);
    setResult(null);
    try {
      await onPush(mode);
      setResult('success');
      setShowConfirm(false);
    } catch {
      setResult('error');
    } finally {
      setPushing(false);
    }
  };

  return (
    <>
      <div style={{
        padding: '12px 24px',
        borderBottom: '1px solid var(--midnight-border)',
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Playlist:</span>

        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className={`filter-pill ${mode === 'replace' ? 'active' : ''}`}
            onClick={() => setMode('replace')}
          >
            Replace
          </button>
          <button
            className={`filter-pill ${mode === 'append' ? 'active' : ''}`}
            onClick={() => setMode('append')}
          >
            Append
          </button>
        </div>

        <button
          className="btn btn-gold btn-sm"
          onClick={() => setShowConfirm(true)}
          disabled={pushing}
        >
          {pushing ? 'Pushing...' : `Add ${selectedCount} tracks to Spotify`}
        </button>

        {result === 'success' && (
          <span style={{ color: '#3DA877', fontSize: '0.8rem', fontWeight: 600 }}>
            Done!
          </span>
        )}
        {result === 'error' && (
          <span style={{ color: 'var(--mmmc-red)', fontSize: '0.8rem', fontWeight: 600 }}>
            Failed — check console
          </span>
        )}
      </div>

      {/* Confirmation modal */}
      {showConfirm && (
        <div className="modal-overlay" onClick={() => setShowConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', marginBottom: 16 }}>
              Confirm Playlist Update
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 8 }}>
              {mode === 'replace' ? (
                <>
                  <strong style={{ color: 'var(--gold)' }}>Replace</strong> all tracks in <em>{playlistName}</em> with your {selectedCount} selected tracks?
                </>
              ) : (
                <>
                  <strong style={{ color: 'var(--gold)' }}>Append</strong> {selectedCount} tracks to <em>{playlistName}</em>?
                </>
              )}
            </p>
            {mode === 'replace' && (
              <p style={{ color: 'var(--mmmc-red)', fontSize: '0.8rem', marginBottom: 16 }}>
                This will remove all existing tracks from the playlist.
              </p>
            )}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn btn-sm" onClick={() => setShowConfirm(false)}>
                Cancel
              </button>
              <button className="btn btn-gold btn-sm" onClick={handleConfirm} disabled={pushing}>
                {pushing ? 'Pushing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
