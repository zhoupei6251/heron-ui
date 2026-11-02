import type { NewsSourceType } from '@/api/heron/newsSource/types';

export interface NewsCandidateQuery extends PageQuery {
  title?: string;
  /** 清空下拉框后是空串，Spring 会绑定成 null，即不按认领状态过滤。 */
  claimed?: boolean | '';
}

export interface NewsCandidate {
  candidateId: string;
  title: string;
  summary: string;
  /** JSON 文本：来源证据条目与截断标记，前端只展示不编辑。 */
  evidence?: string;
  hitCount: number;
  heatScore: number;
  bestRank?: number;
  firstSeenAt?: string;
  lastSeenAt?: string;
  claimedBy?: string;
  claimedAt?: string;
  activeTaskId?: string;
  publishedAt?: string;
  sourceType?: NewsSourceType;
}

export interface NewsCandidateForm {
  title: string;
  summary: string;
}
