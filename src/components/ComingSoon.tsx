import { useState, useEffect, useMemo } from 'react';

interface FutureRelease {
  artist_name: string;
  album_name: string;
  track_name: string;
  release_date: string;
  cover_art_url?: string;
  cover_art_300?: string;
  composer_name?: string | null;
  release_type?: string;
  spotify_track_id?: string;
  spotify_album_id?: string;
}

interface SongwriterInfo {
  pg_id: string;
  display_name: string;
  charting_songs: number;
  no1_songs: number;
  total_credits: number;
  publisher: string | null;
  tier: string;
  ig_handle?: string | null;
}

interface Props {
  releases: FutureRelease[];
  showcaseArtists?: Map<string, Set<string>>; // showcaseId → Set of artist names
  showcases?: { id: string; name: string; emoji: string }[];
}

/** Parse Apple Music composerName string into individual names */
function parseComposerName(str: string | null | undefined): string[] {
  if (!str?.trim()) return [];
  const skip = new Set(['traditional', 'public domain', 'unknown', 'various', 'n/a']);
  return str.replace(/ & /g, ', ').replace(/\band\b/gi, ',')
    .split(',').map(s => s.trim()).filter(s => s.length >= 2 && !skip.has(s.toLowerCase()));
}

/** Get the Friday for a given date (for grouping) */
function getFridayForDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay();
  const diff = day >= 5 ? day - 5 : 5 - day;
  const friday = new Date(d);
  friday.setDate(d.getDate() + (day >= 5 ? 0 : diff));
  return friday.toISOString().split('T')[0];
}

/** Format a Friday date as "This Friday (Apr 11)" or "Apr 18" */
function formatWeekLabel(fridayStr: string): string {
  const d = new Date(fridayStr + 'T12:00:00');
  const today = new Date();
  const diffDays = Math.round((d.getTime() - today.getTime()) / 86400000);
  const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (diffDays <= 7 && diffDays >= 0) return `This Friday (${label})`;
  if (diffDays <= 14 && diffDays > 7) return `Next Friday (${label})`;
  return label;
}

