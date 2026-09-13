import { readFileSync, writeFileSync } from 'node:fs';
import { chatJson } from './llm.js';
import { collapseRollingEnglish, isMostlyChinese, parseSrt, writeSrt } from './srt.js';

const BATCH = 50;

export const translateSrt = async (
  origPath: string,
  zhPath: string,
  onProgress?: (message: string, percent?: number) => void,
) => {
  const cues = collapseRollingEnglish(parseSrt(readFileSync(origPath, 'utf8')));
  if (!cues.length) throw new Error('原语字幕为空，无法翻译');

  const sample = cues.slice(0, 20).map((c) => c.text).join('');
  if (isMostlyChinese(sample)) {
    onProgress?.('原语已是中文，跳过翻译', 100);
    writeFileSync(zhPath, writeSrt(cues), 'utf8');
    return;
  }

  const translated: string[] = [];
  const batches = Math.ceil(cues.length / BATCH);
  for (let i = 0; i < cues.length; i += BATCH) {
    const chunk = cues.slice(i, i + BATCH);
    const batchNo = Math.floor(i / BATCH) + 1;
    onProgress?.(`按条翻译中文字幕 ${batchNo}/${batches}`, Math.round((i / cues.length) * 100));
    const raw = await chatJson<{ translations: string[] }>([
      {
        role: 'system',
        content:
          '你是字幕译者。一条对一条翻译成简体中文。不要合并、拆条或改写时间轴。语气词和残片也要照译。只输出 JSON。',
      },
      {
        role: 'user',
        content: `把下面 ${chunk.length} 条字幕按顺序译成中文。返回 {"translations":["..."]}，数组长度必须等于 ${chunk.length}。\n\n${chunk
          .map((c, idx) => `${idx + 1}. ${c.text}`)
          .join('\n')}`,
      },
    ], { label: `翻译字幕 ${batchNo}/${batches}` });
    const list = Array.isArray(raw.translations) ? raw.translations : [];
    if (list.length !== chunk.length) {
      throw new Error(`翻译条数不匹配：期望 ${chunk.length}，得到 ${list.length}`);
    }
    translated.push(...list.map((t) => String(t || '').trim() || '…'));
  }

  writeFileSync(
    zhPath,
    writeSrt(cues.map((c, i) => ({ ...c, text: translated[i] || c.text }))),
    'utf8',
  );
  onProgress?.('中文字幕翻译完成', 100);
};
