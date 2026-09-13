import { spawnSync } from 'node:child_process';
import { which } from './shell.js';

const nodeMajor = () => {
  const r = spawnSync('node', ['-v'], { encoding: 'utf8' });
  const m = String(r.stdout || '').match(/v(\d+)/);
  return m ? Number(m[1]) : 0;
};

export const youtubeFlags = (playerClient = 'default,-web_safari') => {
  const flags = ['--no-update', '--no-playlist', '--remote-components', 'ejs:github'];
  if (which('deno')) flags.push('--js-runtimes', 'deno');
  if (which('node') && nodeMajor() >= 22) flags.push('--js-runtimes', 'node');
  flags.push('--extractor-args', `youtube:player_client=${playerClient}`);
  const cookies = process.env.YTDLP_COOKIES;
  if (cookies) flags.push('--cookies', cookies);
  const browser = process.env.YTDLP_COOKIES_FROM_BROWSER;
  if (browser) flags.push('--cookies-from-browser', browser);
  return flags;
};
