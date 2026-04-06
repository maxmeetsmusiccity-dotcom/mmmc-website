import { useState, useRef, useEffect, useCallback } from 'react';
import type { TitleSlideTemplate } from '../lib/title-templates';
import { getTitleTemplate } from '../lib/title-templates';
import { generateTitleSlide, type CarouselAspect } from '../lib/canvas-grid';
import type { SelectionSlot } from '../lib/selection';

interface Props {
  templateId: string;
  coverFeature: SelectionSlot | null;
  weekDate: string;
  onSave: (template: TitleSlideTemplate) => void;
  onCancel: () => void;
}

interface DraggableElement {
  id: string;
  label: string;
  /** Fraction of canvas width for X position (0-1) */
  x: number;
  /** Fraction of canvas height for Y position (0-1) */
  y: number;
  /** Fraction of canvas width for size */
  size: number;
  visible: boolean;
  /** Which template field this maps to for Y position */
  fieldY: keyof TitleSlideTemplate;
  /** Which template field this maps to for size (optional) */
  fieldSize?: keyof TitleSlideTemplate;
}

function templateToElements(tt: TitleSlideTemplate): DraggableElement[] {
  return [
    { id: 'headline', label: 'Headline', x: 0.5, y: tt.headlineY, size: tt.headlineSize, visible: true, fieldY: 'headlineY', fieldSize: 'headlineSize' },
    { id: 'subtitle', label: 'Subtitle', x: 0.5, y: tt.subtitleY, size: tt.subtitleSize, visible: true, fieldY: 'subtitleY', fieldSize: 'subtitleSize' },
    { id: 'image', label: 'Album Art', x: 0.5, y: tt.featuredImageY, size: tt.featuredImageSize, visible: true, fieldY: 'featuredImageY', fieldSize: 'featuredImageSize' },
    { id: 'date', label: 'Date', x: 0.5, y: tt.dateY, size: tt.dateSize, visible: true, fieldY: 'dateY', fieldSize: 'dateSize' },
  ];
}

function elementsToTemplate(base: TitleSlideTemplate, elements: DraggableElement[]): TitleSlideTemplate {
  const updated = { ...base };
  for (const el of elements) {
    (updated as any)[el.fieldY] = el.y;
    if (el.fieldSize) (updated as any)[el.fieldSize] = el.size;
  }
  return updated;
}

