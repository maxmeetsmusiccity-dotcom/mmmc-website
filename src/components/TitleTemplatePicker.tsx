import { useState, useRef, useEffect } from 'react';
import { getVisibleTitleTemplates, type TitleSlideTemplate } from '../lib/title-templates';
import { useAuth } from '../lib/auth-context';
import UnifiedTemplateBuilder from './UnifiedTemplateBuilder';

interface Props {
  selected: string;
  onSelect: (id: string) => void;
  onHover?: (id: string | null) => void;
}

/** Generate a small canvas preview for a title template */
function generateTitlePreview(t: TitleSlideTemplate, size = 200): string {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = t.background;
  ctx.fillRect(0, 0, size, size);

  // Background gradient
  if (t.backgroundGradient) {
    const colors = t.backgroundGradient.match(/#[0-9A-Fa-f]{6}/g);
    if (colors && colors.length >= 2) {
      const grad = ctx.createLinearGradient(0, 0, 0, size);
      colors.forEach((c, i) => grad.addColorStop(i / (colors.length - 1), c));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
    }
  }

  // Frame
  if (t.showFrame && t.frameWidth > 0) {
    ctx.strokeStyle = t.frameColor;
    ctx.lineWidth = Math.max(1, t.frameWidth * size / 1080);
    ctx.strokeRect(4, 4, size - 8, size - 8);
  }

  // Headline text with glow
  const hlSize = Math.round(size * t.headlineSize * 1.2);
  const hlY = Math.round(size * t.headlineY) + hlSize;
  if (t.glow.passes > 0 && t.glow.blur > 0) {
    ctx.shadowColor = t.glow.color;
    ctx.shadowBlur = Math.round(t.glow.blur * size / 1080);
  }
  ctx.fillStyle = t.textPrimary;
  ctx.font = `${t.headlineWeight} ${hlSize}px ${t.headlineFont}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const headline = t.headlineCase === 'uppercase' ? 'NEW MUSIC FRIDAY' : 'New Music Friday';
  ctx.fillText(headline, size / 2, hlY);
  ctx.shadowColor = 'transparent';

  // Divider
  if (t.showDivider) {
    ctx.strokeStyle = t.dividerColor;
    ctx.lineWidth = 1;
    const divY = hlY + hlSize + 4;
    ctx.beginPath();
    ctx.moveTo(size * 0.2, divY);
    ctx.lineTo(size * 0.8, divY);
    ctx.stroke();
  }

  // Featured image placeholder
  const imgSize = Math.round(size * t.featuredImageSize * 0.6);
  const imgX = (size - imgSize) / 2;
  const imgY = Math.round(size * 0.35);
  if (t.featuredBorder > 0) {
    ctx.fillStyle = t.featuredBorderColor;
    const bw = Math.max(1, t.featuredBorder * size / 1080);
    ctx.fillRect(imgX - bw, imgY - bw, imgSize + bw * 2, imgSize + bw * 2);
  }
  ctx.fillStyle = `linear-gradient(135deg, ${t.accent}, ${t.textSecondary})`;
  // Canvas doesn't support gradient in fillStyle directly, use solid
  ctx.fillStyle = t.accent;
  ctx.fillRect(imgX, imgY, imgSize, imgSize);
  // Inner accent
  ctx.fillStyle = t.textSecondary;
  ctx.fillRect(imgX + imgSize * 0.3, imgY + imgSize * 0.3, imgSize * 0.4, imgSize * 0.4);

  // Date
  const dateSize = Math.round(size * t.dateSize * 0.8);
  ctx.fillStyle = t.textPrimary;
  ctx.font = `700 ${dateSize}px ${t.dateFont}`;
  if (t.glow.passes > 0) {
    ctx.shadowColor = t.glow.color;
    ctx.shadowBlur = Math.round(t.glow.blur * size / 1080 * 0.5);
  }
  ctx.fillText('Apr 3, 2026', size / 2, Math.round(size * t.dateY));
  ctx.shadowColor = 'transparent';

  // Vignette
  if (t.vignette > 0) {
    const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.3, size / 2, size / 2, size * 0.7);
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(1, `rgba(0,0,0,${t.vignette})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }

  return canvas.toDataURL();
}

