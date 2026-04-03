import { useState } from 'react';

interface Props {
  selectedCount: number;
  token: string;
  weekDate: string;
  onCreateAndPush: (name: string, isPublic: boolean) => Promise<{ id: string; url: string }>;
  onPushMaster: (mode: 'replace' | 'append') => Promise<void>;
  getPlaylistName: () => Promise<string>;
}

export default function PlaylistCreate({
  selectedCount, weekDate, onCreateAndPush, onPushMaster, getPlaylistName,
}: Props) {
  const [masterMode, setMasterMode] = useState<'replace' | 'append'>('replace');
  const [newName, setNewName] = useState(`New Music Friday — ${formatWeekDate(weekDate)}`);
  const [isPublic, setIsPublic] = useState(true);
  const [pushing, setPushing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [masterResult, setMasterResult] = useState<'success' | 'error' | null>(null);
  const [newResult, setNewResult] = useState<{ url: string } | 'error' | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [masterName, setMasterName] = useState('');

  useState(() => { getPlaylistName().then(setMasterName).catch(() => setMasterName('NMF Playlist')); });

  const handlePushMaster = async () => {
    setPushing(true);
    setMasterResult(null);
    try {
      await onPushMaster(masterMode);
      setMasterResult('success');
    } catch { setMasterResult('error'); }
    finally { setPushing(false); }
  };

  const handleCreateNew = async () => {
    setCreating(true);
    setNewResult(null);
    try {
      const result = await onCreateAndPush(newName, isPublic);
      setNewResult(result);
    } catch { setNewResult('error'); }
    finally { setCreating(false); }
  };

  return (
    <div style={{
      padding: '16px 24px', borderBottom: '1px solid var(--midnight-border)',
    }}>
      {/* Master playlist push */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Master:</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className={`filter-pill ${masterMode === 'replace' ? 'active' : ''}`} onClick={() => setMasterMode('replace')}>Replace</button>
          <button className={`filter-pill ${masterMode === 'append' ? 'active' : ''}`} onClick={() => setMasterMode('append')}>Append</button>
        </div>
        <button className="btn btn-sm btn-gold" onClick={() => setShowConfirm(true)} disabled={pushing}>
          {pushing ? 'Pushing...' : `Push ${selectedCount} to ${masterName || 'playlist'}`}
        </button>
        {masterResult === 'success' && <span style={{ color: '#3DA877', fontSize: '0.8rem', fontWeight: 600 }}>Done!</span>}
        {masterResult === 'error' && <span style={{ color: 'var(--mmmc-red)', fontSize: '0.8rem' }}>Failed</span>}
      </div>

      {/* Create new playlist */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>New:</span>
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          style={{
            background: 'var(--midnight)', border: '1px solid var(--midnight-border)',
            borderRadius: 8, padding: '6px 12px', color: 'var(--text-primary)',
            fontSize: '0.8rem', fontFamily: 'var(--font-body)', width: 280,
          }}
        />
        <button
          className={`filter-pill ${isPublic ? 'active' : ''}`}
          onClick={() => setIsPublic(!isPublic)}
          style={{ fontSize: '0.7rem' }}
        >
          {isPublic ? 'Public' : 'Private'}
        </button>
        <button className="btn btn-sm" onClick={handleCreateNew} disabled={creating}>
          {creating ? 'Creating...' : 'Create & Add Tracks'}
        </button>
        {newResult && newResult !== 'error' && (
          <a href={newResult.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: 'var(--spotify-green)' }}>
            Open playlist
          </a>
        )}
        {newResult === 'error' && <span style={{ color: 'var(--mmmc-red)', fontSize: '0.8rem' }}>Failed</span>}
      </div>

      {/* Confirm modal */}
      {showConfirm && (
        <div className="modal-overlay" onClick={() => setShowConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', marginBottom: 16 }}>
              Confirm Playlist Update
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 16 }}>
              {masterMode === 'replace' ? (
                <>Replace all tracks in <em>{masterName}</em> with {selectedCount} selected tracks?</>
              ) : (
                <>Append {selectedCount} tracks to <em>{masterName}</em>?</>
              )}
            </p>
            {masterMode === 'replace' && (
              <p style={{ color: 'var(--mmmc-red)', fontSize: '0.8rem', marginBottom: 16 }}>
                This removes all existing tracks.
              </p>
            )}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button className="btn btn-sm" onClick={() => setShowConfirm(false)}>Cancel</button>
              <button className="btn btn-gold btn-sm" onClick={() => { setShowConfirm(false); handlePushMaster(); }} disabled={pushing}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatWeekDate(d: string): string {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}
