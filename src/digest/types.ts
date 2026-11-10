export type DigestStatus = 'ok' | 'retry' | 'fail';

export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: DigestStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

export type NightDigest = {
  night: string;
  rows: DigestRow[];
  badLines: number;
  counts: { ok: number; retry: number; fail: number };
};

/** Null when `runs/<night>.jsonl` is missing. An empty file yields empty rows. */
export declare function readNight(runsDir: string, night: string): NightDigest | null;
