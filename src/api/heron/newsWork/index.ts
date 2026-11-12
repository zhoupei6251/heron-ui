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

/** 审片队列：跨作品的待审版本，工作区不再逐个点开才发现要审什么。 */
export const listReviewQueue = (query: PageQuery): AxiosPromise<PageResult<NewsVideoVersion>> => {
  return request({ url: '/heron/newsWork/review/queue', method: 'get', params: query });
};

/** 发布记录：发过的版本，含沙箱与命令行提交。 */
export const listPublishedVersions = (query: PageQuery): AxiosPromise<PageResult<NewsVideoVersion>> => {
  return request({ url: '/heron/newsWork/published', method: 'get', params: query });
};

export const getNewsVersion = (workId: string, versionId: string): AxiosPromise<NewsVideoVersion> => {
  return request({ url: `/heron/newsWork/${workId}/versions/${versionId}`, method: 'get' });
};

/**
 * 一次确认：通过即由发布适配器写入回执，驳回只落审核结论。
 * 手动模式的唯一人工动作，替代原先「先审片再回填」两步。
 * 发布走浏览器自动化时要跑几十秒，超时给足，别让前端先断开而后端还在发。
 */
export const confirmNewsVersion = (
  workId: string,
  versionId: string,
  data: NewsReviewForm
): AxiosPromise<NewsVideoVersion> => {
  return request({
    url: `/heron/newsWork/${workId}/versions/${versionId}/confirm`,
    method: 'post',
    data,
    timeout: 300000
  });
};

/** 命令行发布不回传作品链接，人从抖音后台复制一次补进来；其余发布事实不动。 */
export const backfillNewsPublishUrl = (
  workId: string,
  versionId: string,
  workUrl: string
): AxiosPromise<NewsVideoVersion> => {
  return request({ url: `/heron/newsWork/${workId}/versions/${versionId}/publish-url`, method: 'post', data: { workUrl } });
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