export default function ComingSoon({ releases, showcaseArtists, showcases }: Props) {
  const [songwriterCache, setSongwriterCache] = useState<Map<string, SongwriterInfo | null>>(new Map());
  const [expandedAlbum, setExpandedAlbum] = useState<string | null>(null);

  // Collect unique composer names across all releases — used to drive the
  // /api/songwriter-match batch lookup below. Stable memoized key so the
  // API is hit once per releases change, not once per render.
  const uniqueComposerNames = useMemo(() => {
    const names = new Set<string>();
    for (const r of releases) {
      for (const name of parseComposerName(r.composer_name)) {
        names.add(name);
      }
    }
    return [...names];
  }, [releases]);

  // Wave 6 Block 5: replaced the 12MB /data/songwriter_cache.json fetch with
  // a per-request batch POST to /api/songwriter-match. The API handles alias
  // resolution server-side and returns matches_by_input so we can build a
  // lookup Map keyed by the exact lowercased input strings this component
  // already uses, with zero client-side alias-resolution logic.
  useEffect(() => {
    if (uniqueComposerNames.length === 0) {
      setSongwriterCache(new Map());
      return;
    }
    let cancelled = false;
    fetch('/api/songwriter-match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ composer_names: uniqueComposerNames }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled || !data?.matches_by_input) return;
        const cache = new Map<string, SongwriterInfo | null>();
        for (const [key, info] of Object.entries(data.matches_by_input as Record<string, SongwriterInfo>)) {
          cache.set(key, info);
        }
        setSongwriterCache(cache);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [uniqueComposerNames]);

  // Group releases by album, then by Friday week
  const grouped = useMemo(() => {
    // First group by album
    const albumMap = new Map<string, { album: string; artist: string; date: string; artwork: string | null; isSingle: boolean; tracks: FutureRelease[] }>();
    for (const r of releases) {
      const key = r.spotify_album_id || `${r.artist_name}_${r.album_name}`;
      if (!albumMap.has(key)) {
        albumMap.set(key, {
          album: r.album_name,
          artist: r.artist_name,
          date: r.release_date,
          artwork: r.cover_art_300 || r.cover_art_url || null,
          isSingle: r.release_type === 'single',
          tracks: [],
        });
      }
      albumMap.get(key)!.tracks.push(r);
    }

    // Group albums by Friday week
    const weekMap = new Map<string, typeof albumMap extends Map<string, infer V> ? V[] : never>();
    for (const album of albumMap.values()) {
      const friday = getFridayForDate(album.date);
      if (!weekMap.has(friday)) weekMap.set(friday, []);
      weekMap.get(friday)!.push(album);
    }

    // Sort weeks chronologically, albums within each week by artist name
    return [...weekMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([friday, albums]) => ({
        friday,
        label: formatWeekLabel(friday),
        albums: albums.sort((a, b) => a.artist.localeCompare(b.artist)),
      }));
  }, [releases]);

  // Look up songwriter info from cache
  function lookupSongwriter(name: string): SongwriterInfo | null {
    const key = name.toLowerCase().trim();
    return songwriterCache.get(key) || null;
  }

  // Find showcase connections for an artist
  function getShowcaseBadges(artistName: string): { id: string; name: string; emoji: string }[] {
    if (!showcaseArtists || !showcases) return [];
    const lower = artistName.toLowerCase().split(/,|feat\.|ft\./i)[0].trim().toLowerCase();
    return showcases.filter(s => showcaseArtists.get(s.id)?.has(lower));
  }

  if (releases.length === 0) return null;

  return (
    <div style={{ marginBottom: 20, padding: '16px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 'var(--fs-xl)' }}>🔮</span>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
          Coming Soon
        </h3>
        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {releases.length} tracks
        </span>
      </div>

      {grouped.map(week => (
        <div key={week.friday} style={{ marginBottom: 16 }}>
          <p style={{
            fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--gold)',
            marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid var(--midnight-border)',
          }}>
            {week.label}
          </p>

          {week.albums.map(album => {
            const albumKey = `${album.artist}_${album.album}`;
            const isExpanded = expandedAlbum === albumKey;
            const badges = getShowcaseBadges(album.artist);

            // Collect unique composers across all tracks in this album
            const allComposers = new Map<string, SongwriterInfo | null>();
            for (const track of album.tracks) {
              for (const name of parseComposerName(track.composer_name)) {
                if (!allComposers.has(name.toLowerCase())) {
                  allComposers.set(name.toLowerCase(), lookupSongwriter(name));
                }
              }
            }

            // "Bridge" card: any matched ND profile with charting songs
            const matchedWriters = [...allComposers.entries()]
              .filter(([, info]) => info && info.charting_songs > 0)
              .map(([, info]) => info!);
            const hasBridge = matchedWriters.length > 0;

            return (
              <div
                key={albumKey}
                onClick={() => setExpandedAlbum(isExpanded ? null : albumKey)}
                style={{
                  display: 'flex', gap: 12, padding: '10px 12px', marginBottom: 6,
                  borderRadius: 10, cursor: 'pointer',
                  background: hasBridge ? 'rgba(212,168,67,0.06)' : isExpanded ? 'var(--midnight-raised)' : 'transparent',
                  border: '1px solid ' + (hasBridge ? 'var(--gold-dark)' : isExpanded ? 'var(--gold-dark)' : 'var(--midnight-border)'),
                  transition: 'all 0.15s',
                  flexDirection: 'column',
                }}
              >
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  {/* Artwork */}
                  {album.artwork ? (
                    <img src={album.artwork} alt="" style={{ width: 56, height: 56, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 56, height: 56, borderRadius: 6, background: 'var(--midnight-border)', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)' }}>
                      TBD
                    </div>
                  )}

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--text-primary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {album.artist}
                    </div>
                    <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {album.album}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 'var(--fs-3xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {album.date} · {album.isSingle ? 'Single' : `${album.tracks.length} tracks`}
                      </span>
                      {badges.map(b => (
                        <span key={b.id} style={{
                          fontSize: 'var(--fs-3xs)', padding: '0 5px', borderRadius: 4,
                          background: 'rgba(212,168,67,0.15)', color: 'var(--gold)', fontWeight: 600,
                        }}>
                          {b.emoji} {b.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Bridge cards: ND-matched songwriter credits — ALWAYS visible when matched */}
                {hasBridge && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--midnight-border)' }}>
                    <p style={{ fontSize: 'var(--fs-2xs)', color: 'var(--gold)', marginBottom: 6, fontWeight: 600 }}>✍️ SONGWRITERS</p>
                    {matchedWriters.map(info => (
                      <div key={info.pg_id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '6px 10px', marginBottom: 4, borderRadius: 8,
                        background: 'var(--midnight)', border: '1px solid var(--midnight-border)',
                      }}>
                        <div>
                          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {info.display_name}
                          </span>
                          <span className="mono" style={{ fontSize: 'var(--fs-2xs)', color: 'var(--gold)', marginLeft: 8 }}>
                            {info.charting_songs} charting
                            {info.no1_songs > 0 && ` · ${info.no1_songs} #1s`}
                          </span>
                          {info.publisher && (
                            <span style={{ fontSize: 'var(--fs-3xs)', color: 'var(--text-muted)', marginLeft: 8 }}>
                              {info.publisher.split('/')[0].trim()}
                            </span>
                          )}
                        </div>
                        <a
                          href={`https://nashvilledecoder.com/profiles.html?id=${info.pg_id}`}
                          onClick={e => e.stopPropagation()}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: 'var(--fs-3xs)', color: 'var(--gold)', textDecoration: 'none',
                            padding: '3px 8px', borderRadius: 6, border: '1px solid var(--gold-dark)',
                            fontWeight: 600, flexShrink: 0,
                          }}
                        >
                          ND Profile →
                        </a>
                      </div>
                    ))}
                  </div>
                )}

                {/* Expanded: unmatched songwriter credits (no ND profile) */}
                {isExpanded && allComposers.size > 0 && !hasBridge && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--midnight-border)' }}>
                    <p style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)', marginBottom: 6 }}>✍️ Songwriters</p>
                    {[...allComposers.entries()].map(([key, info]) => (
                      <div key={key} style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 2, paddingLeft: 8 }}>
                        <span>{info?.display_name || key}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Expanded: additional unmatched writers when bridge cards shown */}
                {isExpanded && hasBridge && [...allComposers.entries()].some(([, info]) => !info || info.charting_songs === 0) && (
                  <div style={{ marginTop: 4, paddingLeft: 10 }}>
                    <p style={{ fontSize: 'var(--fs-3xs)', color: 'var(--text-muted)', marginBottom: 2 }}>Also credited:</p>
                    {[...allComposers.entries()]
                      .filter(([, info]) => !info || info.charting_songs === 0)
                      .map(([key, info]) => (
                        <span key={key} style={{ fontSize: 'var(--fs-3xs)', color: 'var(--text-muted)', marginRight: 8 }}>
                          {info?.display_name || key}
                        </span>
                      ))}
                  </div>
                )}

                {/* Expanded: track list if album has multiple tracks */}
                {isExpanded && !album.isSingle && album.tracks.length > 1 && (
                  <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--midnight-border)' }}>
                    <p style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)', marginBottom: 4 }}>Tracks</p>
                    {album.tracks.map((t, i) => (
                      <div key={i} style={{ fontSize: 'var(--fs-xs)', color: t.composer_name ? 'var(--text-secondary)' : 'var(--text-muted)',
                        padding: '2px 0 2px 8px' }}>
                        {i + 1}. {t.track_name}
                        {t.composer_name && (
                          <span style={{ fontSize: 'var(--fs-3xs)', color: 'var(--text-muted)', marginLeft: 6 }}>
                            ({t.composer_name})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
