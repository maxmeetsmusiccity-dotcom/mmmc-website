import { describe, it, expect } from 'vitest';
import { extractComposerCandidates, IntelligenceAccumulator } from '../../api/_scan_intelligence';

describe('extractComposerCandidates (M-Z13)', () => {
  it('returns empty array for null/undefined/empty', () => {
    expect(extractComposerCandidates(null)).toEqual([]);
    expect(extractComposerCandidates(undefined)).toEqual([]);
    expect(extractComposerCandidates('')).toEqual([]);
  });

  it('splits a single-composer string', () => {
    expect(extractComposerCandidates('Ashley Gorley')).toEqual(['Ashley Gorley']);
  });

  it('splits comma-separated composers', () => {
    expect(extractComposerCandidates('Ashley Gorley, Hillary Lindsey, Shane McAnally'))
      .toEqual(['Ashley Gorley', 'Hillary Lindsey', 'Shane McAnally']);
  });

  it('splits on ampersand', () => {
    expect(extractComposerCandidates('Sarah Buxton & Natalie Hemby'))
      .toEqual(['Sarah Buxton', 'Natalie Hemby']);
  });

  it('splits on feat/ft', () => {
    expect(extractComposerCandidates('Morgan Wallen feat. HARDY')).toEqual(['Morgan Wallen', 'HARDY']);
    expect(extractComposerCandidates('Morgan Wallen ft. HARDY')).toEqual(['Morgan Wallen', 'HARDY']);
  });

  it('handles mixed separators', () => {
    expect(extractComposerCandidates('A, B & C, D'))
      .toEqual(['A', 'B', 'C', 'D']);
  });

  it('trims whitespace', () => {
    expect(extractComposerCandidates('   Ashley Gorley   ,   Shane McAnally   '))
      .toEqual(['Ashley Gorley', 'Shane McAnally']);
  });

  it('filters empty fragments', () => {
    expect(extractComposerCandidates('Ashley,,,Shane')).toEqual(['Ashley', 'Shane']);
  });

  it('rejects fragments > 120 chars (likely parse error)', () => {
    const longName = 'A'.repeat(130);
    expect(extractComposerCandidates(longName)).toEqual([]);
    expect(extractComposerCandidates(`Real Name, ${longName}`)).toEqual(['Real Name']);
  });

  it('preserves hyphenated single names (does not split on hyphen)', () => {
    expect(extractComposerCandidates('Jean-Baptiste Lully')).toEqual(['Jean-Baptiste Lully']);
  });
});

describe('IntelligenceAccumulator.recordAppleComposerCredit (M-Z13)', () => {
  it('accumulates credits and includes them in build() output', () => {
    const intel = new IntelligenceAccumulator();
    intel.recordAppleComposerCredit({
      track_id: 'apple_isrc_USABC1234567',
      track_name: 'Example Song',
      primary_artist_id: '907166363',
      primary_artist_name: 'Lainey Wilson',
      composer_names: ['Ashley Gorley', 'Hillary Lindsey'],
      source: 'apple_composer_field',
      release_date: '2026-04-19',
    });
    intel.recordAppleComposerCredit({
      track_id: 'apple_isrc_USXYZ9876543',
      track_name: 'Another Song',
      primary_artist_id: '2715720',
      primary_artist_name: 'Miranda Lambert',
      composer_names: ['Natalie Hemby'],
      source: 'apple_composer_field',
      release_date: '2026-04-18',
    });
    const artifact = intel.build({
      scan_week: '2026-04-19',
      scanner: 'nmf_weekly_cron',
      scope: { universe_source: 'seed', artists_input: 2, artists_with_releases: 2, tracks_found: 2 },
    });
    expect(artifact.composer_credits).toHaveLength(2);
    expect(artifact.composer_credits[0].composer_names).toEqual(['Ashley Gorley', 'Hillary Lindsey']);
    expect(artifact.composer_credits[1].primary_artist_name).toBe('Miranda Lambert');
  });

  it('build() emits empty composer_credits array when none recorded', () => {
    const intel = new IntelligenceAccumulator();
    const artifact = intel.build({
      scan_week: '2026-04-19',
      scanner: 'nmf_weekly_cron',
      scope: { universe_source: 'seed', artists_input: 0, artists_with_releases: 0, tracks_found: 0 },
    });
    expect(artifact.composer_credits).toEqual([]);
  });
});
