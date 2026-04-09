import { useState, useEffect, useRef, useCallback } from 'react';
import type { SelectionSlot } from '../lib/selection';
import { resolveInstagramHandle, type HandleResult } from '../lib/nd';
import { supabase } from '../lib/supabase';

/** Consistent artist name splitting — used everywhere in this component */
const ARTIST_SPLIT = /,\s*|\s+feat\.?\s+|\s+ft\.?\s+|\s+x\s+|\s+&\s+/i;

function splitArtistNames(raw: string): string[] {
  if (!raw) return [];
  return raw.split(ARTIST_SPLIT).map(n => n.trim()).filter(n => n.length > 0);
}

interface Props {
  slideGroups: SelectionSlot[][];
  onHandlesResolved?: (handles: Map<string, HandleResult>) => void;
}

type TagFormat = 'handles' | 'with_titles' | 'newline';

export default function TagBlocks({ slideGroups, onHandlesResolved }: Props) {
  const [handles, setHandles] = useState<Map<string, HandleResult>>(new Map());
  const [resolving, setResolving] = useState(false);
  const [format, setFormat] = useState<TagFormat>('handles');
  const [copiedSlide, setCopiedSlide] = useState<number | null>(null);

  // Get unique artist names + IDs across all slides
  const allArtists = new Set<string>();
  const artistIdMap = new Map<string, string>();
  for (const group of slideGroups) {
    for (const slot of group) {
      const names = splitArtistNames(slot.track.artist_names);
      names.forEach((name, i) => {
        allArtists.add(name);
        if (i === 0 && slot.track.artist_id && !artistIdMap.has(name)) {
          artistIdMap.set(name, slot.track.artist_id);
        }
      });
    }
  }

  const resolveAll = useCallback(async (force = false) => {
    if (allArtists.size === 0) return;
    setResolving(true);
    const accumulated = force ? new Map<string, HandleResult>() : new Map(handles);
    for (const name of allArtists) {
      if (!force && accumulated.has(name) && !accumulated.get(name)!.loading) continue;
      try {
        const result = await resolveInstagramHandle(name, artistIdMap.get(name));
        accumulated.set(name, result);
      } catch {
        accumulated.set(name, {
          artist_name: name, handle: null, source: 'unknown',
          pg_id: null, loading: false, confirmed: false,
        });
      }
    }
    setHandles(new Map(accumulated));
    onHandlesResolved?.(new Map(accumulated));
    setResolving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideGroups]);

  const hasResolved = useRef(false);
  useEffect(() => {
    if (allArtists.size === 0 || hasResolved.current) return;
    hasResolved.current = true;
    resolveAll(false).then(() => { hasResolved.current = false; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideGroups]);

  const HANDLE_REGEX = /^@?[a-zA-Z0-9_.]{1,30}$/;

  const handleEditHandle = async (artistName: string, newHandle: string) => {
    const cleaned = newHandle.trim().replace(/^@/, '');
    if (cleaned && !HANDLE_REGEX.test(cleaned)) return;
    const prev = handles.get(artistName);
    const updated: HandleResult = {
      artist_name: artistName,
      handle: cleaned ? `@${cleaned}` : null,
      source: 'manual',
      pg_id: prev?.pg_id || null,
      loading: false,
      confirmed: true,
    };
    setHandles(p => { const next = new Map(p); next.set(artistName, updated); onHandlesResolved?.(next); return next; });

    // Persist to Supabase via server endpoint
    if (cleaned) {
      const token = supabase ? (await supabase.auth.getSession()).data.session?.access_token : null;
      fetch('/api/save-handle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Supabase-Auth': token } : {}) },
        body: JSON.stringify({
          spotify_artist_id: artistIdMap.get(artistName) || prev?.pg_id || `manual:${artistName}`,
          artist_name: artistName,
          instagram_handle: `@${cleaned}`,
          source: 'manual:confirmed',
          confidence: 1.0,
          nd_pg_id: prev?.pg_id || null,
        }),
      }).catch(() => {}); // fire-and-forget
    }
  };

  // AI enrichment for a single artist
  const [enriching, setEnriching] = useState<Set<string>>(new Set());

  const handleAIEnrich = async (artistName: string) => {
    setEnriching(prev => new Set(prev).add(artistName));
    try {
      const token = supabase ? (await supabase.auth.getSession()).data.session?.access_token : null;
      const res = await fetch('/api/enrich-artist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Supabase-Auth': token } : {}) },
        body: JSON.stringify({
          artist_name: artistName,
          pg_id: handles.get(artistName)?.pg_id || null,
          spotify_id: artistIdMap.get(artistName) || null,
          known_data: {},
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.instagram?.handle) {
          const label = data.instagram.confidence_label || 'unverified';
          setHandles(prev => {
            const next = new Map(prev);
            next.set(artistName, {
              artist_name: artistName,
              handle: data.instagram.handle,
              source: `ai:${label}`,
              pg_id: data.pg_id || prev.get(artistName)?.pg_id || null,
              loading: false,
              confirmed: label === 'confirmed' || label === 'likely',
              verified: data.instagram.verified,
              followers: data.instagram.followers,
            });
            onHandlesResolved?.(next);
            return next;
          });
        }
      }
    } catch { /* enrichment failed */ }
    setEnriching(prev => { const next = new Set(prev); next.delete(artistName); return next; });
  };

  const getSlideTagBlock = (slots: SelectionSlot[], confirmedOnly = true): string => {
    const tags: string[] = [];
    const seen = new Set<string>();

    for (const slot of slots) {
      for (const name of splitArtistNames(slot.track.artist_names)) {
        if (seen.has(name)) continue;
        seen.add(name);
        const result = handles.get(name);
        if (!result?.handle) continue;
        if (confirmedOnly && !result.confirmed) continue;
        const handle = result.handle;

        switch (format) {
          case 'handles': tags.push(handle); break;
          case 'with_titles': tags.push(`${handle} - \u201c${slot.track.track_name}\u201d`); break;
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
      for (const name of splitArtistNames(slot.track.artist_names)) {
        if (seen.has(name)) continue;
        seen.add(name);
        const r = handles.get(name);
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
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-xl)' }}>
          Instagram Tags
          {resolving && <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginLeft: 8 }}>Resolving...</span>}
        </h3>
        <button
          className="btn btn-sm"
          onClick={() => resolveAll(true)}
          disabled={resolving}
          style={{ fontSize: 'var(--fs-2xs)', padding: '3px 10px' }}
        >
          {resolving ? 'Resolving...' : 'Refresh Handles'}
        </button>
        <div style={{ display: 'flex', gap: 4 }}>
          {([['handles', 'Handles'], ['with_titles', 'With Titles'], ['newline', 'One Per Line']] as const).map(([key, label]) => (
            <button
              key={key}
              className={`filter-pill ${format === key ? 'active' : ''}`}
              onClick={() => setFormat(key)}
              style={{ fontSize: 'var(--fs-xs)', padding: '4px 10px' }}
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
                <span style={{ fontSize: 'var(--fs-md)', fontWeight: 600 }}>Slide {i + 1}</span>
                <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)' }}>
                  {counts.confirmed > 0 && <span style={{ color: 'var(--steel)' }}>{counts.confirmed} confirmed</span>}
                  {counts.needsHandle > 0 && <span> · {counts.needsHandle} need handle</span>}
                </span>
              </div>
              <button
                className="btn btn-sm"
                onClick={() => copyToClipboard(tagBlock, i)}
                style={{ fontSize: 'var(--fs-2xs)', padding: '3px 10px' }}
              >
                {copiedSlide === i ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <pre style={{
              fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)',
              whiteSpace: 'pre-wrap', wordBreak: 'break-all',
              lineHeight: 1.6,
            }}>
              {tagBlock || 'No confirmed handles yet — edit below or click Refresh Handles'}
            </pre>

            {/* Editable handle list */}
            {handles.size > 0 && (
              <div style={{ marginTop: 8 }}>
                {slots.map(slot => {
                  const artists = splitArtistNames(slot.track.artist_names);
                  return artists.map(name => {
                    const result = handles.get(name);
                    if (!result) return null;
                    return (
                      <div key={`${slot.track.track_id}-${name}`} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        fontSize: 'var(--fs-2xs)', padding: '2px 0',
                      }}>
                        <span style={{ color: 'var(--text-muted)', width: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {name}
                        </span>
                        <input
                          type="text"
                          value={result.handle || ''}
                          onChange={(e) => handleEditHandle(name, e.target.value)}
                          placeholder="@handle"
                          style={{
                            background: 'var(--midnight-raised)', border: '1px solid var(--midnight-border)',
                            borderRadius: 4, padding: '2px 6px', color: 'var(--text-primary)',
                            fontSize: 'var(--fs-2xs)', width: 140, fontFamily: 'var(--font-mono)',
                          }}
                        />
                        {/* Confidence label badge */}
                        <span style={{
                          fontSize: 'var(--fs-3xs)', padding: '1px 6px', borderRadius: 8,
                          background: result.source?.startsWith('ai:confirmed') || result.source?.includes(':confirmed') ? 'rgba(61,168,119,0.15)'
                            : result.source?.includes(':likely') ? 'rgba(61,168,119,0.1)'
                            : result.source?.includes(':contested') ? 'rgba(204,53,53,0.1)'
                            : result.source === 'manual' ? 'rgba(212,168,67,0.1)'
                            : 'transparent',
                          color: result.source?.includes(':confirmed') ? '#3DA877'
                            : result.source?.includes(':likely') ? '#3DA877'
                            : result.source?.includes(':contested') ? 'var(--mmmc-red)'
                            : result.source === 'nd' ? '#3DA877'
                            : result.source === 'cache' ? 'var(--steel)'
                            : result.source === 'manual' ? 'var(--gold)'
                            : result.loading ? 'var(--steel)' : 'var(--text-muted)',
                        }}>
                          {result.loading ? 'searching...'
                            : enriching.has(name) ? 'AI researching...'
                            : result.source?.includes(':confirmed') ? '\u2713 confirmed'
                            : result.source?.includes(':likely') ? '\u2713 likely'
                            : result.source?.includes(':unverified') ? '? unverified'
                            : result.source?.includes(':contested') ? '\u26A0 contested'
                            : result.source === 'nd' ? `\u2713 ND${result.verified ? ' \u2713' : ''}`
                            : result.source === 'cache' ? '\u2713 cached'
                            : result.source === 'manual' ? '\u2713 manual'
                            : result.pg_id ? 'in ND' : ''}
                        </span>
                        {/* AI Verify button — only show for unresolved or unverified */}
                        {!result.loading && !enriching.has(name) && (!result.handle || result.source?.includes(':unverified') || (!result.source?.includes(':confirmed') && result.source !== 'manual')) && (
                          <button
                            onClick={() => handleAIEnrich(name)}
                            style={{
                              background: 'none', border: '1px solid var(--gold-dark)',
                              borderRadius: 4, padding: '1px 6px', cursor: 'pointer',
                              fontSize: 'var(--fs-3xs)', color: 'var(--gold)',
                            }}
                          >
                            AI Verify
                          </button>
                        )}
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
