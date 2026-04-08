import { useState } from 'react';

const SHORTCUTS = [
  { keys: 'Cmd+A', action: 'Select all releases' },
  { keys: 'Cmd+Shift+A', action: 'Clear all selections' },
  { keys: 'Cmd+Z', action: 'Undo (template editor)' },
  { keys: 'Cmd+Shift+Z', action: 'Redo (template editor)' },
  { keys: 'Cmd+S', action: 'Save template' },
  { keys: 'Delete/Backspace', action: 'Delete selected element' },
  { keys: 'Escape', action: 'Close editor / dismiss' },
  { keys: 'Space', action: 'Toggle quick look' },
  { keys: '?', action: 'Show this help' },
  { keys: 'Double-click', action: 'Edit text on canvas' },
];

export default function KeyboardHelp() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed', bottom: 16, left: 16, zIndex: 50,
          width: 32, height: 32, borderRadius: '50%',
          background: 'var(--midnight-raised)', border: '1px solid var(--midnight-border)',
          color: 'var(--text-muted)', fontSize: 16, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        title="Keyboard shortcuts"
      >
        ?
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.5)' }} />
          <div style={{
            position: 'fixed', bottom: 60, left: 16, zIndex: 201,
            background: 'var(--midnight-raised)', border: '1px solid var(--midnight-border)',
            borderRadius: 12, padding: '20px 24px', width: 320,
            boxShadow: '0 12px 48px rgba(0,0,0,0.6)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 'var(--fs-lg)', fontWeight: 600 }}>Keyboard Shortcuts</span>
              <button onClick={() => setOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18 }}>&times;</button>
            </div>
            {SHORTCUTS.map(s => (
              <div key={s.keys} style={{
                display: 'flex', justifyContent: 'space-between', padding: '6px 0',
                borderBottom: '1px solid var(--midnight-border)',
              }}>
                <span className="mono" style={{ fontSize: 'var(--fs-xs)', color: 'var(--gold)' }}>{s.keys}</span>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>{s.action}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
