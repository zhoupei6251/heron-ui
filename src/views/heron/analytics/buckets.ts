/**
 * 归因桶值的中文映射：后端按原始取值分组（line/kind/source 都是线上枚举），
 * 界面只做翻译，不改变分组、不合并桶、不给未命中的值编名字。
 *
 * 只登记这三个维度；`未记录` 与模板、时长这类取值原样保留。
 */

import type { InsightDimension } from '@/api/heron/metrics';

/** 维度 → 原始桶值 → 中文名。没登记的组合返回原值。 */
const BUCKET_TEXT: Partial<Record<InsightDimension, Record<string, string>>> = {
  line: {
    DATA_BOARD: '数据看板',
    TREND_INSIGHT: '趋势洞察',
    NEWS_EXPLAINER: '新闻解说'
  },
  kind: {
    article: '文稿解说',
    data_board: '数据看板',
    trend: '趋势洞察'
  },
  source: {
    data_board: '数据看板',
    trend: '趋势洞察',
    research: '调研',
    hotlist: '热榜'
  }
};

/**
 * 把某个维度的桶值翻成中文。未命中时原样返回，保证「新枚举上线但页面没跟上」时
 * 仍然看得到后端真实分组，而不是一堆空白。`未记录` 不在映射表里，也原样返回。
 */
export function bucketText(dimension: InsightDimension, bucket: string): string {
  return BUCKET_TEXT[dimension]?.[bucket] ?? bucket;
}
