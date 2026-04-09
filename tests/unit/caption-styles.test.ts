import { describe, it, expect } from 'vitest';
import type { SelectionSlot } from '../../src/lib/selection';

/**
 * Tests for the buildCaption function from CaptionGenerator.tsx.
 * Since buildCaption is a module-private function inside a React component,
 * we re-implement it here identically to test the caption logic without
 * requiring a DOM or React rendering.
 */

// ---------- Reproduce buildCaption + resolveHandles exactly from CaptionGenerator.tsx ----------

type CaptionStyle = 'standard' | 'casual' | 'minimal';

interface HandleResult {
  artist_name: string;
  handle: string | null;
  source: string;
  pg_id: string | null;
  loading: boolean;
  confirmed: boolean;
}

const HASHTAGS = [
  '#NewMusicFriday', '#NashvilleMusic', '#CountryMusic',
  '#NewCountry', '#CountryNewReleases', '#NMF',
  '#MusicDiscovery', '#CuratorPicks',
];

function resolveHandles(selections: SelectionSlot[], handles: Map<string, HandleResult>) {
  const artistHandles = new Map<string, string>();
  for (const slot of selections) {
    const names = (slot.track.artist_names || 'Unknown Artist')
      .split(/,\s*|\s+feat\.?\s+|\s+ft\.?\s+|\s+x\s+|\s+&\s+/i)
      .map(n => n.trim()).filter(n => n.length > 0);
    for (const name of names) {
      if (artistHandles.has(name)) continue;
      const h = handles.get(name);
      artistHandles.set(name, h?.handle || name);
    }
  }
  return artistHandles;
}

function buildCaption(style: CaptionStyle, selections: SelectionSlot[], artistHandles: Map<string, string>, dateStr: string): string {
  const handleList = [...artistHandles.values()].filter(h => h.startsWith('@'));
  const getHandle = (slot: SelectionSlot) => {
    const primary = (slot.track.artist_names || '').split(/,\s*|\s+feat\.?\s+|\s+ft\.?\s+|\s+x\s+|\s+&\s+/i)[0].trim();
    return artistHandles.get(primary) || slot.track.artist_names;
  };

  if (style === 'minimal') {
    const lines = [`NMF ${dateStr}`, ''];
    for (const slot of selections) lines.push(`${slot.track.track_name} - ${getHandle(slot)}`);
    if (handleList.length > 0) { lines.push(''); lines.push(handleList.join(' ')); }
    lines.push(''); lines.push(HASHTAGS.slice(0, 4).join(' '));
    return lines.join('\n');
  }

  if (style === 'casual') {
    const lines = [`it's New Music Friday!! ${dateStr}`, '', `${selections.length} tracks on repeat this week:`, ''];
    for (const slot of selections) lines.push(`${slot.track.track_name} \u2014 ${getHandle(slot)}`);
    lines.push('', 'what are YOU listening to? drop your picks below');
    if (handleList.length > 0) { lines.push(''); lines.push(handleList.join(' ')); }
    lines.push(''); lines.push(HASHTAGS.slice(0, 6).join(' '));
    return lines.join('\n');
  }

  // Standard
  const slides: SelectionSlot[][] = [];
  for (let i = 0; i < selections.length; i += 8) slides.push(selections.slice(i, i + 8));
  const lines = [`New Music Friday ${dateStr}`, '', 'This week\'s picks:', ''];
  for (let s = 0; s < slides.length; s++) {
    if (slides.length > 1) lines.push(`Slide ${s + 1}:`);
    for (const slot of slides[s]) lines.push(`\u201c${slot.track.track_name}\u201d \u2014 ${getHandle(slot)}`);
    lines.push('');
  }
  if (handleList.length > 0) { lines.push(handleList.join(' ')); lines.push(''); }
  lines.push(HASHTAGS.slice(0, 6).join(' '), '', 'Curated with NMF Curator Studio');
  return lines.join('\n');
}

// ---------- Test helpers ----------

