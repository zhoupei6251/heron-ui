import type { ProductionFile, ProductionStatus, ProductionTask } from '@/api/heron/production/types';

export type ProtoReviewStatus = 'pending' | 'approved' | 'rejected';

/** archived 后端是无条件等值过滤，只能传 0/1，不给「全部」空值。 */
export interface ProtoProjectQuery extends PageQuery {
  name?: string;
  archived: string;
}

export interface ProtoProject {
  projectId: string;
  ownerId?: string | number;
  name: string;
  requirement: string;
  canvas: 'web' | 'mobile';
  themeKey?: string;
  revision: number;
  nextVersion: number;
  currentVersionId?: string;
  activeTaskId?: string;
  activeTask?: ProductionTask;
  archived: string;
  createTime?: string;
  updateTime?: string;
}

export interface ProtoProjectForm {
  projectId?: string;
  name: string;
  requirement: string;
  canvas: 'web' | 'mobile';
  themeKey: string;
  expectedRevision: number;
}

export interface ProtoGenerateForm {
  requestKey: string;
  expectedRevision: number;
}

export interface ProtoReviewForm {
  decision: 'approved' | 'rejected';
  rpSha256: string;
  previewSha256: string;
  reason?: string;
}

/** 五个动作只能由人逐项勾选，后端不会由任务成功推导。 */
export interface ProtoVerificationForm {
  requestKey: string;
  rpSha256: string;
  targetVersion: string;
  opened: boolean;
  edited: boolean;
  saved: boolean;
  reopened: boolean;
  navigationChecked: boolean;
  note?: string;
}

export interface ProtoDeliverForm {
  requestKey: string;
  rpSha256: string;
  previewSha256: string;
}

export interface ProtoNativeVerification {
  verificationId: string;
  requestKey: string;
  actorId: string | number;
  verifiedAt: string;
  rpSha256: string;
  targetVersion: string;
  passed: boolean;
  note?: string;
}

export interface ProtoDelivery {
  actorId: string | number;
  deliveredAt: string;
  rpSha256: string;
  previewSha256: string;
  nativeVerifiedAtDelivery: boolean;
  verificationId?: string;
}

export interface ProtoPageEvidence {
  pageId: string;
  previewArtifactId?: string;
}

export interface ProtoAuditEvidence {
  colorPassed?: boolean;
  fontPassed?: boolean;
  semanticNamePassed?: boolean;
  groupingPassed?: boolean;
  rawAuditArtifactId?: string;
}

/** 固定流水线的校验结果；Boolean 未回填时按未知展示，不当作通过。 */
export interface ProtoManifestEvidence {
  engineCommit?: string;
  pages?: ProtoPageEvidence[];
  rp1PageIds?: string[];
  rp1ArtifactId?: string;
  previewSummaryArtifactId?: string;
  nativeRpArtifactId?: string;
  checkArtifactId?: string;
  structuralOk?: boolean;
  nativeFormatChecked?: boolean;
  sourceRp1Sha256?: string;
  audit?: ProtoAuditEvidence;
}

export interface ProtoInputSnapshot {
  projectId: string;
  versionNo: number;
  revision: number;
  requirement: string;
  canvas: string;
  themeKey: string;
  engineCommit?: string;
  templateManifest?: Record<string, string>;
  supportedWidgets?: string[];
  modelConfigId?: string;
}

export interface ProtoVersion {
  versionId: string;
  projectId: string;
  ownerId?: string | number;
  versionNo: number;
  taskId?: string;
  status?: ProductionStatus;
  errorCode?: string;
  errorReason?: string;
  engineCommit?: string;
  reviewStatus: ProtoReviewStatus;
  reviewBy?: string | number;
  reviewAt?: string;
  reviewReason?: string;
  reviewPreviewSha?: string;
  reviewRpSha?: string;
  createTime?: string;
  input?: ProtoInputSnapshot;
  artifacts?: ProductionFile[];
  audit?: ProtoManifestEvidence;
  nativeVerifications?: ProtoNativeVerification[];
  delivery?: ProtoDelivery;
}
