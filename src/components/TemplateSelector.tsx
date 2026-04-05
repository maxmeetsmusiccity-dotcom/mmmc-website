import { useState, useEffect, useMemo } from 'react';
import { type CarouselTemplate, getVisibleTemplates } from '../lib/carousel-templates';
import { generateTemplatePreview } from '../lib/canvas-grid';
import { saveCustomTemplate, getCustomTemplates } from '../lib/supabase';
import TemplateBuilder from './TemplateBuilder';
import { useAuth } from '../lib/auth-context';

interface Props {
  selected: string;
  onSelect: (id: string) => void;
}

const CUSTOM_KEY = 'nmf_custom_templates';

function loadLocalTemplates(): CarouselTemplate[] {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveLocalTemplates(templates: CarouselTemplate[]) {
  try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(templates)); } catch {}
}

export default function TemplateSelector({ selected, onSelect }: Props) {
  const { user } = useAuth();
  const [previews, setPreviews] = useState<Map<string, string>>(new Map());
  const [customTemplates, setCustomTemplates] = useState<CarouselTemplate[]>(loadLocalTemplates);
  const [showBuilder, setShowBuilder] = useState(false);

  // Load custom templates from Supabase for authenticated users
  useEffect(() => {
    if (!user?.id) return;
    getCustomTemplates(user.id).then(serverTemplates => {
      if (serverTemplates.length > 0) {
        const merged = serverTemplates as unknown as CarouselTemplate[];
        setCustomTemplates(merged);
        saveLocalTemplates(merged); // sync to localStorage as backup
      }
    });
  }, [user?.id]);

  const visibleTemplates = getVisibleTemplates(user?.email || undefined);
  const allTemplates = useMemo(
    () => [...visibleTemplates, ...customTemplates],
    [visibleTemplates, customTemplates],
  );

  // Generate previews — pass template objects directly to avoid global array mutation
  useEffect(() => {
    const map = new Map<string, string>();
    for (const t of allTemplates) {
      map.set(t.id, generateTemplatePreview(t, 200));
    }
    setPreviews(map);
  }, [allTemplates]);

  const handleSaveCustom = (template: CarouselTemplate) => {
    const updated = customTemplates.filter(t => t.id !== template.id);
    updated.push(template);
    setCustomTemplates(updated);
    saveLocalTemplates(updated);
    // Persist to Supabase for authenticated users
    if (user?.id) {
      saveCustomTemplate(user.id, template as unknown as Record<string, unknown>);
    }
    onSelect(template.id);
    setShowBuilder(false);
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Template</p>
        <button
          className="btn btn-sm"
          onClick={() => setShowBuilder(true)}
          style={{ fontSize: 'var(--fs-2xs)', padding: '3px 10px' }}
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
                  fontSize: 'var(--fs-3xs)', background: 'var(--gold)', color: 'var(--midnight)',
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
                    <span style={{ color: t.accent, fontSize: 'var(--fs-3xs)', fontWeight: 700 }}>NMF</span>
                  </div>
                )}
              </div>
              <p style={{
                fontSize: 'var(--fs-xs)', fontWeight: 600,
                color: selected === t.id ? t.accent : 'var(--text-secondary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {t.name}
              </p>
              <p style={{
                fontSize: 'var(--fs-3xs)', color: 'var(--text-muted)',
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
