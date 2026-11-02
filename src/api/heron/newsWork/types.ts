import type { ProductionFile, ProductionStatus, ProductionTask } from '@/api/heron/production/types';

export type NewsReviewStatus = 'pending' | 'approved' | 'rejected';

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
  createTime?: string;
  taskStatus?: ProductionStatus;
  artifacts?: ProductionFile[];
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
