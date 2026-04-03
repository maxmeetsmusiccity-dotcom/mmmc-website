import { useState } from 'react';
import type { SelectionSlot } from '../lib/selection';
import { resolveInstagramHandle, type HandleResult } from '../lib/nd';

interface Props {
  slideGroups: SelectionSlot[][];
}

type TagFormat = 'handles' | 'with_titles' | 'newline';

export default function TagBlocks({ slideGroups }: Props) {
  const [handles, setHandles] = useState<Map<string, HandleResult>>(new Map());
  const [resolving, setResolving] = useState(false);
  const [format, setFormat] = useState<TagFormat>('handles');
  const [copiedSlide, setCopiedSlide] = useState<number | null>(null);

  // Get unique artist names across all slides
  const allArtists = new Set<string>();
  for (const group of slideGroups) {
    for (const slot of group) {
      // Split comma-separated artist names for collabs
      for (const name of slot.track.artist_names.split(', ')) {
        allArtists.add(name.trim());
      }
    }
  }

  const handleResolveAll = async () => {
    setResolving(true);
    const newHandles = new Map(handles);

    for (const name of allArtists) {
      if (newHandles.has(name) && !newHandles.get(name)!.loading) continue;
      newHandles.set(name, {
        artist_name: name, handle: null, source: 'unknown',
        confidence: 'low', pg_id: null, loading: true,
      });
      setHandles(new Map(newHandles));

      try {
        const result = await resolveInstagramHandle(name);
        newHandles.set(name, result);
      } catch {
        newHandles.set(name, {
          artist_name: name, handle: null, source: 'unknown',
          confidence: 'low', pg_id: null, loading: false,
        });
      }
      setHandles(new Map(newHandles));
    }
    setResolving(false);
  };

  const handleEditHandle = (artistName: string, newHandle: string) => {
    const existing = handles.get(artistName);
    setHandles(prev => {
      const next = new Map(prev);
      next.set(artistName, {
        artist_name: artistName,
        handle: newHandle.startsWith('@') ? newHandle : `@${newHandle}`,
        source: 'nmf_manual',
        confidence: 'high',
        pg_id: existing?.pg_id || null,
        loading: false,
      });
      return next;
    });
  };

  const getSlideTagBlock = (slots: SelectionSlot[]): string => {
    const tags: string[] = [];
    const seen = new Set<string>();

    for (const slot of slots) {
      for (const name of slot.track.artist_names.split(', ')) {
        const trimmed = name.trim();
        if (seen.has(trimmed)) continue;
        seen.add(trimmed);
        const result = handles.get(trimmed);
        const handle = result?.handle || `[${trimmed}]`;

        switch (format) {
          case 'handles':
            tags.push(handle);
            break;
          case 'with_titles':
            tags.push(`${handle} - ${slot.track.track_name}`);
            break;
          case 'newline':
            tags.push(handle);
            break;
        }
      }
    }

    return format === 'newline' ? tags.join('\n') : tags.join(' ');
  };

  const copyToClipboard = async (text: string, slideIdx: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedSlide(slideIdx);
    setTimeout(() => setCopiedSlide(null), 2000);
  };

  return (
    <div style={{
      padding: '16px 0', borderTop: '1px solid var(--midnight-border)', marginTop: 24,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem' }}>
          Instagram Tags
        </h3>
        <button
          className="btn btn-sm"
          onClick={handleResolveAll}
          disabled={resolving}
        >
          {resolving ? 'Resolving...' : handles.size > 0 ? 'Re-resolve' : 'Resolve Handles'}
        </button>
        <div style={{ display: 'flex', gap: 4 }}>
          {([['handles', 'Handles'], ['with_titles', 'With Titles'], ['newline', 'One Per Line']] as const).map(([key, label]) => (
            <button
              key={key}
              className={`filter-pill ${format === key ? 'active' : ''}`}
              onClick={() => setFormat(key)}
              style={{ fontSize: '0.7rem', padding: '4px 10px' }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {slideGroups.map((slots, i) => {
        const tagBlock = getSlideTagBlock(slots);
        return (
          <div key={i} style={{
            marginBottom: 16, padding: 12, borderRadius: 8,
            background: 'var(--midnight)', border: '1px solid var(--midnight-border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Slide {i + 1}</span>
              <button
                className="btn btn-sm"
                onClick={() => copyToClipboard(tagBlock, i)}
                style={{ fontSize: '0.65rem', padding: '3px 10px' }}
              >
                {copiedSlide === i ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <pre style={{
              fontSize: '0.75rem', color: 'var(--text-secondary)',
              whiteSpace: 'pre-wrap', wordBreak: 'break-all',
              lineHeight: 1.6,
            }}>
              {tagBlock || 'Resolve handles first'}
            </pre>

            {/* Editable handle list */}
            {handles.size > 0 && (
              <div style={{ marginTop: 8 }}>
                {slots.map(slot => {
                  const artists = slot.track.artist_names.split(', ');
                  return artists.map(name => {
                    const result = handles.get(name.trim());
                    if (!result) return null;
                    return (
                      <div key={`${slot.track.track_id}-${name}`} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        fontSize: '0.65rem', padding: '2px 0',
                      }}>
                        <span style={{ color: 'var(--text-muted)', width: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {name.trim()}
                        </span>
                        <input
                          type="text"
                          value={result.handle || ''}
                          onChange={(e) => handleEditHandle(name.trim(), e.target.value)}
                          placeholder="@handle"
                          style={{
                            background: 'var(--midnight-raised)', border: '1px solid var(--midnight-border)',
                            borderRadius: 4, padding: '2px 6px', color: 'var(--text-primary)',
                            fontSize: '0.65rem', width: 140, fontFamily: 'var(--font-mono)',
                          }}
                        />
                        <span style={{
                          fontSize: '0.55rem',
                          color: result.source === 'nd_database' ? '#3DA877'
                            : result.source === 'nmf_manual' ? 'var(--gold)'
                            : result.loading ? 'var(--steel)' : 'var(--text-muted)',
                        }}>
                          {result.loading ? 'searching...' : result.source === 'nd_database' ? 'ND' : result.source === 'nmf_manual' ? 'manual' : result.source === 'nmf_auto_discover' ? 'auto' : '?'}
                        </span>
                      </div>
                    );
                  });
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
