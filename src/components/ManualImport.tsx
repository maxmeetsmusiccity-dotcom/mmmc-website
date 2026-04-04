import { useState, useRef } from 'react';
import { parseManifestCSV } from '../lib/sources/manual';
import type { TrackItem } from '../lib/spotify';

interface Props {
  onImport: (tracks: TrackItem[]) => void;
}

export default function ManualImport({ onImport }: Props) {
  const [error, setError] = useState('');
  const [imported, setImported] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const text = await file.text();
      const tracks = parseManifestCSV(text);
      if (tracks.length === 0) {
        setError('No tracks found in CSV. Check the format matches the Python manifest.');
        return;
      }
      setImported(tracks.length);
      onImport(tracks);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div data-testid="manual-import" style={{
      padding: 16, borderRadius: 10,
      background: 'var(--midnight)', border: '1px solid var(--midnight-border)',
    }}>
      <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 8 }}>
        Import from CSV
      </h4>
      <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
        Upload a manifest.csv from the Python NMF automation. Columns: artist_name, track_name, cover_url, etc.
        No API calls needed — direct import.
      </p>

      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        onChange={handleFile}
        style={{ fontSize: '0.75rem', marginBottom: 8 }}
      />

      {error && (
        <p style={{ color: 'var(--mmmc-red)', fontSize: '0.75rem', marginTop: 8 }}>{error}</p>
      )}
      {imported > 0 && (
        <p style={{ color: '#3DA877', fontSize: '0.75rem', marginTop: 8 }}>
          Imported {imported} tracks from CSV
        </p>
      )}
    </div>
  );
}