function makeSlot(trackName: string, artistNames: string): SelectionSlot {
  return {
    track: {
      track_name: trackName,
      track_number: 1,
      track_uri: '',
      track_spotify_url: '',
      track_id: `tid-${Math.random().toString(36).slice(2, 8)}`,
      duration_ms: 200000,
      explicit: false,
      album_name: 'Album',
      artist_names: artistNames,
      artist_id: 'aid1',
      artist_spotify_url: '',
      artist_genres: [],
      artist_followers: 0,
      album_type: 'single',
      release_date: '2026-04-04',
      total_tracks: 1,
      album_spotify_url: '',
      album_spotify_id: 'alb1',
      cover_art_640: '',
      cover_art_300: '',
      cover_art_64: '',
    },
    albumId: 'alb1',
    selectionNumber: 1,
    slideGroup: 1,
    positionInSlide: 1,
    isCoverFeature: false,
  };
}

function makeHandles(entries: [string, string | null][]): Map<string, HandleResult> {
  const map = new Map<string, HandleResult>();
  for (const [name, handle] of entries) {
    map.set(name, {
      artist_name: name,
      handle,
      source: 'test',
      pg_id: null,
      loading: false,
      confirmed: true,
    });
  }
  return map;
}

const DATE_STR = 'April 4, 2026';

// ---------- Tests ----------

describe('buildCaption — minimal style', () => {
  it('starts with "NMF" and the date', () => {
    const slots = [makeSlot('Song A', 'Artist A')];
    const handles = resolveHandles(slots, new Map());
    const caption = buildCaption('minimal', slots, handles, DATE_STR);
    expect(caption.startsWith(`NMF ${DATE_STR}`)).toBe(true);
  });

  it('lists each track as "track - artist"', () => {
    const slots = [
      makeSlot('Song A', 'Artist A'),
      makeSlot('Song B', 'Artist B'),
    ];
    const handles = resolveHandles(slots, new Map());
    const caption = buildCaption('minimal', slots, handles, DATE_STR);
    expect(caption).toContain('Song A - Artist A');
    expect(caption).toContain('Song B - Artist B');
  });

  it('includes only 4 hashtags', () => {
    const slots = [makeSlot('Song A', 'Artist A')];
    const handles = resolveHandles(slots, new Map());
    const caption = buildCaption('minimal', slots, handles, DATE_STR);
    const hashtagLine = caption.split('\n').find(l => l.includes('#NewMusicFriday'))!;
    const tags = hashtagLine.split(/\s+/).filter(w => w.startsWith('#'));
    expect(tags).toHaveLength(4);
  });

  it('includes @ handles when available', () => {
    const slots = [makeSlot('Song A', 'Artist A')];
    const handleMap = makeHandles([['Artist A', '@artistA_ig']]);
    const artistHandles = resolveHandles(slots, handleMap);
    const caption = buildCaption('minimal', slots, artistHandles, DATE_STR);
    expect(caption).toContain('@artistA_ig');
  });

  it('uses artist name when no handle found', () => {
    const slots = [makeSlot('Song A', 'Artist A')];
    const artistHandles = resolveHandles(slots, new Map());
    const caption = buildCaption('minimal', slots, artistHandles, DATE_STR);
    expect(caption).toContain('Song A - Artist A');
  });
});

describe('buildCaption — casual style', () => {
  it('starts with "it\'s New Music Friday!!"', () => {
    const slots = [makeSlot('Song A', 'Artist A')];
    const handles = resolveHandles(slots, new Map());
    const caption = buildCaption('casual', slots, handles, DATE_STR);
    expect(caption).toContain("it's New Music Friday!!");
  });

  it('includes track count', () => {
    const slots = [makeSlot('S1', 'A1'), makeSlot('S2', 'A2'), makeSlot('S3', 'A3')];
    const handles = resolveHandles(slots, new Map());
    const caption = buildCaption('casual', slots, handles, DATE_STR);
    expect(caption).toContain('3 tracks on repeat this week');
  });

  it('includes call-to-action', () => {
    const slots = [makeSlot('Song A', 'Artist A')];
    const handles = resolveHandles(slots, new Map());
    const caption = buildCaption('casual', slots, handles, DATE_STR);
    expect(caption).toContain('what are YOU listening to?');
  });

  it('uses em dash between track and artist', () => {
    const slots = [makeSlot('My Song', 'My Artist')];
    const handles = resolveHandles(slots, new Map());
    const caption = buildCaption('casual', slots, handles, DATE_STR);
    expect(caption).toContain('My Song \u2014 My Artist');
  });

  it('includes 6 hashtags', () => {
    const slots = [makeSlot('Song A', 'Artist A')];
    const handles = resolveHandles(slots, new Map());
    const caption = buildCaption('casual', slots, handles, DATE_STR);
    const hashtagLine = caption.split('\n').find(l => l.includes('#NewMusicFriday'))!;
    const tags = hashtagLine.split(/\s+/).filter(w => w.startsWith('#'));
    expect(tags).toHaveLength(6);
  });
});

