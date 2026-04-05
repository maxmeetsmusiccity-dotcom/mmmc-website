import { PLATFORMS } from '../lib/platforms';

interface Props {
  selected: string;
  onSelect: (id: string) => void;
  totalSlides: number;
}

export default function PlatformTabs({ selected, onSelect, totalSlides }: Props) {
  return (
    <div data-testid="platform-tabs" style={{ marginBottom: 16 }}>
      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginBottom: 8 }}>Platform</p>
      <div style={{
        display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 4,
      }}>
        {PLATFORMS.map(platform => {
          const isActive = selected === platform.id;
          const overLimit = totalSlides > platform.maxSlides;

          return (
            <button
              key={platform.id}
              data-testid={`platform-${platform.id}`}
              onClick={() => onSelect(platform.id)}
              style={{
                flexShrink: 0, padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
                background: isActive ? 'var(--midnight-hover)' : 'var(--midnight)',
                border: isActive
                  ? `2px solid ${overLimit ? 'var(--mmmc-red)' : 'var(--gold)'}`
                  : '2px solid var(--midnight-border)',
                transition: 'all 0.15s',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              }}
            >
              <span style={{ fontSize: 'var(--fs-lg)' }}>{platform.icon}</span>
              <span style={{
                fontSize: 'var(--fs-2xs)', fontWeight: 600,
                color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                whiteSpace: 'nowrap',
              }}>
                {platform.name}
              </span>
              <span style={{
                fontSize: 'var(--fs-3xs)',
                color: overLimit && isActive ? 'var(--mmmc-red)' : 'var(--text-muted)',
              }}>
                {platform.aspectLabel} · {platform.maxSlides} max
              </span>
            </button>
          );
        })}
      </div>

      {/* Over-limit warning */}
      {(() => {
        const platform = PLATFORMS.find(p => p.id === selected);
        if (platform && totalSlides > platform.maxSlides) {
          return (
            <div style={{
              marginTop: 8, padding: '6px 10px', borderRadius: 6,
              background: 'rgba(204,53,53,0.1)', border: '1px solid var(--mmmc-red)',
              fontSize: 'var(--fs-xs)', color: 'var(--mmmc-red)',
            }}>
              {platform.name} allows max {platform.maxSlides} slides. You have {totalSlides}. Remove slides or choose a different platform.
            </div>
          );
        }
        return null;
      })()}
    </div>
  );
}
