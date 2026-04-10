import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div style={{ minHeight: '100vh', overflowX: 'hidden' }}>

      {/* ═══════════════════════════════════════════════════════════
          SECTION 1 — Hero (full viewport)
          ═══════════════════════════════════════════════════════════ */}
      <section
        className="animate-float-up"
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'clamp(32px, 6vw, 80px) 24px',
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            width: '100%',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
            gap: 'clamp(32px, 4vw, 64px)',
            alignItems: 'center',
          }}
        >
          {/* Hero — Left (text) */}
          <div style={{ order: 2 }}>
            <p
              style={{
                color: 'var(--gold)',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--fs-2xs)',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                marginBottom: 16,
              }}
            >
              EST. Nashville
            </p>

            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(2rem, 5.5vw, 3.6rem)',
                fontWeight: 700,
                lineHeight: 1.12,
                marginBottom: 20,
              }}
            >
              Where Nashville's New Music
              <br />
              <span style={{ color: 'var(--gold)' }}>Gets Discovered</span>
            </h1>

            <p
              style={{
                color: 'var(--text-secondary)',
                fontSize: 'var(--fs-md)',
                lineHeight: 1.7,
                maxWidth: 520,
                marginBottom: 32,
              }}
            >
              Photo-journalism. Curation tools. Artist intelligence. Everything
              independent Nashville music needs, built by someone who's in the
              crowd every week.
            </p>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link to="/newmusicfriday/thisweek" className="btn btn-gold">
                This Week's Picks
              </Link>
              <a
                href="https://instagram.com/maxmeetsmusiccity"
                target="_blank"
                rel="noopener noreferrer"
                className="btn"
              >
                Follow the Journey
              </a>
            </div>
          </div>

          {/* Hero — Right (identity card) */}
          <div style={{ order: 1, display: 'flex', justifyContent: 'center' }}>
            <div
              style={{
                background: 'var(--midnight-raised)',
                border: '1px solid var(--midnight-border)',
                borderRadius: 16,
                padding: 'clamp(28px, 4vw, 48px) clamp(24px, 3vw, 40px)',
                textAlign: 'center',
                boxShadow: '0 0 40px rgba(212,168,67,0.06)',
                width: '100%',
                maxWidth: 320,
              }}
            >
              <img
                src="/mmmc-logo-hires.png"
                alt="MMMC logo"
                style={{
                  width: 120,
                  height: 120,
                  objectFit: 'contain',
                  marginBottom: 20,
                }}
              />
              <p
                style={{
                  color: 'var(--gold)',
                  fontFamily: 'var(--font-display)',
                  fontSize: 'var(--fs-lg)',
                  fontWeight: 600,
                  marginBottom: 6,
                }}
              >
                @maxmeetsmusiccity
              </p>
              <p
                style={{
                  color: 'var(--text-secondary)',
                  fontSize: 'var(--fs-sm)',
                }}
              >
                Nashville Music Photo-Journalist
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          SECTION 2 — The Curator's Toolkit
          ═══════════════════════════════════════════════════════════ */}
      <section
        style={{
          background: 'var(--midnight-raised)',
          padding: 'clamp(40px, 6vw, 64px) 24px',
        }}
      >
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <span className="badge badge-single" style={{ marginBottom: 12, display: 'inline-flex' }}>
            TOOLS
          </span>

          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--fs-2xl)',
              fontWeight: 700,
              marginBottom: 12,
            }}
          >
            Built for Curators, by a Curator
          </h2>

          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: 'var(--fs-md)',
              lineHeight: 1.7,
              maxWidth: 620,
              marginBottom: 40,
            }}
          >
            Every tool here exists because I needed it while covering Nashville
            music. Now they're free for every curator, blogger, and playlist
            maker.
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
              gap: 20,
            }}
          >
            {/* Card 1 — NMF Curator Studio */}
            <div
              className="card"
              style={{
                borderTop: '3px solid var(--gold)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                padding: 24,
              }}
            >
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'var(--fs-lg)',
                  fontWeight: 600,
                }}
              >
                New Music Friday Curator Studio
              </h3>
              <span className="badge badge-single" style={{ alignSelf: 'flex-start' }}>
                Free for Curators
              </span>
              <p
                style={{
                  color: 'var(--text-secondary)',
                  fontSize: 'var(--fs-sm)',
                  lineHeight: 1.65,
                  flex: 1,
                }}
              >
                Scan 8,000+ artists for new releases. Build carousels. Auto-tag
                Instagram handles. Push playlists. Every Friday.
              </p>
              <Link to="/newmusicfriday" className="btn btn-gold btn-sm" style={{ alignSelf: 'flex-start' }}>
                Open Studio
              </Link>
            </div>

            {/* Card 2 — Nashville Decoder */}
            <div
              className="card card-hover"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                padding: 24,
              }}
            >
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'var(--fs-lg)',
                  fontWeight: 600,
                }}
              >
                Nashville Decoder
              </h3>
              <span className="badge badge-album" style={{ alignSelf: 'flex-start' }}>
                8,000+ Profiles
              </span>
              <p
                style={{
                  color: 'var(--text-secondary)',
                  fontSize: 'var(--fs-sm)',
                  lineHeight: 1.65,
                  flex: 1,
                }}
              >
                The most comprehensive Nashville artist database. Credits,
                charts, camps, co-writer networks.
              </p>
              <a
                href="https://nashvilledecoder.com"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-sm"
                style={{ alignSelf: 'flex-start' }}
              >
                Explore
              </a>
            </div>

            {/* Card 3 — CoWrite Compass */}
            <div
              className="card card-hover"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                padding: 24,
              }}
            >
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'var(--fs-lg)',
                  fontWeight: 600,
                }}
              >
                CoWrite Compass
              </h3>
              <p
                style={{
                  color: 'var(--text-secondary)',
                  fontSize: 'var(--fs-sm)',
                  lineHeight: 1.65,
                  flex: 1,
                }}
              >
                Smart co-writer matching for Nashville songwriters. Find your
                next collaboration.
              </p>
              <a
                href="https://cowritecompass.com"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-sm"
                style={{ alignSelf: 'flex-start' }}
              >
                Find Co-Writers
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          SECTION 3 — The Scene (Instagram + Community)
          ═══════════════════════════════════════════════════════════ */}
      <section style={{ padding: 'clamp(40px, 6vw, 64px) 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <span className="badge badge-single" style={{ marginBottom: 12, display: 'inline-flex' }}>
            THE SCENE
          </span>

          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--fs-2xl)',
              fontWeight: 700,
              marginBottom: 12,
            }}
          >
            Documenting Nashville's Independent Music
          </h2>

          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: 'var(--fs-md)',
              lineHeight: 1.7,
              maxWidth: 620,
              marginBottom: 40,
            }}
          >
            Live shows. Songwriter rounds. Release days. I cover it all on
            Instagram every week &mdash; and the tools I build make it easier
            for everyone doing this work.
          </p>

          {/* Instagram feature card */}
          <div
            className="card"
            style={{
              border: '1px solid var(--gold-dark)',
              boxShadow: '0 0 24px rgba(212,168,67,0.08)',
              padding: 'clamp(24px, 3vw, 36px)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
              gap: 'clamp(24px, 3vw, 36px)',
              alignItems: 'center',
            }}
          >
            {/* Left */}
            <div>
              <p
                style={{
                  color: 'var(--gold)',
                  fontFamily: 'var(--font-display)',
                  fontSize: 'var(--fs-xl)',
                  fontWeight: 700,
                  marginBottom: 6,
                }}
              >
                @maxmeetsmusiccity
              </p>
              <p
                style={{
                  color: 'var(--text-secondary)',
                  fontSize: 'var(--fs-sm)',
                }}
              >
                Nashville Music Photo-Journalist
              </p>
            </div>

            {/* Right */}
            <div>
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: '0 0 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                {[
                  'Live show photography from Nashville\u2019s best stages',
                  'Weekly new music spotlights and artist features',
                  'Behind-the-scenes with Nashville\u2019s rising talent',
                ].map((text) => (
                  <li
                    key={text}
                    style={{
                      color: 'var(--text-secondary)',
                      fontSize: 'var(--fs-sm)',
                      lineHeight: 1.6,
                      paddingLeft: 18,
                      position: 'relative',
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        color: 'var(--gold)',
                      }}
                    >
                      &bull;
                    </span>
                    {text}
                  </li>
                ))}
              </ul>
              <a
                href="https://instagram.com/maxmeetsmusiccity"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-gold"
              >
                Follow on Instagram
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          SECTION 4 — Submit & Participate
          ═══════════════════════════════════════════════════════════ */}
      <section style={{ padding: 'clamp(32px, 5vw, 48px) 24px' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--fs-xl)',
              fontWeight: 700,
              marginBottom: 12,
            }}
          >
            Be Part of New Music Friday
          </h2>

          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: 'var(--fs-md)',
              lineHeight: 1.7,
              marginBottom: 32,
            }}
          >
            Artists, labels, and managers: submit your new releases for
            consideration. Curators: open the studio and start building your own
            picks.
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link to="/newmusicfriday/submit" className="btn btn-gold">
              Submit a Track
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          SECTION 5 — Community Quote
          ═══════════════════════════════════════════════════════════ */}
      <section style={{ padding: 'clamp(32px, 5vw, 48px) 24px' }}>
        <div
          style={{
            maxWidth: 600,
            margin: '0 auto',
            borderLeft: '4px solid var(--gold)',
            paddingLeft: 'clamp(16px, 3vw, 28px)',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--fs-lg)',
              color: 'var(--text-secondary)',
              fontStyle: 'italic',
              lineHeight: 1.7,
              marginBottom: 16,
            }}
          >
            &ldquo;Nashville&rsquo;s independent music scene is the best in the world because of the
            people who show up every week &mdash; the curators, the photographers, the bloggers,
            the playlist makers, and the fans. I built these tools to serve that community.&rdquo;
          </p>
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--gold)' }}>
            Max Blachman &mdash;{' '}
            <a
              href="https://instagram.com/maxmeetsmusiccity"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--gold)' }}
            >
              @maxmeetsmusiccity
            </a>
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          SECTION 6 — Footer
          ═══════════════════════════════════════════════════════════ */}
      <footer
        style={{
          borderTop: '1px solid var(--midnight-border)',
          padding: '24px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
        }}
      >
        {/* Row 1: Logo + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img
            src="/mmmc-logo-hires.png"
            alt="MMMC"
            style={{ width: 32, height: 32, objectFit: 'contain' }}
          />
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--fs-sm)',
              fontWeight: 600,
            }}
          >
            Max Meets Music City
          </span>
        </div>

        {/* Row 2: Site links */}
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link to="/newmusicfriday/thisweek" style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-2xs)' }}>
            This Week
          </Link>
          <Link to="/newmusicfriday/archive" style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-2xs)' }}>
            Archive
          </Link>
          <Link to="/newmusicfriday/submit" style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-2xs)' }}>
            Submit
          </Link>
          <Link to="/artists" style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-2xs)' }}>
            Artist Directory
          </Link>
        </div>

        {/* Row 3: Products */}
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link to="/newmusicfriday" style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-2xs)' }}>
            NMF Curator Studio
          </Link>
          <a
            href="https://nashvilledecoder.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-2xs)' }}
          >
            Nashville Decoder
          </a>
          <a
            href="https://cowritecompass.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-2xs)' }}
          >
            CoWrite Compass
          </a>
        </div>

        {/* Row 4: Legal + Social */}
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link to="/terms" style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-2xs)' }}>
            Terms
          </Link>
          <Link to="/privacy" style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-2xs)' }}>
            Privacy
          </Link>
          <a
            href="https://instagram.com/maxmeetsmusiccity"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-2xs)' }}
          >
            Instagram
          </a>
        </div>

        {/* Row 5: Copyright */}
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-2xs)' }}>
          &copy; 2026 Max Blachman. Nashville, Tennessee.
        </p>
      </footer>
    </div>
  );
}
