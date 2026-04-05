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
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      <Link to="/" style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginRight: 4 }}>MMMC</Link>
      <Link
        to="/newmusicfriday"
        className={`filter-pill ${isNMF ? 'active' : ''}`}
        style={{ fontSize: '0.7rem', padding: '4px 10px', textDecoration: 'none' }}
      >
        Curator
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
