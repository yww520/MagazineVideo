// 绕过在本机会卡死的 remotion CLI，用编程式 API 渲染。
// 用法: node scripts/render-prog.mjs <slug> <compName>
// 进度只打到 stdout（形如 "render 45%"），由调用方（spawnLogged）捕获并解析百分比。
import path from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { bundle } = require('@remotion/bundler');
const { selectComposition, renderMedia } = require('@remotion/renderer');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const slug = process.argv[2];
const compName = process.argv[3];
if (!slug || !compName) {
  console.error('用法: node scripts/render-prog.mjs <slug> <compName>');
  process.exit(1);
}

const videoDir = path.join(ROOT, 'videos', slug);
const entry = path.join(videoDir, 'src', 'index.ts');
const publicDir = path.join(videoDir, 'public');
const outDir = path.join(videoDir, 'dist');
const outFile = path.join(outDir, `${compName}.mp4`);
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const say = (m) => process.stdout.write(m + '\n');

const main = async () => {
  say(`Bundling ${entry}`);
  let lastBundle = -1;
  const serveUrl = await bundle({
    entryPoint: entry,
    publicDir,
    onProgress: (p) => {
      const pct = Math.round(p);
      if (pct !== lastBundle) {
        lastBundle = pct;
        say(`Bundling ${pct} percent`); // 不用 % 号，避免被当成渲染进度
      }
    },
  });
  say('Bundle done, selecting composition');
  const composition = await selectComposition({ serveUrl, id: compName });
  say(
    `Composition ${composition.id} ${composition.width}x${composition.height} frames=${composition.durationInFrames} fps=${composition.fps}`,
  );
  say(`Rendering -> ${outFile}`);
  let lastPct = -1;
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: outFile,
    concurrency: 3,
    overwrite: true,
    imageFormat: 'jpeg',
    onProgress: ({ progress }) => {
      const pct = Math.round(progress * 100);
      if (pct !== lastPct) {
        lastPct = pct;
        say(`render ${pct}%`);
      }
    },
  });
  say(`DONE ${outFile}`);
};

main().catch((err) => {
  console.error(`RENDER ERROR ${err && err.stack ? err.stack : err}`);
  process.exit(1);
});
