import type { EditorElement } from '../lib/editor-elements';

interface Props {
  elements: EditorElement[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onToggleVisible: (id: string) => void;
  onToggleLocked: (id: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onAddText: () => void;
  onAddImage: () => void;
  onAddShape: (kind: 'rectangle' | 'circle' | 'line') => void;
  onDelete: (id: string) => void;
}

const LAYER_ICONS: Record<string, string> = {
  background: '\u25A3',   // filled square
  text: 'T',
  image: '\u25A1',        // empty square
  decoration: '\u2726',   // star
};

/**
 * Layer panel showing all editor elements with visibility/lock controls.
 * Click to select, eye to toggle visibility, lock to prevent accidental moves.
 */
export default function LayerPanel({
  elements, selectedId, onSelect, onToggleVisible, onToggleLocked, onReorder,
  onAddText, onAddImage, onAddShape, onDelete,
}: Props) {
  return (
    <div style={{
      width: 160, flexShrink: 0,
      borderRight: '1px solid var(--midnight-border)',
      background: 'var(--midnight)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header + Add buttons */}
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid var(--midnight-border)',
        background: 'var(--midnight-raised)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>Layers</span>
          {selectedId && elements.find(e => e.id === selectedId)?.custom && (
            <button
              onClick={() => onDelete(selectedId)}
              style={{ ...iconBtnStyle, color: 'var(--mmmc-red)', fontSize: 13 }}
              title="Delete selected element"
            >
              &#10005;
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={onAddText} style={addBtnStyle} title="Add text">T+</button>
          <button onClick={onAddImage} style={addBtnStyle} title="Add image">&#9633;+</button>
          <button onClick={() => onAddShape('rectangle')} style={addBtnStyle} title="Add rectangle">&#9645;</button>
          <button onClick={() => onAddShape('circle')} style={addBtnStyle} title="Add circle">&#9675;</button>
          <button onClick={() => onAddShape('line')} style={addBtnStyle} title="Add line">&#8212;</button>
        </div>
      </div>

      {/* Element list — render in reverse so topmost layer is at top */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {[...elements].reverse().map((el, _ri) => {
          const isSelected = el.id === selectedId;
          const originalIndex = elements.length - 1 - _ri;

          return (
            <div
              key={el.id}
              onClick={() => onSelect(isSelected ? null : el.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 10px',
                cursor: 'pointer',
                background: isSelected ? 'var(--midnight-hover)' : 'transparent',
                borderLeft: isSelected ? '3px solid var(--gold)' : '3px solid transparent',
                opacity: el.visible ? 1 : 0.4,
                transition: 'background 100ms ease',
              }}
              onMouseEnter={e => {
                if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'var(--midnight-raised)';
              }}
              onMouseLeave={e => {
                if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'transparent';
              }}
            >
              {/* Type icon */}
              <span style={{
                width: 20, textAlign: 'center', fontSize: 13,
                color: isSelected ? 'var(--gold)' : 'var(--text-muted)',
                fontFamily: 'system-ui',
              }}>
                {LAYER_ICONS[el.type] || '?'}
              </span>

              {/* Label */}
              <span style={{
                flex: 1, fontSize: 'var(--fs-2xs)',
                color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {el.label}
              </span>

              {/* Reorder arrows */}
              {originalIndex > 0 && (
                <button
                  onClick={e => { e.stopPropagation(); onReorder(originalIndex, originalIndex - 1); }}
                  style={iconBtnStyle} title="Move down (behind)"
                >
                  &#9660;
                </button>
              )}
              {originalIndex < elements.length - 1 && (
                <button
                  onClick={e => { e.stopPropagation(); onReorder(originalIndex, originalIndex + 1); }}
                  style={iconBtnStyle} title="Move up (in front)"
                >
                  &#9650;
                </button>
              )}

              {/* Visibility toggle */}
              <button
                onClick={e => { e.stopPropagation(); onToggleVisible(el.id); }}
                style={{
                  ...iconBtnStyle,
                  color: el.visible ? 'var(--text-secondary)' : 'var(--text-muted)',
                }}
                title={el.visible ? 'Hide layer' : 'Show layer'}
              >
                {el.visible ? '\u{1F441}' : '\u2014'}
              </button>

              {/* Lock toggle */}
              <button
                onClick={e => { e.stopPropagation(); onToggleLocked(el.id); }}
                style={{
                  ...iconBtnStyle,
                  color: el.locked ? 'var(--gold)' : 'var(--text-muted)',
                }}
                title={el.locked ? 'Unlock layer' : 'Lock layer'}
              >
                {el.locked ? '\u{1F512}' : '\u{1F513}'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const iconBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  padding: '2px 3px', fontSize: 11, lineHeight: 1, flexShrink: 0,
  color: 'var(--text-muted)',
};

const addBtnStyle: React.CSSProperties = {
  flex: 1, padding: '4px 0', fontSize: 12, fontWeight: 600,
  background: 'var(--midnight)', border: '1px solid var(--midnight-border)',
  borderRadius: 4, color: 'var(--text-secondary)', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
