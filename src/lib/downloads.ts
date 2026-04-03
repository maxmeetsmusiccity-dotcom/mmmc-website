import type { TrackItem } from './spotify';

function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').slice(0, 80);
}

function formatDuration(ms: number): string {
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export function downloadJSON(tracks: TrackItem[], filename: string): void {
  const blob = new Blob([JSON.stringify(tracks, null, 2)], { type: 'application/json' });
  downloadBlob(blob, filename);
}

export function downloadCSV(tracks: TrackItem[], filename: string): void {
  const headers = [
    'track_name', 'track_number', 'track_uri', 'track_spotify_url', 'track_id',
    'duration_ms', 'duration_formatted', 'explicit',
    'album_name', 'artist_names', 'artist_id', 'artist_spotify_url',
    'artist_genres', 'artist_followers', 'album_type', 'release_date',
    'total_tracks', 'album_spotify_url', 'album_spotify_id',
    'cover_art_640', 'cover_art_300', 'cover_art_64',
  ];

  const rows = tracks.map(t => [
    t.track_name, t.track_number, t.track_uri, t.track_spotify_url, t.track_id,
    t.duration_ms, formatDuration(t.duration_ms), t.explicit,
    t.album_name, t.artist_names, t.artist_id, t.artist_spotify_url,
    t.artist_genres.join('; '), t.artist_followers, t.album_type, t.release_date,
    t.total_tracks, t.album_spotify_url, t.album_spotify_id,
    t.cover_art_640, t.cover_art_300, t.cover_art_64,
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row =>
      row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  downloadBlob(blob, filename);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function downloadArt(
  tracks: TrackItem[],
  onProgress?: (current: number, total: number) => void,
): Promise<void> {
  // Deduplicate by album ID — one image per album
  const seen = new Set<string>();
  const unique: TrackItem[] = [];
  for (const t of tracks) {
    if (!seen.has(t.album_spotify_id)) {
      seen.add(t.album_spotify_id);
      unique.push(t);
    }
  }

  // Try zip approach first
  try {
    const JSZip = (await import('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js' as string)).default
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      || (window as any).JSZip;

    if (JSZip) {
      const zip = new JSZip();
      for (let i = 0; i < unique.length; i++) {
        const t = unique[i];
        onProgress?.(i + 1, unique.length);
        try {
          const res = await fetch(t.cover_art_640);
          const blob = await res.blob();
          const fname = sanitizeFilename(`${t.artist_names} - ${t.album_name}.jpg`);
          zip.file(fname, blob);
        } catch {
          // CORS blocked, fall through to individual downloads
          throw new Error('CORS');
        }
      }
      const content = await zip.generateAsync({ type: 'blob' });
      downloadBlob(content, 'cover-art.zip');
      return;
    }
  } catch {
    // Fall back to individual downloads
  }

  // Individual downloads with spacing
  for (let i = 0; i < unique.length; i++) {
    const t = unique[i];
    onProgress?.(i + 1, unique.length);
    const a = document.createElement('a');
    a.href = t.cover_art_640;
    a.download = sanitizeFilename(`${t.artist_names} - ${t.album_name}.jpg`);
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    if (i < unique.length - 1) {
      await new Promise(r => setTimeout(r, 300));
    }
  }
}
