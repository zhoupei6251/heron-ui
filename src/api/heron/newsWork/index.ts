import type { ProductionReceipt } from '@/api/heron/production/types';
import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';
import type {
  NewsDraftForm,
  NewsGenerateForm,
  NewsReviewForm,
  NewsVideoVersion,
  NewsWork,
  NewsWorkQuery
} from './types';

export const listNewsWork = (query: NewsWorkQuery): AxiosPromise<PageResult<NewsWork>> => {
  return request({ url: '/heron/newsWork/list', method: 'get', params: query });
};

export const getNewsWork = (workId: string): AxiosPromise<NewsWork> => {
  return request({ url: '/heron/newsWork/' + workId, method: 'get' });
};

/** 草稿保存带 expectedRevision：版本冲突由后端拒绝，前端不静默覆盖。 */
export const saveNewsDraft = (workId: string, data: NewsDraftForm): AxiosPromise<NewsWork> => {
  return request({ url: '/heron/newsWork/' + workId + '/draft', method: 'put', data });
};

export const generateNewsVideo = (workId: string, data: NewsGenerateForm): AxiosPromise<ProductionReceipt> => {
  return request({ url: '/heron/newsWork/' + workId + '/generate', method: 'post', data });
};

export const listNewsVersions = (workId: string, query: PageQuery): AxiosPromise<PageResult<NewsVideoVersion>> => {
  return request({ url: '/heron/newsWork/' + workId + '/versions', method: 'get', params: query });
};

export const getNewsVersion = (workId: string, versionId: string): AxiosPromise<NewsVideoVersion> => {
  return request({ url: `/heron/newsWork/${workId}/versions/${versionId}`, method: 'get' });
};

export const reviewNewsVersion = (
  workId: string,
  versionId: string,
  data: NewsReviewForm
): AxiosPromise<NewsVideoVersion> => {
  return request({ url: `/heron/newsWork/${workId}/versions/${versionId}/review`, method: 'post', data });
};

/**
 * 审片预览要带登录头，普通 <img>/<video> 直链拿不到令牌；这里取回 blob 交给 createObjectURL。
 * 拦截器对 blob 直接返回 res.data，所以运行时拿到的就是 Blob。
 */
export const fetchNewsPreview = (workId: string, versionId: string, artifactId: string): Promise<Blob> => {
  return request({
    url: `/heron/newsWork/${workId}/versions/${versionId}/preview/${artifactId}`,
    method: 'get',
    responseType: 'blob'
  }) as unknown as Promise<Blob>;
};
