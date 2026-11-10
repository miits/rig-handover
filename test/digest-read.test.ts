import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

describe('readNight', () => {
  it('aggregates 2026-10-28 into 5 jobs and counts the bad line', () => {
    const night = readNight('runs', '2026-10-28');
    expect(night).not.toBeNull();
    expect(night!.badLines).toBe(1);
    expect(night!.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(night!.rows).toHaveLength(5);

    const digest = night!.rows.find((r) => r.job === 'digest/render')!;
    expect(digest.owner).toBeNull();
    expect(digest.runs).toBe(1);
    expect(digest.lastStatus).toBe('ok');

    const refresh = night!.rows.find((r) => r.job === 'fixtures/refresh')!;
    expect(refresh.runs).toBe(4);
    expect(refresh.retries).toBe(3);
    expect(refresh.lastStatus).toBe('ok');

    const backup = night!.rows.find((r) => r.job === 'notes/backup')!;
    expect(backup.lastStatus).toBe('fail');
    expect(backup.lastError).toBe('quota exceeded');
  });

  it('returns null when the night file is missing', () => {
    expect(readNight('runs', '2099-01-01')).toBeNull();
  });
});
