import { Link, useLocation } from 'react-router-dom';

interface Props {
  showAdmin?: boolean;
  backTo?: string;
  backLabel?: string;
}

export default function ProductNav({ showAdmin, backTo, backLabel }: Props) {
  const { pathname } = useLocation();
  const isNMF = pathname.startsWith('/newmusicfriday');
  const isAdmin = pathname.startsWith('/admin');

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      {backTo && (
        <Link to={backTo} style={{
          color: 'var(--text-muted)', fontSize: 'var(--fs-md)',
          textDecoration: 'none', marginRight: 4,
        }} title={backLabel || 'Go back'}>
          &larr;
        </Link>
      )}
      <Link
        to="/newmusicfriday"
        style={{
          fontSize: 'var(--fs-sm)', padding: '5px 14px',
          textDecoration: 'none', borderRadius: 6,
          fontWeight: 700, letterSpacing: '0.03em',
          background: isNMF ? 'var(--gold)' : 'transparent',
          color: isNMF ? 'var(--midnight)' : 'var(--text-muted)',
          border: isNMF ? '1px solid var(--gold)' : '1px solid var(--midnight-border)',
          transition: 'all 0.2s',
        }}
        title="Curator Studio"
      >
        Curator Studio
      </Link>
      {showAdmin && (
        <Link
          to="/admin"
          className={`filter-pill ${isAdmin ? 'active' : ''}`}
          style={{ fontSize: 'var(--fs-xs)', padding: '4px 10px', textDecoration: 'none' }}
        >
          Admin
        </Link>
      )}
    </div>
  );
}
