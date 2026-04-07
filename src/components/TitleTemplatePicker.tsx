import { useState, useRef } from 'react';
import { getVisibleTitleTemplates, type TitleSlideTemplate } from '../lib/title-templates';
import { useAuth } from '../lib/auth-context';
import UnifiedTemplateBuilder from './UnifiedTemplateBuilder';

interface Props {
  selected: string;
  onSelect: (id: string) => void;
  onHover?: (id: string | null) => void;
}

export default function TitleTemplatePicker({ selected, onSelect, onHover }: Props) {
  const { user } = useAuth();
  const visibleTemplates = getVisibleTitleTemplates(user?.email || undefined);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editTemplate, setEditTemplate] = useState<TitleSlideTemplate | undefined>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);

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
            flexShrink: 0, width: 90, padding: 6, borderRadius: 8, cursor: 'pointer',
            background: selected === 'none' ? 'var(--midnight-hover)' : 'var(--midnight)',
            border: selected === 'none' ? '2px solid var(--gold)' : '2px solid var(--midnight-border)',
            transition: 'all 0.15s',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          }}
        >
          <div style={{
            width: '100%', height: 60, borderRadius: 4,
            background: 'var(--midnight-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 'var(--fs-2xl)', color: 'var(--text-muted)',
          }}>
            ✕
          </div>
          <span style={{ fontSize: 'var(--fs-2xs)', fontWeight: 600, color: selected === 'none' ? 'var(--gold)' : 'var(--text-muted)' }}>
            No Title
          </span>
        </button>

        {/* Create New */}
        <button
          onClick={() => { setEditTemplate(undefined); setShowBuilder(true); }}
          style={{
            flexShrink: 0, width: 90, padding: 6, borderRadius: 8, cursor: 'pointer',
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
          return (
            <div
              key={t.id}
              data-testid={`title-template-${t.id}`}
              style={{
                flexShrink: 0, width: 90, padding: 6, borderRadius: 8, cursor: 'pointer',
                background: isActive ? 'var(--midnight-hover)' : 'var(--midnight)',
                border: isActive ? `2px solid ${t.accent}` : '2px solid var(--midnight-border)',
                transition: 'all 0.15s', position: 'relative',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              }}
            >
              {/* Edit/customize badge */}
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
              {/* Mini color preview */}
              <div
                onClick={() => onSelect(t.id)}
                onMouseEnter={() => onHover?.(t.id)}
                onMouseLeave={() => onHover?.(null)}
                style={{
                width: '100%', height: 60, borderRadius: 4, overflow: 'hidden',
                background: t.background,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                position: 'relative',
              }}>
                <span style={{
                  color: t.textPrimary, fontSize: 'var(--fs-3xs)', fontWeight: t.headlineWeight,
                  fontFamily: t.headlineFont, textTransform: t.headlineCase,
                  textShadow: t.glow.passes > 0 ? `0 0 ${t.glow.blur * 0.3}px ${t.glow.color}` : 'none',
                }}>
                  NEW MUSIC FRIDAY
                </span>
                <div style={{
                  width: 20, height: 20, borderRadius: 2, marginTop: 4,
                  background: `linear-gradient(135deg, ${t.accent}, ${t.textSecondary})`,
                  border: t.featuredBorder > 0 ? `1px solid ${t.featuredBorderColor}` : 'none',
                }} />
              </div>
              <span
                onClick={() => onSelect(t.id)}
                style={{
                fontSize: 'var(--fs-3xs)', fontWeight: 600,
                color: isActive ? t.accent : 'var(--text-secondary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                maxWidth: 80,
              }}>
                {t.name}
              </span>
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
