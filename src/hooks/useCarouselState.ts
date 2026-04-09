import { useState, useRef } from 'react';
import type { CarouselAspect } from '../lib/canvas-grid';

export function useCarouselState() {
  const [carouselAspect, setCarouselAspect] = useState<CarouselAspect>('1:1');
  const [allPreviews, setAllPreviews] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [exportScope, setExportScope] = useState<'all' | 'selects'>('selects');
  const [tracksPerSlide, setTracksPerSlide] = useState(8);
  const carouselRef = useRef<{ generate: () => void; downloadAll: () => void }>(null);
  const [cardSize, setCardSize] = useState(() => {
    try { return parseInt(localStorage.getItem('nmf_card_size') || '240'); } catch { return 240; }
  });

  return {
    carouselAspect, setCarouselAspect,
    allPreviews, setAllPreviews,
    generating, setGenerating,
    exportScope, setExportScope,
    tracksPerSlide, setTracksPerSlide,
    carouselRef,
    cardSize, setCardSize,
  };
}
