import { useState, useEffect, useMemo } from 'react';
import { supabase, type NMFFeature } from '../lib/supabase';
import { getLastFriday } from '../lib/spotify';
import ProductNav from '../components/ProductNav';
import NavBar from '../components/NavBar';
import Footer from '../components/Footer';

export default function ThisWeek() {
  const [features, setFeatures] = useState<NMFFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const weekDate = getLastFriday();

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.from('nmf_features').select('*').eq('week_date', weekDate)
      .then(({ data }) => { setFeatures(data || []); setLoading(false); });
  }, [weekDate]);

  // Aggregate: count how many curators picked each track
  const trackCounts = useMemo(() => {
    const map = new Map<string, { track: NMFFeature; count: number; curators: Set<string> }>();
    for (const f of features) {
      const key = f.track_spotify_id || f.track_name;
      const existing = map.get(key);
      if (existing) {
        existing.count++;
        existing.curators.add(f.user_id || 'unknown');
      } else {
        map.set(key, { track: f, count: 1, curators: new Set([f.user_id || 'unknown']) });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [features]);

  const uniqueCurators = useMemo(() => {
    const set = new Set(features.map(f => f.user_id).filter(Boolean));
    return set.size;
  }, [features]);

  return (
    <div style={{ minHeight: '100vh' }}>
      <NavBar title="This Week" />
      <header style={{
        padding: '16px 24px', borderBottom: '1px solid var(--midnight-border)',
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <ProductNav />
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-2xl)', fontWeight: 600 }}>This Week in New Music</h1>
      </header>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.5rem, 4vw, 2rem)', marginBottom: 8 }}>
            Week of <span style={{ color: 'var(--gold)' }}>{new Date(weekDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
          </h2>
          <div style={{ display: 'flex', gap: 24, justifyContent: 'center', color: 'var(--text-secondary)', fontSize: 'var(--fs-lg)' }}>
            <span className="mono">{features.length} tracks featured</span>
            <span className="mono">{uniqueCurators} curator{uniqueCurators !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</p>
        ) : trackCounts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
            <p>No picks published for this week yet.</p>
            <p style={{ fontSize: 'var(--fs-md)', marginTop: 8 }}>Curators publish their picks every Friday.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {trackCounts.map(({ track, count }, i) => (
              <div key={track.track_spotify_id || i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', borderRadius: 10,
                background: i < 3 ? 'var(--midnight-hover)' : 'var(--midnight-raised)',
                border: i < 3 ? '1px solid var(--gold-dark)' : '1px solid var(--midnight-border)',
              }}>
                <span className="mono" style={{
                  fontSize: 'var(--fs-md)', fontWeight: 700, width: 28, textAlign: 'right',
                  color: i < 3 ? 'var(--gold)' : 'var(--text-muted)',
                }}>
                  {i + 1}
                </span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 'var(--fs-lg)', fontWeight: 600 }}>{track.track_name}</p>
                  <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>{track.artist_name}</p>
                </div>
                {count > 1 && (
                  <span className="badge badge-single" style={{ fontSize: 'var(--fs-2xs)' }}>
                    {count} picks
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
