import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';
import type { NewsSource, NewsSourceForm, NewsSourceQuery } from './types';

export const listNewsSource = (query: NewsSourceQuery): AxiosPromise<PageResult<NewsSource>> => {
  return request({
    url: '/heron/newsSource/list',
    method: 'get',
    params: query
  });
};

export const getNewsSource = (sourceId: string): AxiosPromise<NewsSource> => {
  return request({
    url: '/heron/newsSource/' + sourceId,
    method: 'get'
  });
};

export const addNewsSource = (data: NewsSourceForm): AxiosPromise<void> => {
  return request({
    url: '/heron/newsSource',
    method: 'post',
    data
  });
};

export const updateNewsSource = (data: NewsSourceForm): AxiosPromise<void> => {
  return request({
    url: '/heron/newsSource',
    method: 'put',
    data
  });
};

export const delNewsSource = (sourceId: string): AxiosPromise<void> => {
  return request({
    url: '/heron/newsSource/' + sourceId,
    method: 'delete'
  });
};

/** 手动采集是后端受控出网，前端只提交已登记来源的 id。 */
export const fetchNewsSource = (sourceId: string): AxiosPromise<void> => {
  return request({
    url: '/heron/newsSource/' + sourceId + '/fetch',
    method: 'post'
  });
};
