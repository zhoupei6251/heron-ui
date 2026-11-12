import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

export type MetricDimension = 'template' | 'line' | 'angle';

/** 一个分组的汇总。样本数必须一起看：只有一条数据的平均值不是规律。 */
export interface MetricBreakdown {
  bucket: string;
  samples: number;
  avgPlays?: number;
  avgCompletionRate?: number;
  avgLikes?: number;
  maxPlays?: number;
}

/** 按模板 / 生产线 / 叙事角度归因。数据来自人工回填，样本通常很少。 */
export const getMetricBreakdown = (dimension: MetricDimension): AxiosPromise<MetricBreakdown[]> => {
  return request({ url: '/heron/metrics/breakdown', method: 'get', params: { dimension } });
};

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
