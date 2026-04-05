import { useState, useRef, useEffect, useCallback } from 'react';
import type { CarouselTemplate } from '../lib/carousel-templates';
import { uploadTemplateAsset } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';

interface Props {
  onImport: (template: CarouselTemplate) => void;
  onCancel: () => void;
}

type Step = 'upload' | 'grid' | 'colors' | 'save';

const GRID_PRESETS = [
  { label: '2x2', cols: 2, rows: 2 },
  { label: '2x3', cols: 2, rows: 3 },
  { label: '3x3', cols: 3, rows: 3 },
  { label: '3x3 + Logo', cols: 3, rows: 3, logo: true },
  { label: '4x4', cols: 4, rows: 4 },
  { label: '3x4', cols: 3, rows: 4 },
];

function sampleColor(ctx: CanvasRenderingContext2D, x: number, y: number, radius = 3): string {
  const data = ctx.getImageData(Math.max(0, x - radius), Math.max(0, y - radius), radius * 2, radius * 2).data;
  let r = 0, g = 0, b = 0, count = 0;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i]; g += data[i + 1]; b += data[i + 2]; count++;
  }
  if (count === 0) return '#000000';
  return `#${[r, g, b].map(c => Math.round(c / count).toString(16).padStart(2, '0')).join('')}`;
}

