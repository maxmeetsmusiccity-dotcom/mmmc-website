import { useState } from 'react';
import type { TitleSlideTemplate } from '../lib/title-templates';
import { getTitleTemplate, TITLE_TEMPLATES } from '../lib/title-templates';

interface Props {
  onSave: (template: TitleSlideTemplate) => void;
  onCancel: () => void;
  initial?: TitleSlideTemplate;
}

const FONT_OPTIONS = [
  { label: 'Dancing Script', value: '"Dancing Script", cursive' },
  { label: 'Playfair Display', value: '"Playfair Display", "Georgia", serif' },
  { label: 'DM Sans', value: '"DM Sans", sans-serif' },
  { label: 'Source Serif', value: '"Source Serif 4", Georgia, serif' },
  { label: 'DM Mono', value: '"DM Mono", "Courier New", monospace' },
  { label: 'System', value: 'system-ui, sans-serif' },
];

const PRESET_BG = [
  '#0F1B33', '#1A1A2E', '#0D0D0D', '#1C1208',
  '#0B1622', '#050510', '#FFFFFF', '#F5F0E8',
];

function Slider({ label, value, min, max, step, onChange, suffix = '' }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; suffix?: string;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)' }}>
        <span>{label}</span><span>{typeof value === 'number' ? (step < 1 ? (value * 100).toFixed(0) + '%' : value + suffix) : value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))} style={{ width: '100%' }} />
    </div>
  );
}

