export interface EditorialRunQuery extends PageQuery {
  status?: string;
  selectedLine?: string;
  /** 日期范围按框架约定放 params，与同项目其它列表页一致。 */
  params?: { beginDate?: string; endDate?: string };
}

/**
 * 一次自动运行。决策字段由后端结构化落库，poolJson 是决策当时的候选概况快照，
 * 前端只解析展示，不回写。
 */
export interface EditorialRun {
  slotDate: string;
  slotTime: string;
  status: 'produced' | 'skipped' | 'failed' | string;
  detail?: string;
  selectedLine?: string;
  editorialIntent?: string;
  decisionReason?: string;
  candidateId?: string;
  poolJson?: string;
  workId?: string;
  workTitle?: string;
  workReviewStatus?: string;
  /** 线内编辑在总编辑定线之后的选择，形状见 EditorialSelection。 */
  selectionJson?: string;
  /** 这份产出的 AI 审稿记录，与自动发布门禁读的是同一份。 */
  reviewJson?: string;
  updateTime?: string;
}

/** selectionJson 的形状，与后端 EditorialSelection 一致。 */
export interface EditorialSelection {
  candidateId?: number;
  dataSourceKey?: string;
  digest?: boolean;
  templateId?: string;
  storyAngle?: string;
  sourceEvidenceIds?: string[];
}

/** reviewJson 的形状，与后端 EditorialReviewer.Verdict#toRecord 一致。 */
export interface EditorialReviewRecord {
  schemaVersion?: string;
  result?: 'PASS' | 'FAIL' | string;
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

/** poolJson 的形状，与后端 EditorialDecisionService.Pools 一致。 */
export interface EditorialPools {
  hotHeadlines?: string[];
  articleCandidates?: string[];
  dataSources?: string[];
  recentPublications?: string[];
}
