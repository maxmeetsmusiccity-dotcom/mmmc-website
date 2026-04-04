import { useState, useEffect, useRef } from 'react';
import type { CarouselTemplate } from '../lib/carousel-templates';
import { TEMPLATES } from '../lib/carousel-templates';
import { generateTemplatePreview } from '../lib/canvas-grid';

interface Props {
  onSave: (template: CarouselTemplate) => void;
  onCancel: () => void;
  initial?: CarouselTemplate;
}

const FONT_OPTIONS = [
  { label: 'Dancing Script', value: '"Dancing Script", cursive' },
  { label: 'DM Sans', value: '"DM Sans", sans-serif' },
  { label: 'Source Serif', value: '"Source Serif 4", Georgia, serif' },
  { label: 'System', value: 'system-ui, sans-serif' },
];

const PRESET_COLORS = [
  '#0F1B33', '#1A1A2E', '#1A0A2E', '#0D0D0D',
  '#1C1208', '#F5F0E8', '#0B1622', '#2C1810',
];

const ACCENT_COLORS = [
  '#D4A843', '#FFFFFF', '#FF69B4', '#FF4500',
  '#FFB347', '#1A1A1A', '#00D4FF', '#7B68EE',
];

export default function TemplateBuilder({ onSave, onCancel, initial }: Props) {
  const base = initial || TEMPLATES[0];
  const [name, setName] = useState(initial ? base.name : 'My Template');
  const [description, setDescription] = useState(initial ? base.description : 'Custom design');
  const [bg, setBg] = useState(base.background);
  const [accent, setAccent] = useState(base.accent);
  const [textPrimary, setTextPrimary] = useState(base.textPrimary);
  const [textSecondary, setTextSecondary] = useState(base.textSecondary);
  const [scriptFont, setScriptFont] = useState(base.scriptFont);
  const [bodyFont, setBodyFont] = useState(base.bodyFont);
  const [gridGap, setGridGap] = useState(base.grid.gap);
  const [showNotes, setShowNotes] = useState(base.decorations.showNotes);
  const [showVinyl, setShowVinyl] = useState(base.cover.vinylOverlay);
  const [showChevrons, setShowChevrons] = useState(base.cover.showChevrons);
  const [rotation, setRotation] = useState(Math.abs(base.grid.rotations[0]));
  const [previewUrl, setPreviewUrl] = useState('');
  const [bgFrameUrl, setBgFrameUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Build template from current state
  const buildTemplate = (): CarouselTemplate => ({
    id: initial?.id || `custom_${Date.now()}`,
    name,
    description,
    background: bg,
    textPrimary,
    textSecondary,
    accent,
    accentGlow: `rgba(${hexToRgb(accent)}, `,
    scriptFont,
    bodyFont,
    neon: {
      outerGlow: `rgba(${hexToRgb(accent)}, 0.25)`,
      outerBlur: 45,
      outerAlpha: 0.3,
      midGlow: `rgba(${hexToRgb(accent)}, 0.5)`,
      midBlur: 20,
      midAlpha: 0.7,
      coreColor: textPrimary,
      coreBlur: 6,
    },
    grid: {
      gap: gridGap,
      rotations: Array(8).fill(0).map((_, i) => (i % 2 === 0 ? -rotation : rotation)),
      cellShadow: true,
      cellBorder: false,
      cellBorderColor: '',
    },
    cover: {
      vinylOverlay: showVinyl,
      vinylOpacity: 0.5,
      grooveCount: 60,
      frameBorder: 14,
      frameColor: textPrimary,
      frameShadowBlur: 32,
      showChevrons,
      showArtistName: true,
      showTrackName: true,
      subtitleText: name,
    },
    decorations: {
      showNotes,
      showSparkles: showNotes,
      noteSize: 52,
      sparkleSize: 36,
    },
    assets: bgFrameUrl ? { background: bgFrameUrl } : undefined,
  });

  // Update preview on any change
  useEffect(() => {
    const t = buildTemplate();
    // Temporarily inject into template system for preview
    const existing = TEMPLATES.find(x => x.id === t.id);
    if (!existing) TEMPLATES.push(t);
    else Object.assign(existing, t);
    setPreviewUrl(generateTemplatePreview(t.id, 300));
    // Clean up
    if (!existing) TEMPLATES.pop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bg, accent, textPrimary, textSecondary, scriptFont, bodyFont, gridGap, showNotes, showVinyl, showChevrons, rotation, name]);

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setBgFrameUrl(url);
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 680, maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem' }}>
            Template Builder
          </h3>
          <button className="btn btn-sm" onClick={onCancel}>Cancel</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24 }}>
          {/* Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Name */}
            <label style={labelStyle}>
              Name
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                style={inputStyle} />
            </label>

            <label style={labelStyle}>
              Description
              <input type="text" value={description} onChange={e => setDescription(e.target.value)}
                style={inputStyle} />
            </label>

            {/* Colors */}
            <div>
              <p style={sectionLabel}>Background</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {PRESET_COLORS.map(c => (
                  <button key={c} onClick={() => setBg(c)} style={{
                    ...swatchStyle, background: c,
                    border: bg === c ? '2px solid var(--gold)' : '2px solid transparent',
                  }} />
                ))}
                <input type="color" value={bg} onChange={e => setBg(e.target.value)}
                  style={{ width: 28, height: 28, cursor: 'pointer', border: 'none', padding: 0 }} />
              </div>
            </div>

            <div>
              <p style={sectionLabel}>Accent Color</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {ACCENT_COLORS.map(c => (
                  <button key={c} onClick={() => setAccent(c)} style={{
                    ...swatchStyle, background: c,
                    border: accent === c ? '2px solid var(--gold)' : '2px solid transparent',
                  }} />
                ))}
                <input type="color" value={accent} onChange={e => setAccent(e.target.value)}
                  style={{ width: 28, height: 28, cursor: 'pointer', border: 'none', padding: 0 }} />
              </div>
            </div>

            <div>
              <p style={sectionLabel}>Text Colors</p>
              <div style={{ display: 'flex', gap: 12 }}>
                <label style={{ ...labelStyle, flex: 1 }}>
                  Primary
                  <input type="color" value={textPrimary} onChange={e => setTextPrimary(e.target.value)}
                    style={{ width: '100%', height: 28, cursor: 'pointer' }} />
                </label>
                <label style={{ ...labelStyle, flex: 1 }}>
                  Secondary
                  <input type="color" value={textSecondary} onChange={e => setTextSecondary(e.target.value)}
                    style={{ width: '100%', height: 28, cursor: 'pointer' }} />
                </label>
              </div>
            </div>

            {/* Fonts */}
            <div style={{ display: 'flex', gap: 12 }}>
              <label style={{ ...labelStyle, flex: 1 }}>
                Script Font
                <select value={scriptFont} onChange={e => setScriptFont(e.target.value)} style={selectStyle}>
                  {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </label>
              <label style={{ ...labelStyle, flex: 1 }}>
                Body Font
                <select value={bodyFont} onChange={e => setBodyFont(e.target.value)} style={selectStyle}>
                  {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </label>
            </div>

            {/* Grid settings */}
            <div>
              <p style={sectionLabel}>Grid</p>
              <label style={labelStyle}>
                Gap: {(gridGap * 100).toFixed(1)}%
                <input type="range" min="0" max="0.02" step="0.001" value={gridGap}
                  onChange={e => setGridGap(parseFloat(e.target.value))} style={{ width: '100%' }} />
              </label>
              <label style={labelStyle}>
                Rotation: {rotation.toFixed(1)}&deg;
                <input type="range" min="0" max="2" step="0.1" value={rotation}
                  onChange={e => setRotation(parseFloat(e.target.value))} style={{ width: '100%' }} />
              </label>
            </div>

            {/* Toggles */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <label style={toggleStyle}>
                <input type="checkbox" checked={showNotes} onChange={e => setShowNotes(e.target.checked)} />
                Music Notes
              </label>
              <label style={toggleStyle}>
                <input type="checkbox" checked={showVinyl} onChange={e => setShowVinyl(e.target.checked)} />
                Vinyl Overlay
              </label>
              <label style={toggleStyle}>
                <input type="checkbox" checked={showChevrons} onChange={e => setShowChevrons(e.target.checked)} />
                Chevrons
              </label>
            </div>

            {/* Background frame upload */}
            <div>
              <p style={sectionLabel}>Background Frame (optional 1080x1080 PNG)</p>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg"
                onChange={handleBgUpload} style={{ fontSize: '0.75rem' }} />
              {bgFrameUrl && (
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <img src={bgFrameUrl} alt="Background frame" style={{ width: 48, height: 48, borderRadius: 4, objectFit: 'cover' }} />
                  <button className="btn btn-sm btn-danger" onClick={() => { setBgFrameUrl(null); if (fileRef.current) fileRef.current.value = ''; }}>
                    Remove
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Live Preview */}
          <div style={{ position: 'sticky', top: 0 }}>
            <p style={sectionLabel}>Preview</p>
            {previewUrl && (
              <img src={previewUrl} alt="Template preview"
                style={{ width: '100%', borderRadius: 8, border: '1px solid var(--midnight-border)' }} />
            )}
          </div>
        </div>

        {/* Save */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--midnight-border)' }}>
          <button className="btn btn-sm" onClick={onCancel}>Cancel</button>
          <button className="btn btn-gold btn-sm" onClick={() => onSave(buildTemplate())}>
            {initial ? 'Update Template' : 'Save Template'}
          </button>
        </div>
      </div>
    </div>
  );
}

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

const labelStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 4,
  fontSize: '0.7rem', color: 'var(--text-muted)',
};

const sectionLabel: React.CSSProperties = {
  fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
  background: 'var(--midnight)', border: '1px solid var(--midnight-border)',
  borderRadius: 6, padding: '6px 10px', color: 'var(--text-primary)',
  fontSize: '0.8rem', fontFamily: 'var(--font-body)',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle, width: '100%',
};

const swatchStyle: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 6, cursor: 'pointer',
};

const toggleStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  fontSize: '0.75rem', color: 'var(--text-secondary)', cursor: 'pointer',
};
