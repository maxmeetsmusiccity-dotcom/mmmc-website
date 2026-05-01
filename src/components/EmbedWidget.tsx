import { useState } from 'react';
import { getLastFriday } from '../lib/spotify';

export default function EmbedWidget() {
  const [copied, setCopied] = useState(false);
  const [interval, setInterval_] = useState(5);
  const weekDate = getLastFriday();

  const embedUrl = `https://newmusicfriday.app/newmusicfriday/embed?week=${weekDate}&interval=${interval * 1000}`;
  const embedCode = `<iframe src="${embedUrl}" width="100%" height="480" frameborder="0" style="border-radius:12px;border:1px solid #2A3A5C;" loading="lazy"></iframe>`;

  return (
    <div>
      <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-md)', marginBottom: 12 }}>
        Auto-advancing carousel slideshow. Embeds your generated carousel images
        with smooth crossfade transitions. Pauses on hover.
      </p>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <label style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
          Slide interval:
          <select
            value={interval}
            onChange={e => setInterval_(Number(e.target.value))}
            style={{
              background: 'var(--midnight)', border: '1px solid var(--midnight-border)',
              borderRadius: 6, color: 'var(--text-secondary)', padding: '3px 8px', fontSize: 'var(--fs-sm)',
            }}
          >
            {[3, 5, 7, 10, 15].map(n => (
              <option key={n} value={n}>{n}s</option>
            ))}
          </select>
        </label>
        <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)' }}>
          Week: {weekDate}
        </span>
      </div>

      <div style={{
        background: 'var(--midnight)', border: '1px solid var(--midnight-border)',
        borderRadius: 8, padding: 12, fontSize: 'var(--fs-2xs)', fontFamily: 'var(--font-mono)',
        color: 'var(--text-secondary)', wordBreak: 'break-all', lineHeight: 1.5,
      }}>
        {embedCode}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button
          className="btn btn-sm"
          onClick={async () => {
            await navigator.clipboard.writeText(embedCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? 'Copied!' : 'Copy Embed Code'}
        </button>
      </div>

      {/* Live preview */}
      <div style={{ marginTop: 16 }}>
        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginBottom: 6 }}>Preview</p>
        <iframe
          src={embedUrl}
          style={{
            width: '100%', height: 360, border: '1px solid var(--midnight-border)',
            borderRadius: 8, background: 'var(--midnight)',
          }}
          title="Embed preview"
        />
        <p style={{ fontSize: 'var(--fs-3xs)', color: 'var(--text-muted)', marginTop: 4, textAlign: 'center' }}>
          Powered by NMF Curator Studio
        </p>
      </div>
    </div>
  );
}
