export type ResearchStatus = 'queued' | 'running' | 'cancelling' | 'succeeded' | 'partial' | 'failed' | 'cancelled';

export interface ResearchTaskQuery extends PageQuery {
  opportunityId?: string;
  status?: string;
  decisionType?: string;
  params?: any;
}

/**
 * 一次研究任务。后端 Long 超出 JS 安全整数范围时序列化为字符串，
 * 所以 researchId / opportunityId 都是 string，别当数字算。
 */
export interface ResearchTask {
  id: string;
  researchNo?: string;
  opportunityId: string;
  goal?: string;
  grade?: string;
  status: ResearchStatus;
  decisionType?: string;
  /** BigDecimal 序列化为字符串。 */
  score?: string | null;
  confidence?: string | null;
  rounds?: number | null;
  toolCalls?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  sessionId?: string;
  attemptNo?: number | null;
  resultText?: string;
  /** 结构化研究报告 JSON：结论、要点、风险与依据的数据版本。 */
  reportJson?: string | null;
  /** 证据链 JSON：工具调用轨迹、冻结快照与未经验证的引用。 */
  evidenceJson?: string | null;
  errorCode?: string;
  errorReason?: string;
  createTime?: string;
  updateTime?: string;
}

export interface ResearchTaskForm {
  opportunityId?: string;
  goal?: string;
}
