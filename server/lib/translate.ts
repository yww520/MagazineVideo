import { readFileSync, writeFileSync } from 'node:fs';
import { chatJson } from './llm.js';
import { collapseRollingEnglish, isMostlyChinese, parseSrt, writeSrt } from './srt.js';
import { logInfo, logOk } from './log.js';

const BATCH = 25;

type RawTranslation = {
  items?: { id?: number; zh?: string; text?: string; translation?: string }[];
  translations?: string[];
};

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

    let chunkResult: string[] = [];
    try {
      const raw = await chatJson<RawTranslation | string[]>([
        {
          role: 'system',
          content:
            '你是专业字幕译者。一条对一条精准翻译成简体中文。绝不要合并或遗漏任何条目。必须输出 JSON 格式：{"items": [{"id": 1, "zh": "中文翻译"}, ...]}，id 从 1 到 N 严格对应。',
        },
        {
          role: 'user',
          content: `把下面 ${chunk.length} 条字幕按顺序译成中文。输出 {"items":[{"id":1,"zh":"..."},...]}，条数必须严格等于 ${chunk.length}。\n\n${chunk
            .map((c, idx) => `${idx + 1}. ${c.text}`)
            .join('\n')}`,
        },
      ], { label: `翻译字幕 ${batchNo}/${batches}` });

      const mapped = new Array<string>(chunk.length).fill('');

      if (Array.isArray(raw)) {
        for (let k = 0; k < Math.min(chunk.length, raw.length); k++) {
          mapped[k] = String(raw[k] || '').trim();
        }
      } else if (raw && typeof raw === 'object') {
        if (Array.isArray(raw.items) && raw.items.length > 0) {
          for (const item of raw.items) {
            const idx = typeof item.id === 'number' ? item.id - 1 : -1;
            const text = String(item.zh || item.translation || item.text || '').trim();
            if (idx >= 0 && idx < chunk.length) {
              mapped[idx] = text;
            }
          }
          let nextEmpty = 0;
          for (const item of raw.items) {
            if (typeof item.id !== 'number' || item.id < 1 || item.id > chunk.length) {
              while (nextEmpty < chunk.length && mapped[nextEmpty]) nextEmpty++;
              if (nextEmpty < chunk.length) {
                mapped[nextEmpty] = String(item.zh || item.translation || item.text || '').trim();
              }
            }
          }
        } else if (Array.isArray(raw.translations)) {
          for (let k = 0; k < Math.min(chunk.length, raw.translations.length); k++) {
            mapped[k] = String(raw.translations[k] || '').trim();
          }
        }
      }

      let missing = 0;
      for (let k = 0; k < chunk.length; k++) {
        if (!mapped[k]) {
          mapped[k] = chunk[k].text || '…';
          missing++;
        }
      }

      if (missing > 0) {
        logInfo('translate', `第 ${batchNo}/${batches} 批字幕有 ${missing} 条由模型漏译，已自动对齐填充以保证音画同步`);
      }

      chunkResult = mapped;
    } catch (err) {
      logInfo('translate', `第 ${batchNo}/${batches} 批字幕翻译解析异常，回退使用原文字幕`, { error: (err as Error).message });
      chunkResult = chunk.map((c) => c.text);
    }

    translated.push(...chunkResult);
  }

  writeFileSync(
    zhPath,
    writeSrt(cues.map((c, i) => ({ ...c, text: translated[i] || c.text }))),
    'utf8',
  );
  onProgress?.('中文字幕翻译完成', 100);
};

