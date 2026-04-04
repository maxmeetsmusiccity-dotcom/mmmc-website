import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getCarouselUrls } from '../lib/supabase';
import { getLastFriday } from '../lib/spotify';

export default function Embed() {
  const [searchParams] = useSearchParams();
  const [images, setImages] = useState<string[]>([]);
  const [activeSlide, setActiveSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);

  const weekDate = searchParams.get('week') || getLastFriday();
  const intervalMs = parseInt(searchParams.get('interval') || '5000', 10);

  // Load carousel images from Supabase Storage
  useEffect(() => {
    getCarouselUrls(weekDate).then(urls => {
      setImages(urls);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [weekDate]);

  // Auto-advance
  useEffect(() => {
    if (images.length <= 1 || paused) return;
    const timer = setInterval(() => {
      setActiveSlide(prev => (prev + 1) % images.length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [images.length, paused, intervalMs]);

  const goTo = useCallback((idx: number) => {
    setActiveSlide(idx);
    setPaused(true);
    // Resume auto-advance after 10s of inactivity
    setTimeout(() => setPaused(false), 10000);
  }, []);

  if (loading) {
    return (
      <div style={containerStyle}>
        <p style={{ color: '#6B7F95', fontSize: '0.8rem' }}>Loading...</p>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div style={containerStyle}>
        <h2 style={titleStyle}>
          New Music <span style={{ color: '#D4A843' }}>Friday</span>
        </h2>
        <p style={{ color: '#6B7F95', fontSize: '0.8rem', marginTop: 12 }}>
          No carousel generated for this week yet.
        </p>
        <p style={{ color: '#4A5568', fontSize: '0.65rem', marginTop: 8 }}>
          {weekDate}
        </p>
      </div>
    );
  }

  return (
    <div
      style={containerStyle}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Slide */}
      <div style={{ position: 'relative', width: '100%', aspectRatio: '1', overflow: 'hidden', borderRadius: 8 }}>
        {images.map((url, i) => (
          <img
            key={url}
            src={url}
            alt={`Slide ${i + 1}`}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
              opacity: i === activeSlide ? 1 : 0,
              transition: 'opacity 0.6s ease-in-out',
            }}
          />
        ))}
      </div>

      {/* Navigation dots */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 8 }}>
        {images.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            style={{
              width: i === activeSlide ? 16 : 6, height: 6, borderRadius: 3,
              background: i === activeSlide ? '#D4A843' : '#2A3A5C',
              transition: 'all 0.3s', cursor: 'pointer', border: 'none',
            }}
          />
        ))}
      </div>

      {/* Branding */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <span style={{ fontSize: '0.55rem', color: '#6B7F95' }}>
          {weekDate}
        </span>
        <a
          href="https://maxmeetsmusiccity.com/newmusicfriday"
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: '0.55rem', color: '#D4A843', textDecoration: 'none' }}
        >
          Max Meets Music City
        </a>
      </div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  background: '#0F1B33',
  color: '#F0EDE8',
  fontFamily: '"DM Sans", system-ui, sans-serif',
  padding: 12,
  minHeight: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
};

const titleStyle: React.CSSProperties = {
  fontFamily: '"Source Serif 4", Georgia, serif',
  fontSize: '1.1rem',
};
