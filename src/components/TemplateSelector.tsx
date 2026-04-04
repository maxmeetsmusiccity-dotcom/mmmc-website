import { useState, useEffect } from 'react';
import { TEMPLATES, type CarouselTemplate, getVisibleTemplates } from '../lib/carousel-templates';
import { getTemplatePreview } from '../lib/canvas-grid';
import TemplateBuilder from './TemplateBuilder';
import { useAuth } from '../lib/auth-context';

interface Props {
  selected: string;
  onSelect: (id: string) => void;
}

const CUSTOM_KEY = 'nmf_custom_templates';

function loadCustomTemplates(): CarouselTemplate[] {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveCustomTemplates(templates: CarouselTemplate[]) {
  try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(templates)); } catch {}
}

export default function TemplateSelector({ selected, onSelect }: Props) {
  const { user } = useAuth();
  const [previews, setPreviews] = useState<Map<string, string>>(new Map());
  const [customTemplates, setCustomTemplates] = useState<CarouselTemplate[]>(loadCustomTemplates);
  const [showBuilder, setShowBuilder] = useState(false);

  const visibleTemplates = getVisibleTemplates(user?.email || undefined);
  const allTemplates = [...visibleTemplates, ...customTemplates];

  // Generate previews on mount and when custom templates change
  useEffect(() => {
    // Inject custom templates into global TEMPLATES array for rendering
    for (const ct of customTemplates) {
      if (!TEMPLATES.find(t => t.id === ct.id)) {
        TEMPLATES.push(ct);
      }
    }
    const map = new Map<string, string>();
    for (const t of allTemplates) {
      map.set(t.id, getTemplatePreview(t.id, 200));
    }
    setPreviews(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customTemplates]);

  const handleSaveCustom = (template: CarouselTemplate) => {
    const updated = customTemplates.filter(t => t.id !== template.id);
    updated.push(template);
    setCustomTemplates(updated);
    saveCustomTemplates(updated);
    // Inject into global array
    const existing = TEMPLATES.findIndex(t => t.id === template.id);
    if (existing >= 0) TEMPLATES[existing] = template;
    else TEMPLATES.push(template);
    onSelect(template.id);
    setShowBuilder(false);
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Template</p>
        <button
          className="btn btn-sm"
          onClick={() => setShowBuilder(true)}
          style={{ fontSize: '0.65rem', padding: '3px 10px' }}
        >
          + Custom
        </button>
      </div>
      <div style={{
        display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8,
        WebkitOverflowScrolling: 'touch', scrollSnapType: 'x mandatory',
      }}>
        {allTemplates.map(t => {
          const preview = previews.get(t.id);
          const isCustom = customTemplates.some(ct => ct.id === t.id);
          return (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              style={{
                flexShrink: 0, scrollSnapAlign: 'start',
                width: 120, padding: 8, borderRadius: 10, cursor: 'pointer',
                background: selected === t.id ? 'var(--midnight-hover)' : 'var(--midnight)',
                border: selected === t.id ? `2px solid ${t.accent}` : '2px solid var(--midnight-border)',
                transition: 'all 0.2s', position: 'relative',
              }}
            >
              {isCustom && (
                <span style={{
                  position: 'absolute', top: 4, right: 4,
                  fontSize: '0.45rem', background: 'var(--gold)', color: 'var(--midnight)',
                  padding: '1px 4px', borderRadius: 4, fontWeight: 700,
                }}>
                  CUSTOM
                </span>
              )}
              <div style={{
                width: '100%', aspectRatio: '1', borderRadius: 6, marginBottom: 6,
                overflow: 'hidden', border: `1px solid ${t.accent}33`,
              }}>
                {preview ? (
                  <img src={preview} alt={`${t.name} preview`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{
                    width: '100%', height: '100%', background: t.background,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ color: t.accent, fontSize: '0.55rem', fontWeight: 700 }}>NMF</span>
                  </div>
                )}
              </div>
              <p style={{
                fontSize: '0.7rem', fontWeight: 600,
                color: selected === t.id ? t.accent : 'var(--text-secondary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {t.name}
              </p>
              <p style={{
                fontSize: '0.5rem', color: 'var(--text-muted)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {t.description}
              </p>
            </button>
          );
        })}
      </div>

      {showBuilder && (
        <TemplateBuilder
          onSave={handleSaveCustom}
          onCancel={() => setShowBuilder(false)}
        />
      )}
    </div>
  );
}
