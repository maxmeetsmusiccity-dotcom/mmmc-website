import { useState, useMemo } from 'react';
import type { SelectionSlot } from '../lib/selection';
import type { HandleResult } from '../lib/nd';

interface Props {
  selections: SelectionSlot[];
  handles: Map<string, HandleResult>;
  weekDate: string;
  /** Show sharing actions (Open Instagram, email, native share) */
  showShare?: boolean;
}

const HASHTAGS = [
  '#NewMusicFriday', '#NashvilleMusic', '#CountryMusic',
  '#NewCountry', '#CountryNewReleases', '#NMF',
  '#MusicDiscovery', '#CuratorPicks',
];

type CaptionStyle = 'standard' | 'casual' | 'minimal';

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

export default function CaptionGenerator({ selections, handles, weekDate, showShare }: Props) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [customCaption, setCustomCaption] = useState('');
  const [style, setStyle] = useState<CaptionStyle>('standard');

  const dateStr = new Date(weekDate + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  const artistHandles = useMemo(() => resolveHandles(selections, handles), [selections, handles]);
  const caption = useMemo(() => buildCaption(style, selections, artistHandles, dateStr), [style, selections, artistHandles, dateStr]);

  const displayCaption = editing ? customCaption : caption;
  const charCount = displayCaption.length;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(displayCaption);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (selections.length === 0) return null;

  return (
    <div style={{ marginTop: 20, padding: 16, borderRadius: 10, border: '1px solid var(--midnight-border)', background: 'var(--midnight-raised)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h4 style={{ fontSize: 'var(--fs-md)', fontWeight: 600 }}>Instagram Caption</h4>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className="btn btn-sm"
            onClick={() => { setEditing(!editing); if (!editing) setCustomCaption(caption); }}
            style={{ fontSize: 'var(--fs-3xs)' }}
          >
            {editing ? 'Use Generated' : 'Edit'}
          </button>
          <button
            className="btn btn-sm btn-gold"
            onClick={handleCopy}
            title="Copy caption to clipboard"
          >
            {copied ? 'Copied!' : 'Copy Caption'}
          </button>
        </div>
      </div>

      {/* Caption style toggle */}
      {!editing && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
          {(['standard', 'casual', 'minimal'] as CaptionStyle[]).map(s => (
            <button key={s} className={`filter-pill ${style === s ? 'active' : ''}`}
              onClick={() => setStyle(s)} style={{ fontSize: 'var(--fs-3xs)' }}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      )}

      {editing ? (
        <textarea
          value={customCaption}
          onChange={e => setCustomCaption(e.target.value)}
          style={{
            width: '100%', minHeight: 200, padding: 10, borderRadius: 6,
            background: 'var(--midnight)', border: '1px solid var(--midnight-border)',
            color: 'var(--text-primary)', fontSize: 'var(--fs-xs)',
            fontFamily: 'var(--font-body)', resize: 'vertical',
          }}
        />
      ) : (
        <pre style={{
          fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)',
          whiteSpace: 'pre-wrap', lineHeight: 1.5, padding: 10,
          background: 'var(--midnight)', borderRadius: 6,
          maxHeight: 300, overflow: 'auto',
        }}>
          {caption}
        </pre>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        <span style={{ fontSize: 'var(--fs-3xs)', color: charCount > 2200 ? 'var(--mmmc-red)' : 'var(--text-muted)' }}>
          {charCount}/2,200 characters
        </span>
        <span style={{ fontSize: 'var(--fs-3xs)', color: 'var(--text-muted)' }}>
          {selections.length} {selections.length === 1 ? 'track' : 'tracks'} &bull; {(() => { const c = new Set(selections.map(s => (s.track.artist_names || '').split(/,/)[0].trim())).size; return `${c} ${c === 1 ? 'artist' : 'artists'}`; })()}
        </span>
      </div>

      {showShare && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--midnight-border)' }}>
          <a href="instagram://camera" className="btn btn-sm"
            style={{ fontSize: 'var(--fs-2xs)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            Open Instagram
          </a>
          <a href={`mailto:?subject=${encodeURIComponent(`New Music Friday ${dateStr}`)}&body=${encodeURIComponent(displayCaption)}`}
            className="btn btn-sm"
            style={{ fontSize: 'var(--fs-2xs)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            Email Caption
          </a>
          {typeof navigator !== 'undefined' && navigator.share && (
            <button className="btn btn-sm"
              onClick={() => navigator.share({ title: `New Music Friday ${dateStr}`, text: displayCaption })}
              style={{ fontSize: 'var(--fs-2xs)' }}>
              Share...
            </button>
          )}
        </div>
      )}
    </div>
  );
}
