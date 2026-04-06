import { useState, useEffect, useMemo } from 'react';
import { type CarouselTemplate, getVisibleTemplates } from '../lib/carousel-templates';
import { generateTemplatePreview } from '../lib/canvas-grid';
import { saveCustomTemplate, deleteCustomTemplate, getCustomTemplates } from '../lib/supabase';
import TemplateBuilder from './TemplateBuilder';
import TemplateImporter from './TemplateImporter';
import { useAuth } from '../lib/auth-context';

interface Props {
  selected: string;
  onSelect: (id: string) => void;
}

function getCustomKey(userId?: string) {
  return userId ? `nmf_custom_templates_${userId}` : 'nmf_custom_templates_guest';
}

function loadLocalTemplates(userId?: string): CarouselTemplate[] {
  try {
    const raw = localStorage.getItem(getCustomKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveLocalTemplates(templates: CarouselTemplate[], userId?: string) {
  try { localStorage.setItem(getCustomKey(userId), JSON.stringify(templates)); } catch {}
}

export default function TemplateSelector({ selected, onSelect }: Props) {
  const { user } = useAuth();
  const [showImporter, setShowImporter] = useState(false);
  const [previews, setPreviews] = useState<Map<string, string>>(new Map());
  const [customTemplates, setCustomTemplates] = useState<CarouselTemplate[]>([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editTemplate, setEditTemplate] = useState<CarouselTemplate | null>(null);

  // Load custom templates — scoped by user ID (no cross-account leakage)
  useEffect(() => {
    // Clear legacy shared key that caused cross-account leakage
    try { localStorage.removeItem('nmf_custom_templates'); } catch {}

    if (!user?.id) {
      setCustomTemplates([]); // Guests see no custom templates
      return;
    }
    // Try Supabase first (authoritative), fall back to user-scoped localStorage
    getCustomTemplates(user.id).then(serverTemplates => {
      if (serverTemplates.length > 0) {
        const merged = serverTemplates as unknown as CarouselTemplate[];
        setCustomTemplates(merged);
        saveLocalTemplates(merged, user.id);
      } else {
        setCustomTemplates(loadLocalTemplates(user.id));
      }
    });
  }, [user?.id]);

  const visibleTemplates = getVisibleTemplates(user?.email || undefined);
  const allTemplates = useMemo(
    () => [...customTemplates, ...visibleTemplates],
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
    saveLocalTemplates(updated, user?.id);
    if (user?.id) {
      saveCustomTemplate(user.id, template as unknown as Record<string, unknown>);
    }
    onSelect(template.id);
    setShowBuilder(false);
  };

  const handleDeleteCustom = (templateId: string) => {
    if (!confirm('Delete this custom template?')) return;
    const updated = customTemplates.filter(t => t.id !== templateId);
    setCustomTemplates(updated);
    saveLocalTemplates(updated, user?.id);
    if (user?.id) {
      deleteCustomTemplate(user.id, templateId);
    }
    if (selected === templateId && allTemplates.length > 0) {
      onSelect(allTemplates[0].id);
    }
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginBottom: 8 }}>Template</p>
      <div style={{
        display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8,
        WebkitOverflowScrolling: 'touch', scrollSnapType: 'x mandatory',
      }}>
        {/* Create Your Own — FIRST in row */}
        <button
          onClick={() => { setEditTemplate(null); setShowBuilder(true); }}
          title="Create a custom template from scratch"
          style={{
            flexShrink: 0, scrollSnapAlign: 'start',
            width: 100, padding: 8, borderRadius: 10, cursor: 'pointer',
            border: '2px dashed var(--gold)',
            background: 'rgba(212,168,67,0.04)',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 4,
            transition: 'all 0.2s',
          }}
        >
          <span style={{ fontSize: 'var(--fs-xl)', color: 'var(--gold)', lineHeight: 1 }}>+</span>
          <span style={{ fontSize: 'var(--fs-3xs)', fontWeight: 600, color: 'var(--gold)', textAlign: 'center' }}>
            Create New
          </span>
        </button>

        {allTemplates.map(t => {
          const preview = previews.get(t.id);
          const isCustom = customTemplates.some(ct => ct.id === t.id);
          return (
            <div
              key={t.id}
              style={{
                flexShrink: 0, scrollSnapAlign: 'start',
                width: 100, borderRadius: 10, cursor: 'pointer',
                background: selected === t.id ? 'var(--midnight-hover)' : 'var(--midnight)',
                border: selected === t.id ? `2px solid ${t.accent}` : '2px solid var(--midnight-border)',
                transition: 'all 0.2s', position: 'relative', padding: 6,
              }}
            >
              {/* Edit pencil icon */}
              <button
                onClick={(e) => { e.stopPropagation(); setEditTemplate(t); setShowBuilder(true); }}
                title={`Edit ${t.name} — save as a new custom template`}
                style={{
                  position: 'absolute', top: 3, right: 3, zIndex: 2,
                  width: 20, height: 20, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.6)', color: 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '10px', cursor: 'pointer', border: 'none',
                }}
              >&#9998;</button>
              {isCustom && (
                <>
                  <span style={{
                    position: 'absolute', top: 3, left: 3, zIndex: 2,
                    fontSize: '8px', background: 'var(--gold)', color: 'var(--midnight)',
                    padding: '1px 3px', borderRadius: 3, fontWeight: 700,
                  }}>
                    CUSTOM
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteCustom(t.id); }}
                    title="Delete custom template"
                    style={{
                      position: 'absolute', top: 3, right: 24, zIndex: 2,
                      width: 20, height: 20, borderRadius: '50%',
                      background: 'rgba(204,53,53,0.8)', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '11px', cursor: 'pointer', border: 'none', lineHeight: 1,
                    }}
                  >&times;</button>
                </>
              )}
              <div
                onClick={() => onSelect(t.id)}
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
                color: selected === t.id ? t.accent : 'var(--text-secondary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {t.name}
              </p>
            </div>
          );
        })}
      </div>

      {/* Import from image link */}
      <button
        onClick={() => setShowImporter(true)}
        style={{
          marginTop: 6, fontSize: 'var(--fs-xs)', color: 'var(--gold)',
          cursor: 'pointer', textDecoration: 'underline',
        }}
        title="Upload an existing carousel image and extract a reusable template"
      >
        Import template from image
      </button>

      {showBuilder && (
        <TemplateBuilder
          initial={editTemplate || undefined}
          onSave={(t) => { handleSaveCustom(t); setEditTemplate(null); }}
          onCancel={() => { setShowBuilder(false); setEditTemplate(null); }}
        />
      )}
      {showImporter && (
        <TemplateImporter
          onImport={(t) => { handleSaveCustom(t); setShowImporter(false); }}
          onCancel={() => setShowImporter(false)}
        />
      )}
    </div>
  );
}
