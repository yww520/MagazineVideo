import { logFail, logInfo, logOk } from './log.js';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type ChatOptions = {
  json?: boolean;
  label?: string;
};

const stripFence = (text: string) =>
  text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

const formatFetchError = (err: unknown) => {
  const e = err as Error & { cause?: { code?: string; message?: string; cause?: { code?: string; message?: string } } };
  const parts = [e.message];
  if (e.cause?.code) parts.push(e.cause.code);
  if (e.cause?.message && e.cause.message !== e.message) parts.push(e.cause.message);
  if (e.cause?.cause?.code) parts.push(e.cause.cause.code);
  if (e.cause?.cause?.message) parts.push(e.cause.cause.message);
  return parts.filter(Boolean).join(' | ');
};

export const llmConfigured = () => Boolean(process.env.LLM_API_KEY);

/**
 * 302.ai OpenAI-compatible chat.
 * 国内默认 https://api.302ai.cn/v1 ；api.302.ai 在部分网络会 DNS 污染导致连不上。
 */
export const chat = async (messages: ChatMessage[], opts: ChatOptions = {}) => {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) throw new Error('未配置 LLM_API_KEY。请在项目根目录 .env 中填写 302.ai 的 API Key。');

  const base = (process.env.LLM_BASE_URL || 'https://api.302ai.cn/v1').replace(/\/$/, '');
  const model = process.env.LLM_MODEL || 'gemini-3.7-flash';
  const url = `${base}/chat/completions`;

  const label = opts.label || 'chat';
  const body: Record<string, unknown> = {
    model,
    messages,
  };

  logInfo('llm', `开始调用 ${label}`, { model, url });

  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const raw = await res.text();
    const ms = Date.now() - started;
    if (!res.ok) throw new Error(`LLM 请求失败 ${res.status}: ${raw.slice(0, 800)}`);
    const data = JSON.parse(raw) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('LLM 返回为空');
    logOk('llm', `${label} 成功`, {
      status: res.status,
      ms,
      chars: content.length,
      tokens: data.usage?.total_tokens,
    });
    return content;
  } catch (err) {
    const message = formatFetchError(err);
    logFail('llm', `${label} 失败`, { error: message, ms: Date.now() - started, url });
    throw new Error(message);
  }
};

export const chatJson = async <T>(messages: ChatMessage[], opts: ChatOptions = {}): Promise<T> => {
  const content = await chat(messages, opts);
  const cleaned = stripFence(content);
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1)) as T;
    throw new Error('LLM 未返回合法 JSON');
  }
};
