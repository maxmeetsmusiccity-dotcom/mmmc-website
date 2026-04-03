interface Props {
  selectedCount: number;
  totalTracks: number;
  showSelectedOnly: boolean;
  onToggleShowSelected: () => void;
}

export default function SelectionBar({ selectedCount, totalTracks, showSelectedOnly, onToggleShowSelected }: Props) {
  return (
    <div className="selection-bar" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span className="mono" style={{
          fontSize: '1.5rem',
          fontWeight: 700,
          color: selectedCount > 32 ? 'var(--mmmc-red)' : selectedCount > 0 ? 'var(--gold)' : 'var(--text-muted)',
        }}>
          {selectedCount}
        </span>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          / 32 selected
        </span>
        {selectedCount > 32 && (
          <span style={{ color: 'var(--mmmc-red)', fontSize: '0.75rem', fontWeight: 600 }}>
            Over limit!
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
          {totalTracks} total tracks
        </span>
        <button
          className={`filter-pill ${showSelectedOnly ? 'active' : ''}`}
          onClick={onToggleShowSelected}
        >
          {showSelectedOnly ? 'Show All' : 'View Selected'}
        </button>
      </div>
    </div>
  );
}
