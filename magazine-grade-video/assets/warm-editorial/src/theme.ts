export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1440;

export const COLORS = {
  cream: '#FAF9F5',
  ink: '#141413',
  coral: '#CC785C',
  tile: '#EFE9DE',
  tile2: '#ECE3D4',
  hairline: 'rgba(20, 20, 19, 0.14)',
  hairlineSoft: 'rgba(20, 20, 19, 0.08)',
} as const;

export const FONTS = {
  serif: '"Noto Serif SC", serif',
  sans: '"Noto Sans SC", sans-serif',
  mono: '"JetBrains Mono", monospace',
} as const;

export const ML = 56;
export const MR = 56;
export const CONTENT_W = WIDTH - ML - MR;

export const VIDEO_W = CONTENT_W;
export const VIDEO_H = Math.round((VIDEO_W * 9) / 16);

export const PAGE_INSET = 22;
export const HEADER_TOP = 60;
export const VIDEO_CARD_TOP = 196;
export const SECTION_LABEL_TOP = 772;

export const LYRIC_TOP = 820;
export const LYRIC_H = 556;
export const LYRIC_ANCHOR = LYRIC_TOP + LYRIC_H / 2;

export const LYRIC_ACTIVE_SIZE = 31;
export const LYRIC_ACTIVE_LH = 46;
export const LYRIC_IDLE_SIZE = 24;
export const LYRIC_BLOCK_GAP = 26;

export const CHARS_PER_LINE_ACTIVE = Math.floor(CONTENT_W / (LYRIC_ACTIVE_SIZE * 1.02));
