import { closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

export const which = (bin: string) =>
  spawnSync(process.platform === 'win32' ? 'where' : 'which', [bin]).status === 0;

export const requireBin = (bin: string, hint: string) => {
  if (!which(bin)) throw new Error(`${bin} 未找到。${hint}`);
};

// 清理本项目残留的 Remotion Chrome 进程。上一次渲染被中断/超时后，
// chrome-headless-shell 会变成孤儿进程，占着 GPU / 网络 / profile 锁，
// 导致下一次渲染在「连接浏览器」时 25 秒超时。开渲染前先清一遍最稳。
export const killStaleChrome = () => {
  if (process.platform === 'win32') return;
  const pattern = 'MagazineVideo/node_modules/.remotion/chrome-headless-shell';
  try {
    const found = spawnSync('pgrep', ['-f', pattern], { encoding: 'utf8' });
    const pids = (found.stdout || '')
      .split('\n')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0);
    if (!pids.length) return;
    for (const pid of pids) {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        /* already gone */
      }
    }
  } catch {
    /* pgrep 不存在时静默跳过 */
  }
};

export const isPidAlive = (pid: number) => {
  if (!pid || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

export const waitPid = (pid: number) =>
  new Promise<void>((resolve) => {
    const tick = () => {
      if (!isPidAlive(pid)) resolve();
      else setTimeout(tick, 1000);
    };
    tick();
  });

const parsePercent = (line: string) => {
  const m =
    line.match(/(\d+(?:\.\d+)?)\s*%/) ||
    line.match(/Rendered\s+(\d+)\s*\/\s*(\d+)/i);
  if (!m) return null;
  if (m[2]) return Math.round((Number(m[1]) / Number(m[2])) * 100);
  return Math.min(99, Math.round(Number(m[1])));
};

export type SpawnLoggedOptions = {
  cwd?: string;
  onLine?: (line: string, percent: number | null) => void;
  env?: NodeJS.ProcessEnv;
  persist?: { logPath: string; pidPath: string };
};

const feedLines = (
  text: string,
  onLine?: (line: string, percent: number | null) => void,
) => {
  for (const part of text.split(/\r|\n/)) {
    const line = part.trim();
    if (!line) continue;
    onLine?.(line, parsePercent(line));
  }
};

export const spawnLogged = (
  bin: string,
  args: string[],
  opts: SpawnLoggedOptions = {},
): Promise<{ stdout: string; stderr: string }> =>
  new Promise((resolve, reject) => {
    if (opts.persist) {
      mkdirSync(dirname(opts.persist.logPath), { recursive: true });
      const fd = openSync(opts.persist.logPath, 'w');
      const child = spawn(bin, args, {
        cwd: opts.cwd,
        env: { ...process.env, ...opts.env },
        detached: true,
        stdio: ['ignore', fd, fd],
      });
      closeSync(fd);
      if (child.pid) writeFileSync(opts.persist.pidPath, `${child.pid}\n`);
      child.unref();

      let readPos = 0;
      const flushLog = () => {
        if (!existsSync(opts.persist!.logPath)) return '';
        const buf = readFileSync(opts.persist!.logPath);
        if (buf.length <= readPos) return '';
        const text = buf.subarray(readPos).toString('utf8');
        readPos = buf.length;
        feedLines(text, opts.onLine);
        return text;
      };
      const timer = setInterval(flushLog, 800);
      const finish = (code: number | null) => {
        clearInterval(timer);
        const rest = flushLog();
        try {
          if (existsSync(opts.persist!.pidPath)) unlinkSync(opts.persist!.pidPath);
        } catch {
          /* ignore */
        }
        if (code === 0) resolve({ stdout: rest, stderr: '' });
        else {
          const err = existsSync(opts.persist!.logPath)
            ? readFileSync(opts.persist!.logPath, 'utf8').trim().slice(-4000)
            : '';
          reject(new Error(`${bin} 失败 (exit ${code})\n${err}`));
        }
      };
      child.on('error', (err) => {
        clearInterval(timer);
        reject(err);
      });
      child.on('exit', (code) => finish(code));
      return;
    }

    const child = spawn(bin, args, {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env },
    });
    let stdout = '';
    let stderr = '';
    const feed = (chunk: Buffer, kind: 'out' | 'err') => {
      const text = chunk.toString();
      if (kind === 'out') stdout += text;
      else stderr += text;
      feedLines(text, opts.onLine);
    };
    child.stdout.on('data', (c: Buffer) => feed(c, 'out'));
    child.stderr.on('data', (c: Buffer) => feed(c, 'err'));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else {
        const err = (stderr || stdout).trim().slice(-4000);
        reject(new Error(`${bin} 失败 (exit ${code})\n${err}`));
      }
    });
  });

export const runCapture = (bin: string, args: string[], cwd?: string) => {
  const r = spawnSync(bin, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 80 * 1024 * 1024,
  });
  if (r.status !== 0) {
    throw new Error((r.stderr || r.stdout || `${bin} failed`).trim().slice(-4000));
  }
  return r.stdout;
};
