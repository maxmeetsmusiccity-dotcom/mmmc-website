import { useState, useRef, useCallback, useEffect } from 'react';
import type { EditorElement } from '../lib/editor-elements';

interface Props {
  elements: EditorElement[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onElementUpdate: (id: string, patch: Partial<EditorElement>) => void;
  onTextEdit?: (id: string, text: string) => void;
  canvasWidth: number;
  canvasHeight: number;
}

/**
 * Interactive SVG overlay: click-to-select, drag-to-move, double-click-to-edit-text,
 * drag handles to resize, snap guides for alignment.
 */
export default function CanvasOverlay({
  elements, selectedId, onSelect, onElementUpdate, onTextEdit,
  canvasWidth, canvasHeight,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<{
    id: string; startX: number; startY: number; origX: number; origY: number;
    mode: 'move' | 'resize' | 'rotate';
    handleIdx?: number; origW?: number; origH?: number; origRotation?: number;
    centerPx?: number; centerPy?: number;
  } | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [snapLines, setSnapLines] = useState<{ x?: number; y?: number }[]>([]);

  const toPixel = useCallback((fx: number, fy: number) => ({
    px: fx * canvasWidth, py: fy * canvasHeight,
  }), [canvasWidth, canvasHeight]);

  const toFrac = useCallback((dx: number, dy: number) => ({
    fx: dx / canvasWidth, fy: dy / canvasHeight,
  }), [canvasWidth, canvasHeight]);

  // Snap detection — check alignment with other elements and canvas center
  const findSnaps = useCallback((id: string, x: number, y: number, _w: number) => {
    const snaps: { x?: number; y?: number }[] = [];
    const threshold = 0.015; // snap within 1.5% of canvas
    const cx = x; // element center x
    const targets = [0.5]; // canvas center
    for (const el of elements) {
      if (el.id === id || !el.visible) continue;
      targets.push(el.x);
      targets.push(el.y);
    }
    for (const t of targets) {
      if (Math.abs(cx - t) < threshold) snaps.push({ x: t * canvasWidth });
      if (Math.abs(y - t) < threshold) snaps.push({ y: t * canvasHeight });
    }
    return snaps;
  }, [elements, canvasWidth, canvasHeight]);

  // Mouse down — move, resize, or rotate
  const handleMouseDown = useCallback((e: React.MouseEvent, el: EditorElement, mode: 'move' | 'resize' | 'rotate' = 'move', handleIdx?: number) => {
    if (el.locked) return;
    e.stopPropagation();
    onSelect(el.id);
    const { px, py } = toPixel(el.x, el.y);
    const h = (el.height || 0.06) * canvasHeight;
    setDragging({
      id: el.id, startX: e.clientX, startY: e.clientY,
      origX: el.x, origY: el.y, mode,
      handleIdx, origW: el.width, origH: el.height,
      origRotation: el.rotation || 0,
      centerPx: px, centerPy: py + h / 2,
    });
  }, [onSelect, toPixel, canvasHeight]);

  // Mouse move — drag or resize (with dead zone for move mode)
  const dragActive = useRef(false);
  useEffect(() => {
    if (!dragging) { dragActive.current = false; return; }
    const handleMove = (e: MouseEvent) => {
      const dx = e.clientX - dragging.startX;
      const dy = e.clientY - dragging.startY;

      // Dead zone: don't start move until mouse moves 4px (allows click-to-select)
      if (dragging.mode === 'move' && !dragActive.current) {
        if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
        dragActive.current = true;
      }

      const { fx, fy } = toFrac(dx, dy);

      if (dragging.mode === 'move') {
        const newX = Math.max(0, Math.min(1, dragging.origX + fx));
        const newY = Math.max(0, Math.min(1, dragging.origY + fy));
        setSnapLines(findSnaps(dragging.id, newX, newY, dragging.origW || 0));
        onElementUpdate(dragging.id, { x: newX, y: newY });
      } else if (dragging.mode === 'resize') {
        const newW = Math.max(0.02, (dragging.origW || 0.1) + fx);
        const newH = Math.max(0.02, (dragging.origH || 0.06) + fy);
        onElementUpdate(dragging.id, { width: newW, height: newH });
      } else if (dragging.mode === 'rotate' && svgRef.current) {
        // Calculate angle from element center to mouse position
        const rect = svgRef.current.getBoundingClientRect();
        const scaleX = canvasWidth / rect.width;
        const scaleY = canvasHeight / rect.height;
        const mx = (e.clientX - rect.left) * scaleX;
        const my = (e.clientY - rect.top) * scaleY;
        const cx = dragging.centerPx || 0;
        const cy = dragging.centerPy || 0;
        const angle = Math.atan2(mx - cx, -(my - cy)) * (180 / Math.PI);
        onElementUpdate(dragging.id, { rotation: Math.round(angle) });
      }
    };
    const handleUp = () => { setDragging(null); setSnapLines([]); };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => { document.removeEventListener('mousemove', handleMove); document.removeEventListener('mouseup', handleUp); };
  }, [dragging, toFrac, onElementUpdate, findSnaps]);

  // Double-click to edit text
  const handleDoubleClick = useCallback((e: React.MouseEvent, el: EditorElement) => {
    if (el.type !== 'text' || el.locked) return;
    e.stopPropagation();
    setEditingTextId(el.id);
  }, []);

  const handleBackgroundClick = useCallback(() => {
    onSelect(null);
    setEditingTextId(null);
  }, [onSelect]);

  const visibleElements = elements.filter(el => el.visible && el.type !== 'background');

  return (
    <>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
        style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          cursor: dragging ? (dragging.mode === 'resize' ? 'nwse-resize' : dragging.mode === 'rotate' ? 'crosshair' : 'grabbing') : 'default',
          pointerEvents: 'all',
        }}
        onClick={handleBackgroundClick}
      >
        {/* Snap guides */}
        {snapLines.map((s, i) => (
          s.x !== undefined ? (
            <line key={`sx${i}`} x1={s.x} y1={0} x2={s.x} y2={canvasHeight}
              stroke="#D4A843" strokeWidth={1} strokeDasharray="4 4" opacity={0.6} />
          ) : s.y !== undefined ? (
            <line key={`sy${i}`} x1={0} y1={s.y} x2={canvasWidth} y2={s.y}
              stroke="#D4A843" strokeWidth={1} strokeDasharray="4 4" opacity={0.6} />
          ) : null
        ))}

        {visibleElements.map(el => {
          const isSelected = el.id === selectedId;
          const { px, py } = toPixel(el.x, el.y);
          const w = el.width * canvasWidth;
          const h = (el.height || 0.06) * canvasHeight;
          const rx = px - w / 2;
          const ry = py;

          return (
            <g key={el.id}>
              {/* Hit area */}
              <rect
                x={rx} y={ry} width={w} height={h}
                fill="transparent"
                stroke={isSelected ? '#D4A843' : 'transparent'}
                strokeWidth={isSelected ? 2 : 0}
                style={{ cursor: el.locked ? 'not-allowed' : 'grab', pointerEvents: 'all' }}
                onMouseDown={e => handleMouseDown(e, el)}
                onDoubleClick={e => handleDoubleClick(e, el)}
                onMouseEnter={e => {
                  if (!isSelected && !el.locked) {
                    (e.target as SVGRectElement).setAttribute('stroke', 'rgba(212,168,67,0.5)');
                    (e.target as SVGRectElement).setAttribute('stroke-width', '1');
                    (e.target as SVGRectElement).setAttribute('stroke-dasharray', '4 2');
                  }
                }}
                onMouseLeave={e => {
                  if (!isSelected) {
                    (e.target as SVGRectElement).setAttribute('stroke', 'transparent');
                    (e.target as SVGRectElement).setAttribute('stroke-width', '0');
                  }
                }}
              />
              {/* Live text label while dragging — shows element name so user knows what's moving */}
              {dragging?.id === el.id && dragging.mode === 'move' && (
                <text
                  x={px} y={ry - 8}
                  fill="#D4A843"
                  fontSize={12}
                  fontFamily="system-ui"
                  textAnchor="middle"
                  style={{ pointerEvents: 'none' }}
                >
                  {el.label || el.type}
                </text>
              )}
              {/* Selection handles + resize */}
              {isSelected && !el.locked && (
                <>
                  {/* Corner handles — top-left, top-right, bottom-left */}
                  {[[rx, ry], [rx + w, ry], [rx, ry + h]].map(([hx, hy], i) => (
                    <rect key={`h${i}`} x={hx - 4} y={hy - 4} width={8} height={8}
                      fill="#D4A843" stroke="#0F1B33" strokeWidth={1}
                      style={{ cursor: 'move' }} />
                  ))}
                  {/* Bottom-right handle — RESIZE */}
                  <rect
                    x={rx + w - 4} y={ry + h - 4} width={8} height={8}
                    fill="#D4A843" stroke="#0F1B33" strokeWidth={1}
                    style={{ cursor: 'nwse-resize', pointerEvents: 'all' }}
                    onMouseDown={e => handleMouseDown(e, el, 'resize', 3)}
                  />
                  {/* Rotation handle — circle above element, connected by a line */}
                  <line x1={px} y1={ry} x2={px} y2={ry - 24}
                    stroke="#D4A843" strokeWidth={1} strokeDasharray="3 2" />
                  <circle
                    cx={px} cy={ry - 28} r={6}
                    fill="#D4A843" stroke="#0F1B33" strokeWidth={1}
                    style={{ cursor: 'crosshair', pointerEvents: 'all' }}
                    onMouseDown={e => handleMouseDown(e, el, 'rotate')}
                  />
                  {/* Label + rotation */}
                  <text x={rx} y={ry - 36} fill="#D4A843" fontSize={11} fontFamily="system-ui"
                    style={{ pointerEvents: 'none' }}>
                    {el.label}{el.rotation ? ` ${el.rotation}°` : ''}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>

      {/* Inline text editor — HTML input overlaid on canvas */}
      {editingTextId && (() => {
        const el = elements.find(e => e.id === editingTextId);
        if (!el || el.type !== 'text') return null;
        const { px, py } = toPixel(el.x, el.y);
        const w = el.width * canvasWidth;
        // Position the input over the element
        const pctX = (px - w / 2) / canvasWidth * 100;
        const pctY = py / canvasHeight * 100;
        const pctW = el.width * 100;
        return (
          <input
            autoFocus
            defaultValue={(el.props.text as string) || ''}
            onBlur={e => {
              if (onTextEdit) onTextEdit(editingTextId, e.target.value);
              setEditingTextId(null);
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                if (onTextEdit) onTextEdit(editingTextId, (e.target as HTMLInputElement).value);
                setEditingTextId(null);
              }
              if (e.key === 'Escape') setEditingTextId(null);
            }}
            style={{
              position: 'absolute',
              left: `${pctX}%`, top: `${pctY}%`, width: `${pctW}%`,
              background: 'rgba(0,0,0,0.8)', color: '#fff',
              border: '2px solid var(--gold)', borderRadius: 4,
              padding: '4px 8px', fontSize: 14, fontFamily: 'inherit',
              outline: 'none', zIndex: 20,
            }}
          />
        );
      })()}
    </>
  );
}
