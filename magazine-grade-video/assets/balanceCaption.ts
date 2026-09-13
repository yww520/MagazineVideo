/** Split English caption text into two similar-length lines. */
export const balanceCaptionLines = (raw: string): string[] => {
  const text = raw.replace(/\s+/g, ' ').trim();
  if (!text) return [];
  const words = text.split(' ');
  if (words.length <= 1 || text.length <= 34) return [text];

  let bestAt = Math.ceil(words.length / 2);
  let bestScore = Infinity;
  for (let i = 1; i < words.length; i++) {
    const left = words.slice(0, i).join(' ').length;
    const right = words.slice(i).join(' ').length;
    const uneven = Math.abs(left - right);
    const preferFirstNotShorter = left < right ? 1 : 0;
    const score = uneven * 2 + preferFirstNotShorter;
    if (score < bestScore) {
      bestScore = score;
      bestAt = i;
    }
  }
  return [words.slice(0, bestAt).join(' '), words.slice(bestAt).join(' ')];
};
