export type DecisionType = 'PRODUCE' | 'OBSERVE' | 'REJECT';
export type DecisionStatus = 'proposed' | 'accepted' | 'rejected';

export interface ContentDecisionQuery extends PageQuery {
  opportunityId?: string;
  decisionType?: string;
  status?: string;
  params?: any;
}

/**
 * 内容决策。decisionId / researchId / opportunityId 都是雪花 id，
 * 后端按字符串返回，别当数字算。
 */
export interface ContentDecision {
  decisionId: string;
  researchId: string;
  attemptNo?: number;
  opportunityId?: string | null;
  decisionType: DecisionType;
  confidence?: string | null;
  decisionReason?: string;
  /** 报告里的 data_sha256；为空表示当时没有可绑定的快照。 */
  evidenceRef?: string | null;
  reportVersion?: string;
  promptVersion?: string;
  modelId?: string;
  status: DecisionStatus;
  decidedBy?: string | null;
  decidedAt?: string | null;
  decisionNote?: string | null;
  /** 独立核验员的判定；只对 PRODUCE 跑，其余为空。 */
  verificationVerdict?: VerificationVerdict | string | null;
  verificationReason?: string | null;
  /** 核验员指出的具体冲突，JSON 数组文本。 */
  verificationConflicts?: string | null;
  createTime?: string;
}

export type VerificationVerdict = 'AGREE' | 'DISAGREE' | 'UNCERTAIN';

export interface GradeCost {
  grade: string;
  count: number;
  avgTokens: number;
  succeeded: number;
}

export interface DecisionCount {
  decisionType: string;
  count: number;
  accepted: number;
}

/** 成本与质量概览，给监督工作台用。 */
export interface ResearchCost {
  days: number;
  researchCount: number;
  decidedCount: number;
  inputTokens: number;
  outputTokens: number;
  avgTokens: number;
  toolCalls: number;
  byGrade: GradeCost[];
  byDecision: DecisionCount[];
  verifiedCount: number;
  conflictCount: number;
  acceptedCount: number;
  acceptanceRate: string | null;
}
