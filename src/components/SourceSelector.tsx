import { SOURCES, type MusicSource } from '../lib/sources/types';

interface Props {
  selected: MusicSource['id'];
  onSelect: (id: MusicSource['id']) => void;
  spotifyConnected: boolean;
  appleMusicConnected: boolean;
}

export default function SourceSelector({
  selected, onSelect, spotifyConnected, appleMusicConnected,
}: Props) {
  return (
    <div data-testid="source-selector" style={{ marginBottom: 16 }}>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8 }}>Source</p>
      <div style={{ display: 'flex', gap: 10 }}>
        {SOURCES.map(source => {
          const isActive = selected === source.id;
          const isConnected = source.id === 'spotify' ? spotifyConnected
            : source.id === 'apple-music' ? appleMusicConnected
            : true; // manual always available

          return (
            <button
              key={source.id}
              data-testid={`source-${source.id}`}
              onClick={() => onSelect(source.id)}
              style={{
                flex: 1, padding: '12px 10px', borderRadius: 10, cursor: 'pointer',
                background: isActive ? 'var(--midnight-hover)' : 'var(--midnight)',
                border: isActive ? '2px solid var(--gold)' : '2px solid var(--midnight-border)',
                transition: 'all 0.15s',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                opacity: isActive ? 1 : 0.7,
              }}
            >
              <span style={{ fontSize: '1.5rem' }}>{source.icon}</span>
              <span style={{
                fontSize: '0.8rem', fontWeight: 600,
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              }}>
                {source.name}
              </span>
              <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                {source.description}
              </span>
              {source.requiresAuth && (
                <span style={{
                  fontSize: '0.55rem', fontWeight: 600,
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
