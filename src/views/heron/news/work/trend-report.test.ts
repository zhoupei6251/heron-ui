import { describe, expect, it } from 'vitest';
import {
  parseTrendReport,
  TREND_CORROBORATION_TEXT,
  TREND_INSUFFICIENT_NOTE,
  trendRatioPct,
  trendRows,
  trendSignedPct,
  trendVerdictTagType
} from './trend-report';

const sustainedUp = JSON.stringify({
  contract: 'trend/1',
  verdict: 'sustained_up',
  label: '持续上行',
  metric: { key: 'gold_price', label: '金价', unit: '美元/盎司', precision: 2 },
  cadence: 'daily',
  points: 12,
  period: { from: '2026-11-01', to: '2026-11-12' },
  first: { date: '2026-11-01', value: 2000.5 },
  last: { date: '2026-11-12', value: 2310.25 },
  min: { date: '2026-11-01', value: 2000.5 },
  max: { date: '2026-11-12', value: 2310.25 },
  median_shift_pct: 14.8,
  net_change_pct: 15.48,
  sign_agreement: 0.83,
  volatility_pct: 12.6,
  segments: [],
  thresholds: { min_points: 8, step_pct: 5.0, net_pct: 10.0, flat_pct: 5.0, sign_agreement: 0.6, high_volatility_pct: 60.0 },
  speculation_boundary: '这里只陈述已发生的变化，原因与后续走势属于推测。',
  plan: { question: '这十二期怎么变的', beats: [], must_not: [], unit: '美元/盎司' },
  evidence: [
    {
      role: 'primary',
      source_key: 'gold',
      source_name: '示例交易所',
      data_sha256: 'a'.repeat(64),
      points: 12,
      from: '2026-11-01',
      to: '2026-11-12'
    }
  ],
  corroboration: 'single_source',
  disagreements: [],
  limits: ['只描述 2026-11-01 到 2026-11-12 共 12 期，不外推为长期趋势']
});

const insufficient = JSON.stringify({
  contract: 'trend/1',
  verdict: 'insufficient',
  label: '样本不足',
  metric: { key: 'gold_price', label: '金价', unit: '美元/盎司', precision: 2 },
  cadence: 'daily',
  points: 6,
  segments: [],
  speculation_boundary: '这里只陈述已发生的变化，原因与后续走势属于推测。',
  evidence: [
    {
      role: 'primary',
      source_key: 'gold',
      source_name: '示例交易所',
      data_sha256: 'a'.repeat(64),
      points: 6,
      from: '2026-11-01',
      to: '2026-11-06'
    }
  ],
  corroboration: 'single_source',
  disagreements: [],
  limits: ['只有 6 期，少于 8 期，不做趋势判定；画面只能讲已发生的区间变化']
});

describe('趋势判定（trend/1）的解析层', () => {
  it('持续上行把判定、区间与四项数值都带出来', () => {
    const report = parseTrendReport(sustainedUp);
    expect(report?.verdict).toBe('sustained_up');
    expect(report?.label).toBe('持续上行');
    expect(report?.directional).toBe(true);
    expect(report?.insufficient).toBe(false);
    expect(report?.period).toEqual({ from: '2026-11-01', to: '2026-11-12' });
    const rows = trendRows(report!);
    expect(rows.map(row => row.label)).toEqual([
      '判定',
      '指标',
      '期数',
      '区间',
      '整体位移（首末）',
      '中位位移（三段）',
      '同向点对占比',
      '区间波动幅度',
      '交叉核对'
    ]);
    expect(rows.find(row => row.label === '区间')?.value).toBe('2026-11-01 → 2026-11-12');
    expect(rows.find(row => row.label === '整体位移（首末）')?.value).toBe('+15.48%');
    expect(rows.find(row => row.label === '中位位移（三段）')?.value).toBe('+14.8%');
    expect(rows.find(row => row.label === '同向点对占比')?.value).toBe('83%');
    expect(rows.find(row => row.label === '区间波动幅度')?.value).toBe('12.6%');
    expect(rows.find(row => row.label === '交叉核对')?.value).toBe('单一来源');
    expect(report?.limits).toEqual(['只描述 2026-11-01 到 2026-11-12 共 12 期，不外推为长期趋势']);
    expect(report?.speculationBoundary).toContain('属于推测');
  });

  it('样本不足只给判定与期数，不渲染位移、占比、波动这些数字', () => {
    const report = parseTrendReport(insufficient);
    expect(report?.verdict).toBe('insufficient');
    expect(report?.insufficient).toBe(true);
    expect(report?.directional).toBe(false);
    expect(report?.netChangePct).toBeUndefined();
    expect(report?.medianShiftPct).toBeUndefined();
    expect(report?.signAgreement).toBeUndefined();
    expect(report?.volatilityPct).toBeUndefined();
    const rows = trendRows(report!);
    expect(rows.map(row => row.label)).toEqual(['判定', '指标', '期数', '交叉核对']);
    expect(rows.find(row => row.label === '判定')?.value).toBe('样本不足');
    expect(rows.find(row => row.label === '期数')?.value).toBe('6 期');
    expect(rows.every(row => !row.label.includes('位移') && !row.label.includes('占比') && !row.label.includes('波动'))).toBe(
      true
    );
    expect(rows.every(row => !row.value.includes('%'))).toBe(true);
    expect(TREND_INSUFFICIENT_NOTE).toBe('样本不足，不给方向结论');
  });

  it('坏 JSON、契约版本不对、判定取值不合法都返回 null，不抛错', () => {
    expect(parseTrendReport(undefined)).toBeNull();
    expect(parseTrendReport('{')).toBeNull();
    expect(parseTrendReport('[]')).toBeNull();
    expect(parseTrendReport(JSON.stringify({ contract: 'dataset/1', verdict: 'sustained_up' }))).toBeNull();
    expect(parseTrendReport(JSON.stringify({ contract: 'trend/1', verdict: 'unknown' }))).toBeNull();
  });

  it('交叉核对与百分比的展示口径固定，不在页面里另算', () => {
    expect(TREND_CORROBORATION_TEXT).toEqual({
      single_source: '单一来源',
      consistent: '一致',
      divergent: '存在分歧'
    });
    expect(trendSignedPct(15.48)).toBe('+15.48%');
    expect(trendSignedPct(-8.2)).toBe('-8.2%');
    expect(trendSignedPct(0)).toBe('0%');
    expect(trendRatioPct(0.83)).toBe('83%');
    expect(trendVerdictTagType('sustained_up')).toBe('success');
    expect(trendVerdictTagType('sustained_down')).toBe('warning');
    expect(trendVerdictTagType('range_fluctuation')).toBe('info');
    expect(trendVerdictTagType('insufficient')).toBe('info');
  });
});
