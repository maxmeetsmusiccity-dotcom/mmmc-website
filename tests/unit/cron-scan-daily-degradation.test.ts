import { describe, it, expect } from 'vitest';
import { shouldAlertOnDegradation } from '../../api/cron-scan-daily';

describe('shouldAlertOnDegradation (M-Z12 daily alert thresholding)', () => {
  it('no alert on clean run', () => {
    const r = shouldAlertOnDegradation(20, 0, 1000, 450);
    expect(r.alert).toBe(false);
  });

  it('no alert at exactly 5% failure rate', () => {
    const r = shouldAlertOnDegradation(20, 1, 1000, 300); // 5.0% — boundary, not >
    expect(r.alert).toBe(false);
  });

  it('alerts above 5% failure rate', () => {
    const r = shouldAlertOnDegradation(20, 2, 1000, 200); // 10%
    expect(r.alert).toBe(true);
    expect(r.reason).toContain('apple_failure_rate');
    expect(r.reason).toContain('10');
  });

  it('alerts on zero tracks when >= 10 artists scanned', () => {
    const r = shouldAlertOnDegradation(4, 0, 200, 0);
    expect(r.alert).toBe(true);
    expect(r.reason).toContain('zero_tracks');
  });

  it('no alert on zero tracks when fewer than 10 artists scanned', () => {
    const r = shouldAlertOnDegradation(1, 0, 5, 0);
    expect(r.alert).toBe(false);
  });

  it('no alert with zero attempted batches', () => {
    const r = shouldAlertOnDegradation(0, 0, 0, 0);
    expect(r.alert).toBe(false);
  });

  it('failure rate alert takes precedence over zero-track alert', () => {
    const r = shouldAlertOnDegradation(20, 5, 1000, 0); // 25% fail AND 0 tracks
    expect(r.alert).toBe(true);
    expect(r.reason).toContain('apple_failure_rate');
  });
});
