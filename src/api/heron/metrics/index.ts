import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 归因维度。与后端白名单一一对应，多一个少一个后端都会拒。
 * 每个维度都能从冻结输入或版本行里直接读出来，读不到的归「未记录」。
 */
export type InsightDimension =
  | 'template'
  | 'line'
  | 'angle'
  | 'source'
  | 'column'
  | 'kind'
  | 'chart'
  | 'duration'
  | 'weekday'
  | 'signal'
  | 'style'
  | 'voice'
  | 'publishHour'
  | 'hook'
  | 'opening';

/**
 * 结论类型：四类不能混着说。
 * evidence_conclusion 有证据的数据结论；
 * strategy_hypothesis 待人工确认的策略假设；
 * insufficient_sample 样本不足的观察；
 * unvalidated_suggestion 尚未验证的建议。
 */
export type InsightConclusion =
  | 'evidence_conclusion'
  | 'strategy_hypothesis'
  | 'insufficient_sample'
  | 'unvalidated_suggestion';

/** 证据等级 L0~L4：样本不够或覆盖周期太短就降级。 */
export type InsightTier = 'L0' | 'L1' | 'L2' | 'L3' | 'L4';

/**
 * 一条原始样本：某个版本的一次采样明细。
 * 聚合值算不出来的时候（L0/L1 桶），这层明细是唯一能看的东西。
 * 字段取不到就是空值，不拿 0 顶替——0 是一条真实数据，空才是没有数据。
 */
export interface InsightRawSample {
  versionId: string;
  plays?: number | null;
  completionRate?: number | null;
  likes?: number | null;
  fetchedAt?: string;
  publishAt?: string;
}

/** 一个分组的结论。数字为 null 表示这一组没有可用的播放数据，不是 0。 */
export interface InsightBucket {
  /** 分组值；取不到时是「未记录」。 */
  bucket: string;
  /** 样本数。 */
  samples: number;
  /** 播放量中位数（p50），主指标。 */
  medianPlays?: number | null;
  /** 播放量下四分位（p25）。 */
  p25Plays?: number | null;
  /** 播放量上四分位（p75）。 */
  p75Plays?: number | null;
  /** 播放量均值，仅作对照，不作为结论依据。 */
  avgPlays?: number | null;
  /** 最高播放量。 */
  maxPlays?: number | null;
  /** 完播率中位数。 */
  medianCompletionRate?: number | null;
  /** 点赞中位数。 */
  medianLikes?: number | null;
  /** 最高播放 / 中位播放；大于 5 说明这一组被单条极端值主导。 */
  outlierRatio?: number | null;
  /** 覆盖的自然周数。 */
  weeks: number;
  /** 证据等级。 */
  tier: InsightTier;
  /** 结论类型。 */
  conclusion: InsightConclusion;
  /** 后端写好的一句话结论，页面直接用，不重算口径。 */
  summary: string;
  /** 去掉最高的一条后方向是否还成立。 */
  stable: boolean;
  /** 是否可以直接进入内容策略（只有 L4 且稳定才可以）。 */
  strategyEligible: boolean;
  /** 这一组的原始样本明细；样本不足时用它替代聚合值。 */
  rawSamples?: InsightRawSample[];
  /** 这一组播放最高的那条样本；没有就是没有。 */
  extremeSample?: InsightRawSample | null;
}

/** 一页归因结论。 */
export interface PerformanceInsight {
  dimension: string;
  /** 参与统计的样本数（同一版本只取最新一次采样）。 */
  totalSamples: number;
  /** 全部样本覆盖了几个自然周。 */
  weeks: number;
  /** 整体证据等级。 */
  tier: InsightTier;
  /** 整体结论类型。 */
  conclusion: InsightConclusion;
  /** 这一页的结论能说到什么程度。 */
  notice: string;
  /** 各分组明细。 */
  buckets: InsightBucket[];
  /** 参与统计的原始样本明细。 */
  rawSamples?: InsightRawSample[];
}

/**
 * 归因结论：中位数 + 证据等级 + 稳定性。
 * 结论文案一律用后端给的 summary，前端不自己重算。
 */
export const getMetricInsight = (dimension: InsightDimension): AxiosPromise<PerformanceInsight> => {
  return request({ url: '/heron/metrics/insight', method: 'get', params: { dimension } });
};

/** 参考卡里的一个分组。字段与归因桶同口径，聚合值同样可能是 null。 */
export interface MetricReferenceBucket {
  bucket: string;
  samples: number;
  tier: InsightTier;
  medianPlays?: number | null;
  p25Plays?: number | null;
  p75Plays?: number | null;
  outlierRatio?: number | null;
  stable: boolean;
  strategyEligible: boolean;
  summary?: string;
}

/**
 * 历史表现参考卡：给人看的，不是给模型看的。
 * locked=true 表示这个维度被人工锁定了，锁定期内不给聚合结论，
 * 但卡本身要看得见——人要看得见自己锁了什么。
 */
export interface MetricReference {
  schemaVersion?: string;
  generatedAt?: string;
  dimension: string;
  bucketValue?: string;
  tier?: InsightTier;
  locked: boolean;
  lockReason?: string | null;
  scopeUntil?: string | null;
  buckets: MetricReferenceBucket[];
  notice?: string;
}

/** 取某个维度下某个分组值的历史表现参考卡。 */
export const getMetricReference = (dimension: InsightDimension, bucketValue: string): AxiosPromise<MetricReference> => {
  return request({ url: '/heron/metrics/reference', method: 'get', params: { dimension, bucketValue } });
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
