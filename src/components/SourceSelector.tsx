import { SOURCES, type MusicSource } from '../lib/sources/types';
import { useAuth } from '../lib/auth-context';

const MAX_EMAILS = new Set(['maxmeetsmusiccity@gmail.com', 'maxblachman@gmail.com']);

interface Props {
  selected: MusicSource['id'];
  onSelect: (id: MusicSource['id']) => void;
  spotifyConnected: boolean;
  appleMusicConnected: boolean;
}

export default function SourceSelector({
  selected, onSelect, spotifyConnected, appleMusicConnected,
}: Props) {
  const { user } = useAuth();
  const isAdmin = MAX_EMAILS.has(user?.email || '');

  return (
    <div data-testid="source-selector" style={{ marginBottom: 16 }}>
      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginBottom: 8 }}>Source</p>
      <div style={{ display: 'flex', gap: 10 }}>
        {SOURCES.map(source => {
          const isActive = selected === source.id;
          const isConnected = source.id === 'spotify' ? spotifyConnected
            : source.id === 'apple-music' ? appleMusicConnected
            : true;

          // Spotify is admin-only until quota approved. Apple Music is open to all.
          const isSpotifyLocked = source.id === 'spotify' && !isAdmin;
          const isLocked = isSpotifyLocked;

          return (
            <button
              key={source.id}
              data-testid={`source-${source.id}`}
              onClick={() => !isLocked && onSelect(source.id)}
              style={{
                flex: 1, padding: '12px 10px', borderRadius: 10,
                cursor: isLocked ? 'not-allowed' : 'pointer',
                background: isActive ? 'var(--midnight-hover)' : 'var(--midnight)',
                border: isActive ? '2px solid var(--gold)' : '2px solid var(--midnight-border)',
                transition: 'all 0.15s',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                opacity: isLocked ? 0.55 : isActive ? 1 : 0.7,
                position: 'relative', overflow: 'hidden',
              }}
            >
              {isLocked && (
                <div style={{
                  position: 'absolute', top: '50%', left: '50%',
                  transform: 'translate(-50%, -50%) rotate(-20deg)',
                  background: 'var(--gold)', color: 'var(--midnight)', fontSize: 11,
                  fontWeight: 800, padding: '4px 16px', letterSpacing: '0.08em',
                  borderRadius: 3, whiteSpace: 'nowrap',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                }}>
                  COMING SOON
                </div>
              )}
              <span style={{ fontSize: 'var(--fs-3xl)' }}>{source.icon}</span>
              <span style={{
                fontSize: 'var(--fs-md)', fontWeight: 600,
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              }}>
                {source.name}
              </span>
              <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)' }}>
                {isLocked ? 'Scan your library' : source.description}
              </span>
              {source.requiresAuth && !isLocked && (
                <span style={{
                  fontSize: 'var(--fs-3xs)', fontWeight: 600,
                  color: isConnected ? '#3DA877' : 'var(--text-muted)',
                }}>
                  {isConnected ? 'Connected' : 'Connect'}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
