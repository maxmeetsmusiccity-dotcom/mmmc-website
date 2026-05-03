import { useMemo } from 'react';
import { getGridsForCount, computeCellRects, suggestBetterCounts, type GridConfig } from '../lib/grid-layouts';

interface Props {
  trackCount: number;
  selected: string;
  onSelect: (id: string) => void;
  onChangeCount?: (count: number) => void;
}

/** Render a tiny SVG icon of the grid layout */
function LayoutIcon({ config, size = 36, active }: { config: GridConfig; size?: number; active: boolean }) {
  const pad = 2;
  const gap = 1;
  const rects = computeCellRects(config, pad, pad, size - pad * 2, size - pad * 2, gap);
  const accent = active ? '#F5C453' : '#6B7F95';
  const logoColor = active ? '#B08A2E' : '#4A5568';
  const emptyColor = active ? '#2A3A5C' : '#1E2D4F';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {rects.map((r, i) => (
        <g key={i}>
          <rect
            x={r.x} y={r.y} width={r.w} height={r.h} rx={1}
            fill={r.isLogo ? logoColor : r.isEmpty ? emptyColor : accent}
            opacity={r.isLogo ? 0.8 : r.isEmpty ? 0.3 : 0.85}
          />
          {r.isLogo && (
            <text
              x={r.x + r.w / 2} y={r.y + r.h / 2 + 1}
              textAnchor="middle" dominantBaseline="middle"
              fill={active ? '#F5E6B8' : '#A0B4C8'}
              fontSize={Math.max(3, Math.round(r.w * 0.45))}
              fontWeight={700}
            >
              ★
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

export default function GridLayoutSelector({ trackCount, selected, onSelect, onChangeCount }: Props) {
  const opts = useMemo(() => getGridsForCount(trackCount), [trackCount]);
  const betterCounts = useMemo(() => suggestBetterCounts(trackCount), [trackCount]);
  const hasExactFit = opts.exact.length > 0 && opts.exact.some(g => g.columns > 1 && g.rows > 1);

  // Flatten all grids into one list with category labels
  const allGrids = useMemo(() => {
    const list: { config: GridConfig; type: string }[] = [];
    for (const g of opts.exact) list.push({ config: g, type: 'exact' });
    for (const g of opts.logo) list.push({ config: g, type: 'logo' });
    for (const g of opts.mosaic) list.push({ config: g, type: 'mosaic' });
    for (const g of opts.close) list.push({ config: g, type: 'close' });
    return list;
  }, [opts]);

  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ fontSize: 'var(--fs-lg)', color: 'var(--text-muted)', marginBottom: 6 }}>
        Grid Layout <span className="mono" style={{ color: 'var(--gold)' }}>({trackCount} tracks &middot; {allGrids.length} options)</span>
      </p>

      {/* Single scrollable row with all grid options */}
      <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 6, WebkitOverflowScrolling: 'touch' }}>
        {allGrids.map(({ config, type }) => {
          const isActive = selected === config.id;
          return (
            <button
              key={config.id}
              data-testid="grid-layout-button"
              onClick={() => onSelect(config.id)}
              title={`${config.name} — ${config.trackSlots} tracks${config.hasLogo ? ' + logo' : ''}${config.emptyCount > 0 ? ` (${config.emptyCount} empty)` : ''} [${type}]`}
              style={{
                flexShrink: 0,
                width: 52, padding: '3px 2px', borderRadius: 6, cursor: 'pointer',
                background: isActive ? 'var(--midnight-hover)' : 'var(--midnight)',
                border: isActive ? '2px solid var(--gold)' : '2px solid var(--midnight-border)',
                transition: 'all 0.15s',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
              }}
            >
              <LayoutIcon config={config} size={28} active={isActive} />
              <span style={{
                fontSize: 'var(--fs-3xs)', fontWeight: 600,
                color: isActive ? 'var(--gold)' : 'var(--text-muted)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                maxWidth: 48,
              }}>
                {config.name}
              </span>
              <span style={{ fontSize: '8px', color: 'var(--text-muted)', opacity: 0.6 }}>
                {type}
              </span>
            </button>
          );
        })}
      </div>

      {!hasExactFit && betterCounts.length > 0 && onChangeCount && (
        <div style={{
          marginTop: 6, padding: '4px 8px', borderRadius: 6,
          background: 'rgba(212,168,67,0.08)', border: '1px solid var(--gold-dark)',
          fontSize: 'var(--fs-3xs)', color: 'var(--text-secondary)',
        }}>
          Try{' '}
          {betterCounts.map((c, i) => (
            <span key={c}>
              {i > 0 && ', '}
              <button
                onClick={() => onChangeCount(c)}
                style={{ color: 'var(--gold)', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}
              >
                {c}
              </button>
            </span>
          ))}
          {' '}tracks for more exact-fit options
        </div>
      )}
    </div>
  );
}
