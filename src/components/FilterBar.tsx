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
      padding: '12px 24px',
      borderBottom: '1px solid var(--midnight-border)',
      display: 'flex',
      gap: 12,
      flexWrap: 'wrap',
      alignItems: 'center',
    }}>
      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 6 }}>
        {([['all', 'All'], ['single', 'Singles'], ['album', 'Albums & EPs']] as const).map(([key, label]) => (
          <button
            key={key}
            className={`filter-pill ${filter === key ? 'active' : ''}`}
            onClick={() => onFilterChange(key)}
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
          borderRadius: 8,
          color: 'var(--text-secondary)',
          padding: '6px 12px',
          fontSize: '0.8rem',
          fontFamily: 'var(--font-body)',
        }}
      >
        <option value="date">Sort: Release Date</option>
        <option value="artist">Sort: Artist</option>
        <option value="title">Sort: Title</option>
      </select>

      {/* Search */}
      <input
        type="text"
        className="search-input"
        placeholder="Search artist or title..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        style={{ maxWidth: 280, flex: '1 1 200px' }}
      />
    </div>
  );
}