export default function TitleTemplateBuilder({ onSave, onCancel, initial }: Props) {
  const base = initial || getTitleTemplate('vintage_press');
  const [t, setT] = useState<TitleSlideTemplate>({
    ...base,
    id: initial?.id || `custom_title_${Date.now()}`,
    name: initial?.name ? `${initial.name} (Custom)` : 'My Custom Title',
  });

  const update = <K extends keyof TitleSlideTemplate>(key: K, val: TitleSlideTemplate[K]) => {
    setT(prev => ({ ...prev, [key]: val }));
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{
        maxWidth: 560, maxHeight: '92vh', overflow: 'auto', padding: 24,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-2xl)', color: 'var(--gold)' }}>
            Title Template Builder
          </h3>
          <button className="btn btn-sm" onClick={onCancel}>Cancel</button>
        </div>

        {/* Name */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Name</label>
          <input type="text" value={t.name} onChange={e => update('name', e.target.value)}
            className="search-input" style={{ width: '100%' }} />
        </div>

        {/* Base template selector */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Start from</label>
          <select value={t.id.startsWith('custom_') ? '' : t.id}
            onChange={e => { if (e.target.value) { const base = getTitleTemplate(e.target.value); setT(prev => ({ ...base, id: prev.id, name: prev.name })); } }}
            style={{ width: '100%', padding: '6px 10px', borderRadius: 6, background: 'var(--midnight)', border: '1px solid var(--midnight-border)', color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)' }}>
            <option value="">Custom</option>
            {TITLE_TEMPLATES.map(tt => <option key={tt.id} value={tt.id}>{tt.name}</option>)}
          </select>
        </div>

        {/* Colors */}
        <details open style={{ marginBottom: 16 }}>
          <summary style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: 8 }}>Colors</summary>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {PRESET_BG.map(c => (
              <div key={c} onClick={() => update('background', c)}
                style={{ width: 28, height: 28, borderRadius: 4, background: c, cursor: 'pointer', border: t.background === c ? '2px solid var(--gold)' : '2px solid transparent' }} />
            ))}
            <input type="color" value={t.background} onChange={e => update('background', e.target.value)}
              style={{ width: 28, height: 28, border: 'none', borderRadius: 4, cursor: 'pointer' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <label style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)' }}>
              Text <input type="color" value={t.textPrimary} onChange={e => update('textPrimary', e.target.value)} style={{ width: 20, height: 20, border: 'none', borderRadius: 3, cursor: 'pointer', verticalAlign: 'middle', marginLeft: 4 }} />
            </label>
            <label style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)' }}>
              Accent <input type="color" value={t.accent} onChange={e => update('accent', e.target.value)} style={{ width: 20, height: 20, border: 'none', borderRadius: 3, cursor: 'pointer', verticalAlign: 'middle', marginLeft: 4 }} />
            </label>
            <label style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)' }}>
              Secondary <input type="color" value={t.textSecondary} onChange={e => update('textSecondary', e.target.value)} style={{ width: 20, height: 20, border: 'none', borderRadius: 3, cursor: 'pointer', verticalAlign: 'middle', marginLeft: 4 }} />
            </label>
          </div>
        </details>

        {/* Typography */}
        <details open style={{ marginBottom: 16 }}>
          <summary style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: 8 }}>Typography</summary>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <label style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)' }}>
              Headline Font
              <select value={t.headlineFont} onChange={e => update('headlineFont', e.target.value)}
                style={{ width: '100%', padding: '4px 8px', borderRadius: 4, background: 'var(--midnight)', border: '1px solid var(--midnight-border)', color: 'var(--text-secondary)', fontSize: 'var(--fs-2xs)', marginTop: 2 }}>
                {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)' }}>
              Date Font
              <select value={t.dateFont} onChange={e => update('dateFont', e.target.value)}
                style={{ width: '100%', padding: '4px 8px', borderRadius: 4, background: 'var(--midnight)', border: '1px solid var(--midnight-border)', color: 'var(--text-secondary)', fontSize: 'var(--fs-2xs)', marginTop: 2 }}>
                {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 4 }}>
            <label style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)' }}>
              Case
              <select value={t.headlineCase} onChange={e => update('headlineCase', e.target.value as any)}
                style={{ width: '100%', padding: '4px 8px', borderRadius: 4, background: 'var(--midnight)', border: '1px solid var(--midnight-border)', color: 'var(--text-secondary)', fontSize: 'var(--fs-2xs)', marginTop: 2 }}>
                <option value="capitalize">Title Case</option>
                <option value="uppercase">UPPERCASE</option>
                <option value="none">As-is</option>
              </select>
            </label>
            <label style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)' }}>
              Weight
              <select value={t.headlineWeight} onChange={e => update('headlineWeight', parseInt(e.target.value))}
                style={{ width: '100%', padding: '4px 8px', borderRadius: 4, background: 'var(--midnight)', border: '1px solid var(--midnight-border)', color: 'var(--text-secondary)', fontSize: 'var(--fs-2xs)', marginTop: 2 }}>
                <option value="400">Regular</option>
                <option value="600">Semi-Bold</option>
                <option value="700">Bold</option>
              </select>
            </label>
          </div>
          <Slider label="Headline Size" value={t.headlineSize} min={0.02} max={0.08} step={0.002} onChange={v => update('headlineSize', v)} />
          <Slider label="Date Size" value={t.dateSize} min={0.02} max={0.06} step={0.002} onChange={v => update('dateSize', v)} />
        </details>

        {/* Layout */}
        <details open style={{ marginBottom: 16 }}>
          <summary style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: 8 }}>Layout</summary>
          <Slider label="Headline Y" value={t.headlineY} min={0.01} max={0.15} step={0.005} onChange={v => update('headlineY', v)} />
          <Slider label="Album Art Y" value={t.featuredImageY} min={0.10} max={0.45} step={0.005} onChange={v => update('featuredImageY', v)} />
          <Slider label="Album Art Size" value={t.featuredImageSize} min={0.20} max={0.65} step={0.01} onChange={v => update('featuredImageSize', v)} />
          <Slider label="Date Y" value={t.dateY} min={0.70} max={0.98} step={0.005} onChange={v => update('dateY', v)} />
          <Slider label="Image Rotation" value={t.featuredRotation} min={-8} max={8} step={0.5} onChange={v => update('featuredRotation', v)} suffix="deg" />
          <Slider label="Image Border" value={t.featuredBorder} min={0} max={24} step={1} onChange={v => update('featuredBorder', v)} suffix="px" />
          <Slider label="Image Shadow" value={t.featuredShadowBlur} min={0} max={60} step={2} onChange={v => update('featuredShadowBlur', v)} suffix="px" />
        </details>

        {/* Effects */}
        <details style={{ marginBottom: 16 }}>
          <summary style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: 8 }}>Effects</summary>
          <Slider label="Glow Blur" value={t.glow.blur} min={0} max={60} step={2} onChange={v => update('glow', { ...t.glow, blur: v })} suffix="px" />
          <Slider label="Glow Passes" value={t.glow.passes} min={0} max={8} step={1} onChange={v => update('glow', { ...t.glow, passes: v })} />
          <Slider label="Grain" value={t.grain} min={0} max={0.4} step={0.02} onChange={v => update('grain', v)} />
          <Slider label="Vignette" value={t.vignette} min={0} max={0.5} step={0.02} onChange={v => update('vignette', v)} />
          <label style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)' }}>
            Glow Color <input type="color" value={t.glow.color.includes('#') ? t.glow.color : '#D4A843'} onChange={e => update('glow', { ...t.glow, color: e.target.value })} style={{ width: 20, height: 20, border: 'none', borderRadius: 3, cursor: 'pointer', verticalAlign: 'middle', marginLeft: 4 }} />
          </label>
        </details>

        {/* Decorations */}
        <details style={{ marginBottom: 16 }}>
          <summary style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: 8 }}>Decorations & Frame</summary>
          {[
            { label: 'Show Frame', key: 'showFrame' as const, checked: t.showFrame },
            { label: 'Show Divider', key: 'showDivider' as const, checked: t.showDivider },
            { label: 'Swipe Pill', key: 'swipePill' as const, checked: t.swipePill },
          ].map(opt => (
            <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: 4 }}>
              <input type="checkbox" checked={opt.checked} onChange={e => update(opt.key, e.target.checked)} />
              {opt.label}
            </label>
          ))}
          {t.showFrame && (
            <div style={{ marginTop: 8 }}>
              <Slider label="Frame Width" value={t.frameWidth} min={1} max={12} step={1} onChange={v => update('frameWidth', v)} suffix="px" />
              <label style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)' }}>
                Frame Color <input type="color" value={t.frameColor || '#D4A843'} onChange={e => update('frameColor', e.target.value)} style={{ width: 20, height: 20, border: 'none', borderRadius: 3, cursor: 'pointer', verticalAlign: 'middle', marginLeft: 4 }} />
              </label>
            </div>
          )}
          <div style={{ marginTop: 8 }}>
            <label style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)' }}>
              Border Color <input type="color" value={t.featuredBorderColor || '#FFFFFF'} onChange={e => update('featuredBorderColor', e.target.value)} style={{ width: 20, height: 20, border: 'none', borderRadius: 3, cursor: 'pointer', verticalAlign: 'middle', marginLeft: 4 }} />
            </label>
          </div>
        </details>

        {/* Save */}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button className="btn btn-gold" onClick={() => onSave(t)} style={{ flex: 1 }}>
            Save Title Template
          </button>
          <button className="btn" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
