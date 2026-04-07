import { useState, useRef, useCallback, useEffect } from 'react';
import type { EditorElement } from '../lib/editor-elements';

interface Props {
  elements: EditorElement[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onElementUpdate: (id: string, patch: Partial<EditorElement>) => void;
  canvasWidth: number;
  canvasHeight: number;
}

/**
 * Interactive overlay rendered on top of the canvas preview image.
 * Shows bounding boxes for elements, handles click-to-select and drag-to-reposition.
 */
export default function CanvasOverlay({
  elements, selectedId, onSelect, onElementUpdate,
  canvasWidth, canvasHeight,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<{
    id: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  // Convert fractional element position to pixel position within the overlay
  const toPixel = useCallback((fracX: number, fracY: number) => ({
    px: fracX * canvasWidth,
    py: fracY * canvasHeight,
  }), [canvasWidth, canvasHeight]);

  // Convert pixel delta to fractional delta
  const toFrac = useCallback((dx: number, dy: number) => ({
    fx: dx / canvasWidth,
    fy: dy / canvasHeight,
  }), [canvasWidth, canvasHeight]);

  // Handle mouse down on an element
  const handleMouseDown = useCallback((e: React.MouseEvent, el: EditorElement) => {
    if (el.locked) return;
    e.stopPropagation();
    onSelect(el.id);
    setDragging({
      id: el.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: el.x,
      origY: el.y,
    });
  }, [onSelect]);

  // Handle mouse move (drag)
  useEffect(() => {
    if (!dragging) return;

    const handleMove = (e: MouseEvent) => {
      const dx = e.clientX - dragging.startX;
      const dy = e.clientY - dragging.startY;
      const { fx, fy } = toFrac(dx, dy);
      onElementUpdate(dragging.id, {
        x: Math.max(0, Math.min(1, dragging.origX + fx)),
        y: Math.max(0, Math.min(1, dragging.origY + fy)),
      });
    };

    const handleUp = () => setDragging(null);

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
  }, [dragging, toFrac, onElementUpdate]);

  // Click on empty space to deselect
  const handleBackgroundClick = useCallback(() => {
    onSelect(null);
  }, [onSelect]);

  // Render element bounding boxes
  const visibleElements = elements.filter(el => el.visible && el.type !== 'background');

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
      style={{
        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
        cursor: dragging ? 'grabbing' : 'default',
        pointerEvents: 'all',
      }}
      onClick={handleBackgroundClick}
    >
      {visibleElements.map(el => {
        const isSelected = el.id === selectedId;
        const { px, py } = toPixel(el.x, el.y);
        const w = el.width * canvasWidth;
        const h = (el.height || 0.06) * canvasHeight; // default height for text elements
        // Center the rect on the element's x,y position
        const rx = px - w / 2;
        const ry = py;

        return (
          <g key={el.id}>
            {/* Hover/selection region */}
            <rect
              x={rx} y={ry} width={w} height={h}
              fill="transparent"
              stroke={isSelected ? '#D4A843' : 'transparent'}
              strokeWidth={isSelected ? 2 : 0}
              strokeDasharray={isSelected ? 'none' : '4 2'}
              style={{
                cursor: el.locked ? 'not-allowed' : 'grab',
                pointerEvents: 'all',
              }}
              onMouseDown={e => handleMouseDown(e, el)}
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
            {/* Selection handles */}
            {isSelected && !el.locked && (
              <>
                {/* Corner handles */}
                {[
                  [rx, ry],
                  [rx + w, ry],
                  [rx, ry + h],
                  [rx + w, ry + h],
                  [rx + w / 2, ry],
                  [rx + w / 2, ry + h],
                ].map(([hx, hy], i) => (
                  <rect
                    key={i}
                    x={hx - 4} y={hy - 4} width={8} height={8}
                    fill="#D4A843" stroke="#0F1B33" strokeWidth={1}
                    style={{ cursor: 'move' }}
                  />
                ))}
                {/* Label */}
                <text
                  x={rx} y={ry - 6}
                  fill="#D4A843" fontSize={11} fontFamily="system-ui"
                  style={{ pointerEvents: 'none' }}
                >
                  {el.label}
                </text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}
