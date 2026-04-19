import { describe, it, expect } from 'vitest';
import { splitPerformerCreditString } from '../../api/_scan_intelligence';

// M-Z-W3-2: regression tests against the `\bfeat\.?\b` trailing-boundary bug
// that tripped the M-Z13 composer-credits test. Same lookahead-on-right fix
// as `extractComposerCandidates` but with the wider delimiter set (with, x,
// and) used for performer credits in cron-scan-weekly + cron-scan-daily.

describe('splitPerformerCreditString (M-Z-W3-2)', () => {
  it('returns empty array for null/undefined/empty', () => {
    expect(splitPerformerCreditString(null)).toEqual([]);
    expect(splitPerformerCreditString(undefined)).toEqual([]);
    expect(splitPerformerCreditString('')).toEqual([]);
  });

  it('returns single name when no delimiter present', () => {
    expect(splitPerformerCreditString('Morgan Wallen')).toEqual(['Morgan Wallen']);
  });

  it('splits on comma', () => {
    expect(splitPerformerCreditString('Luke Combs, Chris Stapleton'))
      .toEqual(['Luke Combs', 'Chris Stapleton']);
  });

  it('splits on ampersand', () => {
    expect(splitPerformerCreditString('Jelly Roll & Lainey Wilson'))
      .toEqual(['Jelly Roll', 'Lainey Wilson']);
  });

  // THE BUG — previous regex `\bfeat\.?\b` failed because `.` then space is
  // non-word → non-word (no word boundary). The new lookahead `(?=\s|$|,|&)`
  // matches after the optional dot regardless of whether the `.` is followed
  // by a word-boundary-inducing character.
  it('splits `feat.` with trailing space (regression for \\bfeat\\.?\\b bug)', () => {
    expect(splitPerformerCreditString('Morgan Wallen feat. HARDY'))
      .toEqual(['Morgan Wallen', 'HARDY']);
  });

  it('splits `ft.` with trailing space', () => {
    expect(splitPerformerCreditString('Post Malone ft. Morgan Wallen'))
      .toEqual(['Post Malone', 'Morgan Wallen']);
  });

  it('splits `feat.` followed by comma', () => {
    expect(splitPerformerCreditString('Zach Bryan feat. Kacey Musgraves, Sierra Ferrell'))
      .toEqual(['Zach Bryan', 'Kacey Musgraves', 'Sierra Ferrell']);
  });

  it('splits on `with`', () => {
    expect(splitPerformerCreditString('Jason Aldean with Carrie Underwood'))
      .toEqual(['Jason Aldean', 'Carrie Underwood']);
  });

  it('splits on `x`', () => {
    expect(splitPerformerCreditString('Bailey Zimmerman x Jelly Roll'))
      .toEqual(['Bailey Zimmerman', 'Jelly Roll']);
  });

  it('splits on `and`', () => {
    expect(splitPerformerCreditString('Brothers Osborne and Dierks Bentley'))
      .toEqual(['Brothers Osborne', 'Dierks Bentley']);
  });

  // IMPORTANT: the lookahead must not swallow `featuring` (the `feat` prefix is
  // part of a longer word). Treat this as `featuring` the whole artist name.
  it('does not split on `featuring` (word boundary)', () => {
    // `featuring` as a substring should NOT be split on the `feat` prefix
    // because `featuring` has no space after `feat.?` (it continues with `uring`).
    expect(splitPerformerCreditString('Artist featuring Someone'))
      .toEqual(['Artist featuring Someone']);
  });

  it('mixed delimiters chain correctly', () => {
    expect(splitPerformerCreditString('Ashley McBryde, Carly Pearce & Kelsea Ballerini feat. Lindsay Ell'))
      .toEqual(['Ashley McBryde', 'Carly Pearce', 'Kelsea Ballerini', 'Lindsay Ell']);
  });

  it('trims whitespace from split segments', () => {
    expect(splitPerformerCreditString('  A ,  B  &  C  '))
      .toEqual(['A', 'B', 'C']);
  });

  it('filters empty segments', () => {
    expect(splitPerformerCreditString('A,,B'))
      .toEqual(['A', 'B']);
  });
});
