import { TEMPLATES } from '../lib/carousel-templates';

interface Props {
  selected: string;
  onSelect: (id: string) => void;
}

export default function TemplateSelector({ selected, onSelect }: Props) {
  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8 }}>Template</p>
      <div style={{
        display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8,
        WebkitOverflowScrolling: 'touch', scrollSnapType: 'x mandatory',
      }}>
        {TEMPLATES.map(t => (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            style={{
              flexShrink: 0, scrollSnapAlign: 'start',
              width: 100, padding: 8, borderRadius: 10, cursor: 'pointer',
              background: selected === t.id ? 'var(--midnight-hover)' : 'var(--midnight)',
              border: selected === t.id ? `2px solid ${t.accent}` : '2px solid var(--midnight-border)',
              transition: 'all 0.2s',
            }}
          >
            {/* Color preview swatch */}
            <div style={{
              width: '100%', height: 48, borderRadius: 6, marginBottom: 6,
              background: t.background,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: `1px solid ${t.accent}33`,
            }}>
              <span style={{
                color: t.accent, fontSize: '0.55rem', fontWeight: 700,
                fontFamily: t.scriptFont, letterSpacing: 0.5,
              }}>
                NMF
              </span>
            </div>
            <p style={{
              fontSize: '0.65rem', fontWeight: 600,
              color: selected === t.id ? t.accent : 'var(--text-secondary)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {t.name}
            </p>
            <p style={{
              fontSize: '0.5rem', color: 'var(--text-muted)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {t.description}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
