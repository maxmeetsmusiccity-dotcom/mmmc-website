import { useState, useRef, useCallback } from 'react';
import { parseManifestCSV } from '../lib/sources/manual';
import { groupIntoReleases } from '../lib/spotify';
import type { TrackItem } from '../lib/spotify';

interface Props {
  onImport: (tracks: TrackItem[]) => void;
}

export default function ManualImport({ onImport }: Props) {
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<{ tracks: number; artists: number; albums: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    setError('');
    setSummary(null);
    try {
      const text = await file.text();
      const tracks = parseManifestCSV(text);
      if (tracks.length === 0) {
        setError('No tracks found. Check that the CSV has artist_name and track_name columns.');
        return;
      }
      // Compute summary
      const releases = groupIntoReleases(tracks);
      const uniqueArtists = new Set(tracks.map(t => t.artist_id || t.artist_names));
      setSummary({
        tracks: tracks.length,
        artists: uniqueArtists.size,
        albums: releases.length,
      });
      onImport(tracks);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [onImport]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) {
      processFile(file);
    } else {
      setError('Please drop a .csv file');
    }
  }, [processFile]);

  return (
    <div data-testid="manual-import">
      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        style={{
          padding: 24, borderRadius: 10, cursor: 'pointer',
          background: dragging ? 'rgba(212,168,67,0.08)' : 'var(--midnight)',
          border: dragging ? '2px dashed var(--gold)' : '2px dashed var(--midnight-border)',
          textAlign: 'center', transition: 'all 0.2s',
        }}
      >
        <div style={{ fontSize: '2rem', marginBottom: 8 }}>
          {summary ? '✓' : '📄'}
        </div>
        <p style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 4 }}>
          {summary ? `${summary.tracks} tracks imported` : 'Drop manifest.csv here'}
        </p>
        <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
          {summary
            ? `${summary.artists} artists · ${summary.albums} releases · Zero API calls`
            : 'or click to browse — from your Python NMF automation'}
        </p>

        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFile}
          style={{ display: 'none' }}
        />
      </div>

      {/* Summary after import */}
      {summary && (
        <div style={{
          marginTop: 12, padding: '8px 12px', borderRadius: 6,
          background: 'rgba(61,168,119,0.1)', border: '1px solid rgba(61,168,119,0.3)',
          fontSize: '0.75rem', color: '#3DA877',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>Ready for selection — album art loaded from Spotify CDN</span>
          <button
            onClick={() => { setSummary(null); setError(''); if (fileRef.current) fileRef.current.value = ''; }}
            style={{ color: 'var(--text-muted)', fontSize: '0.65rem', cursor: 'pointer' }}
          >
            Clear
          </button>
        </div>
      )}

      {error && (
        <div style={{
          marginTop: 12, padding: '8px 12px', borderRadius: 6,
          background: 'rgba(204,53,53,0.1)', border: '1px solid rgba(204,53,53,0.3)',
          fontSize: '0.75rem', color: 'var(--mmmc-red)',
        }}>
          {error}
        </div>
      )}

      {/* Format hint */}
      <details style={{ marginTop: 12 }}>
        <summary style={{ fontSize: '0.65rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
          Expected CSV format
        </summary>
        <pre style={{
          marginTop: 6, padding: 8, borderRadius: 6,
          background: 'var(--midnight-raised)', fontSize: '0.55rem',
          color: 'var(--text-secondary)', overflow: 'auto',
          fontFamily: 'var(--font-mono)',
        }}>
{`select,artist_name,artist_id,release_name,release_id,
release_type,release_date,track_name,track_id,
track_uri,cover_url,cover_path`}
        </pre>
      </details>
    </div>
  );
}
