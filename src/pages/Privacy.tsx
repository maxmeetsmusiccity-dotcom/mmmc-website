import { Link } from 'react-router-dom';

export default function Privacy() {
  return (
    <div style={{ minHeight: '100vh' }}>
      <header style={{ padding: '16px 24px', borderBottom: '1px solid var(--midnight-border)', display: 'flex', alignItems: 'center', gap: 16 }}>
        <Link to="/" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>MMMC</Link>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 600 }}>Privacy Policy</h1>
      </header>

      <div style={{ maxWidth: 700, margin: '0 auto', padding: 32, color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '0.9rem' }}>
        <div style={{ background: 'rgba(212,168,67,0.1)', border: '1px solid var(--gold-dark)', borderRadius: 8, padding: '12px 16px', marginBottom: 24, color: 'var(--gold)', fontSize: '0.8rem' }}>
          DRAFT — PENDING LEGAL REVIEW. This policy is not yet in effect.
        </div>

        <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)', marginBottom: 8 }}>What We Collect</h2>
        <p>Account information (email, name, avatar), activity data (track selections, curation patterns, carousel generation, playlist pushes), device information (browser, OS, screen size), usage patterns (session duration, feature usage frequency, scan frequency).</p>

        <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)', marginTop: 24, marginBottom: 8 }}>How We Use It</h2>
        <p>Platform improvement and feature development. Intelligence products sold to music industry subscribers (aggregated, never individual). Personalization of curator experience. Matching algorithm for publicist submissions. Communication about platform updates.</p>

        <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)', marginTop: 24, marginBottom: 8 }}>Who We Share With</h2>
        <p>Aggregated intelligence data shared with paying subscribers (publicists, labels). Service providers (Supabase for data storage, Vercel for hosting, Spotify and Apple Music for catalog data). Legal requirements when compelled by law. We never sell individual user data to third parties.</p>

        <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)', marginTop: 24, marginBottom: 8 }}>Your Rights</h2>
        <p>Access: request a copy of your personal data. Correction: update inaccurate information. Deletion: request deletion of your account and personal data. Note: aggregated, anonymized data derived from your activity persists after deletion and is not subject to individual deletion requests.</p>

        <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)', marginTop: 24, marginBottom: 8 }}>Data Security</h2>
        <p>All data is encrypted in transit (TLS) and at rest (Supabase). Authentication tokens are stored in session storage only. No passwords are stored in plaintext. Spotify and Apple Music tokens are never persisted beyond the browser session.</p>

        <p style={{ marginTop: 32, color: 'var(--text-muted)', fontSize: '0.75rem' }}>Last updated: April 2026. Contact: privacy@maxmeetsmusiccity.com</p>
      </div>
    </div>
  );
}
