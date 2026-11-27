export interface PublishInventoryQuery {
  pageNum?: number;
  pageSize?: number;
  /** 评估状态；缺省只看合格 */
  curationStatus?: string;
  publishStatus?: string;
  bizLine?: string;
  workId?: string | number;
}

export interface ScoreItem {
  score: number;
  note: string;
}

export interface PublishInventory {
  id: string;
  versionId: string;
  workId: string;
  candidateId?: string | null;
  bizLine: string;
  durationMs: number;
  curationStatus: string;
  publishStatus: string;
  priorityScore?: number | null;
  scoreBreakdown?: string | null;
  curationReason?: string | null;
  curatorVersion?: string | null;
  evaluatedAt?: string | null;
  expiresAt?: string | null;
  reservedAt?: string | null;
  coverUrl?: string | null;
}

export interface PublishReservation {
  inventoryId: string;
  workId: string;
  versionId: string;
  bizLine: string;
}
