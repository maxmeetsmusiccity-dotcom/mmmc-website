import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase, type NMFFeature } from '../lib/supabase';
import ProductNav from '../components/ProductNav';
import NavBar from '../components/NavBar';
import Footer from '../components/Footer';

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
    // Sanitize: reject PostgREST metacharacters to prevent filter injection
    if (/[,.(;)"]/.test(username)) { setLoading(false); return; }
    // Use two safe sequential queries instead of .or() interpolation
    supabase.from('user_profiles')
      .select('id, display_name, username, bio, avatar_url, genre_focus')
      .eq('username', username)
      .single()
      .then(async ({ data }) => {
        // If not found by username, try by ID
        if (!data && supabase) {
          const { data: byId } = await supabase.from('user_profiles')
            .select('id, display_name, username, bio, avatar_url, genre_focus')
            .eq('id', username)
            .single();
          data = byId;
        }
        return { data };
      })
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
      <NavBar title="Curator Profile" />
      <header style={{ padding: '16px 24px', borderBottom: '1px solid var(--midnight-border)', display: 'flex', alignItems: 'center', gap: 16 }}>
        <ProductNav />
      </header>

      <div style={{ maxWidth: 700, margin: '0 auto', padding: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" style={{ width: 64, height: 64, borderRadius: '50%' }} />
          ) : (
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--midnight-raised)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-3xl)', fontWeight: 700, color: 'var(--gold)' }}>
              {(profile.display_name || '?')[0].toUpperCase()}
            </div>
          )}
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-3xl)' }}>{profile.display_name}</h1>
            {profile.bio && <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-md)', marginTop: 4 }}>{profile.bio}</p>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 24, marginBottom: 32 }}>
          <div className="card" style={{ flex: 1, textAlign: 'center' }}>
            <p className="mono" style={{ fontSize: 'var(--fs-3xl)', color: 'var(--gold)' }}>{weekCount}</p>
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>Weeks</p>
          </div>
          <div className="card" style={{ flex: 1, textAlign: 'center' }}>
            <p className="mono" style={{ fontSize: 'var(--fs-3xl)', color: 'var(--gold)' }}>{features.length}</p>
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>Tracks Featured</p>
          </div>
          <div className="card" style={{ flex: 1, textAlign: 'center' }}>
            <p className="mono" style={{ fontSize: 'var(--fs-3xl)', color: 'var(--gold)' }}>{artistCounts.size}</p>
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>Unique Artists</p>
          </div>
        </div>

        {profile.genre_focus?.length > 0 && (
          <div style={{ marginBottom: 24, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {profile.genre_focus.map(g => <span key={g} className="badge badge-single">{g}</span>)}
          </div>
        )}

        {topArtists.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-lg)', marginBottom: 12 }}>Most Featured Artists</h3>
            {topArtists.map(([name, count]) => (
              <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--midnight-border)' }}>
                <span style={{ fontSize: 'var(--fs-md)' }}>{name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="mono" style={{ fontSize: 'var(--fs-sm)', color: 'var(--gold)' }}>{count}x</span>
                  <a
                    href={`https://nashvilledecoder.com/search?q=${encodeURIComponent(name)}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 'var(--fs-2xs)', color: 'var(--steel)', padding: '2px 6px', border: '1px solid var(--midnight-border)', borderRadius: 4 }}
                  >
                    ND
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Nashville Decoder Data Preview — blurred teaser */}
        <div style={{ marginBottom: 32, position: 'relative' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-lg)', marginBottom: 12 }}>
            Artist Intelligence <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--steel)' }}>via Nashville Decoder</span>
          </h3>
          <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 12 }}>
            <div style={{ filter: 'blur(6px)', pointerEvents: 'none', opacity: 0.5 }}>
              <div className="card" style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 'var(--fs-md)' }}>Credit Count</span>
                  <span className="mono" style={{ color: 'var(--gold)' }}>247</span>
                </div>
              </div>
              <div className="card" style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 'var(--fs-md)' }}>Chart Trajectory</span>
                  <span className="mono" style={{ color: '#3DA877' }}>Rising</span>
                </div>
              </div>
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 'var(--fs-md)' }}>Co-Writer Network</span>
                  <span className="mono" style={{ color: 'var(--steel-light)' }}>18 connections</span>
                </div>
              </div>
            </div>
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', background: 'rgba(15,27,51,0.6)',
              borderRadius: 12,
            }}>
              <p style={{ fontWeight: 600, marginBottom: 8, fontSize: 'var(--fs-lg)' }}>
                Unlock with Nashville Decoder
              </p>
              <a
                href="https://nashvilledecoder.com"
                target="_blank" rel="noopener noreferrer"
                className="btn btn-sm btn-gold"
              >
                Learn More
              </a>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
