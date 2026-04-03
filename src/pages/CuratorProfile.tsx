import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase, type NMFFeature } from '../lib/supabase';

interface Profile {
  id: string;
  display_name: string;
  username: string;
  bio: string;
  avatar_url: string;
  genre_focus: string[];
}

export default function CuratorProfile() {
  const { username } = useParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [features, setFeatures] = useState<NMFFeature[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase || !username) { setLoading(false); return; }
    supabase.from('user_profiles')
      .select('id, display_name, username, bio, avatar_url, genre_focus')
      .or(`username.eq.${username},id.eq.${username}`)
      .single()
      .then(({ data }) => {
        setProfile(data);
        if (data?.id && supabase) {
          supabase.from('nmf_features').select('*')
            .eq('user_id', data.id)
            .order('week_date', { ascending: false })
            .limit(100)
            .then(({ data: feats }) => setFeatures(feats || []));
        }
        setLoading(false);
      });
  }, [username]);

  // Aggregate stats
  const weekCount = new Set(features.map(f => f.week_date)).size;
  const artistCounts = new Map<string, number>();
  for (const f of features) {
    artistCounts.set(f.artist_name, (artistCounts.get(f.artist_name) || 0) + 1);
  }
  const topArtists = [...artistCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><p style={{ color: 'var(--text-muted)' }}>Loading...</p></div>;
  if (!profile) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><p style={{ color: 'var(--text-muted)' }}>Curator not found.</p></div>;

  return (
    <div style={{ minHeight: '100vh' }}>
      <header style={{ padding: '16px 24px', borderBottom: '1px solid var(--midnight-border)', display: 'flex', alignItems: 'center', gap: 16 }}>
        <Link to="/" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>MMMC</Link>
        <Link to="/newmusicfriday/archive" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Archive</Link>
      </header>

      <div style={{ maxWidth: 700, margin: '0 auto', padding: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" style={{ width: 64, height: 64, borderRadius: '50%' }} />
          ) : (
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--midnight-raised)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 700, color: 'var(--gold)' }}>
              {(profile.display_name || '?')[0].toUpperCase()}
            </div>
          )}
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem' }}>{profile.display_name}</h1>
            {profile.bio && <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 4 }}>{profile.bio}</p>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 24, marginBottom: 32 }}>
          <div className="card" style={{ flex: 1, textAlign: 'center' }}>
            <p className="mono" style={{ fontSize: '1.5rem', color: 'var(--gold)' }}>{weekCount}</p>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Weeks</p>
          </div>
          <div className="card" style={{ flex: 1, textAlign: 'center' }}>
            <p className="mono" style={{ fontSize: '1.5rem', color: 'var(--gold)' }}>{features.length}</p>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Tracks Featured</p>
          </div>
          <div className="card" style={{ flex: 1, textAlign: 'center' }}>
            <p className="mono" style={{ fontSize: '1.5rem', color: 'var(--gold)' }}>{artistCounts.size}</p>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Unique Artists</p>
          </div>
        </div>

        {profile.genre_focus?.length > 0 && (
          <div style={{ marginBottom: 24, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {profile.genre_focus.map(g => <span key={g} className="badge badge-single">{g}</span>)}
          </div>
        )}

        {topArtists.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', marginBottom: 12 }}>Most Featured Artists</h3>
            {topArtists.map(([name, count]) => (
              <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--midnight-border)' }}>
                <span style={{ fontSize: '0.85rem' }}>{name}</span>
                <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--gold)' }}>{count}x</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
