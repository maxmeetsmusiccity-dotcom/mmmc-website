import { GRID_LAYOUTS, type GridLayout, computeCellRects } from '../lib/grid-layouts';

interface Props {
  selected: string;
  onSelect: (id: string) => void;
}

/** Render a tiny SVG icon of the grid layout */
function LayoutIcon({ layout, size = 36, active }: { layout: GridLayout; size?: number; active: boolean }) {
  const pad = 2;
  const gap = 1;
  const rects = computeCellRects(layout, pad, pad, size - pad * 2, size - pad * 2, gap);
  const accent = active ? '#D4A843' : '#6B7F95';
  const logoColor = active ? '#B08A2E' : '#4A5568';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <rect x={0} y={0} width={size} height={size} rx={3} fill="none" />
      {rects.map((r, i) => (
        <rect
          key={i}
          x={r.x}
          y={r.y}
          width={r.w}
          height={r.h}
          rx={1}
          fill={r.isLogo ? logoColor : accent}
          opacity={r.isLogo ? 0.6 : 0.85}
        />
      ))}
    </svg>
  );
}

export default function GridLayoutSelector({ selected, onSelect }: Props) {
  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8 }}>Grid Layout</p>
      <div style={{
        display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6,
        WebkitOverflowScrolling: 'touch',
      }}>
        {GRID_LAYOUTS.map(layout => {
          const isActive = selected === layout.id;
          return (
            <button
              key={layout.id}
              data-testid="grid-layout-button"
              onClick={() => onSelect(layout.id)}
              title={`${layout.name} — ${layout.trackSlots} tracks${layout.hasLogo ? ' + logo' : ''}`}
              style={{
                flexShrink: 0,
                width: 64, padding: '6px 4px', borderRadius: 8, cursor: 'pointer',
                background: isActive ? 'var(--midnight-hover)' : 'var(--midnight)',
                border: isActive ? '2px solid var(--gold)' : '2px solid var(--midnight-border)',
                transition: 'all 0.15s',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              }}
            >
              <LayoutIcon layout={layout} size={36} active={isActive} />
              <span style={{
                fontSize: '0.5rem', fontWeight: 600,
                color: isActive ? 'var(--gold)' : 'var(--text-muted)',
                whiteSpace: 'nowrap',
              }}>
                {layout.name}
              </span>
              <span style={{
                fontSize: '0.45rem',
                color: 'var(--text-muted)',
              }}>
                {layout.trackSlots}t{layout.hasLogo ? '+L' : ''}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
