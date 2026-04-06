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

          // Spotify is admin-only until Extended Quota Mode is approved
          const isSpotifyLocked = source.id === 'spotify' && !isAdmin;

          return (
            <button
              key={source.id}
              data-testid={`source-${source.id}`}
              onClick={() => !isSpotifyLocked && onSelect(source.id)}
              style={{
                flex: 1, padding: '12px 10px', borderRadius: 10,
                cursor: isSpotifyLocked ? 'not-allowed' : 'pointer',
                background: isActive ? 'var(--midnight-hover)' : 'var(--midnight)',
                border: isActive ? '2px solid var(--gold)' : '2px solid var(--midnight-border)',
                transition: 'all 0.15s',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                opacity: isSpotifyLocked ? 0.35 : isActive ? 1 : 0.7,
                position: 'relative', overflow: 'hidden',
              }}
            >
              {isSpotifyLocked && (
                <div style={{
                  position: 'absolute', top: 8, right: -24, transform: 'rotate(45deg)',
                  background: 'var(--gold-dark)', color: 'var(--midnight)', fontSize: 8,
                  fontWeight: 700, padding: '2px 28px', letterSpacing: '0.05em',
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
                {isSpotifyLocked ? 'Available soon' : source.description}
              </span>
              {source.requiresAuth && !isSpotifyLocked && (
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
