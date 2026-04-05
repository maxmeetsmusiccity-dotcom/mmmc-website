import { useState, useEffect, useRef, useCallback } from 'react';
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
  { label: 'JetBrains Mono', value: '"JetBrains Mono", monospace' },
  { label: 'System', value: 'system-ui, sans-serif' },
];

const PRESET_COLORS = [
  '#0F1B33', '#1A1A2E', '#1A0A2E', '#0D0D0D',
  '#1C1208', '#F5F0E8', '#0B1622', '#2C1810',
  '#FFFFFF', '#050510', '#1A2E1A', '#0A0E1E',
];

const ACCENT_COLORS = [
  '#D4A843', '#FFFFFF', '#FF69B4', '#FF4500',
  '#FFB347', '#1A1A1A', '#00D4FF', '#7B68EE',
  '#E8E8E8', '#7BA87A', '#CC1100', '#C4572A',
];

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16) || 0;
  const g = parseInt(h.substring(2, 4), 16) || 0;
  const b = parseInt(h.substring(4, 6), 16) || 0;
  return `${r}, ${g}, ${b}`;
}

export default function TemplateBuilder({ onSave, onCancel, initial }: Props) {
  const base = initial || TEMPLATES[0];

  // --- State for ALL controls ---
  // Identity
  const [name, setName] = useState(initial ? base.name : 'My Template');
  const [description, setDescription] = useState(initial ? base.description : 'Custom design');

  // Colors
  const [bg, setBg] = useState(base.background);
  const [accent, setAccent] = useState(base.accent);
  const [textPrimary, setTextPrimary] = useState(base.textPrimary);
  const [textSecondary, setTextSecondary] = useState(base.textSecondary);
  const [useGradient, setUseGradient] = useState(!!base.backgroundGradient);
  const [gradientEnd, setGradientEnd] = useState('#000000');
  const [gradientAngle, setGradientAngle] = useState(180);

  // Typography
  const [scriptFont, setScriptFont] = useState(base.scriptFont);
  const [bodyFont, setBodyFont] = useState(base.bodyFont);
  const [headerFontSize, setHeaderFontSize] = useState(base.headerFontSize || 52);
  const [glowIntensity, setGlowIntensity] = useState(Math.round(base.neon.outerBlur / 60 * 100));
  const [glowColor, setGlowColor] = useState(base.accent);
  const [letterSpacing, setLetterSpacing] = useState(base.letterSpacing || 0);
  const [textTransform, setTextTransform] = useState<'none' | 'uppercase' | 'lowercase'>(base.textTransform || 'none');

  // Grid
  const [gridGap, setGridGap] = useState(base.grid.gap);
  const [rotation, setRotation] = useState(Math.abs(base.grid.rotations[0]));
  const [cellBorder, setCellBorder] = useState(base.grid.cellBorder);
  const [cellBorderWidth, setCellBorderWidth] = useState(base.cellBorderWidth || 2);
  const [cellBorderColor, setCellBorderColor] = useState(base.grid.cellBorderColor || accent);
  const [cellCornerRadius, setCellCornerRadius] = useState(base.cellCornerRadius || 0);
  const [cellShadow, setCellShadow] = useState(base.grid.cellShadow);
  const [cellShadowBlur, setCellShadowBlur] = useState(base.cellShadowBlur || 16);

  // Decorations
  const [showNotes, setShowNotes] = useState(base.decorations.showNotes);
  const [showSparkles, setShowSparkles] = useState(base.decorations.showSparkles);
  const [showVinyl, setShowVinyl] = useState(base.cover.vinylOverlay);
  const [vinylOpacity, setVinylOpacity] = useState(base.cover.vinylOpacity);
  const [showChevrons, setShowChevrons] = useState(base.cover.showChevrons);
  const [noteSize, setNoteSize] = useState(base.decorations.noteSize);
  const [sparkleSize, setSparkleSize] = useState(base.decorations.sparkleSize);

  // Effects
  const [grainIntensity, setGrainIntensity] = useState(base.grainIntensity || 0.12);
  const [vignetteIntensity, setVignetteIntensity] = useState(base.vignetteIntensity || 0.2);
  const [scanlineSpacing, setScanlineSpacing] = useState(base.scanlineSpacing || 0);
  const [colorOverlay, setColorOverlay] = useState(base.colorOverlay || '');
  const [colorOverlayBlend, setColorOverlayBlend] = useState<'screen' | 'multiply' | 'overlay'>(base.colorOverlayBlend || 'overlay');

  // Assets
  const [bgFrameUrl, setBgFrameUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const jsonImportRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const previewTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Build the full CarouselTemplate from state
  const buildTemplate = useCallback((): CarouselTemplate => {
    const outerBlur = Math.round(glowIntensity / 100 * 60);
    const outerAlpha = glowIntensity / 100 * 0.4;
    return {
      id: initial?.id || `custom_${Date.now()}`,
      name, description,
      background: bg,
      textPrimary, textSecondary,
      accent,
      accentGlow: `rgba(${hexToRgb(glowColor)}, `,
      scriptFont, bodyFont,
      neon: {
        outerGlow: `rgba(${hexToRgb(glowColor)}, ${outerAlpha.toFixed(2)})`,
        outerBlur,
        outerAlpha,
        midGlow: `rgba(${hexToRgb(glowColor)}, ${(outerAlpha * 1.8).toFixed(2)})`,
        midBlur: Math.round(outerBlur * 0.45),
        midAlpha: outerAlpha * 2,
        coreColor: textPrimary,
        coreBlur: Math.round(outerBlur * 0.12),
      },
      grid: {
        gap: gridGap,
        rotations: Array(8).fill(0).map((_, i) => (i % 2 === 0 ? -rotation : rotation)),
        cellShadow,
        cellBorder,
        cellBorderColor,
      },
      cover: {
        vinylOverlay: showVinyl, vinylOpacity,
        grooveCount: 60, frameBorder: 14,
        frameColor: textPrimary, frameShadowBlur: 32,
        showChevrons, showArtistName: true, showTrackName: true,
        subtitleText: name,
      },
      decorations: { showNotes, showSparkles, noteSize, sparkleSize },
      assets: bgFrameUrl ? { background: bgFrameUrl } : undefined,
      // Extended fields
      backgroundGradient: useGradient ? `linear-gradient(${gradientAngle}deg, ${bg}, ${gradientEnd})` : undefined,
      headerFontSize, letterSpacing, textTransform,
      cellCornerRadius, cellShadowBlur, cellBorderWidth,
      grainIntensity, vignetteIntensity, scanlineSpacing,
      colorOverlay: colorOverlay || undefined,
      colorOverlayBlend,
    };
  }, [name, description, bg, accent, textPrimary, textSecondary, scriptFont, bodyFont,
    gridGap, rotation, cellBorder, cellBorderWidth, cellBorderColor, cellCornerRadius,
    cellShadow, cellShadowBlur, showNotes, showSparkles, showVinyl, vinylOpacity,
    showChevrons, noteSize, sparkleSize, grainIntensity, vignetteIntensity,
    scanlineSpacing, colorOverlay, colorOverlayBlend, bgFrameUrl, useGradient,
    gradientEnd, gradientAngle, glowIntensity, glowColor, headerFontSize,
    letterSpacing, textTransform, initial?.id]);

  // Debounced preview update (200ms)
  useEffect(() => {
    clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => {
      const t = buildTemplate();
      setPreviewUrl(generateTemplatePreview(t, 300));
    }, 200);
    return () => clearTimeout(previewTimer.current);
  }, [buildTemplate]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        onSave(buildTemplate());
      }
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [buildTemplate, onSave, onCancel]);

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setBgFrameUrl(URL.createObjectURL(file));
  };

  const handleExportJSON = () => {
    const t = buildTemplate();
    const blob = new Blob([JSON.stringify(t, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${t.name.replace(/\s+/g, '_')}_template.json`;
    a.click(); URL.revokeObjectURL(url);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then(text => {
      try {
        const t = JSON.parse(text) as CarouselTemplate;
        setName(t.name || 'Imported');
        setDescription(t.description || '');
        setBg(t.background);
        setAccent(t.accent);
        setTextPrimary(t.textPrimary);
        setTextSecondary(t.textSecondary);
        setScriptFont(t.scriptFont);
        setBodyFont(t.bodyFont);
        setGridGap(t.grid.gap);
        setRotation(Math.abs(t.grid.rotations[0] || 0));
        setCellBorder(t.grid.cellBorder);
        setCellBorderColor(t.grid.cellBorderColor);
        setCellShadow(t.grid.cellShadow);
        setShowNotes(t.decorations.showNotes);
        setShowSparkles(t.decorations.showSparkles);
        setShowVinyl(t.cover.vinylOverlay);
        setShowChevrons(t.cover.showChevrons);
        if (t.headerFontSize) setHeaderFontSize(t.headerFontSize);
        if (t.grainIntensity !== undefined) setGrainIntensity(t.grainIntensity);
        if (t.vignetteIntensity !== undefined) setVignetteIntensity(t.vignetteIntensity);
        if (t.cellCornerRadius !== undefined) setCellCornerRadius(t.cellCornerRadius);
        if (t.letterSpacing !== undefined) setLetterSpacing(t.letterSpacing);
        if (t.textTransform) setTextTransform(t.textTransform);
      } catch { /* invalid JSON */ }
    });
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 760, maxHeight: '92vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-2xl)' }}>
            Template Builder
          </h3>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-sm" onClick={handleExportJSON} title="Export template as JSON">Export</button>
            <button className="btn btn-sm" onClick={() => jsonImportRef.current?.click()} title="Import template from JSON">Import</button>
            <input ref={jsonImportRef} type="file" accept=".json" onChange={handleImportJSON} style={{ display: 'none' }} />
            <button className="btn btn-sm" onClick={onCancel}>Cancel</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20 }}>
          {/* Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {/* Name */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
              <label style={{ ...labelStyle, flex: 2 }}>
                Name
                <input type="text" value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
              </label>
              <label style={{ ...labelStyle, flex: 3 }}>
                Description
                <input type="text" value={description} onChange={e => setDescription(e.target.value)} style={inputStyle} />
              </label>
            </div>

            {/* === COLORS === */}
            <details open>
              <summary style={sectionHeader}>Colors & Background</summary>
              <div style={sectionBody}>
                <p style={fieldLabel}>Background</p>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
                  {PRESET_COLORS.map(c => (
                    <button key={c} onClick={() => setBg(c)} title={c} style={{
                      ...swatchStyle, background: c,
                      border: bg === c ? '2px solid var(--gold)' : '2px solid transparent',
                    }} />
                  ))}
                  <input type="color" value={bg} onChange={e => setBg(e.target.value)}
                    style={{ width: 26, height: 26, cursor: 'pointer', border: 'none', padding: 0 }} />
                </div>

                <label style={toggleStyle}>
                  <input type="checkbox" checked={useGradient} onChange={e => setUseGradient(e.target.checked)} />
                  Gradient
                </label>
                {useGradient && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4, marginBottom: 8 }}>
                    <input type="color" value={gradientEnd} onChange={e => setGradientEnd(e.target.value)}
                      style={{ width: 26, height: 26, cursor: 'pointer' }} title="Gradient end color" />
                    <label style={{ ...labelStyle, flex: 1 }}>
                      Angle: {gradientAngle}&deg;
                      <input type="range" min="0" max="360" value={gradientAngle}
                        onChange={e => setGradientAngle(Number(e.target.value))} style={{ width: '100%' }} />
                    </label>
                  </div>
                )}

                <p style={fieldLabel}>Accent</p>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
                  {ACCENT_COLORS.map(c => (
                    <button key={c} onClick={() => setAccent(c)} title={c} style={{
                      ...swatchStyle, background: c,
                      border: accent === c ? '2px solid var(--gold)' : '2px solid transparent',
                    }} />
                  ))}
                  <input type="color" value={accent} onChange={e => setAccent(e.target.value)}
                    style={{ width: 26, height: 26, cursor: 'pointer', border: 'none', padding: 0 }} />
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <label style={{ ...labelStyle, flex: 1 }}>
                    Text Primary
                    <input type="color" value={textPrimary} onChange={e => setTextPrimary(e.target.value)}
                      style={{ width: '100%', height: 26, cursor: 'pointer' }} />
                  </label>
                  <label style={{ ...labelStyle, flex: 1 }}>
                    Text Secondary
                    <input type="color" value={textSecondary} onChange={e => setTextSecondary(e.target.value)}
                      style={{ width: '100%', height: 26, cursor: 'pointer' }} />
                  </label>
                </div>
              </div>
            </details>

            {/* === TYPOGRAPHY === */}
            <details>
              <summary style={sectionHeader}>Typography</summary>
              <div style={sectionBody}>
                <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                  <label style={{ ...labelStyle, flex: 1 }}>
                    Header Font
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

                <label style={labelStyle}>
                  Header Size: {headerFontSize}px
                  <input type="range" min="28" max="72" value={headerFontSize}
                    onChange={e => setHeaderFontSize(Number(e.target.value))} style={{ width: '100%' }} />
                </label>

                <div style={{ display: 'flex', gap: 10 }}>
                  <label style={{ ...labelStyle, flex: 1 }}>
                    Glow: {glowIntensity}%
                    <input type="range" min="0" max="100" value={glowIntensity}
                      onChange={e => setGlowIntensity(Number(e.target.value))} style={{ width: '100%' }} />
                  </label>
                  <label style={{ ...labelStyle, flex: 0 }}>
                    Color
                    <input type="color" value={glowColor} onChange={e => setGlowColor(e.target.value)}
                      style={{ width: 26, height: 26, cursor: 'pointer' }} />
                  </label>
                </div>

                <label style={labelStyle}>
                  Letter Spacing: {letterSpacing}px
                  <input type="range" min="-2" max="8" step="0.5" value={letterSpacing}
                    onChange={e => setLetterSpacing(Number(e.target.value))} style={{ width: '100%' }} />
                </label>

                <label style={labelStyle}>
                  Text Transform
                  <select value={textTransform} onChange={e => setTextTransform(e.target.value as 'none' | 'uppercase' | 'lowercase')} style={selectStyle}>
                    <option value="none">None</option>
                    <option value="uppercase">UPPERCASE</option>
                    <option value="lowercase">lowercase</option>
                  </select>
                </label>
              </div>
            </details>

            {/* === GRID STYLE === */}
            <details>
              <summary style={sectionHeader}>Grid Style</summary>
              <div style={sectionBody}>
                <label style={labelStyle}>
                  Cell Gap: {(gridGap * 100).toFixed(1)}%
                  <input type="range" min="0" max="0.03" step="0.001" value={gridGap}
                    onChange={e => setGridGap(parseFloat(e.target.value))} style={{ width: '100%' }} />
                </label>

                <label style={labelStyle}>
                  Cell Rotation: &plusmn;{rotation.toFixed(1)}&deg;
                  <input type="range" min="0" max="5" step="0.1" value={rotation}
                    onChange={e => setRotation(parseFloat(e.target.value))} style={{ width: '100%' }} />
                </label>

                <label style={labelStyle}>
                  Rounded Corners: {cellCornerRadius}px
                  <input type="range" min="0" max="30" value={cellCornerRadius}
                    onChange={e => setCellCornerRadius(Number(e.target.value))} style={{ width: '100%' }} />
                </label>

                <label style={toggleStyle}>
                  <input type="checkbox" checked={cellShadow} onChange={e => setCellShadow(e.target.checked)} />
                  Cell Shadow
                </label>
                {cellShadow && (
                  <label style={labelStyle}>
                    Shadow Blur: {cellShadowBlur}px
                    <input type="range" min="0" max="40" value={cellShadowBlur}
                      onChange={e => setCellShadowBlur(Number(e.target.value))} style={{ width: '100%' }} />
                  </label>
                )}

                <label style={toggleStyle}>
                  <input type="checkbox" checked={cellBorder} onChange={e => setCellBorder(e.target.checked)} />
                  Cell Border
                </label>
                {cellBorder && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                    <label style={{ ...labelStyle, flex: 1 }}>
                      Width: {cellBorderWidth}px
                      <input type="range" min="1" max="6" value={cellBorderWidth}
                        onChange={e => setCellBorderWidth(Number(e.target.value))} style={{ width: '100%' }} />
                    </label>
                    <label style={labelStyle}>
                      Color
                      <input type="color" value={cellBorderColor} onChange={e => setCellBorderColor(e.target.value)}
                        style={{ width: 26, height: 26, cursor: 'pointer' }} />
                    </label>
                  </div>
                )}
              </div>
            </details>

            {/* === DECORATIONS === */}
            <details>
              <summary style={sectionHeader}>Decorations</summary>
              <div style={sectionBody}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
                  <label style={toggleStyle}>
                    <input type="checkbox" checked={showNotes} onChange={e => setShowNotes(e.target.checked)} />
                    Music Notes
                  </label>
                  <label style={toggleStyle}>
                    <input type="checkbox" checked={showSparkles} onChange={e => setShowSparkles(e.target.checked)} />
                    Sparkles
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

                {showNotes && (
                  <label style={labelStyle}>
                    Note Size: {noteSize}px
                    <input type="range" min="20" max="80" value={noteSize}
                      onChange={e => setNoteSize(Number(e.target.value))} style={{ width: '100%' }} />
                  </label>
                )}
                {showSparkles && (
                  <label style={labelStyle}>
                    Sparkle Size: {sparkleSize}px
                    <input type="range" min="12" max="60" value={sparkleSize}
                      onChange={e => setSparkleSize(Number(e.target.value))} style={{ width: '100%' }} />
                  </label>
                )}
                {showVinyl && (
                  <label style={labelStyle}>
                    Vinyl Opacity: {Math.round(vinylOpacity * 100)}%
                    <input type="range" min="0" max="1" step="0.05" value={vinylOpacity}
                      onChange={e => setVinylOpacity(parseFloat(e.target.value))} style={{ width: '100%' }} />
                  </label>
                )}
              </div>
            </details>

            {/* === EFFECTS === */}
            <details>
              <summary style={sectionHeader}>Effects</summary>
              <div style={sectionBody}>
                <label style={labelStyle}>
                  Film Grain: {Math.round(grainIntensity * 100)}%
                  <input type="range" min="0" max="0.5" step="0.01" value={grainIntensity}
                    onChange={e => setGrainIntensity(parseFloat(e.target.value))} style={{ width: '100%' }} />
                </label>

                <label style={labelStyle}>
                  Vignette: {Math.round(vignetteIntensity * 100)}%
                  <input type="range" min="0" max="0.6" step="0.02" value={vignetteIntensity}
                    onChange={e => setVignetteIntensity(parseFloat(e.target.value))} style={{ width: '100%' }} />
                </label>

                <label style={labelStyle}>
                  Scanlines: {scanlineSpacing === 0 ? 'Off' : `${scanlineSpacing}px`}
                  <input type="range" min="0" max="8" value={scanlineSpacing}
                    onChange={e => setScanlineSpacing(Number(e.target.value))} style={{ width: '100%' }} />
                </label>

                <label style={labelStyle}>
                  Color Overlay
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="color" value={colorOverlay || '#000000'} onChange={e => setColorOverlay(e.target.value)}
                      style={{ width: 26, height: 26, cursor: 'pointer' }} />
                    <select value={colorOverlayBlend} onChange={e => setColorOverlayBlend(e.target.value as 'screen' | 'multiply' | 'overlay')} style={{ ...selectStyle, flex: 1 }}>
                      <option value="overlay">Overlay</option>
                      <option value="screen">Screen (lighten)</option>
                      <option value="multiply">Multiply (darken)</option>
                    </select>
                    {colorOverlay && (
                      <button className="btn btn-sm" onClick={() => setColorOverlay('')} style={{ fontSize: 'var(--fs-3xs)', padding: '2px 6px' }}>Clear</button>
                    )}
                  </div>
                </label>
              </div>
            </details>

            {/* === BACKGROUND IMAGE === */}
            <details>
              <summary style={sectionHeader}>Background Image</summary>
              <div style={sectionBody}>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp"
                  onChange={handleBgUpload} style={{ fontSize: 'var(--fs-sm)' }} />
                {bgFrameUrl && (
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <img src={bgFrameUrl} alt="Background" style={{ width: 48, height: 48, borderRadius: 4, objectFit: 'cover' }} />
                    <button className="btn btn-sm btn-danger" onClick={() => { setBgFrameUrl(null); if (fileRef.current) fileRef.current.value = ''; }}>
                      Remove
                    </button>
                  </div>
                )}
              </div>
            </details>
          </div>

          {/* Live Preview */}
          <div style={{ position: 'sticky', top: 0, alignSelf: 'start' }}>
            <p style={fieldLabel}>Live Preview</p>
            {previewUrl ? (
              <img src={previewUrl} alt="Template preview"
                style={{ width: '100%', borderRadius: 8, border: '1px solid var(--midnight-border)' }} />
            ) : (
              <div style={{
                width: '100%', aspectRatio: '1', borderRadius: 8,
                background: bg, border: '1px solid var(--midnight-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: accent, fontSize: 'var(--fs-md)',
              }}>
                Loading...
              </div>
            )}
            <p style={{ fontSize: 'var(--fs-3xs)', color: 'var(--text-muted)', marginTop: 4 }}>
              Cmd+S to save &bull; Esc to cancel
            </p>
          </div>
        </div>

        {/* Save */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--midnight-border)' }}>
          <button className="btn btn-sm" onClick={onCancel}>Cancel</button>
          <button className="btn btn-gold btn-sm" onClick={() => onSave(buildTemplate())} title="Save template (Cmd+S)">
            {initial ? 'Update Template' : 'Save Template'}
          </button>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 3,
  fontSize: 'var(--fs-xs)', color: 'var(--text-muted)',
};

const fieldLabel: React.CSSProperties = {
  fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600,
};

const sectionHeader: React.CSSProperties = {
  fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', fontWeight: 600,
  cursor: 'pointer', padding: '8px 0',
  borderBottom: '1px solid var(--midnight-border)',
};

const sectionBody: React.CSSProperties = {
  padding: '10px 0', display: 'flex', flexDirection: 'column', gap: 8,
};

const inputStyle: React.CSSProperties = {
  background: 'var(--midnight)', border: '1px solid var(--midnight-border)',
  borderRadius: 6, padding: '5px 8px', color: 'var(--text-primary)',
  fontSize: 'var(--fs-sm)', fontFamily: 'var(--font-body)',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle, width: '100%',
};

const swatchStyle: React.CSSProperties = {
  width: 26, height: 26, borderRadius: 5, cursor: 'pointer',
};

const toggleStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 5,
  fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', cursor: 'pointer',
};
