import { describe, it, expect } from 'vitest';

/**
 * Tests for ground truth verification logic.
 * Verifies the categorization of handles based on Apify Instagram profile data.
 */

const MUSIC_KEYWORDS = [
  'musician', 'songwriter', 'singer', 'artist', 'producer', 'band',
  'music', 'nashville', 'country', 'records', 'recording', 'album',
  'tour', 'concert', 'guitar', 'songs', 'writer', 'performer',
  'americana', 'christian', 'worship', 'gospel', 'bluegrass', 'folk',
  'mgmt', 'management', 'booking', 'label', 'publishing', 'bmi', 'ascap',
  'sesac', 'opry', 'cma', 'acm', 'grammy', 'dove', 'ryman',
  'singer-songwriter', 'new music', 'out now', 'debut', 'single',
];

function bioMatchesMusic(bio: string): boolean {
  if (!bio) return false;
  const lower = bio.toLowerCase();
  return MUSIC_KEYWORDS.some(kw => lower.includes(kw));
}

type Label = 'confirmed' | 'likely' | 'unverified' | 'rejected';

function categorize(profile: { biography?: string; followersCount?: number; isVerified?: boolean } | null): Label {
  if (!profile) return 'rejected';
  const bio = profile.biography || '';
  const bioMatch = bioMatchesMusic(bio);
  const hasFollowers = (profile.followersCount || 0) > 100;
  const isVerified = profile.isVerified || false;
  if (isVerified && bioMatch) return 'confirmed';
  if (bioMatch && hasFollowers) return 'confirmed';
  if (bioMatch) return 'likely';
  if (hasFollowers) return 'unverified';
  return 'unverified';
}

describe('ground truth verification categorization', () => {
  it('confirmed: verified badge + music bio', () => {
    expect(categorize({ biography: 'Nashville songwriter', followersCount: 50000, isVerified: true })).toBe('confirmed');
  });

  it('confirmed: music bio + followers > 100', () => {
    expect(categorize({ biography: 'Country music artist, new album out now', followersCount: 500 })).toBe('confirmed');
  });

  it('likely: music bio but low followers', () => {
    expect(categorize({ biography: 'Nashville singer-songwriter', followersCount: 50 })).toBe('likely');
  });

  it('unverified: followers but no music keywords', () => {
    expect(categorize({ biography: 'Living my best life in Tennessee', followersCount: 5000 })).toBe('unverified');
  });

  it('unverified: no bio, no followers', () => {
    expect(categorize({ biography: '', followersCount: 0 })).toBe('unverified');
  });

  it('rejected: profile is null (handle does not exist)', () => {
    expect(categorize(null)).toBe('rejected');
  });

  it('handles batch categorization correctly', () => {
    const batch = [
      { biography: 'Country artist on tour', followersCount: 10000, isVerified: true },
      { biography: 'Dentist in Ohio', followersCount: 200 },
      null,
      { biography: 'Nashville songwriter', followersCount: 50 },
      { biography: 'Opry performer', followersCount: 3000 },
    ];
    const results = batch.map(categorize);
    expect(results).toEqual(['confirmed', 'unverified', 'rejected', 'likely', 'confirmed']);
    expect(results.filter(r => r === 'confirmed').length).toBe(2);
    expect(results.filter(r => r === 'rejected').length).toBe(1);
    expect(results.filter(r => r === 'likely').length).toBe(1);
    expect(results.filter(r => r === 'unverified').length).toBe(1);
  });
});

describe('bioMatchesMusic', () => {
  it('matches Nashville', () => expect(bioMatchesMusic('Nashville, TN')).toBe(true));
  it('matches songwriter', () => expect(bioMatchesMusic('I am a songwriter')).toBe(true));
  it('matches Opry', () => expect(bioMatchesMusic('Grand Ole Opry member')).toBe(true));
  it('matches CMA', () => expect(bioMatchesMusic('CMA nominee 2025')).toBe(true));
  it('matches out now', () => expect(bioMatchesMusic('New single out now!')).toBe(true));
  it('does not match generic bio', () => expect(bioMatchesMusic('Dog lover, coffee addict')).toBe(false));
  it('does not match empty', () => expect(bioMatchesMusic('')).toBe(false));
  it('case insensitive', () => expect(bioMatchesMusic('NASHVILLE SONGWRITER')).toBe(true));
});
