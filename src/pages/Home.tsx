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

        {/* Two products */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          <Link to="/newmusicfriday" style={{ textDecoration: 'none' }}>
            <div className="card card-hover" style={{ padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>&#9835;</div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', marginBottom: 4 }}>
                NMF <span style={{ color: 'var(--gold)' }}>Curator</span>
              </h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Scan releases, build carousels, push playlists
              </p>
              <span className="badge badge-single" style={{ marginTop: 8 }}>Free</span>
            </div>
          </Link>

          <Link to="/dashboard" style={{ textDecoration: 'none' }}>
            <div className="card card-hover" style={{ padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>&#9878;</div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', marginBottom: 4 }}>
                NMF <span style={{ color: 'var(--steel-light)' }}>Intelligence</span>
              </h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Curator directory, submissions, analytics
              </p>
              <span className="badge badge-album" style={{ marginTop: 8 }}>For Labels</span>
            </div>
          </Link>
        </div>

        <div style={{
          display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 24,
        }}>
          <Link to="/newmusicfriday/thisweek" className="btn btn-sm">This Week's Picks</Link>
          <Link to="/newmusicfriday/archive" className="btn btn-sm">Archive</Link>
          <Link to="/newmusicfriday/submit" className="btn btn-sm">Submit a Track</Link>
        </div>

        <div style={{
          display: 'flex', gap: 20, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center',
        }}>
          <a href="https://nashvilledecoder.com" className="btn btn-sm" target="_blank" rel="noopener noreferrer">
            Nashville Decoder
          </a>
          <a href="https://cowritecompass.com" className="btn btn-sm" target="_blank" rel="noopener noreferrer">
            CoWrite Compass
          </a>
        </div>

        <div style={{
          marginTop: 48, display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap',
        }}>
          <Link to="/terms" style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Terms</Link>
          <Link to="/privacy" style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Privacy</Link>
          <a href="https://github.com/maxmeetsmusiccity-dotcom" style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>GitHub</a>
          <a href="https://x.com/maxblachman" style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>X / Twitter</a>
        </div>
      </div>
    </div>
  );
}
