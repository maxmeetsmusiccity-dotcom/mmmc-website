import { useState } from 'react';
import type { SelectionSlot } from '../lib/selection';
import { generateGridComposite, downloadBlob } from '../lib/canvas-grid';
import { startCanvaAuth, getCanvaToken, exchangeCanvaCode, uploadCanvaAsset, clearCanvaToken } from '../lib/canva';

interface Props {
  slideGroups: SelectionSlot[][];
  coverFeature: SelectionSlot | null;
}

export default function CarouselPreview({ slideGroups, coverFeature }: Props) {
  const [previews, setPreviews] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [canvaToken, setCanvaToken] = useState(getCanvaToken());
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const newPreviews: string[] = [];
      for (const group of slideGroups) {
        const blob = await generateGridComposite(group, '/mmmc-logo.png');
        newPreviews.push(URL.createObjectURL(blob));
      }
      setPreviews(newPreviews);
    } catch (e) {
      console.error('Grid generation failed:', e);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadAll = async () => {
    for (let i = 0; i < slideGroups.length; i++) {
      const blob = await generateGridComposite(slideGroups[i], '/mmmc-logo.png');
      downloadBlob(blob, `nmf-grid-slide-${i + 1}.png`);
      if (i < slideGroups.length - 1) {
        await new Promise(r => setTimeout(r, 300));
      }
    }
  };

  const handleCanvaConnect = () => {
    startCanvaAuth();
  };

  // Handle Canva OAuth callback (check for state=canva in URL)
  const handleCanvaCallback = async (code: string) => {
    try {
      const token = await exchangeCanvaCode(code);
      setCanvaToken(token);
    } catch (e) {
      console.error('Canva auth failed:', e);
    }
  };

  const handleUploadToCanva = async () => {
    if (!canvaToken) return;
    setUploading(true);
    setUploadStatus('Uploading grid composites...');
    try {
      const assetIds: string[] = [];
      for (let i = 0; i < slideGroups.length; i++) {
        setUploadStatus(`Uploading slide ${i + 1}/${slideGroups.length}...`);
        const blob = await generateGridComposite(slideGroups[i], '/mmmc-logo.png');
        const assetId = await uploadCanvaAsset(canvaToken, blob, `NMF Grid Slide ${i + 1}`);
        assetIds.push(assetId);
      }

      // Upload cover feature art if designated
      if (coverFeature) {
        setUploadStatus('Uploading cover feature art...');
        const res = await fetch(coverFeature.track.cover_art_640);
        const blob = await res.blob();
        const coverId = await uploadCanvaAsset(canvaToken, blob, `NMF Cover - ${coverFeature.track.artist_names}`);
        assetIds.push(coverId);
      }

      setUploadStatus(`Done! ${assetIds.length} assets uploaded to Canva. Open Canva to assemble the carousel.`);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('401') || msg.includes('403')) {
        clearCanvaToken();
        setCanvaToken(null);
        setUploadStatus('Canva session expired. Reconnect to try again.');
      } else {
        setUploadStatus(`Upload failed: ${msg}`);
      }
    } finally {
      setUploading(false);
    }
  };

  // Check if we just returned from Canva OAuth
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    if (code && state === 'canva' && !canvaToken) {
      handleCanvaCallback(code);
      // Clean URL
      const url = new URL(window.location.href);
      url.searchParams.delete('code');
      url.searchParams.delete('state');
      window.history.replaceState({}, '', url.toString());
    }
  }

  return (
    <div style={{
      padding: '16px 0',
      borderTop: '1px solid var(--midnight-border)',
      marginTop: 24,
    }}>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', marginBottom: 16 }}>
        Carousel Grids
      </h3>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <button
          className="btn btn-sm btn-gold"
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating ? 'Generating...' : previews.length > 0 ? 'Regenerate Grids' : 'Generate Grid Previews'}
        </button>
        {previews.length > 0 && (
          <button className="btn btn-sm" onClick={handleDownloadAll}>
            Download All Grid PNGs
          </button>
        )}

        <span style={{ color: 'var(--midnight-border)', margin: '0 4px', alignSelf: 'center' }}>|</span>

        {!canvaToken ? (
          <button className="btn btn-sm" onClick={handleCanvaConnect}>
            Connect Canva
          </button>
        ) : (
          <>
            <button
              className="btn btn-sm"
              onClick={handleUploadToCanva}
              disabled={uploading}
            >
              {uploading ? 'Uploading...' : 'Upload to Canva'}
            </button>
            <button
              className="btn btn-sm btn-danger"
              onClick={() => { clearCanvaToken(); setCanvaToken(null); }}
              style={{ fontSize: '0.7rem' }}
            >
              Disconnect Canva
            </button>
          </>
        )}
      </div>

      {uploadStatus && (
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
          {uploadStatus}
        </p>
      )}

      {/* Grid previews */}
      {previews.length > 0 && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {previews.map((url, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                Slide {i + 1}
              </p>
              <img
                src={url}
                alt={`Grid slide ${i + 1}`}
                style={{
                  width: 200, height: 200, borderRadius: 8,
                  border: '1px solid var(--midnight-border)',
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
