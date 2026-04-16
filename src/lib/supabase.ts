import { createClient } from '@supabase/supabase-js';
import { NMF_AUTH_CONFIG } from './auth-config';

// These are public keys — safe in client code
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        // PKCE is more secure than implicit flow and required for
        // proper multi-product redirect handling. Supabase appends
        // ?code= instead of #access_token, which is validated against
        // the dashboard's Redirect URLs allow list.
        flowType: 'pkce',
        // Product-specific storage key prevents token collision if
        // two MMMC products ever share a domain (e.g. subpaths).
        storageKey: NMF_AUTH_CONFIG.storageKey,
        // Let Supabase detect the session from the URL callback
        detectSessionInUrl: true,
      },
    })
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

/** Strip tracks with synth_* placeholder IDs before persisting */
function filterSynthTracks<T extends { track_id?: string }>(arr: T[]): T[] {
  return arr.filter(t => !t.track_id?.startsWith('synth_'));
}

export async function saveWeek(week: NMFWeek, userId?: string): Promise<NMFWeek | null> {
  if (!supabase) return null;
  // Sanitize synth_ placeholder IDs that persist if backfill was rate-limited
  const sanitized = {
    ...week,
    ...(Array.isArray(week.all_releases) ? { all_releases: filterSynthTracks(week.all_releases as any[]) } : {}),
    ...(Array.isArray(week.selections) ? { selections: (week.selections as any[]).filter((s: any) => !s.track?.track_id?.startsWith('synth_')) } : {}),
  };
  const row = { ...sanitized, updated_at: new Date().toISOString(), ...(userId ? { user_id: userId } : {}) };
  const { data, error } = await supabase
    .from('nmf_weeks')
    .upsert(row, { onConflict: 'week_date' })
    .select()
    .single();
  if (error) { console.error('saveWeek error:', error); return null; }
  return data;
}

export async function getWeek(weekDate: string, userId?: string): Promise<NMFWeek | null> {
  if (!supabase) return null;
  let query = supabase.from('nmf_weeks').select('*').eq('week_date', weekDate);
  if (userId) query = query.eq('user_id', userId);
  const { data, error } = await query.single();
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
  user_id?: string;
}

