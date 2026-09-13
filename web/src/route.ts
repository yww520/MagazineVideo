import type { Route } from './types';

export const parseHash = (hash = window.location.hash): Route => {
  const path = hash.replace(/^#/, '') || '/';
  const parts = path.split('/').filter(Boolean);
  if (parts[0] === 'v' && parts[1]) {
    const view = parts[2];
    if (view === 'wrap') return { page: 'video', jobId: parts[1], view: 'wrap' };
    if (view === 'make') return { page: 'video', jobId: parts[1], view: 'producing' };
    if (view === 'analyzing') return { page: 'video', jobId: parts[1], view: 'analyzing' };
    return { page: 'video', jobId: parts[1], view: 'brief' };
  }
  return { page: 'home' };
};

export const toHash = (route: Route) => {
  if (route.page === 'home') return '#/';
  if (route.view === 'wrap') return `#/v/${route.jobId}/wrap`;
  if (route.view === 'producing') return `#/v/${route.jobId}/make`;
  if (route.view === 'analyzing') return `#/v/${route.jobId}/analyzing`;
  return `#/v/${route.jobId}`;
};

export const go = (route: Route) => {
  const next = toHash(route);
  if (window.location.hash !== next) window.location.hash = next;
};
