import { useState, useRef, useCallback } from 'react';
import { parseManifestCSV } from '../lib/sources/manual';
import { groupIntoReleases } from '../lib/spotify';
import type { TrackItem } from '../lib/spotify';
import ArtistBrowser from './ArtistBrowser';

interface Props {
  onImport: (tracks: TrackItem[]) => void;
}

type Tab = 'browse' | 'artists' | 'csv';

export default function ManualImport({ onImport }: Props) {
  const [tab, setTab] = useState<Tab>('browse');
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<{ tracks: number; artists: number; albums: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Artist names scan state
  const [artistText, setArtistText] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('');

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
      const releases = groupIntoReleases(tracks);
      const uniqueArtists = new Set(tracks.map(t => t.artist_id || t.artist_names));
      setSummary({ tracks: tracks.length, artists: uniqueArtists.size, albums: releases.length });
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

  const handleArtistScan = async () => {
    const names = artistText
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);
    if (names.length === 0) {
      setError('Paste at least one artist name (one per line)');
      return;
    }
    if (names.length > 200) {
      setError('Max 200 artists per scan. You have ' + names.length + '.');
      return;
    }

    setScanning(true);
    setError('');
    setSummary(null);
    setScanStatus(`Scanning ${names.length} artists...`);

    try {
      const res = await fetch('/api/scan-artists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artistNames: names }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `Scan failed: ${res.status}`);
      }

      const data = await res.json();
      const tracks = data.tracks as TrackItem[];

      if (tracks.length === 0) {
        setError(`No new releases found from ${data.scannedArtists} artists since last Friday.`);
        setScanStatus('');
        setScanning(false);
        return;
      }

      const releases = groupIntoReleases(tracks);
      setSummary({ tracks: tracks.length, artists: data.scannedArtists, albums: releases.length });
      setScanStatus(`Found ${tracks.length} tracks from ${releases.length} releases`);
      onImport(tracks);
    } catch (err) {
      setError((err as Error).message);
      setScanStatus('');
    } finally {
      setScanning(false);
    }
  };

  return (
    <div data-testid="manual-import">
      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        <button
          className={`filter-pill ${tab === 'browse' ? 'active' : ''}`}
          onClick={() => setTab('browse')}
          style={{ fontSize: '0.75rem' }}
        >
          Browse Artists
        </button>
        <button
          className={`filter-pill ${tab === 'artists' ? 'active' : ''}`}
          onClick={() => setTab('artists')}
          style={{ fontSize: '0.75rem' }}
        >
          Paste Names
        </button>
        <button
          className={`filter-pill ${tab === 'csv' ? 'active' : ''}`}
          onClick={() => setTab('csv')}
          style={{ fontSize: '0.75rem' }}
        >
          Upload CSV
        </button>
      </div>

      {/* Browse Artists tab (ND-powered) */}
      {tab === 'browse' && (
        <ArtistBrowser
          onScanArtists={async (names) => {
            setScanning(true);
            setError('');
            setSummary(null);
            setScanStatus(`Scanning ${names.length} artists...`);
            try {
              const res = await fetch('/api/scan-artists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ artistNames: names }),
              });
              if (!res.ok) {
                const err = await res.json().catch(() => ({ error: res.statusText }));
                throw new Error(err.error || `Scan failed: ${res.status}`);
              }
              const data = await res.json();
              const tracks = data.tracks as TrackItem[];
              if (tracks.length === 0) {
                setError(`No new releases found from ${data.scannedArtists} artists since last Friday.`);
              } else {
                const releases = groupIntoReleases(tracks);
                setSummary({ tracks: tracks.length, artists: data.scannedArtists, albums: releases.length });
                setScanStatus(`Found ${tracks.length} tracks from ${releases.length} releases`);
                onImport(tracks);
              }
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setScanning(false);
              setScanStatus('');
            }
          }}
          scanning={scanning}
        />
      )}

      {/* Artist Names tab */}
      {tab === 'artists' && (
        <div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
            Paste artist names (one per line). We'll search Spotify's catalog for their new releases since last Friday — no Spotify login needed.
          </p>
          <textarea
            value={artistText}
            onChange={e => setArtistText(e.target.value)}
            placeholder={'Lainey Wilson\nZach Bryan\nMorgan Wallen\nAshley Cooke\nElla Langley'}
            rows={8}
            style={{
              width: '100%', padding: 12, borderRadius: 8,
              background: 'var(--midnight)', border: '1px solid var(--midnight-border)',
              color: 'var(--text-primary)', fontFamily: 'var(--font-body)',
              fontSize: '0.8rem', resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
            <button
              className="btn btn-gold"
              onClick={handleArtistScan}
              disabled={scanning || !artistText.trim()}
              style={{ fontSize: '0.85rem', padding: '10px 24px' }}
            >
              {scanning ? 'Scanning...' : 'Scan for New Releases'}
            </button>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {artistText.trim() ? `${artistText.split('\n').filter(s => s.trim()).length} artists` : ''}
              {scanStatus && ` · ${scanStatus}`}
            </span>
          </div>
          <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: 6 }}>
            No Spotify account needed. Uses server-side catalog search. Max 200 artists per scan.
          </p>
        </div>
      )}

      {/* CSV tab */}
      {tab === 'csv' && (
        <div>
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
              {summary ? '\u2713' : '\uD83D\uDCC4'}
            </div>
            <p style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 4 }}>
              {summary ? `${summary.tracks} tracks imported` : 'Drop manifest.csv here'}
            </p>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
              {summary
                ? `${summary.artists} artists \u00B7 ${summary.albums} releases \u00B7 Zero API calls`
                : 'or click to browse \u2014 Python NMF manifest format'}
            </p>
            <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile} style={{ display: 'none' }} />
          </div>

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
      )}

      {/* Summary */}
      {summary && (
        <div style={{
          marginTop: 12, padding: '8px 12px', borderRadius: 6,
          background: 'rgba(61,168,119,0.1)', border: '1px solid rgba(61,168,119,0.3)',
          fontSize: '0.75rem', color: '#3DA877',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>{summary.tracks} tracks from {summary.albums} releases ready for selection</span>
          <button
            onClick={() => { setSummary(null); setError(''); setScanStatus(''); if (fileRef.current) fileRef.current.value = ''; }}
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
    </div>
  );
}
