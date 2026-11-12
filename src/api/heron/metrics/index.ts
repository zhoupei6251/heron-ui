import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

export interface NewsMetric {
  metricId: string;
  versionId: string;
  platform: string;
  plays?: number;
  completionRate?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  fetchedAt: string;
}

export interface NewsMetricForm {
  versionId: string;
  platform: string;
  plays?: number;
  completionRate?: number;
  likes?: number;
  comments?: number;
  shares?: number;
}

export const listNewsMetrics = (versionId: string): AxiosPromise<NewsMetric[]> => {
  return request({ url: `/heron/metrics/${versionId}`, method: 'get' });
};

export const saveNewsMetric = (data: NewsMetricForm): AxiosPromise<NewsMetric> => {
  return request({ url: '/heron/metrics', method: 'post', data });
};