export default function TitleTemplatePicker({ selected, onSelect, onHover }: Props) {
  const { user } = useAuth();
  const visibleTemplates = getVisibleTitleTemplates(user?.email || undefined);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editTemplate, setEditTemplate] = useState<TitleSlideTemplate | undefined>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Generate preview images for all templates
  const [previews, setPreviews] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    const map = new Map<string, string>();
    for (const t of visibleTemplates) {
      map.set(t.id, generateTitlePreview(t, 200));
    }
    setPreviews(map);
  }, [visibleTemplates]);

  return (
    <div data-testid="title-template-picker" style={{ marginBottom: 16 }}>
      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginBottom: 8 }}>Title Slide Template</p>
      <div
        ref={scrollRef}
        style={{
          display: 'flex', gap: 10, overflowX: 'scroll', paddingBottom: 12,
          WebkitOverflowScrolling: 'touch', scrollSnapType: 'x mandatory',
          scrollbarWidth: 'thin', scrollbarColor: 'var(--gold-dark) var(--midnight)',
        }}
        tabIndex={0}
        onKeyDown={(e) => {
          const allIds = ['none', ...visibleTemplates.map(t => t.id)];
          const idx = allIds.indexOf(selected);
          if (e.key === 'ArrowRight' && idx < allIds.length - 1) { e.preventDefault(); onSelect(allIds[idx + 1]); }
          if (e.key === 'ArrowLeft' && idx > 0) { e.preventDefault(); onSelect(allIds[idx - 1]); }
        }}
      >
        {/* "No Title Slide" option */}
        <button
          onClick={() => onSelect('none')}
          onMouseEnter={() => onHover?.('none')}
          onMouseLeave={() => onHover?.(null)}
          style={{
            flexShrink: 0, width: 100, padding: 6, borderRadius: 10, cursor: 'pointer',
            background: selected === 'none' ? 'var(--midnight-hover)' : 'var(--midnight)',
            border: selected === 'none' ? '2px solid var(--gold)' : '2px solid var(--midnight-border)',
            transition: 'all 0.15s',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          }}
        >
          <div style={{
            width: '100%', aspectRatio: '1', borderRadius: 5,
            background: 'var(--midnight-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 'var(--fs-2xl)', color: 'var(--text-muted)',
          }}>
            ✕
          </div>
          <span style={{ fontSize: 'var(--fs-3xs)', fontWeight: 600, color: selected === 'none' ? 'var(--gold)' : 'var(--text-muted)' }}>
            No Title
          </span>
        </button>

        {/* Create New */}
        <button
          onClick={() => { setEditTemplate(undefined); setShowBuilder(true); }}
          style={{
            flexShrink: 0, width: 100, padding: 6, borderRadius: 10, cursor: 'pointer',
            border: '2px dashed var(--gold)',
            background: 'rgba(212,168,67,0.04)',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 4,
            transition: 'all 0.15s',
          }}
          title="Create a custom title template"
        >
          <span style={{ fontSize: 'var(--fs-xl)', color: 'var(--gold)', lineHeight: 1 }}>+</span>
          <span style={{ fontSize: 'var(--fs-3xs)', fontWeight: 600, color: 'var(--gold)', textAlign: 'center' }}>
            Create New
          </span>
        </button>

        {visibleTemplates.map(t => {
          const isActive = selected === t.id;
          const preview = previews.get(t.id);
          return (
            <div
              key={t.id}
              data-testid={`title-template-${t.id}`}
              style={{
                flexShrink: 0, width: 100, borderRadius: 10, cursor: 'pointer',
                background: isActive ? 'var(--midnight-hover)' : 'var(--midnight)',
                border: isActive ? `2px solid ${t.accent}` : '2px solid var(--midnight-border)',
                transition: 'all 0.2s', position: 'relative', padding: 6,
              }}
            >
              {/* Edit pencil */}
              <button
                onClick={(e) => { e.stopPropagation(); setEditTemplate(t); setShowBuilder(true); }}
                title={`Customize ${t.name}`}
                style={{
                  position: 'absolute', top: 3, right: 3, zIndex: 2,
                  width: 20, height: 20, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.6)', color: 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '10px', cursor: 'pointer', border: 'none',
                }}
              >&#9998;</button>
              {/* Rendered preview */}
              <div
                onClick={() => onSelect(t.id)}
                onMouseEnter={() => onHover?.(t.id)}
                onMouseLeave={() => onHover?.(null)}
                style={{
                  width: '100%', aspectRatio: '1', borderRadius: 5, marginBottom: 4,
                  overflow: 'hidden', border: `1px solid ${t.accent}33`,
                }}
              >
                {preview ? (
                  <img src={preview} alt={`${t.name} preview`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{
                    width: '100%', height: '100%', background: t.background,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ color: t.accent, fontSize: 'var(--fs-3xs)', fontWeight: 700 }}>NMF</span>
                  </div>
                )}
              </div>
              <p onClick={() => onSelect(t.id)} style={{
                fontSize: 'var(--fs-3xs)', fontWeight: 600,
                color: isActive ? t.accent : 'var(--text-secondary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {t.name}
              </p>
            </div>
          );
        })}
      </div>

      {showBuilder && (
        <UnifiedTemplateBuilder
          mode="title"
          initial={editTemplate}
          onSave={(customTemplate) => {
            onSelect(customTemplate.id);
            setShowBuilder(false);
            setEditTemplate(undefined);
          }}
          onCancel={() => { setShowBuilder(false); setEditTemplate(undefined); }}
        />
      )}
    </div>
  );
}
