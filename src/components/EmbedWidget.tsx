import { useState } from 'react';
import { useAuth } from '../lib/auth-context';

export default function EmbedWidget() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const userId = user?.id || 'guest';
  const embedCode = `<iframe src="https://maxmeetsmusiccity.com/newmusicfriday/embed?curator=${userId}" width="100%" height="480" frameborder="0" style="border-radius:12px;border:1px solid #2A3A5C;" loading="lazy"></iframe>`;

  return (
    <div style={{ padding: '16px 0', borderTop: '1px solid var(--midnight-border)', marginTop: 24 }}>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', marginBottom: 12 }}>
        Embed Widget
      </h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: 12 }}>
        Drop this code on any website to show your latest NMF picks. Updates automatically every Friday.
      </p>
      <div style={{
        background: 'var(--midnight)', border: '1px solid var(--midnight-border)',
        borderRadius: 8, padding: 12, fontSize: '0.7rem', fontFamily: 'var(--font-mono)',
        color: 'var(--text-secondary)', wordBreak: 'break-all', lineHeight: 1.5,
      }}>
        {embedCode}
      </div>
      <button
        className="btn btn-sm"
        style={{ marginTop: 8 }}
        onClick={async () => {
          await navigator.clipboard.writeText(embedCode);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? 'Copied!' : 'Copy Embed Code'}
      </button>
    </div>
  );
}
