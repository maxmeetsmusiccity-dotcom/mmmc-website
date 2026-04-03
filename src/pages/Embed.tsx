import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase, type NMFWeek } from '../lib/supabase';
import { getLastFriday } from '../lib/spotify';

export default function Embed() {
  const [searchParams] = useSearchParams();
  const [week, setWeek] = useState<NMFWeek | null>(null);
  const [loading, setLoading] = useState(true);
  const curatorId = searchParams.get('curator');
  const weekDate = getLastFriday();

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    const query = supabase.from('nmf_weeks').select('*').eq('week_date', weekDate);
    if (curatorId && curatorId !== 'guest') query.eq('user_id', curatorId);
    query.single().then(({ data }) => { setWeek(data); setLoading(false); });
  }, [weekDate, curatorId]);

  const selections = (week?.selections as Array<{ track: { track_name: string; artist_names: string; cover_art_64: string; track_spotify_url: string } }>) || [];

  return (
    <div style={{
      background: '#0F1B33', color: '#F0EDE8', fontFamily: '"DM Sans", system-ui, sans-serif',
      padding: 16, minHeight: '100%',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ fontFamily: '"Source Serif 4", Georgia, serif', fontSize: '1.1rem' }}>
          New Music <span style={{ color: '#D4A843' }}>Friday</span>
        </h2>
        <span style={{ fontSize: '0.65rem', color: '#6B7F95' }}>
          {new Date(weekDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      </div>

      {loading ? (
        <p style={{ color: '#6B7F95', fontSize: '0.8rem' }}>Loading...</p>
      ) : selections.length === 0 ? (
        <p style={{ color: '#6B7F95', fontSize: '0.8rem' }}>No picks for this week yet.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
          {selections.slice(0, 16).map((sel, i) => (
            <a
              key={i}
              href={sel.track.track_spotify_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: 6, borderRadius: 6, background: '#162341',
                textDecoration: 'none', color: 'inherit',
                border: '1px solid #2A3A5C', transition: 'border-color 0.2s',
              }}
            >
              {sel.track.cover_art_64 && (
                <img src={sel.track.cover_art_64} alt="" style={{ width: 36, height: 36, borderRadius: 4 }} />
              )}
              <div style={{ overflow: 'hidden', flex: 1 }}>
                <p style={{ fontSize: '0.7rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {sel.track.track_name}
                </p>
                <p style={{ fontSize: '0.6rem', color: '#A0B4C8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {sel.track.artist_names}
                </p>
              </div>
            </a>
          ))}
        </div>
      )}

      <div style={{ marginTop: 12, textAlign: 'center' }}>
        <a
          href="https://maxmeetsmusiccity.com/newmusicfriday/archive"
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: '0.6rem', color: '#D4A843', textDecoration: 'none' }}
        >
          Powered by Max Meets Music City
        </a>
      </div>
    </div>
  );
}