export default function TitleSlideEditor({ templateId, coverFeature, weekDate, onSave, onCancel }: Props) {
  const baseTemplate = getTitleTemplate(templateId);
  const [template, setTemplate] = useState<TitleSlideTemplate>({ ...baseTemplate });
  const [elements, setElements] = useState<DraggableElement[]>(templateToElements(baseTemplate));
  const [aspect, setAspect] = useState<CarouselAspect>('1:1');
  const [previewUrl, setPreviewUrl] = useState('');
  const [rendering, setRendering] = useState(false);
  const [name, setName] = useState(`${baseTemplate.name} (Custom)`);
  const previewRef = useRef<HTMLDivElement>(null);
  const renderTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const dragRef = useRef<{ elId: string; startY: number; startElY: number } | null>(null);
  const resizeRef = useRef<{ elId: string; startY: number; startSize: number } | null>(null);

  // Render preview (debounced)
  const renderPreview = useCallback(async (tmpl: TitleSlideTemplate, asp: CarouselAspect) => {
    if (!coverFeature) return;
    setRendering(true);
    try {
      const blob = await generateTitleSlide(coverFeature, weekDate, tmpl.id, asp);
      // generateTitleSlide uses the template from the registry, but we want our modified version.
      // We need to temporarily register it. For now, render with the base and show overlay positions.
      const url = URL.createObjectURL(blob);
      setPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return url; });
    } catch (e) {
      console.error('[TitleSlideEditor] render error:', e);
    } finally {
      setRendering(false);
    }
  }, [coverFeature, weekDate]);

  // Re-render on template or aspect change (debounced 300ms)
  useEffect(() => {
    clearTimeout(renderTimeoutRef.current);
    renderTimeoutRef.current = setTimeout(() => renderPreview(template, aspect), 300);
    return () => clearTimeout(renderTimeoutRef.current);
  }, [template, aspect, renderPreview]);

  // Handle element drag
  const handleMouseDown = (elId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const el = elements.find(el => el.id === elId);
    if (!el) return;
    dragRef.current = { elId, startY: e.clientY, startElY: el.y };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current || !previewRef.current) return;
      const rect = previewRef.current.getBoundingClientRect();
      const deltaY = (ev.clientY - dragRef.current.startY) / rect.height;
      const newY = Math.max(0.01, Math.min(0.98, dragRef.current.startElY + deltaY));

      setElements(prev => prev.map(el =>
        el.id === dragRef.current!.elId ? { ...el, y: newY } : el
      ));
    };

    const onUp = () => {
      if (dragRef.current) {
        // Update template from current elements
        setElements(prev => {
          const updated = elementsToTemplate(template, prev);
          setTemplate(updated);
          return prev;
        });
      }
      dragRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // Handle element resize (size control)
  const handleResizeStart = (elId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const el = elements.find(el => el.id === elId);
    if (!el) return;
    resizeRef.current = { elId, startY: e.clientY, startSize: el.size };

    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current || !previewRef.current) return;
      const rect = previewRef.current.getBoundingClientRect();
      const delta = (ev.clientY - resizeRef.current.startY) / rect.height;
      const newSize = Math.max(0.01, Math.min(0.8, resizeRef.current.startSize + delta));

      setElements(prev => prev.map(el =>
        el.id === resizeRef.current!.elId ? { ...el, size: newSize } : el
      ));
    };

    const onUp = () => {
      if (resizeRef.current) {
        setElements(prev => {
          const updated = elementsToTemplate(template, prev);
          setTemplate(updated);
          return prev;
        });
      }
      resizeRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const handleToggleVisibility = (elId: string) => {
    setElements(prev => prev.map(el =>
      el.id === elId ? { ...el, visible: !el.visible } : el
    ));
  };

  const handleSave = () => {
    const customTemplate: TitleSlideTemplate = {
      ...elementsToTemplate(template, elements),
      id: `custom_title_${Date.now()}`,
      name,
    };
    onSave(customTemplate);
  };

  // Slider controls for fine-tuning
  const updateField = (field: keyof TitleSlideTemplate, value: number) => {
    setTemplate(prev => ({ ...prev, [field]: value }));
    setElements(templateToElements({ ...template, [field]: value }));
  };

  const canvasH = aspect === '3:4' ? 1440 : 1080;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(0,0,0,0.92)',
        display: 'flex', alignItems: 'stretch',
        fontFamily: 'var(--font-body)',
      }}
    >
      {/* Left: Preview with draggable overlays */}
      <div style={{ flex: 3, display: 'flex', flexDirection: 'column', padding: 24 }}>
        {/* Aspect toggle */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button
            className={`filter-pill ${aspect === '1:1' ? 'active' : ''}`}
            onClick={() => setAspect('1:1')}
            style={{ fontSize: 'var(--fs-sm)' }}
          >Square (1:1)</button>
          <button
            className={`filter-pill ${aspect === '3:4' ? 'active' : ''}`}
            onClick={() => setAspect('3:4')}
            style={{ fontSize: 'var(--fs-sm)' }}
          >Portrait (3:4)</button>
          <span style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-xs)', alignSelf: 'center', marginLeft: 8 }}>
            {rendering ? 'Rendering...' : 'Drag elements to reposition'}
          </span>
        </div>

        {/* Preview area */}
        <div
          ref={previewRef}
          style={{
            flex: 1, position: 'relative',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {previewUrl ? (
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <img
                src={previewUrl}
                alt="Title slide preview"
                style={{
                  maxWidth: '100%',
                  maxHeight: aspect === '3:4' ? 'calc(100vh - 140px)' : 'calc(100vh - 140px)',
                  borderRadius: 8,
                  border: '1px solid var(--midnight-border)',
                }}
              />

              {/* Draggable element overlays */}
              {elements.filter(el => el.visible).map(el => (
                <div
                  key={el.id}
                  onMouseDown={(e) => handleMouseDown(el.id, e)}
                  style={{
                    position: 'absolute',
                    left: '5%',
                    right: '5%',
                    top: `${el.y * 100}%`,
                    height: el.id === 'image' ? `${el.size * 100}%` : `${Math.max(el.size * 100, 4)}%`,
                    border: '2px dashed rgba(212,168,67,0.6)',
                    borderRadius: 4,
                    cursor: 'grab',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0 8px',
                    background: 'rgba(212,168,67,0.08)',
                    transition: 'border-color 0.15s',
                    userSelect: 'none',
                  }}
                  title={`Drag to move ${el.label}`}
                >
                  <span style={{
                    fontSize: 10, color: 'var(--gold)', fontWeight: 700,
                    background: 'rgba(0,0,0,0.6)', padding: '1px 6px', borderRadius: 3,
                  }}>
                    {el.label}
                  </span>
                  {/* Resize handle */}
                  <div
                    onMouseDown={(e) => handleResizeStart(el.id, e)}
                    style={{
                      width: 14, height: 14, borderRadius: 2,
                      background: 'var(--gold)', cursor: 'ns-resize',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 8, color: 'var(--midnight)', fontWeight: 700,
                    }}
                    title={`Drag to resize ${el.label}`}
                  >
                    &harr;
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              width: 400, aspectRatio: aspect === '3:4' ? '3/4' : '1',
              background: 'var(--midnight)', borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)',
            }}>
              {coverFeature ? 'Rendering preview...' : 'Star an album to preview'}
            </div>
          )}
        </div>
      </div>

      {/* Right: Controls panel */}
      <div style={{
        flex: 2, maxWidth: 420, background: 'var(--midnight-raised)',
        borderLeft: '1px solid var(--midnight-border)',
        padding: 24, overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-2xl)', color: 'var(--gold)' }}>
          Edit Title Slide
        </h2>

        {/* Template name */}
        <div>
          <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Template Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="search-input"
            style={{ width: '100%' }}
          />
        </div>

        {/* Layer visibility toggles */}
        <div>
          <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>Layers</label>
          {elements.map(el => (
            <div key={el.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <button
                onClick={() => handleToggleVisibility(el.id)}
                style={{
                  width: 20, height: 20, borderRadius: 4, border: 'none', cursor: 'pointer',
                  background: el.visible ? 'var(--gold)' : 'var(--midnight-border)',
                  color: el.visible ? 'var(--midnight)' : 'var(--text-muted)',
                  fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {el.visible ? '\u2713' : '\u2715'}
              </button>
              <span style={{ fontSize: 'var(--fs-sm)', color: el.visible ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                {el.label}
              </span>
              <span className="mono" style={{ fontSize: 'var(--fs-3xs)', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                Y: {Math.round(el.y * 100)}% | Size: {Math.round(el.size * 100)}%
              </span>
            </div>
          ))}
        </div>

        {/* Fine-tune sliders */}
        <div>
          <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>Fine-Tune Positions</label>

          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)' }}>
              <span>Headline Y</span><span>{Math.round(template.headlineY * canvasH)}px</span>
            </div>
            <input type="range" min="0.01" max="0.20" step="0.005" value={template.headlineY}
              onChange={e => updateField('headlineY', parseFloat(e.target.value))} style={{ width: '100%' }} />
          </div>

          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)' }}>
              <span>Album Art Y</span><span>{Math.round(template.featuredImageY * canvasH)}px</span>
            </div>
            <input type="range" min="0.10" max="0.50" step="0.005" value={template.featuredImageY}
              onChange={e => updateField('featuredImageY', parseFloat(e.target.value))} style={{ width: '100%' }} />
          </div>

          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)' }}>
              <span>Album Art Size</span><span>{Math.round(template.featuredImageSize * 1080)}px</span>
            </div>
            <input type="range" min="0.20" max="0.70" step="0.01" value={template.featuredImageSize}
              onChange={e => updateField('featuredImageSize', parseFloat(e.target.value))} style={{ width: '100%' }} />
          </div>

          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)' }}>
              <span>Date Y</span><span>{Math.round(template.dateY * canvasH)}px</span>
            </div>
            <input type="range" min="0.70" max="0.98" step="0.005" value={template.dateY}
              onChange={e => updateField('dateY', parseFloat(e.target.value))} style={{ width: '100%' }} />
          </div>

          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)' }}>
              <span>Image Rotation</span><span>{template.featuredRotation}deg</span>
            </div>
            <input type="range" min="-8" max="8" step="0.5" value={template.featuredRotation}
              onChange={e => setTemplate(prev => ({ ...prev, featuredRotation: parseFloat(e.target.value) }))} style={{ width: '100%' }} />
          </div>

          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)' }}>
              <span>Image Border</span><span>{template.featuredBorder}px</span>
            </div>
            <input type="range" min="0" max="24" step="1" value={template.featuredBorder}
              onChange={e => setTemplate(prev => ({ ...prev, featuredBorder: parseInt(e.target.value) }))} style={{ width: '100%' }} />
          </div>

          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)' }}>
              <span>Shadow Blur</span><span>{template.featuredShadowBlur}px</span>
            </div>
            <input type="range" min="0" max="60" step="2" value={template.featuredShadowBlur}
              onChange={e => setTemplate(prev => ({ ...prev, featuredShadowBlur: parseInt(e.target.value) }))} style={{ width: '100%' }} />
          </div>
        </div>

        {/* Effects */}
        <div>
          <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>Effects</label>

          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)' }}>
              <span>Grain</span><span>{Math.round(template.grain * 100)}%</span>
            </div>
            <input type="range" min="0" max="0.4" step="0.02" value={template.grain}
              onChange={e => setTemplate(prev => ({ ...prev, grain: parseFloat(e.target.value) }))} style={{ width: '100%' }} />
          </div>

          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)' }}>
              <span>Vignette</span><span>{Math.round(template.vignette * 100)}%</span>
            </div>
            <input type="range" min="0" max="0.5" step="0.02" value={template.vignette}
              onChange={e => setTemplate(prev => ({ ...prev, vignette: parseFloat(e.target.value) }))} style={{ width: '100%' }} />
          </div>

          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)' }}>
              <span>Glow Blur</span><span>{template.glow.blur}px</span>
            </div>
            <input type="range" min="0" max="60" step="2" value={template.glow.blur}
              onChange={e => setTemplate(prev => ({ ...prev, glow: { ...prev.glow, blur: parseInt(e.target.value) } }))} style={{ width: '100%' }} />
          </div>
        </div>

        {/* Colors */}
        <div>
          <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>Colors</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { label: 'Background', field: 'background' as const, value: template.background },
              { label: 'Text', field: 'textPrimary' as const, value: template.textPrimary },
              { label: 'Accent', field: 'accent' as const, value: template.accent },
              { label: 'Border', field: 'featuredBorderColor' as const, value: template.featuredBorderColor || '#FFFFFF' },
            ].map(c => (
              <label key={c.field} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)' }}>
                <input type="color" value={c.value}
                  onChange={e => setTemplate(prev => ({ ...prev, [c.field]: e.target.value }))}
                  style={{ width: 24, height: 24, border: 'none', borderRadius: 4, cursor: 'pointer' }} />
                {c.label}
              </label>
            ))}
          </div>
        </div>

        {/* Toggles */}
        <div>
          <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>Options</label>
          {[
            { label: 'Show Frame', field: 'showFrame' as const, value: template.showFrame },
            { label: 'Show Divider', field: 'showDivider' as const, value: template.showDivider },
            { label: 'Swipe Pill', field: 'swipePill' as const, value: template.swipePill },
          ].map(t => (
            <label key={t.field} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={t.value}
                onChange={e => setTemplate(prev => ({ ...prev, [t.field]: e.target.checked }))} />
              {t.label}
            </label>
          ))}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--midnight-border)' }}>
          <button className="btn btn-gold" onClick={handleSave} style={{ flex: 1 }}>
            Save as Custom Template
          </button>
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
