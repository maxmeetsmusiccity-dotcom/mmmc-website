import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      textAlign: 'center',
    }}>
      <div className="animate-float-up" style={{ maxWidth: 520 }}>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(2rem, 6vw, 3.5rem)',
          fontWeight: 700,
          lineHeight: 1.15,
          marginBottom: 12,
        }}>
          Max Meets<br />
          <span style={{ color: 'var(--gold)' }}>Music City</span>
        </h1>

        <p style={{
          color: 'var(--text-secondary)',
          fontSize: '1.1rem',
          marginBottom: 40,
          lineHeight: 1.6,
        }}>
          Tools &amp; intelligence for Nashville's music industry.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
          <Link to="/newmusicfriday" className="btn btn-gold" style={{ fontSize: '1rem', padding: '14px 32px' }}>
            New Music Friday Tool
          </Link>

          <div style={{
            display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center',
          }}>
            <Link to="/newmusicfriday/thisweek" className="btn btn-sm">This Week's Picks</Link>
            <Link to="/newmusicfriday/archive" className="btn btn-sm">Archive</Link>
            <Link to="/newmusicfriday/submit" className="btn btn-sm">Submit a Track</Link>
          </div>

          <div style={{
            display: 'flex', gap: 20, marginTop: 24, flexWrap: 'wrap', justifyContent: 'center',
          }}>
            <a href="https://nashvilledecoder.com" className="btn btn-sm" target="_blank" rel="noopener noreferrer">
              Nashville Decoder
            </a>
            <a href="https://cowritecompass.com" className="btn btn-sm" target="_blank" rel="noopener noreferrer">
              CoWrite Compass
            </a>
          </div>
        </div>

        <div style={{
          marginTop: 48, display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap',
        }}>
          <a href="https://github.com/maxmeetsmusiccity-dotcom" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>GitHub</a>
          <a href="https://x.com/maxblachman" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>X / Twitter</a>
          <a href="https://linkedin.com/in/maxblachman" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>LinkedIn</a>
        </div>
      </div>
    </div>
  );
}
