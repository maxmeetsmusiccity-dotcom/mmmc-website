/**
 * Platform and aspect ratio configurations for carousel export.
 * Covers all standard iPhone Photos crop ratios plus social media sizes.
 */

export interface PlatformConfig {
  id: string;
  name: string;
  icon: string;
  width: number;
  height: number;
  maxSlides: number;
  aspectLabel: string;
  category: 'social' | 'ratio';
}

export const PLATFORMS: PlatformConfig[] = [
  // Social media presets
  { id: 'ig-post', name: 'IG Post', icon: '\uD83D\uDCF7', width: 1080, height: 1080, maxSlides: 20, aspectLabel: '1:1', category: 'social' },
  { id: 'ig-portrait', name: 'IG Portrait', icon: '\uD83D\uDCF7', width: 1080, height: 1350, maxSlides: 20, aspectLabel: '4:5', category: 'social' },
  { id: 'ig-story', name: 'IG Story / Reel', icon: '\uD83D\uDCF1', width: 1080, height: 1920, maxSlides: 20, aspectLabel: '9:16', category: 'social' },
  { id: 'tiktok', name: 'TikTok', icon: '\uD83C\uDFB5', width: 1080, height: 1920, maxSlides: 35, aspectLabel: '9:16', category: 'social' },
  { id: 'facebook', name: 'Facebook', icon: '\uD83D\uDCD8', width: 1080, height: 1080, maxSlides: 10, aspectLabel: '1:1', category: 'social' },
  { id: 'twitter', name: 'Twitter/X', icon: '\uD83D\uDC26', width: 1200, height: 675, maxSlides: 4, aspectLabel: '16:9', category: 'social' },
  { id: 'pinterest', name: 'Pinterest', icon: '\uD83D\uDCCC', width: 1000, height: 1500, maxSlides: 5, aspectLabel: '2:3', category: 'social' },
  { id: 'youtube', name: 'YouTube Thumb', icon: '\u25B6\uFE0F', width: 1280, height: 720, maxSlides: 1, aspectLabel: '16:9', category: 'social' },

  // iPhone Photos crop ratios (at 1080px base width)
  { id: 'square', name: 'Square', icon: '\u2B1C', width: 1080, height: 1080, maxSlides: 20, aspectLabel: '1:1', category: 'ratio' },
  { id: 'ratio-4-5', name: '4:5 Portrait', icon: '\u2B1C', width: 1080, height: 1350, maxSlides: 20, aspectLabel: '4:5', category: 'ratio' },
  { id: 'ratio-5-4', name: '5:4 Landscape', icon: '\u2B1C', width: 1350, height: 1080, maxSlides: 20, aspectLabel: '5:4', category: 'ratio' },
  { id: 'ratio-3-4', name: '3:4 Portrait', icon: '\u2B1C', width: 1080, height: 1440, maxSlides: 20, aspectLabel: '3:4', category: 'ratio' },
  { id: 'ratio-4-3', name: '4:3 Landscape', icon: '\u2B1C', width: 1440, height: 1080, maxSlides: 20, aspectLabel: '4:3', category: 'ratio' },
  { id: 'ratio-2-3', name: '2:3 Portrait', icon: '\u2B1C', width: 1080, height: 1620, maxSlides: 20, aspectLabel: '2:3', category: 'ratio' },
  { id: 'ratio-3-2', name: '3:2 Landscape', icon: '\u2B1C', width: 1620, height: 1080, maxSlides: 20, aspectLabel: '3:2', category: 'ratio' },
  { id: 'ratio-9-16', name: '9:16 Vertical', icon: '\u2B1C', width: 1080, height: 1920, maxSlides: 20, aspectLabel: '9:16', category: 'ratio' },
  { id: 'ratio-16-9', name: '16:9 Widescreen', icon: '\u2B1C', width: 1920, height: 1080, maxSlides: 20, aspectLabel: '16:9', category: 'ratio' },
];

export function getPlatform(id: string): PlatformConfig {
  return PLATFORMS.find(p => p.id === id) || PLATFORMS[0];
}
