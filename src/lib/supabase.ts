import { createClient } from '@supabase/supabase-js';

// These are public keys — safe in client code
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

export interface NMFWeek {
  id?: string;
  week_date: string;
  all_releases?: unknown;
  selections?: unknown;
  cover_feature?: unknown;
  instagram_handles?: unknown;
  manifest_curated?: unknown;
  playlist_master_pushed: boolean;
  playlist_new_id?: string;
  playlist_new_url?: string;
  carousel_generated: boolean;
  created_at?: string;
  updated_at?: string;
}

export async function saveWeek(week: NMFWeek): Promise<NMFWeek | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('nmf_weeks')
    .upsert(
      { ...week, updated_at: new Date().toISOString() },
      { onConflict: 'week_date' },
    )
    .select()
    .single();
  if (error) { console.error('saveWeek error:', error); return null; }
  return data;
}

export async function getWeek(weekDate: string): Promise<NMFWeek | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('nmf_weeks')
    .select('*')
    .eq('week_date', weekDate)
    .single();
  if (error) return null;
  return data;
}

export async function listWeeks(): Promise<NMFWeek[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('nmf_weeks')
    .select('id, week_date, playlist_master_pushed, playlist_new_url, carousel_generated, created_at, selections')
    .order('week_date', { ascending: false })
    .limit(52);
  if (error) { console.error('listWeeks error:', error); return []; }
  return data || [];
}

export interface NMFFeature {
  id?: string;
  week_date: string;
  spotify_artist_id: string;
  artist_name: string;
  track_name: string;
  track_spotify_id?: string;
  album_name?: string;
  slide_number?: number;
  slide_position?: number;
  was_cover_feature: boolean;
  nd_pg_id?: string;
}

export async function saveFeatures(features: NMFFeature[]): Promise<boolean> {
  if (!supabase || features.length === 0) return false;
  const { error } = await supabase.from('nmf_features').upsert(features, {
    onConflict: 'week_date,track_spotify_id',
  });
  if (error) { console.error('saveFeatures error:', error); return false; }
  return true;
}

export async function getArtistFeatures(spotifyArtistId: string): Promise<NMFFeature[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('nmf_features')
    .select('*')
    .eq('spotify_artist_id', spotifyArtistId)
    .order('week_date', { ascending: false });
  if (error) return [];
  return data || [];
}

export async function searchFeatures(query: string): Promise<NMFFeature[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('nmf_features')
    .select('*')
    .or(`artist_name.ilike.%${query}%,track_name.ilike.%${query}%`)
    .order('week_date', { ascending: false })
    .limit(100);
  if (error) return [];
  return data || [];
}

export interface IGHandle {
  spotify_artist_id: string;
  artist_name: string;
  instagram_handle: string | null;
  nd_pg_id?: string;
  source: string;
  confidence: number;
}

export async function getHandles(artistIds: string[]): Promise<Map<string, IGHandle>> {
  if (!supabase || artistIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from('instagram_handles')
    .select('*')
    .in('spotify_artist_id', artistIds);
  if (error) return new Map();
  const map = new Map<string, IGHandle>();
  for (const row of data || []) map.set(row.spotify_artist_id, row);
  return map;
}

export async function saveHandle(handle: IGHandle): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('instagram_handles')
    .upsert({ ...handle, updated_at: new Date().toISOString() }, {
      onConflict: 'spotify_artist_id',
    });
  if (error) { console.error('saveHandle error:', error); return false; }
  return true;
}
