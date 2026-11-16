import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';
import type { ContentDecision, ContentDecisionQuery, ResearchCost } from './types';

export const listDecision = (query: ContentDecisionQuery): AxiosPromise<PageResult<ContentDecision>> => {
  return request({ url: '/heron/decision/list', method: 'get', params: query });
};

export const getDecision = (decisionId: string): AxiosPromise<ContentDecision> => {
  return request({ url: '/heron/decision/' + decisionId, method: 'get' });
};

export const acceptDecision = (decisionId: string, note?: string): AxiosPromise<ContentDecision> => {
  return request({ url: '/heron/decision/' + decisionId + '/accept', method: 'post', data: { note } });
};

/** 否决必须带理由：后端会拒绝空理由。 */
export const rejectDecision = (decisionId: string, note: string): AxiosPromise<ContentDecision> => {
  return request({ url: '/heron/decision/' + decisionId + '/reject', method: 'post', data: { note } });
};

/** 采纳并提升为选题候选：两个动作合成一步，只采纳不提升的话判断就停在决策中心没人用。 */
export const promoteDecision = (
  decisionId: string,
  note?: string
): AxiosPromise<{ decisionId: string; candidateId: string }> => {
  return request({ url: '/heron/decision/' + decisionId + '/promote', method: 'post', data: { note } });
};

/** 成本与质量概览。 */
export const getResearchCost = (days?: number): AxiosPromise<ResearchCost> => {
  return request({ url: '/heron/decision/cost', method: 'get', params: { days } });
};
