import { useRef, useEffect, useState, useCallback } from 'react';
import { Stage, Layer, Image as KImage, Text as KText, Rect as KRect, Transformer } from 'react-konva';
import Konva from 'konva';
import type { EditorElement } from '../lib/editor-elements';

interface Props {
  elements: EditorElement[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onElementUpdate: (id: string, patch: Partial<EditorElement>) => void;
  onTextEdit?: (id: string, text: string) => void;
  /** Full rendered canvas preview (used as background) */
  backgroundSrc: string | null;
  /** Cover art URL for featured image element */
  coverArtSrc?: string;
  canvasWidth: number;
  canvasHeight: number;
}

/** Load an image, returning null until loaded */
function useLoadImage(src: string | null | undefined): HTMLImageElement | null {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!src) { setImg(null); return; }
    const el = new window.Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => setImg(el);
    el.onerror = () => setImg(null);
    el.src = src;
  }, [src]);
  return img;
}

export default function KonvaEditor({
  elements, selectedId, onSelect, onElementUpdate, onTextEdit,
  backgroundSrc, coverArtSrc, canvasWidth, canvasHeight,
}: Props) {
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const bgImage = useLoadImage(backgroundSrc);
  const coverImage = useLoadImage(coverArtSrc);

  // Attach transformer to selected node
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const stage = tr.getStage();
    if (!stage) return;

    if (selectedId) {
      const node = stage.findOne(`#${selectedId}`);
      if (node && !(node as any)._isLocked) {
        tr.nodes([node as Konva.Node]);
      } else {
        tr.nodes([]);
      }
    } else {
      tr.nodes([]);
    }
    tr.getLayer()?.batchDraw();
  }, [selectedId, elements]);

  // Deselect on background click
  const handleDeselect = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (e.target === e.target.getStage()) {
      onSelect(null);
    }
  }, [onSelect]);

  // Convert Konva node state back to EditorElement patch
  const syncFromNode = useCallback((id: string, node: Konva.Node) => {
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    // Reset scale, bake into width/height
    node.scaleX(1);
    node.scaleY(1);
    onElementUpdate(id, {
      x: node.x() / canvasWidth,
      y: node.y() / canvasHeight,
      width: Math.max(0.02, (node.width() * scaleX) / canvasWidth),
      height: Math.max(0.02, (node.height() * scaleY) / canvasHeight),
      rotation: node.rotation(),
    });
  }, [canvasWidth, canvasHeight, onElementUpdate]);

  const visibleElements = elements.filter(el => el.visible && el.type !== 'background');

  return (
    <Stage
      ref={stageRef}
      width={canvasWidth}
      height={canvasHeight}
      onMouseDown={handleDeselect}
      onTouchStart={handleDeselect}
      style={{ cursor: 'default' }}
    >
      {/* Layer 1: Static background — cached, non-interactive */}
      <Layer listening={false}>
        {bgImage && (
          <KImage
            image={bgImage}
            width={canvasWidth}
            height={canvasHeight}
          />
        )}
      </Layer>

      {/* Layer 2: Interactive elements */}
      <Layer>
        {visibleElements.map(el => {
          const px = el.x * canvasWidth;
          const py = el.y * canvasHeight;
          const w = el.width * canvasWidth;
          const h = (el.height || 0.06) * canvasHeight;
          const isLocked = el.locked;

          const commonProps = {
            id: el.id,
            x: px,
            y: py,
            offsetX: w / 2,
            offsetY: 0,
            width: w,
            height: h,
            rotation: el.rotation || 0,
            draggable: !isLocked,
            onClick: (e: Konva.KonvaEventObject<MouseEvent>) => {
              e.cancelBubble = true;
              onSelect(el.id);
            },
            onTap: (e: Konva.KonvaEventObject<TouchEvent>) => {
              e.cancelBubble = true;
              onSelect(el.id);
            },
            onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
              syncFromNode(el.id, e.target);
            },
            onTransformEnd: (e: Konva.KonvaEventObject<Event>) => {
              syncFromNode(el.id, e.target);
            },
          };

          // Mark locked nodes for transformer check
          if (el.type === 'text') {
            const fontSize = typeof el.props.fontSize === 'number'
              ? Math.round(el.props.fontSize * canvasHeight)
              : 24;
            return (
              <KText
                key={el.id}
                {...commonProps}
                text={String(el.props.text || '')}
                fontSize={fontSize}
                fontFamily={String(el.props.font || el.props.fontFamily || 'system-ui')}
                fontStyle={`${el.props.fontWeight || 700}`}
                fill={String(el.props.color || '#fff')}
                align="center"
                verticalAlign="top"
                listening={!isLocked}
                onDblClick={() => {
                  if (onTextEdit && !isLocked) {
                    const newText = prompt('Edit text:', String(el.props.text || ''));
                    if (newText !== null) onTextEdit(el.id, newText);
                  }
                }}
              />
            );
          }

          if (el.type === 'image' && el.id === 'featured_image' && coverImage) {
            return (
              <KImage
                key={el.id}
                {...commonProps}
                image={coverImage}
                listening={!isLocked}
              />
            );
          }

          if (el.type === 'decoration') {
            // Render decorations as transparent hit areas (content is in the background)
            return (
              <KRect
                key={el.id}
                {...commonProps}
                fill="transparent"
                stroke={el.id === selectedId ? '#D4A843' : 'transparent'}
                strokeWidth={el.id === selectedId ? 1 : 0}
                dash={[4, 2]}
                listening={!isLocked}
              />
            );
          }

          // Fallback: transparent hit area
          return (
            <KRect
              key={el.id}
              {...commonProps}
              fill="transparent"
              listening={!isLocked}
            />
          );
        })}

        {/* Single shared Transformer */}
        <Transformer
          ref={trRef}
          rotateEnabled={true}
          enabledAnchors={[
            'top-left', 'top-right', 'bottom-left', 'bottom-right',
            'middle-left', 'middle-right',
          ]}
          anchorStroke="#D4A843"
          anchorFill="#0F1B33"
          anchorSize={8}
          borderStroke="#D4A843"
          borderDash={[4, 4]}
          boundBoxFunc={(_oldBox, newBox) => {
            if (Math.abs(newBox.width) < 10 || Math.abs(newBox.height) < 10) {
              return _oldBox;
            }
            return newBox;
          }}
        />
      </Layer>
    </Stage>
  );
}