describe('buildCaption — standard style', () => {
  it('starts with "New Music Friday" and the date', () => {
    const slots = [makeSlot('Song A', 'Artist A')];
    const handles = resolveHandles(slots, new Map());
    const caption = buildCaption('standard', slots, handles, DATE_STR);
    expect(caption).toContain(`New Music Friday ${DATE_STR}`);
  });

  it('includes "This week\'s picks:"', () => {
    const slots = [makeSlot('Song A', 'Artist A')];
    const handles = resolveHandles(slots, new Map());
    const caption = buildCaption('standard', slots, handles, DATE_STR);
    expect(caption).toContain("This week's picks:");
  });

  it('wraps track names in smart quotes', () => {
    const slots = [makeSlot('My Track', 'My Artist')];
    const handles = resolveHandles(slots, new Map());
    const caption = buildCaption('standard', slots, handles, DATE_STR);
    expect(caption).toContain('\u201cMy Track\u201d');
  });

  it('labels slide groups when more than 8 tracks', () => {
    const slots: SelectionSlot[] = [];
    for (let i = 0; i < 10; i++) {
      const s = makeSlot(`Track ${i + 1}`, `Artist ${i + 1}`);
      s.selectionNumber = i + 1;
      slots.push(s);
    }
    const handles = resolveHandles(slots, new Map());
    const caption = buildCaption('standard', slots, handles, DATE_STR);
    expect(caption).toContain('Slide 1:');
    expect(caption).toContain('Slide 2:');
  });

  it('does NOT label slides when 8 or fewer tracks', () => {
    const slots = [makeSlot('Song A', 'Artist A')];
    const handles = resolveHandles(slots, new Map());
    const caption = buildCaption('standard', slots, handles, DATE_STR);
    expect(caption).not.toContain('Slide 1:');
  });

  it('ends with "Curated with NMF Curator Studio"', () => {
    const slots = [makeSlot('Song A', 'Artist A')];
    const handles = resolveHandles(slots, new Map());
    const caption = buildCaption('standard', slots, handles, DATE_STR);
    expect(caption).toContain('Curated with NMF Curator Studio');
  });
});

describe('resolveHandles', () => {
  it('splits featured artists from comma-separated names', () => {
    const slots = [makeSlot('Song', 'Artist A, Artist B')];
    const handles = resolveHandles(slots, new Map());
    expect(handles.has('Artist A')).toBe(true);
    expect(handles.has('Artist B')).toBe(true);
  });

  it('splits "feat." collaborations', () => {
    const slots = [makeSlot('Song', 'Main Artist feat. Guest Artist')];
    const handles = resolveHandles(slots, new Map());
    expect(handles.has('Main Artist')).toBe(true);
    expect(handles.has('Guest Artist')).toBe(true);
  });

  it('uses handle from lookup map when available', () => {
    const slots = [makeSlot('Song', 'Artist A')];
    const handleMap = makeHandles([['Artist A', '@artistA']]);
    const handles = resolveHandles(slots, handleMap);
    expect(handles.get('Artist A')).toBe('@artistA');
  });

  it('falls back to artist name when handle is null', () => {
    const slots = [makeSlot('Song', 'Artist A')];
    const handleMap = makeHandles([['Artist A', null]]);
    const handles = resolveHandles(slots, handleMap);
    expect(handles.get('Artist A')).toBe('Artist A');
  });

  it('deduplicates artists across multiple selections', () => {
    const slots = [
      makeSlot('Song 1', 'Artist A'),
      makeSlot('Song 2', 'Artist A'),
    ];
    const handles = resolveHandles(slots, new Map());
    expect([...handles.keys()].filter(k => k === 'Artist A')).toHaveLength(1);
  });
});