export async function saveFeatures(features: NMFFeature[]): Promise<boolean> {
  const clean = features.filter(f => !(f as any).track_spotify_id?.startsWith('synth_'));
  if (!supabase || clean.length === 0) return false;
  const { error } = await supabase.from('nmf_features').upsert(clean, {
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
  // Sanitize: escape PostgREST special chars to prevent filter injection
  const sanitized = query.replace(/[%_\\(),."']/g, '');
  if (!sanitized) return [];
  const { data, error } = await supabase
    .from('nmf_features')
    .select('*')
    .or(`artist_name.ilike.%${sanitized}%,track_name.ilike.%${sanitized}%`)
    .order('week_date', { ascending: false })
    .limit(100);
  if (error) return [];
  return data || [];
}

/** Get feature counts for a list of artist IDs (for "Previously Featured" badge) */
export async function getFeatureCounts(artistIds: string[]): Promise<Map<string, number>> {
  if (!supabase || artistIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from('nmf_features')
    .select('spotify_artist_id')
    .in('spotify_artist_id', artistIds);
  if (error || !data) return new Map();
  const counts = new Map<string, number>();
  for (const row of data) {
    counts.set(row.spotify_artist_id, (counts.get(row.spotify_artist_id) || 0) + 1);
  }
  return counts;
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
  // Route through server endpoint (RLS restricts direct writes to service_role)
  try {
    const token = supabase ? (await supabase.auth.getSession()).data.session?.access_token : null;
    const res = await fetch('/api/save-handle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'X-Supabase-Auth': token } : {}),
      },
      body: JSON.stringify(handle),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Custom Templates ───────────────────────────────────

export async function saveCustomTemplate(userId: string, template: Record<string, unknown>): Promise<boolean> {
  if (!supabase) return false;
  const templateId = template.id as string;
  // Check if exists first
  const { data: existing } = await supabase
    .from('custom_templates')
    .select('id')
    .eq('user_id', userId)
    .eq('template_name', templateId)
    .limit(1);

  if (existing && existing.length > 0) {
    const { error } = await supabase
      .from('custom_templates')
      .update({ config: template, updated_at: new Date().toISOString() })
      .eq('id', existing[0].id);
    if (error) { console.error('saveCustomTemplate update error:', error); return false; }
  } else {
    const { error } = await supabase
      .from('custom_templates')
      .insert({
        user_id: userId,
        template_name: templateId,
        config: template,
      });
    if (error) { console.error('saveCustomTemplate insert error:', error); return false; }
  }
  return true;
}

export async function getCustomTemplates(userId: string): Promise<Record<string, unknown>[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('custom_templates')
    .select('config')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) { console.error('getCustomTemplates error:', error); return []; }
  return (data || []).map(row => row.config as Record<string, unknown>);
}

export async function deleteCustomTemplate(userId: string, templateId: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('custom_templates')
    .delete()
    .eq('user_id', userId)
    .eq('template_name', templateId);
  if (error) { console.error('deleteCustomTemplate error:', error); return false; }
  return true;
}

// ─── Supabase Storage: Carousel Uploads ─────────────────

const CAROUSEL_BUCKET = 'carousels';

/** Upload a carousel slide PNG to Supabase Storage */
export async function uploadCarouselSlide(
  weekDate: string,
  slideIndex: number,
  blob: Blob,
  templateId: string,
): Promise<string | null> {
  if (!supabase) return null;
  const path = `${weekDate}/${templateId}/slide-${slideIndex}.png`;

  const { error } = await supabase.storage
    .from(CAROUSEL_BUCKET)
    .upload(path, blob, {
      contentType: 'image/png',
      upsert: true,
    });

  if (error) {
    console.error('Upload carousel slide error:', error);
    return null;
  }

  const { data: urlData } = supabase.storage
    .from(CAROUSEL_BUCKET)
    .getPublicUrl(path);

  return urlData?.publicUrl || null;
}

/** Upload all carousel slides and return URLs */
export async function uploadFullCarousel(
  weekDate: string,
  slides: Blob[],
  templateId: string,
  onProgress?: (current: number, total: number) => void,
): Promise<string[]> {
  const urls: string[] = [];
  for (let i = 0; i < slides.length; i++) {
    onProgress?.(i, slides.length);
    const url = await uploadCarouselSlide(weekDate, i, slides[i], templateId);
    if (url) urls.push(url);
  }
  onProgress?.(slides.length, slides.length);
  return urls;
}

/** Get stored carousel URLs for a week */
export async function getCarouselUrls(weekDate: string): Promise<string[]> {
  if (!supabase) return [];

  const { data, error } = await supabase.storage
    .from(CAROUSEL_BUCKET)
    .list(weekDate, { limit: 100, sortBy: { column: 'name', order: 'asc' } });

  if (error || !data) return [];

  const urls: string[] = [];
  for (const folder of data) {
    const { data: files } = await supabase.storage
      .from(CAROUSEL_BUCKET)
      .list(`${weekDate}/${folder.name}`, { limit: 20, sortBy: { column: 'name', order: 'asc' } });

    if (files) {
      for (const file of files) {
        const { data: urlData } = supabase.storage
          .from(CAROUSEL_BUCKET)
          .getPublicUrl(`${weekDate}/${folder.name}/${file.name}`);
        if (urlData?.publicUrl) urls.push(urlData.publicUrl);
      }
    }
  }

  return urls;
}

/** Upload a custom template asset (background or logo) */
export async function uploadTemplateAsset(
  userId: string,
  filename: string,
  blob: Blob,
): Promise<string | null> {
  if (!supabase) return null;
  const path = `templates/${userId}/${filename}`;

  const { error } = await supabase.storage
    .from(CAROUSEL_BUCKET)
    .upload(path, blob, {
      contentType: blob.type || 'image/png',
      upsert: true,
    });

  if (error) {
    console.error('Upload template asset error:', error);
    return null;
  }

  const { data } = supabase.storage
    .from(CAROUSEL_BUCKET)
    .getPublicUrl(path);

  return data?.publicUrl || null;
}
