import type { JobPublic, LibraryCard, Masthead, ProgressEvent, Selection, StyleId } from './types';

const parse = async <T>(resPromise: Promise<Response>): Promise<T> => {
  const res = await resPromise;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const fromApi = (data as { error?: string }).error;
    if (fromApi) throw new Error(fromApi);
    if (res.status === 500 || res.status === 502 || res.status === 503) {
      throw new Error('本地服务刚重启或暂时中断，请再试一次包装');
    }
    throw new Error(`请求失败 ${res.status}`);
  }
  return data as T;
};

export const listLibrary = () => parse<{ items: LibraryCard[] }>(fetch('/api/library'));

export const analyze = (url: string) =>
  parse<{ jobId: string; job: JobPublic; reused?: boolean }>(
    fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    }),
  );

export const getJob = (id: string) => parse<JobPublic>(fetch(`/api/jobs/${id}`));

export const suggestMasthead = (id: string, selection: Selection) =>
  parse<Masthead>(
    fetch(`/api/jobs/${id}/masthead`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selection }),
    }),
  );

export const produce = (id: string, body: { selection: Selection; masthead: Masthead; style: StyleId }) =>
  parse<{ job: JobPublic }>(
    fetch(`/api/jobs/${id}/produce`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );

export const deleteProduction = (id: string, production: string) =>
  parse<{ job: JobPublic }>(
    fetch(`/api/jobs/${id}/productions/${encodeURIComponent(production)}`, { method: 'DELETE' }),
  );

const prepareShare = (id: string, production: string | undefined, to: 'xhs' | 'dy') =>
  parse<{ ok: boolean; needLogin?: boolean; message: string }>(
    fetch(`/api/jobs/${id}/share/${to}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ production }),
    }),
  );

export const prepareXhs = (id: string, production?: string) => prepareShare(id, production, 'xhs');
export const prepareDy = (id: string, production?: string) => prepareShare(id, production, 'dy');

export const revealFolder = (id: string, production?: string) =>
  parse<{ ok: boolean; path: string }>(
    fetch(`/api/jobs/${id}/reveal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ production }),
    }),
  );

export const videoUrl = (id: string, production?: string, bust?: number) => {
  const q = new URLSearchParams();
  if (production) q.set('production', production);
  if (bust) q.set('t', String(bust));
  const qs = q.toString();
  return qs ? `/api/jobs/${id}/video?${qs}` : `/api/jobs/${id}/video`;
};

export const subscribeJob = (id: string, onEvent: (event: ProgressEvent) => void) => {
  const es = new EventSource(`/api/jobs/${id}/events`);
  let live = false;
  es.onmessage = (msg) => {
    try {
      const event = JSON.parse(msg.data) as ProgressEvent;
      if (event.type === 'snapshot') {
        onEvent(event);
        live = true;
        return;
      }
      onEvent({ ...event, live });
    } catch {
      /* ignore */
    }
  };
  return () => es.close();
};
