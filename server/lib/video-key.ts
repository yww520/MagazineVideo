export const videoKey = (raw: string) => {
  const url = String(raw || '').trim();
  if (!url) return '';
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = u.pathname.split('/').filter(Boolean)[0];
      if (id) return id;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      const v = u.searchParams.get('v');
      if (v) return v;
      const m = u.pathname.match(/\/(?:shorts|live|embed)\/([^/?]+)/);
      if (m?.[1]) return m[1];
    }
  } catch {
    /* use raw */
  }
  return url;
};
