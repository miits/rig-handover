import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { readNight } from '../src/digest/read.js';

function appWithRuns(runsDir: string) {
  return createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  });
}

describe('digest routes', () => {
  it('GET /digest/:night returns 200 for a real night', async () => {
    const res = await appWithRuns('runs').request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('digest · 2026-10-28');
    expect(html).toContain('notes/backup');
    expect(html).toContain('digest/render');
    expect(html).toContain('—');
  });

  it('GET /digest/:night returns 404 when the night file is missing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
    const res = await appWithRuns(dir).request('/digest/2026-10-28');
    expect(res.status).toBe(404);
  });

  it('GET /digest/:night renders nothing ran for an empty file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
    writeFileSync(join(dir, '2026-10-28.jsonl'), '');
    const res = await appWithRuns(dir).request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('nothing ran');
  });

  it('GET /digest/:night still renders when a line is bad', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
    writeFileSync(
      join(dir, '2026-10-28.jsonl'),
      [
        '{"at":"2026-10-28T23:00:02+01:00","job":"rig/rotate-logs","status":"ok","owner":"lane-07"}',
        'not-json',
        '',
      ].join('\n'),
    );
    const res = await appWithRuns(dir).request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('rig/rotate-logs');
  });

  it('GET /api/digest/:night matches the page job order', async () => {
    const app = appWithRuns('runs');
    const page = await app.request('/digest/2026-10-28');
    const html = await page.text();
    const json = await (await app.request('/api/digest/2026-10-28')).json();
    const rows = readNight('runs', '2026-10-28')!.rows;
    expect(json).toEqual(rows);
    for (const row of rows) {
      expect(html.indexOf(row.job)).toBeGreaterThan(-1);
    }
    const positions = rows.map((r) => html.indexOf(r.job));
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('GET /api/digest/:night returns 404 when missing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
    mkdirSync(dir, { recursive: true });
    const res = await appWithRuns(dir).request('/api/digest/2099-01-01');
    expect(res.status).toBe(404);
  });
});

describe('board links', () => {
  it('links both nights on disk to a digest that renders', async () => {
    const app = appWithRuns('runs');
    const board = await app.request('/');
    const html = await board.text();
    expect(html).toContain('href="/digest/2026-10-28"');
    expect(html).toContain('href="/digest/2026-10-27"');

    for (const night of ['2026-10-27', '2026-10-28']) {
      const res = await app.request(`/digest/${night}`);
      expect(res.status).toBe(200);
    }
  });
});
