// Create a Magazine-Grade Video instance and ensure the Remotion shell is linked.
// Usage:
//   node skills/magazine-grade-video/scripts/scaffold.mjs --slug my-clip --comp MyClip
//   node skills/magazine-grade-video/scripts/scaffold.mjs --slug my-clip --comp MyClip --style ink-zine
import { existsSync, lstatSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const skillRoot = resolve(__dirname, '..');
const assetsRoot = resolve(skillRoot, 'assets');

const STYLES = {
  'warm-editorial': {
    id: 'warm-editorial',
    zh: '暖奶油编辑风',
    en: 'Warm Cream Editorial',
  },
  'ink-zine': {
    id: 'ink-zine',
    zh: '墨绿刊印冷感风',
    en: 'Cool Ink Letterpress',
  },
};

const STYLE_ALIASES = {
  'warm-editorial': 'warm-editorial',
  warm: 'warm-editorial',
  editorial: 'warm-editorial',
  cream: 'warm-editorial',
  'warm-cream-editorial': 'warm-editorial',
  暖编辑: 'warm-editorial',
  暖奶油编辑风: 'warm-editorial',
  'ink-zine': 'ink-zine',
  ink: 'ink-zine',
  zine: 'ink-zine',
  retro: 'ink-zine',
  letterpress: 'ink-zine',
  'cool-ink-letterpress': 'ink-zine',
  沉浸复古: 'ink-zine',
  墨绿刊印冷感风: 'ink-zine',
};

const DEFAULT_STYLE = 'warm-editorial';

const findWorkspace = (start) => {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, 'package.json')) && existsSync(join(dir, 'videos'))) return dir;
    dir = resolve(dir, '..');
  }
  throw new Error('Could not find Remotion workspace (package.json + videos/)');
};

const arg = (name) => {
  const i = process.argv.indexOf(name);
  if (i === -1 || !process.argv[i + 1]) return null;
  return process.argv[i + 1];
};

const slug = arg('--slug');
const comp = arg('--comp');
if (!slug || !comp) {
  console.error(
    'Usage: node scaffold.mjs --slug kebab-name --comp PascalName [--style warm-editorial|ink-zine]',
  );
  process.exit(1);
}

const styleRaw = (arg('--style') ?? DEFAULT_STYLE).trim();
const styleId = STYLE_ALIASES[styleRaw];
if (!styleId) {
  console.error('Unknown style: ' + styleRaw);
  console.error('Use --style warm-editorial (暖奶油编辑风) or --style ink-zine (墨绿刊印冷感风)');
  process.exit(1);
}
const style = STYLES[styleId];

const workspace = findWorkspace(skillRoot);
const shellLink = resolve(workspace, 'videos', '_lyric-player');

const ensureShell = () => {
  if (existsSync(shellLink)) {
    const stat = lstatSync(shellLink);
    if (stat.isSymbolicLink()) return;
    rmSync(shellLink, { recursive: true, force: true });
  }
  const rel = relative(dirname(shellLink), assetsRoot);
  symlinkSync(rel, shellLink);
  console.log('Linked videos/_lyric-player -> ' + rel);
};

ensureShell();

const root = resolve(workspace, 'videos', slug);
if (existsSync(root)) throw new Error('Project already exists: ' + root);

mkdirSync(join(root, 'public'), { recursive: true });
mkdirSync(join(root, 'src'), { recursive: true });

const shell = `../../_lyric-player/${style.id}/src`;

const content = `import type { LyricContent } from '../../_lyric-player/src/types';

export const content: LyricContent = {
  compName: '${comp}',
  kicker: '',
  source: '',
  title: '',
  footerRight: '',
  videoFile: 'media.mp4',
  durationSec: 1,
};
`;

const highlights = `import type { Highlights } from '../../_lyric-player/src/types';

export const HIGHLIGHTS: Highlights = {};
`;

const main = `import React from 'react';
import { LyricPlayer } from '${shell}/LyricPlayer';
import { content } from './content';
import { HIGHLIGHTS } from './highlights';
import { CUES as zhCues } from './subtitles';
import { CUES as enCues } from './en-subtitles';

export const Main: React.FC = () => (
  <LyricPlayer content={content} zhCues={zhCues} enCues={enCues} highlights={HIGHLIGHTS} />
);
`;

const rootTsx = `import React from 'react';
import { Composition } from 'remotion';
import { loadFonts } from '${shell}/loadFonts';
import { FPS, HEIGHT, WIDTH } from '${shell}/theme';
import { content } from './content';
import { Main } from './Main';

loadFonts();

export const RemotionRoot: React.FC = () => (
  <Composition
    id={content.compName}
    component={Main}
    durationInFrames={Math.round(content.durationSec * FPS)}
    fps={FPS}
    width={WIDTH}
    height={HEIGHT}
  />
);
`;

const index = `import { registerRoot } from 'remotion';
import { RemotionRoot } from './Root';

registerRoot(RemotionRoot);
`;

writeFileSync(join(root, 'src/content.ts'), content);
writeFileSync(join(root, 'src/highlights.ts'), highlights);
writeFileSync(join(root, 'src/Main.tsx'), main);
writeFileSync(join(root, 'src/Root.tsx'), rootTsx);
writeFileSync(join(root, 'src/index.ts'), index);

console.log('Scaffolded ' + root);
console.log('Style: ' + style.zh + ' / ' + style.en + ' (' + style.id + ')');
console.log('Next: copy media.mp4 into public/, then run parse-srt.mjs');
