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
    const accumulated = new Map(handles);

    // Mark all as loading in one batch
    for (const name of allArtists) {
      if (accumulated.has(name) && !accumulated.get(name)!.loading) continue;
      accumulated.set(name, {
        artist_name: name, handle: null, source: 'unknown',
        pg_id: null, loading: true, confirmed: false,
      });
    }
    setHandles(new Map(accumulated));

    // Resolve all, then batch update once
    for (const name of allArtists) {
      if (handles.has(name) && !handles.get(name)!.loading) continue;
      try {
        const result = await resolveInstagramHandle(name);
        accumulated.set(name, result);
      } catch {
        accumulated.set(name, {
          artist_name: name, handle: null, source: 'unknown',
          pg_id: null, loading: false, confirmed: false,
        });
      }
    }
    setHandles(new Map(accumulated));
    setResolving(false);
  };

  const HANDLE_REGEX = /^@?[a-zA-Z0-9_.]{1,30}$/;

  const handleEditHandle = (artistName: string, newHandle: string) => {
    const cleaned = newHandle.trim().replace(/^@/, '');
    if (cleaned && !HANDLE_REGEX.test(cleaned)) return; // silently reject invalid
    setHandles(prev => {
      const next = new Map(prev);
      next.set(artistName, {
        artist_name: artistName,
        handle: cleaned ? `@${cleaned}` : null,
        source: 'manual',
        pg_id: prev.get(artistName)?.pg_id || null,
        loading: false,
        confirmed: true,
      });
      return next;
    });
  };

  const getSlideTagBlock = (slots: SelectionSlot[], confirmedOnly = true): string => {
    const tags: string[] = [];
    const seen = new Set<string>();

    for (const slot of slots) {
      for (const name of slot.track.artist_names.split(/\s*[,&]\s*/)) {
        const trimmed = name.trim();
        if (!trimmed || seen.has(trimmed)) continue;
        seen.add(trimmed);
        const result = handles.get(trimmed);
        if (!result?.handle) continue;
        // Only include confirmed handles in copy output
        if (confirmedOnly && !result.confirmed) continue;
        const handle = result.handle;

        switch (format) {
          case 'handles': tags.push(handle); break;
          case 'with_titles': tags.push(`${handle} - ${slot.track.track_name}`); break;
          case 'newline': tags.push(handle); break;
        }
      }
    }

    return format === 'newline' ? tags.join('\n') : tags.join(' ');
  };

  const getSlideHandleCounts = (slots: SelectionSlot[]) => {
    let confirmed = 0, needsHandle = 0;
    const seen = new Set<string>();
    for (const slot of slots) {
      for (const name of slot.track.artist_names.split(/\s*[,&]\s*/)) {
        const trimmed = name.trim();
        if (!trimmed || seen.has(trimmed)) continue;
        seen.add(trimmed);
        const r = handles.get(trimmed);
        if (r?.handle && r.confirmed) confirmed++;
        else needsHandle++;
      }
    }
    return { confirmed, needsHandle };
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
        const tagBlock = getSlideTagBlock(slots, true);
        const counts = getSlideHandleCounts(slots);
        return (
          <div key={i} style={{
            marginBottom: 16, padding: 12, borderRadius: 8,
            background: 'var(--midnight)', border: '1px solid var(--midnight-border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Slide {i + 1}</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                  {counts.confirmed > 0 && <span style={{ color: 'var(--steel)' }}>{counts.confirmed} confirmed</span>}
                  {counts.needsHandle > 0 && <span> · {counts.needsHandle} need handle</span>}
                </span>
              </div>
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
                          color: result.source === 'nd' ? 'var(--steel)'
                            : result.source === 'spotify' ? '#5E8EA8'
                            : result.source === 'manual' ? 'var(--gold)'
                            : result.loading ? 'var(--steel)' : 'var(--text-muted)',
                        }}>
                          {result.loading ? 'searching...'
                            : result.source === 'nd' ? '✓ ND'
                            : result.source === 'spotify' ? '✓ Spotify'
                            : result.source === 'manual' ? '✓ manual'
                            : result.pg_id ? 'in ND · add handle' : '+ add handle'}
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
