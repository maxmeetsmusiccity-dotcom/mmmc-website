import { useState, useEffect } from 'react';
import { listWeeks, type NMFWeek } from '../lib/supabase';

interface Props {
  onLoadWeek: (week: NMFWeek) => void;
  currentWeekDate: string;
}

export default function WeekHistory({ onLoadWeek, currentWeekDate }: Props) {
  const [weeks, setWeeks] = useState<NMFWeek[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listWeeks().then(w => { setWeeks(w); setLoading(false); });
  }, []);

  if (loading) {
    return <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-md)', padding: 16 }}>Loading history...</p>;
  }

  if (weeks.length === 0) {
    return <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-md)', padding: 16 }}>No saved weeks yet. Complete a scan and finalize to save.</p>;
  }

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-2xl)', marginBottom: 16 }}>
        Week History
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
        {weeks.map(week => {
          const selections = (week.selections as Array<unknown>) || [];
          const isCurrent = week.week_date === currentWeekDate;
          return (
            <div
              key={week.week_date}
              className="card card-hover"
              style={{
                cursor: 'pointer',
                border: isCurrent ? '1px solid var(--gold)' : undefined,
              }}
              onClick={() => onLoadWeek(week)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>
                  {new Date(week.week_date + 'T12:00:00').toLocaleDateString('en-US', {
                    month: 'long', day: 'numeric', year: 'numeric',
                  })}
                </span>
                {isCurrent && (
                  <span className="badge badge-single">Current</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
                <span className="mono">{selections.length} {selections.length === 1 ? 'track' : 'tracks'}</span>
                {week.playlist_master_pushed && (
                  <span style={{ color: 'var(--spotify-green)' }}>Playlist pushed</span>
                )}
                {week.carousel_generated && (
                  <span style={{ color: 'var(--gold)' }}>Carousel done</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
