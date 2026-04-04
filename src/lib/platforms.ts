/**
 * Platform configurations for carousel export.
 * Each platform has specific dimensions, aspect ratios, and slide limits.
 */

export interface PlatformConfig {
  id: string;
  name: string;
  icon: string;
  width: number;
  height: number;
  maxSlides: number;
  aspectLabel: string;
}

export const PLATFORMS: PlatformConfig[] = [
  { id: 'ig-post', name: 'Instagram Post', icon: '📷', width: 1080, height: 1080, maxSlides: 20, aspectLabel: '1:1' },
  { id: 'ig-portrait', name: 'IG Portrait', icon: '📷', width: 1080, height: 1350, maxSlides: 20, aspectLabel: '4:5' },
  { id: 'ig-story', name: 'IG Story', icon: '📱', width: 1080, height: 1920, maxSlides: 20, aspectLabel: '9:16' },
  { id: 'tiktok', name: 'TikTok', icon: '🎵', width: 1080, height: 1920, maxSlides: 35, aspectLabel: '9:16' },
  { id: 'facebook', name: 'Facebook', icon: '📘', width: 1080, height: 1080, maxSlides: 10, aspectLabel: '1:1' },
  { id: 'twitter', name: 'Twitter/X', icon: '🐦', width: 1200, height: 675, maxSlides: 4, aspectLabel: '16:9' },
  { id: 'linkedin', name: 'LinkedIn', icon: '💼', width: 1080, height: 1080, maxSlides: 20, aspectLabel: '1:1' },
];

export function getPlatform(id: string): PlatformConfig {
  return PLATFORMS.find(p => p.id === id) || PLATFORMS[0];
}
