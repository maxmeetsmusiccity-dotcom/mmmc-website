/**
 * DSP-agnostic source system.
 * Any source converts to TrackItem[] so the downstream
 * selection/carousel pipeline works unchanged.
 */

export interface MusicSource {
  id: 'spotify' | 'apple-music' | 'manual';
  name: string;
  icon: string;
  description: string;
  requiresAuth: boolean;
}

export const SOURCES: MusicSource[] = [
  {
    id: 'spotify',
    name: 'Spotify',
    icon: '🟢',
    description: 'Scan your followed artists',
    requiresAuth: true,
  },
  {
    id: 'apple-music',
    name: 'Apple Music',
    icon: '🔴',
    description: 'Scan your library',
    requiresAuth: true,
  },
  {
    id: 'manual',
    name: 'Artist List',
    icon: '📋',
    description: 'Paste names or import CSV',
    requiresAuth: false,
  },
];

export function getSource(id: string): MusicSource {
  return SOURCES.find(s => s.id === id) || SOURCES[0];
}
