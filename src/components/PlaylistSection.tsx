import PlaylistCreate from './PlaylistCreate';
import { getPlaylistName } from '../lib/spotify';
import { showToast } from './Toast';
import type { TrackItem } from '../lib/spotify';

const PLAYLIST_ID = '0ve1vYFkWoRaElCmfkw2IB';

interface PlaylistSectionProps {
  token: string | null;
  selectedCount: number;
  weekDate: string;
  selectedTracks: TrackItem[];
  onCreateAndPush: (name: string, isPublic: boolean) => Promise<any>;
  onPushMaster: (mode: 'replace' | 'append') => Promise<void>;
  startAuth: () => void;
  setError: (msg: string) => void;
}

export default function PlaylistSection({
  token, selectedCount, weekDate, selectedTracks,
  onCreateAndPush, onPushMaster, startAuth, setError,
}: PlaylistSectionProps) {
  if (!token) return null;

  return (
    <details style={{ marginTop: 16, borderTop: '1px solid var(--midnight-border)', paddingTop: 16 }}>
      <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 'var(--fs-lg)', fontWeight: 600 }}>
        Push to Playlist
      </summary>
      <div style={{ marginTop: 12 }}>
        {token ? (
          <PlaylistCreate
            selectedCount={selectedCount}
            weekDate={weekDate}
            onCreateAndPush={onCreateAndPush}
            onPushMaster={onPushMaster}
            getPlaylistName={() => getPlaylistName(token, PLAYLIST_ID)}
          />
        ) : (
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-md)', marginBottom: 12 }}>
              Connect a music service to create a playlist from your curated picks.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-sm btn-spotify" onClick={startAuth}>
                Connect Spotify
              </button>
              <button
                className="btn btn-sm"
                onClick={async () => {
                  try {
                    const { authorizeAppleMusic } = await import('../lib/sources/apple-music');
                    await authorizeAppleMusic();
                    const music = (window as any).MusicKit?.getInstance();
                    if (!music) throw new Error('MusicKit not available');
                    const name = `New Music Friday \u2014 ${new Date(weekDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
                    const trackIds = selectedTracks
                      .filter(t => t.apple_music_url)
                      .map(t => {
                        const match = t.apple_music_url?.match(/\/(\d+)$/);
                        return match ? { id: match[1], type: 'songs' as const } : null;
                      })
                      .filter(Boolean);
                    if (trackIds.length === 0) {
                      setError('No Apple Music track IDs found. Run Apple Music enrichment first.');
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
                    setError('');
                    showToast(`Created Apple Music playlist: ${name}`, 'success');
                  } catch (e) {
                    setError(`Apple Music error: ${(e as Error).message}`);
                  }
                }}
              >
                Create Apple Music Playlist
              </button>
            </div>
          </div>
        )}
      </div>
    </details>
  );
}
