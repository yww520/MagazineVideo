import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chatJson } from './llm.js';

type CueFile = {
  startFrame: number;
  endFrame: number;
  startSec: number;
  endSec: number;
  lines: string[];
};

const loadCues = (projectDir: string) => {
  const raw = readFileSync(join(projectDir, 'src', 'subtitles.ts'), 'utf8');
  const match = raw.match(/export const CUES: Cue\[\] = (\[[\s\S]*\]);/);
  if (!match) throw new Error('无法读取 subtitles.ts');
  return JSON.parse(match[1]) as CueFile[];
};

export const writeHighlights = async (
  projectDir: string,
  onProgress?: (message: string) => void,
) => {
  const cues = loadCues(projectDir);
  onProgress?.('正在提炼珊瑚高亮…');

  const raw = await chatJson<{ highlights: { index: number; phrase: string }[] }>([
    {
      role: 'system',
      content:
        '你是杂志编辑。只给真正有观点的中文字幕碎片做高亮。必须输出 JSON。',
    },
    {
      role: 'user',
      content: `下面是按时间排列的中文字幕碎片。规则：
- 没有核心观点的碎片不要标
- 每条最多一个短语
- phrase 必须是该条 lines 拼起来后的连续子串
- 不要整条通体涂色
- 不要跨条拼接

返回 {"highlights":[{"index":0,"phrase":"连续子串"}]}

字幕：
${cues
  .map((c, i) => `${i}. ${c.lines.join('')}`)
  .join('\n')}`,
    },
  ], { label: '珊瑚高亮' });

  const map: Record<number, string[]> = {};
  for (const item of raw.highlights || []) {
    const idx = Number(item.index);
    const phrase = String(item.phrase || '').trim();
    if (!Number.isInteger(idx) || idx < 0 || idx >= cues.length || !phrase) continue;
    const hay = cues[idx].lines.join('');
    if (!hay.includes(phrase)) continue;
    if (!map[idx]) map[idx] = [phrase];
  }

  const body = `import type { Highlights } from '../../_lyric-player/src/types';

export const HIGHLIGHTS: Highlights = ${JSON.stringify(map, null, 2)};
`;
  writeFileSync(join(projectDir, 'src', 'highlights.ts'), body, 'utf8');
};
