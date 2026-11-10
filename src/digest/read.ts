import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, DigestStatus, NightDigest } from './types.js';

type LogEvent = {
  at: string;
  job: string;
  status: DigestStatus;
  owner: string | null;
  error: string | null;
};

function isStatus(value: unknown): value is DigestStatus {
  return value === 'ok' || value === 'retry' || value === 'fail';
}

function parseLine(line: string): LogEvent | null {
  let raw: unknown;
  try {
    raw = JSON.parse(line);
  } catch {
    return null;
  }
  if (raw === null || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.at !== 'string' || typeof obj.job !== 'string' || !isStatus(obj.status)) {
    return null;
  }
  if (obj.owner !== null && obj.owner !== undefined && typeof obj.owner !== 'string') {
    return null;
  }
  return {
    at: obj.at,
    job: obj.job,
    status: obj.status,
    owner: obj.owner === undefined ? null : (obj.owner as string | null),
    error: typeof obj.error === 'string' ? obj.error : null,
  };
}

/**
 * Read `runs/<night>.jsonl` into one row per job.
 * Null when the file is missing. An empty file yields empty rows.
 */
export function readNight(runsDir: string, night: string): NightDigest | null {
  const path = join(runsDir, `${night}.jsonl`);
  if (!existsSync(path)) return null;

  const text = readFileSync(path, 'utf8');
  const lines = text === '' ? [] : text.split(/\r?\n/);

  const counts = { ok: 0, retry: 0, fail: 0 };
  let badLines = 0;
  const byJob = new Map<
    string,
    {
      owner: string | null;
      runs: number;
      retries: number;
      lastStatus: DigestStatus;
      lastError: string | null;
      firstAt: string;
      lastAt: string;
    }
  >();

  for (const line of lines) {
    if (line === '') continue;
    const event = parseLine(line);
    if (!event) {
      badLines += 1;
      continue;
    }
    counts[event.status] += 1;
    const existing = byJob.get(event.job);
    if (!existing) {
      byJob.set(event.job, {
        owner: event.owner,
        runs: 1,
        retries: event.status === 'retry' ? 1 : 0,
        lastStatus: event.status,
        lastError: event.error,
        firstAt: event.at,
        lastAt: event.at,
      });
      continue;
    }
    existing.runs += 1;
    if (event.status === 'retry') existing.retries += 1;
    if (event.at < existing.firstAt) existing.firstAt = event.at;
    if (event.at >= existing.lastAt) {
      existing.lastAt = event.at;
      existing.lastStatus = event.status;
      existing.lastError = event.error;
      existing.owner = event.owner;
    }
  }

  const rows: DigestRow[] = [...byJob.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([job, row]) => ({ job, ...row }));

  return { night, rows, badLines, counts };
}