export default function TemplateImporter({ onImport, onCancel }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('upload');
  const [imageUrl, setImageUrl] = useState('');
  const [imageDimensions, setImageDimensions] = useState({ w: 0, h: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // Grid overlay state
  const [gridPreset, setGridPreset] = useState(GRID_PRESETS[2]); // 3x3 default
  const [gridX, setGridX] = useState(0.05);    // fraction of image width
  const [gridY, setGridY] = useState(0.1);
  const [gridW, setGridW] = useState(0.9);
  const [gridH, setGridH] = useState(0.8);

  // Sampled colors
  const [bgColor, setBgColor] = useState('#0F1B33');
  const [borderColor, setBorderColor] = useState('#2A3A5C');
  const [accentColor, setAccentColor] = useState('#D4A843');

  // Name
  const [name, setName] = useState('Imported Template');
  const [saving, setSaving] = useState(false);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      setImageDimensions({ w: img.width, h: img.height });
      setStep('grid');
    };
    img.src = url;
  };

  // Draw image + grid overlay on canvas
  const drawOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const displayW = Math.min(600, img.width);
    const scale = displayW / img.width;
    const displayH = img.height * scale;
    canvas.width = displayW;
    canvas.height = displayH;

    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, displayW, displayH);

    // Grid overlay
    const gx = gridX * displayW;
    const gy = gridY * displayH;
    const gw = gridW * displayW;
    const gh = gridH * displayH;

    // Semi-transparent overlay outside grid
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, 0, displayW, gy);
    ctx.fillRect(0, gy, gx, gh);
    ctx.fillRect(gx + gw, gy, displayW - gx - gw, gh);
    ctx.fillRect(0, gy + gh, displayW, displayH - gy - gh);

    // Grid lines
    const cols = gridPreset.cols;
    const rows = gridPreset.rows;
    const cellW = gw / cols;
    const cellH = gh / rows;

    ctx.strokeStyle = 'rgba(212,168,67,0.8)';
    ctx.lineWidth = 1;
    // Vertical lines
    for (let c = 0; c <= cols; c++) {
      ctx.beginPath();
      ctx.moveTo(gx + c * cellW, gy);
      ctx.lineTo(gx + c * cellW, gy + gh);
      ctx.stroke();
    }
    // Horizontal lines
    for (let r = 0; r <= rows; r++) {
      ctx.beginPath();
      ctx.moveTo(gx, gy + r * cellH);
      ctx.lineTo(gx + gw, gy + r * cellH);
      ctx.stroke();
    }

    // Logo marker
    if (gridPreset.logo) {
      const logoCol = Math.floor(cols / 2);
      const logoRow = Math.floor(rows / 2);
      ctx.fillStyle = 'rgba(212,168,67,0.3)';
      ctx.fillRect(gx + logoCol * cellW, gy + logoRow * cellH, cellW, cellH);
      ctx.fillStyle = '#D4A843';
      ctx.font = '12px "DM Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('LOGO', gx + logoCol * cellW + cellW / 2, gy + logoRow * cellH + cellH / 2);
    }
  }, [gridX, gridY, gridW, gridH, gridPreset]);

  useEffect(() => { drawOverlay(); }, [drawOverlay]);

  const handleSampleColors = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const w = canvas.width, h = canvas.height;

    // Background: sample from corners
    setBgColor(sampleColor(ctx, 5, 5));
    // Border: sample from gap between first two cells
    const gx = gridX * w;
    const gy = gridY * h;
    const cellW = (gridW * w) / gridPreset.cols;
    setBorderColor(sampleColor(ctx, Math.round(gx + cellW), Math.round(gy + 10)));
    // Accent: sample from header area (top 10% center)
    setAccentColor(sampleColor(ctx, Math.round(w / 2), Math.round(h * 0.05)));

    setStep('colors');
  };

  const handleSave = async () => {
    setSaving(true);

    // Upload the image to Supabase Storage for persistence (GAP 6)
    let persistedUrl = imageUrl;
    if (user?.id && imageRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = imageDimensions.w;
      canvas.height = imageDimensions.h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(imageRef.current, 0, 0);
      const blob = await new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b!), 'image/png'));
      const uploaded = await uploadTemplateAsset(user.id, `import_${Date.now()}.png`, blob);
      if (uploaded) persistedUrl = uploaded;
    }

    const template: CarouselTemplate = {
      id: `import_${Date.now()}`,
      name,
      description: 'Imported from image',
      background: bgColor,
      textPrimary: accentColor,
      textSecondary: borderColor,
      accent: accentColor,
      accentGlow: `rgba(${accentColor.replace('#', '').match(/.{2}/g)?.map(h => parseInt(h, 16)).join(', ') || '212,168,67'}, `,
      scriptFont: '"DM Sans", sans-serif',
      bodyFont: '"DM Sans", sans-serif',
      neon: {
        outerGlow: 'rgba(255,255,255,0.1)', outerBlur: 10, outerAlpha: 0.1,
        midGlow: 'rgba(255,255,255,0.2)', midBlur: 5, midAlpha: 0.2,
        coreColor: accentColor, coreBlur: 2,
      },
      grid: {
        gap: 0.004,
        rotations: [0, 0, 0, 0, 0, 0, 0, 0],
        cellShadow: false,
        cellBorder: borderColor !== bgColor,
        cellBorderColor: borderColor,
      },
      cover: {
        vinylOverlay: false, vinylOpacity: 0, grooveCount: 0,
        frameBorder: 0, frameColor: '', frameShadowBlur: 0,
        showChevrons: false, showArtistName: true, showTrackName: true,
        subtitleText: name,
      },
      decorations: { showNotes: false, showSparkles: false, noteSize: 0, sparkleSize: 0 },
      assets: { background: persistedUrl },
    };

    onImport(template);
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 680, maxHeight: '92vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-2xl)' }}>
            Import Template from Image
          </h3>
          <button className="btn btn-sm" onClick={onCancel}>Cancel</button>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
          {(['upload', 'grid', 'colors', 'save'] as Step[]).map((s, i) => (
            <div key={s} style={{
              flex: 1, height: 3, borderRadius: 2,
              background: i <= ['upload', 'grid', 'colors', 'save'].indexOf(step) ? 'var(--gold)' : 'var(--midnight-border)',
            }} />
          ))}
        </div>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <p style={{ fontSize: 'var(--fs-md)', color: 'var(--text-secondary)', marginBottom: 16 }}>
              Upload an existing carousel slide image. We'll help you extract a reusable template from it.
            </p>
            <label style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '14px 28px', borderRadius: 10, cursor: 'pointer',
              background: 'var(--gold)', color: 'var(--midnight)',
              fontWeight: 600, fontSize: 'var(--fs-md)',
            }}>
              Choose Image
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleUpload} style={{ display: 'none' }} />
            </label>
          </div>
        )}

        {/* Step 2: Position grid overlay */}
        {step === 'grid' && (
          <div>
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginBottom: 8 }}>
              Select grid type and adjust the overlay to match the cell positions in your image.
            </p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {GRID_PRESETS.map(p => (
                <button
                  key={p.label}
                  onClick={() => setGridPreset(p)}
                  className={`filter-pill ${gridPreset.label === p.label ? 'active' : ''}`}
                  style={{ fontSize: 'var(--fs-xs)' }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <canvas ref={canvasRef} style={{ width: '100%', borderRadius: 8, border: '1px solid var(--midnight-border)' }} />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 12 }}>
              <label style={sliderLabel}>
                Left: {Math.round(gridX * 100)}%
                <input type="range" min="0" max="0.3" step="0.01" value={gridX}
                  onChange={e => setGridX(parseFloat(e.target.value))} style={{ width: '100%' }} />
              </label>
              <label style={sliderLabel}>
                Top: {Math.round(gridY * 100)}%
                <input type="range" min="0" max="0.3" step="0.01" value={gridY}
                  onChange={e => setGridY(parseFloat(e.target.value))} style={{ width: '100%' }} />
              </label>
              <label style={sliderLabel}>
                Width: {Math.round(gridW * 100)}%
                <input type="range" min="0.5" max="1" step="0.01" value={gridW}
                  onChange={e => setGridW(parseFloat(e.target.value))} style={{ width: '100%' }} />
              </label>
              <label style={sliderLabel}>
                Height: {Math.round(gridH * 100)}%
                <input type="range" min="0.5" max="1" step="0.01" value={gridH}
                  onChange={e => setGridH(parseFloat(e.target.value))} style={{ width: '100%' }} />
              </label>
            </div>

            <button className="btn btn-gold" onClick={handleSampleColors} style={{ marginTop: 16, width: '100%', justifyContent: 'center' }}>
              Sample Colors &amp; Continue
            </button>
          </div>
        )}

        {/* Step 3: Review colors */}
        {step === 'colors' && (
          <div>
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginBottom: 12 }}>
              Sampled colors from your image. Adjust if needed.
            </p>
            <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
              <label style={{ ...sliderLabel, flex: 1 }}>
                Background
                <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)}
                  style={{ width: '100%', height: 36, cursor: 'pointer' }} />
              </label>
              <label style={{ ...sliderLabel, flex: 1 }}>
                Border/Gap
                <input type="color" value={borderColor} onChange={e => setBorderColor(e.target.value)}
                  style={{ width: '100%', height: 36, cursor: 'pointer' }} />
              </label>
              <label style={{ ...sliderLabel, flex: 1 }}>
                Accent/Text
                <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)}
                  style={{ width: '100%', height: 36, cursor: 'pointer' }} />
              </label>
            </div>
            <button className="btn btn-gold" onClick={() => setStep('save')} style={{ width: '100%', justifyContent: 'center' }}>
              Continue to Save
            </button>
          </div>
        )}

        {/* Step 4: Name & save */}
        {step === 'save' && (
          <div>
            <label style={sliderLabel}>
              Template Name
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 6,
                  background: 'var(--midnight)', border: '1px solid var(--midnight-border)',
                  color: 'var(--text-primary)', fontSize: 'var(--fs-md)',
                }} />
            </label>
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: 8 }}>
              Your uploaded image will be used as the template background. New album art will be composited into the cell positions you marked.
            </p>
            <button
              className="btn btn-gold"
              onClick={handleSave}
              disabled={saving}
              style={{ marginTop: 16, width: '100%', justifyContent: 'center' }}
            >
              {saving ? 'Saving...' : 'Save Template'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const sliderLabel: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 3,
  fontSize: 'var(--fs-xs)', color: 'var(--text-muted)',
};
