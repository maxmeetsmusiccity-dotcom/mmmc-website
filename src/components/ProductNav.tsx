import { Link, useLocation } from 'react-router-dom';

interface Props {
  showAdmin?: boolean;
}

export default function ProductNav({ showAdmin }: Props) {
  const { pathname } = useLocation();
  const isNMF = pathname.startsWith('/newmusicfriday');
  const isAdmin = pathname.startsWith('/admin');

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <Link to="/" style={{
        color: 'var(--text-muted)', fontSize: '0.75rem',
        fontFamily: 'var(--font-display)', fontWeight: 600,
        textDecoration: 'none', letterSpacing: '0.02em',
      }}>
        MMMC
      </Link>
      <Link
        to="/newmusicfriday"
        style={{
          fontSize: '0.7rem', padding: '4px 12px',
          textDecoration: 'none', borderRadius: 6,
          fontWeight: 600, letterSpacing: '0.03em',
          background: isNMF ? 'var(--gold)' : 'transparent',
          color: isNMF ? 'var(--midnight)' : 'var(--text-muted)',
          border: isNMF ? '1px solid var(--gold)' : '1px solid var(--midnight-border)',
          transition: 'all 0.2s',
        }}
      >
        NMF Curator
      </Link>
      {showAdmin && (
        <Link
          to="/admin"
          className={`filter-pill ${isAdmin ? 'active' : ''}`}
          style={{ fontSize: '0.7rem', padding: '4px 10px', textDecoration: 'none' }}
        >
          Admin
        </Link>
      )}
    </div>
  );
}
