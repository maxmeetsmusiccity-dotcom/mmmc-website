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

export default function CanvasOverlay({
  elements, selectedId, onSelect, onElementUpdate, onTextEdit,
  canvasWidth, canvasHeight,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [snapLines, setSnapLines] = useState<{ x?: number; y?: number }[]>([]);

  // Drag state kept in ref so it doesn't trigger re-renders mid-drag
  const drag = useRef<{
    id: string; mode: 'move' | 'resize' | 'rotate';
    startX: number; startY: number;
    origX: number; origY: number;
    origW: number; origH: number; origRot: number;
    centerPx: number; centerPy: number;
    active: boolean; // has mouse moved past dead zone?
  } | null>(null);
  // Force re-render for cursor changes
  const [dragging, setDragging] = useState(false);

  const toFrac = useCallback((dx: number, dy: number) => ({
    fx: dx / canvasWidth, fy: dy / canvasHeight,
  }), [canvasWidth, canvasHeight]);

  // Start drag on mousedown (for resize/rotate handles, NOT the main hit area)
  const startDrag = useCallback((e: React.MouseEvent, el: EditorElement, mode: 'resize' | 'rotate') => {
    e.stopPropagation();
    e.preventDefault();
    const px = el.x * canvasWidth;
    const py = el.y * canvasHeight;
    const h = (el.height || 0.06) * canvasHeight;
    drag.current = {
      id: el.id, mode, startX: e.clientX, startY: e.clientY,
      origX: el.x, origY: el.y, origW: el.width, origH: el.height || 0.06,
      origRot: el.rotation || 0, centerPx: px, centerPy: py + h / 2,
      active: true, // resize/rotate start immediately
    };
    setDragging(true);
  }, [canvasWidth, canvasHeight]);

  // Start potential move drag on element mousedown
  const startMoveDrag = useCallback((e: React.MouseEvent, el: EditorElement) => {
    if (el.locked) return;
    e.stopPropagation();
    e.preventDefault();
    onSelect(el.id);
    const px = el.x * canvasWidth;
    const py = el.y * canvasHeight;
    const h = (el.height || 0.06) * canvasHeight;
    drag.current = {
      id: el.id, mode: 'move', startX: e.clientX, startY: e.clientY,
      origX: el.x, origY: el.y, origW: el.width, origH: el.height || 0.06,
      origRot: el.rotation || 0, centerPx: px, centerPy: py + h / 2,
      active: false, // requires dead zone before activating
    };
    setDragging(true);
  }, [canvasWidth, canvasHeight, onSelect]);

  // Global mouse handlers
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      const d = drag.current;
      if (!d) return;

      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;

      // Dead zone for move mode
      if (d.mode === 'move' && !d.active) {
        if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
        d.active = true;
      }

      const { fx, fy } = toFrac(dx, dy);

      if (d.mode === 'move') {
        const newX = Math.max(0, Math.min(1, d.origX + fx));
        const newY = Math.max(0, Math.min(1, d.origY + fy));
        onElementUpdate(d.id, { x: newX, y: newY });
      } else if (d.mode === 'resize') {
        const newW = Math.max(0.02, d.origW + fx);
        const newH = Math.max(0.02, d.origH + fy);
        onElementUpdate(d.id, { width: newW, height: newH });
      } else if (d.mode === 'rotate' && svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        const scaleX = canvasWidth / rect.width;
        const scaleY = canvasHeight / rect.height;
        const mx = (e.clientX - rect.left) * scaleX;
        const my = (e.clientY - rect.top) * scaleY;
        const angle = Math.atan2(mx - d.centerPx, -(my - d.centerPy)) * (180 / Math.PI);
        onElementUpdate(d.id, { rotation: Math.round(angle) });
      }
    };

    const handleUp = () => {
      drag.current = null;
      setDragging(false);
      setSnapLines([]);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
  }, [toFrac, onElementUpdate, canvasWidth, canvasHeight]);

  const handleBackgroundClick = useCallback((e: React.MouseEvent) => {
    // Only deselect if click was directly on SVG background, not on an element
    if (e.target === svgRef.current) {
      onSelect(null);
      setEditingTextId(null);
    }
  }, [onSelect]);

  const visibleElements = elements.filter(el => el.visible && el.type !== 'background');

  return (
    <>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
        style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          cursor: dragging ? 'grabbing' : 'default',
          pointerEvents: 'all',
        }}
        onMouseDown={handleBackgroundClick}
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
          const px = el.x * canvasWidth;
          const py = el.y * canvasHeight;
          const w = el.width * canvasWidth;
          const h = (el.height || 0.06) * canvasHeight;
          const rx = px - w / 2;
          const ry = py;

          return (
            <g key={el.id}>
              {/* Hit area — click to select, drag to move */}
              <rect
                x={rx} y={ry} width={w} height={h}
                fill="transparent"
                stroke={isSelected ? '#D4A843' : 'transparent'}
                strokeWidth={isSelected ? 2 : 0}
                style={{ cursor: el.locked ? 'not-allowed' : 'grab', pointerEvents: 'all' }}
                onMouseDown={e => startMoveDrag(e, el)}
                onDoubleClick={e => {
                  if (el.type === 'text' && !el.locked) {
                    e.stopPropagation();
                    setEditingTextId(el.id);
                  }
                }}
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
              {/* Selection handles (only when selected and not locked) */}
              {isSelected && !el.locked && (
                <>
                  {/* Corner handles */}
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
                    onMouseDown={e => startDrag(e, el, 'resize')}
                  />
                  {/* Rotation handle — circle above element */}
                  <line x1={px} y1={ry} x2={px} y2={ry - 24}
                    stroke="#D4A843" strokeWidth={1} strokeDasharray="3 2"
                    style={{ pointerEvents: 'none' }} />
                  <circle
                    cx={px} cy={ry - 28} r={6}
                    fill="#D4A843" stroke="#0F1B33" strokeWidth={1}
                    style={{ cursor: 'crosshair', pointerEvents: 'all' }}
                    onMouseDown={e => startDrag(e, el, 'rotate')}
                  />
                  {/* Label */}
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

      {/* Inline text editor */}
      {editingTextId && (() => {
        const el = elements.find(e => e.id === editingTextId);
        if (!el || el.type !== 'text') return null;
        const px = el.x * canvasWidth;
        const py = el.y * canvasHeight;
        const w = el.width * canvasWidth;
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
