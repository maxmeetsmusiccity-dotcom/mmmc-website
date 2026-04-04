/**
 * Pure utility functions for the scan — no browser dependencies.
 * Extracted so they can be unit tested without jsdom.
 */

/**
 * Parse Spotify release_date with known precisions.
 * Matches Python _parse_release_date() exactly.
 */
export function parseReleaseDate(releaseDate: string, precision?: string): string | null {
  if (!releaseDate) return null;
  try {
    if (precision === 'day') return releaseDate;
    if (precision === 'month') {
      const [y, m] = releaseDate.split('-');
      return `${y}-${m.padStart(2, '0')}-01`;
    }
    if (precision === 'year') return `${releaseDate}-01-01`;
    // Fallback on string length when precision missing
    if (releaseDate.length === 10) return releaseDate;
    if (releaseDate.length === 7) return `${releaseDate}-01`;
    if (releaseDate.length === 4) return `${releaseDate}-01-01`;
  } catch { return null; }
  return null;
}

/**
 * Compute last Friday date string (YYYY-MM-DD).
 * If today is Friday → today. Sat/Sun/Mon → prev Friday. Tue/Wed/Thu → prev Friday.
 */
export function computeLastFriday(now: Date = new Date()): string {
  const day = now.getDay();
  const diff = day >= 5 ? day - 5 : day + 2;
  const friday = new Date(now);
  friday.setDate(now.getDate() - diff);
  friday.setHours(0, 0, 0, 0);
  return friday.toISOString().split('T')[0];
}
