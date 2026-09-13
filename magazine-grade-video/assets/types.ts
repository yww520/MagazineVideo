export interface Cue {
  /** inclusive start frame at project FPS */
  startFrame: number;
  /** exclusive end frame at project FPS */
  endFrame: number;
  startSec: number;
  endSec: number;
  /** one or more text lines for this cue */
  lines: string[];
}

export interface LyricContent {
  /** Remotion Composition id, PascalCase */
  compName: string;
  /** 页眉左侧：视频原英文名 */
  kicker: string;
  /** 页眉右侧、右对齐：节目名或频道名 */
  source: string;
  /** 主标题，单行中文 */
  title: string;
  /** 页脚：视频地址 */
  footerRight: string;
  /** public/ 下的视频文件名 */
  videoFile: string;
  /** 由 ffprobe 写入，单位秒 */
  durationSec: number;
  /** 墨绿刊印冷感风刊头左侧记号。用户未提供则不填，模板用珊瑚菱形 */
  mark?: string;
  /** 主标题下的副行。用户未提供则不填，模板不渲染 */
  titleLine2?: string;
}

export type Highlights = Record<number, string[]>;
