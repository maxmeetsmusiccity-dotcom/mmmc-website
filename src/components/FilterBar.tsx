type FilterKey = 'all' | 'single' | 'album';
type SortKey = 'date' | 'artist' | 'title';

interface Props {
  filter: FilterKey;
  sort: SortKey;
  search: string;
  onFilterChange: (f: FilterKey) => void;
  onSortChange: (s: SortKey) => void;
  onSearchChange: (s: string) => void;
}

export default function FilterBar({ filter, sort, search, onFilterChange, onSortChange, onSearchChange }: Props) {
  return (
    <div style={{
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap',
      alignItems: 'center',
    }}>
      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 4 }}>
        {([['all', 'All'], ['single', 'Singles'], ['album', 'Albums & EPs']] as const).map(([key, label]) => (
          <button
            key={key}
            className={`filter-pill ${filter === key ? 'active' : ''}`}
            onClick={() => onFilterChange(key)}
            style={{ fontSize: '0.7rem', padding: '3px 10px' }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Sort */}
      <select
        value={sort}
        onChange={(e) => onSortChange(e.target.value as SortKey)}
        style={{
          background: 'var(--midnight)',
          border: '1px solid var(--midnight-border)',
          borderRadius: 6,
          color: 'var(--text-secondary)',
          padding: '3px 8px',
          fontSize: '0.7rem',
          fontFamily: 'var(--font-body)',
        }}
      >
        <option value="date">Sort: Date</option>
        <option value="artist">Sort: Artist</option>
        <option value="title">Sort: Title</option>
      </select>

      {/* Search */}
      <input
        type="text"
        className="search-input"
        placeholder="Search..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        style={{ maxWidth: 200, flex: '1 1 140px', fontSize: '0.7rem', padding: '4px 10px' }}
      />
    </div>
  );
}
