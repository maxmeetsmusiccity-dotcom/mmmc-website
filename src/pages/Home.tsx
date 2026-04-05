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
      <div className="animate-float-up" style={{ maxWidth: 560 }}>
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
          fontSize: 'var(--fs-lg)',
          marginBottom: 12,
          lineHeight: 1.6,
        }}>
          Tools for the people who break new music every week.
        </p>

        <p style={{
          color: 'var(--text-muted)',
          fontSize: 'var(--fs-md)',
          marginBottom: 40,
          lineHeight: 1.6,
          maxWidth: 440,
          margin: '0 auto 40px',
        }}>
          Whether you run an Instagram page, a blog, a newsletter, or a playlist &mdash; if you're out here putting new artists in front of ears that need to hear them, this is for you.
        </p>

        {/* Main CTA */}
        <Link to="/newmusicfriday" style={{ textDecoration: 'none' }}>
          <div className="card card-hover" style={{ padding: 28, textAlign: 'center', maxWidth: 400, margin: '0 auto 24px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-2xl)', marginBottom: 8 }}>
              New Music <span style={{ color: 'var(--gold)' }}>Friday</span>
            </h2>
            <p style={{ fontSize: 'var(--fs-md)', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 12 }}>
              Scan every new release from the artists you follow. Build a carousel in your style. Tag everyone. Push your playlist. All in one session, every Friday.
            </p>
            <span className="badge badge-single" style={{ fontSize: 'var(--fs-xs)' }}>Free for Curators</span>
          </div>
        </Link>

        <div style={{
          display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 32,
        }}>
          <Link to="/newmusicfriday/thisweek" className="btn btn-sm">This Week's Picks</Link>
          <Link to="/newmusicfriday/archive" className="btn btn-sm">Archive</Link>
          <Link to="/newmusicfriday/submit" className="btn btn-sm">Submit a Track</Link>
        </div>

        {/* Community shoutout */}
        <div style={{
          padding: '20px 24px', borderRadius: 12,
          background: 'rgba(212,168,67,0.05)',
          border: '1px solid rgba(212,168,67,0.15)',
          textAlign: 'left', maxWidth: 440, margin: '0 auto 32px',
        }}>
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            This platform is built with deep respect for the curators, bloggers, and music journalists
            who do the work of discovery every week &mdash; the indie playlist makers, the Instagram
            tastemakers, the newsletter writers, and the legacy publications that have been championing
            artists for decades. You are the bridge between the music and the people. Thank you.
          </p>
          <p style={{ fontSize: 'var(--fs-2xs)', color: 'var(--gold)', marginTop: 8 }}>
            &mdash; Max Blachman, @maxmeetsmusiccity
          </p>
        </div>

        <div style={{
          display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 32,
        }}>
          <a href="https://nashvilledecoder.com" className="btn btn-sm" target="_blank" rel="noopener noreferrer">
            Nashville Decoder
          </a>
          <a href="https://cowritecompass.com" className="btn btn-sm" target="_blank" rel="noopener noreferrer">
            CoWrite Compass
          </a>
        </div>

        <div style={{
          display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap',
        }}>
          <Link to="/terms" style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-xs)' }}>Terms</Link>
          <Link to="/privacy" style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-xs)' }}>Privacy</Link>
          <a href="https://instagram.com/maxmeetsmusiccity" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-xs)' }}>Instagram</a>
        </div>
      </div>
    </div>
  );
}
