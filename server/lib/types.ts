export type CaptionSource = 'manual' | 'auto' | 'none';

export type PageChapter = {
  title: string;
  startSec: number;
  endSec: number;
};

export type Segment = {
  title: string;
  startSec: number;
  endSec: number;
  body: string;
};

export type Analysis = {
  originalTitle: string;
  titleZh: string;
  channel: string;
  durationSec: number;
  description: string;
  promoLinks: string[];
  pageChapters: PageChapter[];
  hasPageChapters: boolean;
  summary: string;
  segments: Segment[];
  takeaway: string;
  captions: CaptionSource;
  captionWarning?: string;
};

export type Masthead = {
  title: string;
  kicker: string;
  source: string;
  footerRight: string;
};

export type StyleId = 'warm-editorial' | 'ink-zine';

export type Selection =
  | { type: 'full' }
  | { type: 'segments'; ids: number[] };

export type Production = {
  id: string;
  slug: string;
  compName: string;
  videoPath: string;
  selection: Selection;
  masthead: Masthead;
  style: StyleId;
  createdAt: number;
};

export type JobStatus =
  | 'queued'
  | 'analyzing'
  | 'ready'
  | 'producing'
  | 'done'
  | 'error';

export type ProgressEvent = {
  type: 'progress' | 'ready' | 'done' | 'error';
  stage?: string;
  message: string;
  percent?: number;
  analysis?: Analysis;
  at: number;
};

export type Job = {
  id: string;
  url: string;
  videoKey?: string;
  status: JobStatus;
  stage: string;
  message: string;
  percent?: number;
  analysis?: Analysis;
  masthead?: Masthead;
  style?: StyleId;
  selection?: Selection;
  slug?: string;
  compName?: string;
  videoPath?: string;
  sourceVideoPath?: string;
  sourceSrtPath?: string;
  productions?: Production[];
  error?: string;
  events: ProgressEvent[];
  createdAt: number;
  updatedAt: number;
};

export type LibraryCard = {
  id: string;
  url: string;
  videoKey: string;
  titleZh: string;
  originalTitle: string;
  channel: string;
  durationSec: number;
  summary: string;
  status: JobStatus;
  producedCount: number;
  hasThumb: boolean;
  hasSource: boolean;
  updatedAt: number;
};

export type PreviewMeta = {
  title: string;
  channel: string;
  durationSec: number;
  description: string;
  webpageUrl: string;
  thumbnailUrl: string | null;
  chapters: PageChapter[];
  origLang: string;
  captions: CaptionSource;
  captionLang: string | null;
  thumbPath: string | null;
  srtPath: string | null;
};
