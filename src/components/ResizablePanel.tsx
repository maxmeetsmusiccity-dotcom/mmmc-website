import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react';

const STORAGE_KEY = 'nmf_panel_ratio';
const DEFAULT_RATIO = 0.35;
const MIN_LEFT = 280;
const MIN_RIGHT = 300;

interface Props {
  left: ReactNode;
  right: ReactNode;
}

export default function ResizablePanel({ left, right }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [ratio, setRatio] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return Math.max(0.2, Math.min(0.7, parseFloat(stored)));
    } catch {}
    return DEFAULT_RATIO;
  });
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const totalW = rect.width;
      const x = e.clientX - rect.left;
      const newRatio = x / totalW;
      // Enforce min widths
      const leftW = newRatio * totalW;
      const rightW = (1 - newRatio) * totalW;
      if (leftW < MIN_LEFT || rightW < MIN_RIGHT) return;
      setRatio(Math.max(0.2, Math.min(0.7, newRatio)));
    };

    const onUp = () => {
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      // Persist
      try {
        const el = containerRef.current;
        if (el) {
          const totalW = el.getBoundingClientRect().width;
          const r = ratio;
          if (r * totalW >= MIN_LEFT && (1 - r) * totalW >= MIN_RIGHT) {
            localStorage.setItem(STORAGE_KEY, String(r));
          }
        }
      } catch {}
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [ratio]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    dragging.current = true;

    const onMove = (e: TouchEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.touches[0].clientX - rect.left;
      const newRatio = x / rect.width;
      const leftW = newRatio * rect.width;
      const rightW = (1 - newRatio) * rect.width;
      if (leftW < MIN_LEFT || rightW < MIN_RIGHT) return;
      setRatio(Math.max(0.2, Math.min(0.7, newRatio)));
    };

    const onEnd = () => {
      dragging.current = false;
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
    };

    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
  }, []);

  // Save ratio on change (debounced by mouseup)
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(ratio)); } catch {}
  }, [ratio]);

  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div>{left}</div>
        <div>{right}</div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        width: '100%',
        gap: 0,
      }}
    >
      {/* Left panel */}
      <div style={{
        width: `calc(${ratio * 100}% - 2px)`,
        minWidth: MIN_LEFT,
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        <div style={{ overflowY: 'auto', overflowX: 'auto', paddingRight: 12 }}>
          {left}
        </div>
      </div>

      {/* Divider */}
      <div
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        style={{
          width: 4,
          flexShrink: 0,
          cursor: 'col-resize',
          background: 'var(--midnight-border)',
          borderRadius: 2,
          transition: 'background 0.15s',
          position: 'relative',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--gold-dark)'; }}
        onMouseLeave={e => { if (!dragging.current) (e.currentTarget as HTMLDivElement).style.background = 'var(--midnight-border)'; }}
      >
        {/* Grab indicator dots */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          display: 'flex', flexDirection: 'column', gap: 3,
        }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 2, height: 2, borderRadius: '50%',
              background: 'var(--text-muted)',
            }} />
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div style={{
        flex: 1,
        minWidth: MIN_RIGHT,
        overflow: 'hidden',
        paddingLeft: 12,
      }}>
        {right}
      </div>
    </div>
  );
}
