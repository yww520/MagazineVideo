import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const ROOT = join(__dirname, '../..');
export const SKILL_ROOT = join(ROOT, 'magazine-grade-video');
export const VIDEOS_DIR = join(ROOT, 'videos');
export const DATA_DIR = join(ROOT, 'data', 'jobs');
export const EXTRACT_PROMPT = join(ROOT, 'ExtractPrompt.md');

export const jobDir = (id: string) => join(DATA_DIR, id);

export const ensureDir = (dir: string) => {
  mkdirSync(dir, { recursive: true });
  return dir;
};

export const atomicWrite = (path: string, body: string) => {
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, body);
  renameSync(tmp, path);
};
