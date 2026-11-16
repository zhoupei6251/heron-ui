import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';
import type { ContentDecision, ContentDecisionQuery } from './types';

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
