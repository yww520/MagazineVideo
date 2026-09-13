const longestSuffixPrefix = (a: string, b: string) => {
  const max = Math.min(a.length, b.length);
  for (let n = max; n >= 4; n--) {
    if (a.endsWith(b.slice(0, n))) return n;
  }
  return 0;
};

const longestCommonPrefix = (a: string, b: string) => {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i += 1;
  return i;
};

/** Drop the already-shown YouTube rolling prefix, including 1–3 char tail revisions. */
export const stripRollingPrefix = (prev: string, text: string) => {
  if (!prev || !text || prev === text) return text;
  if (text.startsWith(prev)) return text.slice(prev.length) || text;

  const overlap = longestSuffixPrefix(prev, text);
  if (overlap >= 4) return text.slice(overlap) || text;

  const lcp = longestCommonPrefix(prev, text);
  if (lcp >= 8 && text.length > lcp) return text.slice(lcp);
  if (lcp >= 6 && prev.length - lcp <= 3 && text.length > lcp) return text.slice(lcp);
  return text;
};
