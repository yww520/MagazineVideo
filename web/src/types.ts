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

export type Selection = { type: 'full' } | { type: 'segments'; ids: number[] };

export type JobStatus = 'queued' | 'analyzing' | 'ready' | 'producing' | 'done' | 'error';

export type ProductionPublic = {
  id: string;
  slug: string;
  compName: string;
  title: string;
  kicker: string;
  source: string;
  style: StyleId;
  selection: Selection;
  createdAt: number;
};

export type JobPublic = {
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
  error?: string;
  hasVideo?: boolean;
  hasThumb?: boolean;
  hasSource?: boolean;
  productions?: ProductionPublic[];
  createdAt?: number;
  updatedAt?: number;
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

export type ProgressEvent = {
  type: 'progress' | 'ready' | 'done' | 'error' | 'snapshot';
  stage?: string;
  message?: string;
  percent?: number;
  analysis?: Analysis;
  job?: JobPublic;
  live?: boolean;
  at: number;
};

export type Route =
  | { page: 'home' }
  | { page: 'video'; jobId: string; view: 'brief' | 'wrap' | 'analyzing' | 'producing' };
