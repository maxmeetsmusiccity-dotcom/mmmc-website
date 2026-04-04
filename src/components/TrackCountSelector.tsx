import { countGridOptions } from '../lib/grid-layouts';

interface Props {
  value: number;
  onChange: (count: number) => void;
}

export default function TrackCountSelector({ value, onChange }: Props) {
  return (
    <div data-testid="track-count-selector" style={{ marginBottom: 16 }}>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8 }}>
        How many tracks to feature?
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <select
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{
            background: 'var(--midnight)', border: '1px solid var(--midnight-border)',
            borderRadius: 8, color: 'var(--text-primary)', padding: '8px 16px',
            fontSize: '1rem', fontFamily: 'var(--font-mono)', fontWeight: 700,
            width: 100,
          }}
        >
          {Array.from({ length: 50 }, (_, i) => i + 1).map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          {countGridOptions(value)} grid layout{countGridOptions(value) !== 1 ? 's' : ''} available
        </span>
      </div>
    </div>
  );
}
