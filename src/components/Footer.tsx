import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer style={{
      padding: '20px 24px',
      textAlign: 'center',
      borderTop: '1px solid var(--midnight-border)',
      marginTop: 'auto',
    }}>
      <p style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)', marginBottom: 8 }}>
        NMF Curator Studio &bull; A Max Meets Music City Tool
      </p>
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', fontSize: 'var(--fs-2xs)' }}>
        <Link to="/terms" style={{ color: 'var(--text-muted)' }}>Terms</Link>
        <Link to="/privacy" style={{ color: 'var(--text-muted)' }}>Privacy</Link>
        <a href="https://instagram.com/maxmeetsmusiccity" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-muted)' }}>Instagram</a>
      </div>
    </footer>
  );
}
