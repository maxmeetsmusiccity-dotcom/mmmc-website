import { useNavigate, Link } from 'react-router-dom';

/**
 * Consistent back + home navigation bar.
 * Back uses browser history (navigate(-1)), falling back to home if no history.
 */
export default function NavBar({ title }: { title?: string }) {
  const navigate = useNavigate();

  const goBack = () => {
    // React Router stores navigation index in history state
    const idx = window.history.state?.idx;
    if (idx != null && idx > 0) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <nav style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '10px 16px',
      borderBottom: '1px solid var(--midnight-border)',
      background: 'var(--midnight)',
    }}>
      <button
        onClick={goBack}
        style={{
          background: 'none', border: 'none', color: 'var(--text-secondary)',
          cursor: 'pointer', padding: '4px 8px', fontSize: 'var(--fs-sm)',
          display: 'flex', alignItems: 'center', gap: 4,
        }}
        aria-label="Go back"
      >
        &larr; Back
      </button>
      <Link
        to="/"
        style={{
          color: 'var(--text-muted)', textDecoration: 'none',
          fontSize: 'var(--fs-sm)', padding: '4px 8px',
        }}
      >
        Home
      </Link>
      {title && (
        <span style={{ flex: 1, textAlign: 'right', color: 'var(--text-muted)', fontSize: 'var(--fs-xs)' }}>
          {title}
        </span>
      )}
    </nav>
  );
}
