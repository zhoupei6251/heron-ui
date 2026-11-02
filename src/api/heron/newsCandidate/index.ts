import type { NewsWork } from '@/api/heron/newsWork/types';
import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';
import type { NewsCandidate, NewsCandidateForm, NewsCandidateQuery } from './types';

export const listNewsCandidate = (query: NewsCandidateQuery): AxiosPromise<PageResult<NewsCandidate>> => {
  return request({
    url: '/heron/newsCandidate/list',
    method: 'get',
    params: query
  });
};

export const getNewsCandidate = (candidateId: string): AxiosPromise<NewsCandidate> => {
  return request({
    url: '/heron/newsCandidate/' + candidateId,
    method: 'get'
  });
};

export const addNewsCandidate = (data: NewsCandidateForm): AxiosPromise<NewsCandidate> => {
  return request({
    url: '/heron/newsCandidate/manual',
    method: 'post',
    data
  });
};

/** 认领是同用户可重放的持久操作，返回新建或已存在的新闻作品。 */
export const claimNewsCandidate = (candidateId: string): AxiosPromise<NewsWork> => {
  return request({
    url: '/heron/newsCandidate/' + candidateId + '/claim',
    method: 'post'
  });
};
