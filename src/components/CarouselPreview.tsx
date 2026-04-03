import { useState } from 'react';
import type { SelectionSlot } from '../lib/selection';
import { generateFullCarousel, downloadBlob, type CarouselOutput } from '../lib/canvas-grid';
import { getLastFriday } from '../lib/spotify';
import TemplateSelector from './TemplateSelector';

interface Props {
  slideGroups: SelectionSlot[][];
  coverFeature: SelectionSlot | null;
}

export default function CarouselPreview({ slideGroups, coverFeature }: Props) {
  const [carousel, setCarousel] = useState<CarouselOutput | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [templateId, setTemplateId] = useState(localStorage.getItem('nmf_template') || 'mmmc_classic');

  const weekDate = getLastFriday();

  const [genProgress, setGenProgress] = useState<{ current: number; total: number } | null>(null);

  const handleTemplateChange = (id: string) => {
    setTemplateId(id);
    localStorage.setItem('nmf_template', id);
    // Clear previous carousel so user regenerates with new template
    setCarousel(null);
    setPreviews([]);
  };

  const handleGenerate = async () => {
    if (!coverFeature) {
      setError('Set a cover feature first — click ★ on any selected card in Browse view');
      return;
    }
    setGenerating(true);
    setError('');
    setGenProgress(null);
    try {
      const result = await generateFullCarousel(slideGroups, coverFeature, weekDate, (cur, tot) => {
        setGenProgress({ current: cur, total: tot });
      }, templateId);
      setCarousel(result);
      setGenProgress(null);
      const urls = result.allSlides.map(b => URL.createObjectURL(b));
      setPreviews(prev => { prev.forEach(URL.revokeObjectURL); return urls; });
    } catch (e) {
      setError(`Generation failed: ${(e as Error).message}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadAll = async () => {
    if (!carousel) return;
    // Try zip
    try {
      const JSZip = (await import('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js' as string)).default
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        || (window as any).JSZip;
      if (JSZip) {
        const zip = new JSZip();
        zip.file('01_cover.png', carousel.coverSlide);
        carousel.gridSlides.forEach((b, i) => {
          zip.file(`${String(i + 2).padStart(2, '0')}_grid_slide${i + 1}.png`, b);
        });
        const content = await zip.generateAsync({ type: 'blob' });
        downloadBlob(content, `nmf-carousel-${weekDate}.zip`);
        return;
      }
    } catch { /* fall through */ }

    // Fallback: individual downloads
    downloadBlob(carousel.coverSlide, '01_cover.png');
    for (let i = 0; i < carousel.gridSlides.length; i++) {
      await new Promise(r => setTimeout(r, 300));
      downloadBlob(carousel.gridSlides[i], `${String(i + 2).padStart(2, '0')}_grid_slide${i + 1}.png`);
    }
  };

  const handleDownloadSingle = (index: number) => {
    if (!carousel) return;
    if (index === 0) {
      downloadBlob(carousel.coverSlide, '01_cover.png');
    } else {
      downloadBlob(carousel.gridSlides[index - 1], `${String(index + 1).padStart(2, '0')}_grid_slide${index}.png`);
    }
  };

  return (
    <div style={{
      padding: '16px 0', borderTop: '1px solid var(--midnight-border)', marginTop: 24,
    }}>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', marginBottom: 16 }}>
        Instagram Carousel
      </h3>

      <TemplateSelector selected={templateId} onSelect={handleTemplateChange} />

      {error && (
        <p style={{ color: 'var(--mmmc-red)', fontSize: '0.8rem', marginBottom: 12 }}>{error}</p>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <button
          className="btn btn-sm btn-gold"
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating && genProgress
            ? `Generating slide ${genProgress.current + 1} of ${genProgress.total}...`
            : generating ? 'Generating...'
            : previews.length > 0 ? 'Regenerate Carousel' : 'Generate Carousel'}
        </button>
        {carousel && (
          <button className="btn btn-sm" onClick={handleDownloadAll}>
            Download Carousel (ZIP)
          </button>
        )}
        {!coverFeature && (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', alignSelf: 'center' }}>
            Set a cover feature first
          </span>
        )}
      </div>

      {/* Slide previews — swipeable on mobile */}
      {previews.length > 0 && (
        <div className="carousel-preview-row" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {previews.map((url, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                {i === 0 ? 'Cover' : `Slide ${i}`}
              </p>
              <img
                src={url}
                alt={i === 0 ? 'Cover slide' : `Grid slide ${i}`}
                style={{
                  width: 200, height: 200, borderRadius: 8,
                  border: '1px solid var(--midnight-border)',
                  cursor: 'pointer',
                }}
                onClick={() => handleDownloadSingle(i)}
                title="Click to download"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
