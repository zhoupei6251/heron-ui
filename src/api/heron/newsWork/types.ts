import type { ProductionFile, ProductionStatus, ProductionTask } from '@/api/heron/production/types';

export type NewsReviewStatus = 'pending' | 'approved' | 'rejected';

/** 发布来源必须区分开：v1 只有人工回填，接开放平台后才有 api，历史数据口径靠它判断。 */
export type NewsPublishSource = 'manual' | 'api' | 'douyin-cli' | 'sandbox';

export interface NewsPublishAttempt {
  attemptId: string;
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

export interface NewsVideoVersion {
  versionId: string;
  workId: string;
  ownerId?: string | number;
  versionNo: number;
  taskId?: string;
  script?: string;
  checks?: string;
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

export interface NewsWork {
  workId: string;
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
