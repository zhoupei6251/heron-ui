import type { ProductionFile, ProductionStatus, ProductionTask } from '@/api/heron/production/types';

export type NewsReviewStatus = 'pending' | 'approved' | 'rejected';

/** 发布来源必须区分开：v1 只有人工回填，接开放平台后才有 api，历史数据口径靠它判断。 */
export type NewsPublishSource = 'manual' | 'api' | 'douyin-cli' | 'sandbox';

export interface NewsPublishAttempt {
  id: string;
  versionId: string;
  videoSha: string;
  source: string;
  account?: string;
  status: 'started' | 'unknown' | 'submitted' | 'published' | 'not_published';
  startedAt?: string;
  updatedAt?: string;
  failureCode?: string;
  resolvedBy?: string | number;
  resolvedAt?: string;
  resolutionReason?: string;
}

export interface NewsPublishReceipt {
  workUrl: string;
  account: string;
  publishedAt: string;
  videoSha256: string;
}

export interface NewsPublishResolution {
  decision: 'published' | 'not_published';
  videoSha256: string;
  reason: string;
  uploadStopped: boolean;
  receipt?: NewsPublishReceipt;
}

export interface NewsWorkQuery extends PageQuery {
  title?: string;
  candidateId?: string;
}

/**
 * AI 审稿记录，形状与后端 EditorialReviewer.Verdict#toRecord 一致。
 * 后端 editorialReview 字段就是这个 JSON 的字符串形式。
 */
export interface NewsEditorialReview {
  schemaVersion?: string;
  result?: 'PASS' | 'FAIL' | string;
  /** 核心断言能否被证据支持；解说线才有，数据看板线的事实由 Java 给。 */
  coreFacts?: 'supported' | 'unverifiable' | 'unsupported' | string;
  issues?: {
    severity?: 'BLOCKER' | 'MAJOR' | 'MINOR' | string;
    segmentId?: string;
    description?: string;
    suggestion?: string;
  }[];
  minorSuggestions?: string[];
  repairAttempts?: number;
  promptVersion?: string;
  reviewedAt?: string;
}

export interface NewsVideoVersion {
  id: string;
  workId: string;
  ownerId?: string | number;
  versionNo: number;
  taskId?: string;
  script?: string;
  checks?: string;
  /** AI 审稿结论；自动发布只认这里的 PASS，null 表示没审过。 */
  editorialReview?: string;
  /**
   * 成片级质量审稿报告（L3）的 JSON 字符串，结构见 quality-review/1。
   * 为空表示这条片子没做过 L3 审稿——它不是闸，缺失不阻塞任何流程。
   */
  qualityReport?: string;
  /** 内容属性补充（标题钩子类型、开头结构）的 JSON 字符串；取不到就是没有。 */
  contentProfile?: string;
  /** 冻结输入快照；列表接口不下发（一条含整篇正文），单版本详情才有。 */
  inputSnapshot?: string;
  durationMs?: number;
  reviewStatus: NewsReviewStatus;
  reviewBy?: string | number;
  reviewAt?: string;
  reviewReason?: string;
  reviewContactSha?: string;
  reviewVideoSha?: string;
  publishSource?: NewsPublishSource;
  publishUrl?: string;
  publishAccount?: string;
  publishAt?: string;
  publishBy?: string | number;
  publishVideoSha?: string;
  publishAttempt?: NewsPublishAttempt;
  createTime?: string;
  taskStatus?: ProductionStatus;
  taskErrorCode?: string;
  taskErrorReason?: string;
  artifacts?: ProductionFile[];
  /** 只在审片队列与发布记录里填：跨作品列表需要作品标题。 */
  workTitle?: string;
}

/**
 * 补充评审抽帧：一帧一个 data URL。
 * 帧不落库、不进质量报告，只在审片时给人看画面。
 */
export interface NewsQualityFrame {
  seq: number;
  /** 画面出处：第几段 / 结尾。 */
  label: string;
  /** 抽帧时间点，取自字幕闸实测区间。 */
  atMs: number;
  dataUrl: string;
}

export interface NewsWork {
  id: string;
  candidateId: string;
  ownerId?: string | number;
  title: string;
  draft?: string;
  revision: number;
  templateKey?: string;
  voiceKey?: string;
  currentVersionId?: string;
  activeTaskId?: string;
  currentVersion?: NewsVideoVersion;
  activeTask?: ProductionTask;
  updateTime?: string;
}

export interface NewsDraftForm {
  expectedRevision: number;
  title: string;
  draft: string;
  templateKey: string;
  voiceKey: string;
}

export interface NewsGenerateForm {
  requestKey: string;
  expectedRevision: number;
}

export interface NewsReviewForm {
  decision: 'approved' | 'rejected';
  contactSha256: string;
  videoSha256: string;
  reason?: string;
}
