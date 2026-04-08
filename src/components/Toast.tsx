import { useState, useEffect, useCallback } from 'react';

interface ToastMessage {
  id: number;
  text: string;
  type: 'success' | 'error' | 'info';
}

let _addToast: ((text: string, type?: 'success' | 'error' | 'info') => void) | null = null;

/** Call from anywhere to show a toast */
export function showToast(text: string, type: 'success' | 'error' | 'info' = 'info') {
  if (_addToast) _addToast(text, type);
}

/** Render this component once at the app root */
export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  let nextId = 0;

  const addToast = useCallback((text: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = ++nextId;
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  useEffect(() => { _addToast = addToast; return () => { _addToast = null; }; }, [addToast]);

  if (toasts.length === 0) return null;

  const colors = { success: '#3DA877', error: '#CC3535', info: 'var(--gold)' };

  return (
    <div style={{
      position: 'fixed', bottom: 60, right: 24, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: 'var(--midnight-raised)', border: `1px solid ${colors[t.type]}`,
          borderRadius: 8, padding: '10px 16px', fontSize: 'var(--fs-sm)',
          color: colors[t.type], boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          animation: 'sheetSlideUp 200ms ease',
          maxWidth: 360,
        }}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
