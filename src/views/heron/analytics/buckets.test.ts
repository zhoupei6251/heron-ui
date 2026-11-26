import { describe, expect, it } from 'vitest';
import { bucketText } from './buckets';

describe('归因桶值的中文映射', () => {
  it('line 维度三种决策线翻成中文', () => {
    expect(bucketText('line', 'DATA_BOARD')).toBe('数据看板');
    expect(bucketText('line', 'TREND_INSIGHT')).toBe('趋势洞察');
    expect(bucketText('line', 'NEWS_EXPLAINER')).toBe('新闻解说');
  });

  it('kind 维度三种内容线翻成中文', () => {
    expect(bucketText('kind', 'article')).toBe('文稿解说');
    expect(bucketText('kind', 'data_board')).toBe('数据看板');
    expect(bucketText('kind', 'trend')).toBe('趋势洞察');
  });

  it('source 维度四种来源翻成中文', () => {
    expect(bucketText('source', 'data_board')).toBe('数据看板');
    expect(bucketText('source', 'trend')).toBe('趋势洞察');
    expect(bucketText('source', 'research')).toBe('调研');
    expect(bucketText('source', 'hotlist')).toBe('热榜');
  });

  it('未命中的桶值保持原值，未记录也原样返回', () => {
    expect(bucketText('line', 'SOMETHING_NEW')).toBe('SOMETHING_NEW');
    expect(bucketText('kind', 'old_kind')).toBe('old_kind');
    expect(bucketText('source', 'unknown_source')).toBe('unknown_source');
    expect(bucketText('line', '未记录')).toBe('未记录');
  });
});
