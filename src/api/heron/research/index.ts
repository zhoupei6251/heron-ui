import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';
import type { ResearchTask, ResearchTaskForm, ResearchTaskQuery } from './types';

export const listResearch = (query: ResearchTaskQuery): AxiosPromise<PageResult<ResearchTask>> => {
  return request({ url: '/heron/research/list', method: 'get', params: query });
};

export const getResearch = (researchId: string): AxiosPromise<ResearchTask> => {
  return request({ url: '/heron/research/' + researchId, method: 'get' });
};

/** 建任务并立刻排上执行；同一机会同一天复用已有任务。 */
export const addResearch = (data: ResearchTaskForm): AxiosPromise<ResearchTask> => {
  return request({ url: '/heron/research', method: 'post', data });
};

/** 重跑已结束的任务：后端先把状态回退到排队，再排上执行。 */
export const rerunResearch = (researchId: string): AxiosPromise<ResearchTask> => {
  return request({ url: '/heron/research/' + researchId + '/rerun', method: 'post' });
};

export const cancelResearch = (researchId: string): AxiosPromise<ResearchTask> => {
  return request({ url: '/heron/research/' + researchId + '/cancel', method: 'post' });
};
