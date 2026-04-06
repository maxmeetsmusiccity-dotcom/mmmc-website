import { useState, useMemo } from 'react';
import type { SelectionSlot } from '../lib/selection';
import type { HandleResult } from '../lib/nd';

interface Props {
  selections: SelectionSlot[];
  handles: Map<string, HandleResult>;
  weekDate: string;
}

const HASHTAGS = [
  '#NewMusicFriday', '#NashvilleMusic', '#CountryMusic',
  '#NewCountry', '#CountryNewReleases', '#NMF',
  '#MusicDiscovery', '#CuratorPicks',
];

export default function CaptionGenerator({ selections, handles, weekDate }: Props) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [customCaption, setCustomCaption] = useState('');

  const dateStr = new Date(weekDate + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  const caption = useMemo(() => {
    // Collect unique artist handles
    const artistHandles = new Map<string, string>();
    for (const slot of selections) {
      const names = (slot.track.artist_names || 'Unknown Artist')
        .split(/,\s*|\s+feat\.?\s+|\s+ft\.?\s+|\s+x\s+|\s+&\s+/i)
        .map(n => n.trim())
        .filter(n => n.length > 0);
      for (const name of names) {
        if (artistHandles.has(name)) continue;
        const h = handles.get(name);
        artistHandles.set(name, h?.handle || name);
      }
    }

    // Group tracks by slide (8 per slide)
    const slides: SelectionSlot[][] = [];
    for (let i = 0; i < selections.length; i += 8) {
      slides.push(selections.slice(i, i + 8));
    }

    const lines: string[] = [];
    lines.push(`New Music Friday ${dateStr}`);
    lines.push('');
    lines.push('This week\'s picks:');
    lines.push('');

    for (let s = 0; s < slides.length; s++) {
      if (slides.length > 1) lines.push(`Slide ${s + 1}:`);
      for (const slot of slides[s]) {
        const primaryName = (slot.track.artist_names || 'Unknown Artist').split(/,\s*|\s+feat\.?\s+|\s+ft\.?\s+|\s+x\s+|\s+&\s+/i)[0].trim();
        const handle = artistHandles.get(primaryName) || slot.track.artist_names;
        lines.push(`\u201c${slot.track.track_name}\u201d \u2014 ${handle}`);
      }
      lines.push('');
    }

    // All handles
    const handleList = [...artistHandles.values()].filter(h => h.startsWith('@'));
    if (handleList.length > 0) {
      lines.push(handleList.join(' '));
      lines.push('');
    }

    lines.push(HASHTAGS.slice(0, 6).join(' '));
    lines.push('');
    lines.push('Curated with NMF Curator Studio');

    return lines.join('\n');
  }, [selections, handles, dateStr]);

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
          {selections.length} tracks &bull; {new Set(selections.map(s => (s.track.artist_names || '').split(/,/)[0].trim())).size} artists
        </span>
      </div>
    </div>
  );
}
