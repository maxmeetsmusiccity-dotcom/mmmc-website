import { getVisibleTitleTemplates } from '../lib/title-templates';
import { useAuth } from '../lib/auth-context';

interface Props {
  selected: string;
  onSelect: (id: string) => void;
  onHover?: (id: string | null) => void;
}

export default function TitleTemplatePicker({ selected, onSelect, onHover }: Props) {
  const { user } = useAuth();
  const visibleTemplates = getVisibleTitleTemplates(user?.email || undefined);

  return (
    <div data-testid="title-template-picker" style={{ marginBottom: 16 }}>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8 }}>Title Slide Template</p>
      <div style={{
        display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8,
        WebkitOverflowScrolling: 'touch',
      }}>
        {/* "No Title Slide" option */}
        <button
          onClick={() => onSelect('none')}
          onMouseEnter={() => onHover?.('none')}
          onMouseLeave={() => onHover?.(null)}
          style={{
            flexShrink: 0, width: 90, padding: 6, borderRadius: 8, cursor: 'pointer',
            background: selected === 'none' ? 'var(--midnight-hover)' : 'var(--midnight)',
            border: selected === 'none' ? '2px solid var(--gold)' : '2px solid var(--midnight-border)',
            transition: 'all 0.15s',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          }}
        >
          <div style={{
            width: '100%', height: 60, borderRadius: 4,
            background: 'var(--midnight-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.2rem', color: 'var(--text-muted)',
          }}>
            ✕
          </div>
          <span style={{ fontSize: '0.6rem', fontWeight: 600, color: selected === 'none' ? 'var(--gold)' : 'var(--text-muted)' }}>
            No Title
          </span>
        </button>

        {visibleTemplates.map(t => {
          const isActive = selected === t.id;
          return (
            <button
              key={t.id}
              data-testid={`title-template-${t.id}`}
              onClick={() => onSelect(t.id)}
              onMouseEnter={() => onHover?.(t.id)}
              onMouseLeave={() => onHover?.(null)}
              style={{
                flexShrink: 0, width: 90, padding: 6, borderRadius: 8, cursor: 'pointer',
                background: isActive ? 'var(--midnight-hover)' : 'var(--midnight)',
                border: isActive ? `2px solid ${t.accent}` : '2px solid var(--midnight-border)',
                transition: 'all 0.15s',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              }}
            >
              {/* Mini color preview */}
              <div style={{
                width: '100%', height: 60, borderRadius: 4, overflow: 'hidden',
                background: t.background,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                position: 'relative',
              }}>
                <span style={{
                  color: t.textPrimary, fontSize: '0.4rem', fontWeight: t.headlineWeight,
                  fontFamily: t.headlineFont, textTransform: t.headlineCase,
                  textShadow: t.glow.passes > 0 ? `0 0 ${t.glow.blur * 0.3}px ${t.glow.color}` : 'none',
                }}>
                  NEW MUSIC FRIDAY
                </span>
                <div style={{
                  width: 20, height: 20, borderRadius: 2, marginTop: 4,
                  background: `linear-gradient(135deg, ${t.accent}, ${t.textSecondary})`,
                  border: t.featuredBorder > 0 ? `1px solid ${t.featuredBorderColor}` : 'none',
                }} />
              </div>
              <span style={{
                fontSize: '0.55rem', fontWeight: 600,
                color: isActive ? t.accent : 'var(--text-secondary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                maxWidth: 80,
              }}>
                {t.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
