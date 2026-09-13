import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Segment } from './types.js';
import { parseSrt, writeSrt, type SrtCue } from './srt.js';
import { spawnLogged } from './shell.js';

export const concatSegments = async (opts: {
  mediaPath: string;
  srtPath: string;
  segments: Pick<Segment, 'startSec' | 'endSec'>[];
  workDir: string;
  onProgress?: (message: string, percent?: number) => void;
}) => {
  const { mediaPath, srtPath, segments, workDir, onProgress } = opts;
  if (!segments.length) {
    return { segmentSrtPaths: [], clipDurations: [] };
  }
  mkdirSync(workDir, { recursive: true });

  const clips: { path: string; start: number; end: number; duration: number }[] = [];
  for (const [i, seg] of segments.entries()) {
    const duration = Math.max(0.2, seg.endSec - seg.startSec);
    const out = join(workDir, `clip_${i}.mp4`);
    onProgress?.(`裁切第 ${i + 1}/${segments.length} 段`, Math.round(((i + 0.2) / segments.length) * 70));
    await spawnLogged('ffmpeg', [
      '-y',
      '-ss',
      String(seg.startSec),
      '-i',
      mediaPath,
      '-t',
      String(duration),
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '18',
      '-c:a',
      'aac',
      '-movflags',
      '+faststart',
      out,
    ]);
    clips.push({ path: out, start: seg.startSec, end: seg.endSec, duration });
  }

  const listFile = join(workDir, 'concat.txt');
  writeFileSync(listFile, clips.map((c) => `file '${c.path.replace(/'/g, "'\\''")}'`).join('\n'));
  const tmpOut = join(workDir, 'media.concat.mp4');
  onProgress?.('正在拼接所选段落…', 80);
  await spawnLogged('ffmpeg', [
    '-y',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    listFile,
    '-c',
    'copy',
    tmpOut,
  ]);

  if (existsSync(mediaPath)) renameSync(mediaPath, join(workDir, `media.full.${Date.now()}.mp4`));
  renameSync(tmpOut, mediaPath);

  const segmentSrtPaths: string[] = [];
  if (existsSync(srtPath)) {
    const cues = parseSrt(readFileSync(srtPath, 'utf8'));
    const next: SrtCue[] = [];
    let offset = 0;
    for (const [i, clip] of clips.entries()) {
      const segmentCues: SrtCue[] = [];
      for (const cue of cues) {
        if (cue.end <= clip.start || cue.start >= clip.end) continue;
        const localStart = Math.max(0, cue.start - clip.start);
        const localEnd = Math.min(clip.duration, cue.end - clip.start);
        if (localEnd <= localStart) continue;
        segmentCues.push({ start: localStart, end: localEnd, text: cue.text });
        next.push({
          start: localStart + offset,
          end: localEnd + offset,
          text: cue.text,
        });
      }
      const segmentSrtPath = join(workDir, `segment_${i}.orig.srt`);
      writeFileSync(segmentSrtPath, writeSrt(segmentCues), 'utf8');
      segmentSrtPaths.push(segmentSrtPath);
      if (!segmentCues.length) {
        writeFileSync(segmentSrtPath, '', 'utf8');
      }
      offset += clip.duration;
    }
    writeFileSync(srtPath, writeSrt(next), 'utf8');
  }
  onProgress?.('段落拼接完成', 100);
  return {
    segmentSrtPaths,
    clipDurations: clips.map((c) => c.duration),
  };
};
