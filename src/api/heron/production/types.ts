export type ProductionBizType = 'news_video' | 'prototype';

export type ProductionStatus = 'queued' | 'running' | 'cancelling' | 'succeeded' | 'failed' | 'cancelled';

export interface ProductionTaskQuery extends PageQuery {
  bizType?: ProductionBizType | '';
  status?: ProductionStatus | '';
  bizId?: string;
}

export interface ProductionFile {
  artifactId: string;
  kind: string;
  bytes: number;
  sha256: string;
  mediaType: string;
  available: boolean;
}

export interface ProductionStep {
  stage: string;
  status: string;
  startedAt?: string;
  finishedAt?: string;
  errorCode?: string;
  errorReason?: string;
  evidence?: ProductionFile[];
}

export interface ProductionUsage {
  provider?: string;
  model?: string;
  status: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
  elapsedMs?: number | null;
}

export interface ProductionTask {
  taskId: string;
  bizType: ProductionBizType;
  bizId: string;
  versionId?: string;
  status: ProductionStatus;
  stage?: string;
  progress?: number;
  attemptNo?: number;
  startedAt?: string;
  finishedAt?: string;
  errorCode?: string;
  errorReason?: string;
  steps?: ProductionStep[];
  usage?: ProductionUsage[];
  artifacts?: ProductionFile[];
}

/** 生成受理回执：任务已入队，产物与状态由任务中心跟踪。 */
export interface ProductionReceipt {
  taskId: string;
  bizType: ProductionBizType;
  bizId: string;
  versionId: string;
  status: ProductionStatus;
}

export interface ProductionCapability {
  configured: boolean;
  available: boolean;
  reasons: string[];
  capacity: number;
}

export interface ProductionCapabilities {
  news: ProductionCapability;
  prototype: ProductionCapability;
}
