export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1440;

export const COLORS = {
  green: '#0E1D18',
  greenLight: '#1A2A20',
  greenDeep: '#0A1410',
  oat: '#F7E9D7',
  coral: '#D9776A',
} as const;

export const FONTS = {
  serif: '"Songti SC", "Noto Serif SC", serif',
  display: '"Playfair Display", serif',
} as const;

export const ML = 56;
export const MR = 56;
export const CONTENT_W = WIDTH - ML - MR;

export const VIDEO_W = 900;
export const VIDEO_H = Math.round((VIDEO_W * 9) / 16);
export const VIDEO_TOP = 256;
export const VIDEO_LEFT = (WIDTH - VIDEO_W) / 2;

export const LYRIC_TOP = 800;
export const LYRIC_H = 500;
export const LYRIC_ANCHOR = LYRIC_TOP + LYRIC_H / 2;
export const LYRIC_ACTIVE_SIZE = 32;
export const LYRIC_ACTIVE_LH = 48;
export const LYRIC_IDLE_SIZE = 26;
export const LYRIC_BLOCK_GAP = 20;
export const CHARS_PER_LINE = Math.floor(VIDEO_W / (LYRIC_ACTIVE_SIZE * 1.05));
