/**
 * 趋势判定（trend/1）的解析层：只把后端算好并落库的判定读出来，不重算、不补字段。
 *
 * trend 产物是一份 JSON 快照，判定由后端从 dataset 确定性算出（阈值也随快照一起落库），
 * 这里负责把它变成页面能读的结构。解析失败只说明这条产物异常，不能让整页崩掉，
 * 所以返回 null 而不是抛错。
 *
 * 两条硬规则写在展示模型里，而不是留给各页面各写一遍：
 * - 样本不足时只说明「不给方向结论」，不渲染位移、占比、波动这些数字（后端此时也没有）；
 * - 预测性话术与单一总分不在这里生成：页面只转述后端给的 label、limits 与边界说明。
 */

export type TrendVerdict = 'sustained_up' | 'sustained_down' | 'range_fluctuation' | 'insufficient';
export type TrendCorroboration = 'single_source' | 'consistent' | 'divergent';

export interface TrendEvidence {
  role: string;
  sourceKey: string;
  sourceName: string;
  points: number;
  from: string;
  to: string;
  /** 交叉来源自己算出的首末变化；主来源没有这个字段。 */
  netChangePct?: number;
  direction?: string;
}

export interface TrendReport {
  contract: string;
  verdict: TrendVerdict;
  /** 后端已给的中文判定名，页面直接用它，不自己再翻一遍。 */
  label: string;
  metricKey: string;
  metricLabel: string;
  unit: string;
  cadence: string;
  points: number;
  period?: { from: string; to: string };
  netChangePct?: number;
  medianShiftPct?: number;
  /** 0~1 的同向点对占比。 */
  signAgreement?: number;
  volatilityPct?: number;
  /** 只有持续上行 / 持续下行算有明确方向。 */
  directional: boolean;
  insufficient: boolean;
  corroboration: TrendCorroboration;
  corroborationText: string;
  /** 后端写死的推测边界说明，原文展示。 */
  speculationBoundary: string;
  limits: string[];
  disagreements: string[];
  evidence: TrendEvidence[];
}

export interface TrendRow {
  label: string;
  value: string;
}

/** 样本不足时的固定说法：这时给方向就是编内容。 */
export const TREND_INSUFFICIENT_NOTE = '样本不足，不给方向结论';

export const TREND_CORROBORATION_TEXT: Record<TrendCorroboration, string> = {
  single_source: '单一来源',
  consistent: '一致',
  divergent: '存在分歧'
};

const TREND_VERDICT_TEXT: Record<TrendVerdict, string> = {
  sustained_up: '持续上行',
  sustained_down: '持续下行',
  range_fluctuation: '区间波动',
  insufficient: '样本不足'
};

const VERDICTS: TrendVerdict[] = ['sustained_up', 'sustained_down', 'range_fluctuation', 'insufficient'];
const CORROBORATIONS: TrendCorroboration[] = ['single_source', 'consistent', 'divergent'];

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const text = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() ? value : undefined);

const number = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const stringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.flatMap(item => (typeof item === 'string' ? [item] : [])) : [];

const verdictOf = (value: unknown): TrendVerdict | undefined => {
  const candidate = text(value);
  return candidate && VERDICTS.includes(candidate as TrendVerdict) ? (candidate as TrendVerdict) : undefined;
};

const corroborationOf = (value: unknown): TrendCorroboration => {
  const candidate = text(value);
  return candidate && CORROBORATIONS.includes(candidate as TrendCorroboration)
    ? (candidate as TrendCorroboration)
    : 'single_source';
};

const periodOf = (value: unknown): { from: string; to: string } | undefined => {
  if (!record(value)) return undefined;
  const from = text(value.from);
  const to = text(value.to);
  return from && to ? { from, to } : undefined;
};

const evidenceOf = (value: unknown): TrendEvidence[] =>
  Array.isArray(value)
    ? value.flatMap(item => {
        if (!record(item)) return [];
        const result = record(item.result) ? item.result : undefined;
        return [
          {
            role: text(item.role) ?? '',
            sourceKey: text(item.source_key) ?? '',
            sourceName: text(item.source_name) ?? '',
            points: number(item.points) ?? 0,
            from: text(item.from) ?? '',
            to: text(item.to) ?? '',
            netChangePct: result ? number(result.net_change_pct) : undefined,
            direction: result ? text(result.direction) : undefined
          }
        ];
      })
    : [];

/** 解析 trend.json；坏 JSON、契约版本不对、判定取值不合法都当没有这条产物。 */
export function parseTrendReport(raw?: string): TrendReport | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!record(parsed) || parsed.contract !== 'trend/1') return null;
    const verdict = verdictOf(parsed.verdict);
    if (!verdict) return null;
    const metric = record(parsed.metric) ? parsed.metric : {};
    const corroboration = corroborationOf(parsed.corroboration);
    return {
      contract: 'trend/1',
      verdict,
      label: text(parsed.label) ?? TREND_VERDICT_TEXT[verdict],
      metricKey: text(metric.key) ?? '',
      metricLabel: text(metric.label) ?? '',
      unit: text(metric.unit) ?? '',
      cadence: text(parsed.cadence) ?? '',
      points: number(parsed.points) ?? 0,
      period: periodOf(parsed.period),
      netChangePct: number(parsed.net_change_pct),
      medianShiftPct: number(parsed.median_shift_pct),
      signAgreement: number(parsed.sign_agreement),
      volatilityPct: number(parsed.volatility_pct),
      directional: verdict === 'sustained_up' || verdict === 'sustained_down',
      insufficient: verdict === 'insufficient',
      corroboration,
      corroborationText: TREND_CORROBORATION_TEXT[corroboration],
      speculationBoundary: text(parsed.speculation_boundary) ?? '',
      limits: stringList(parsed.limits),
      disagreements: stringList(parsed.disagreements),
      evidence: evidenceOf(parsed.evidence)
    };
  } catch {
    return null;
  }
}

/** 带符号的百分比：+12.5% / -8.2%，不四舍五入成整数，也不补小数位。 */
export function trendSignedPct(value: number): string {
  return `${value > 0 ? '+' : ''}${value}%`;
}

/** 0~1 的占比转成整数百分比；后端保留两位小数，这里按展示需要取整。 */
export function trendRatioPct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/** 后端已经算成百分比数值的字段（如波动幅度 12.6 表示 12.6%），不再乘 100。 */
export function trendPlainPct(value: number): string {
  return `${value}%`;
}

/**
 * 判定的标签色：上行绿、下行黄、区间波动灰蓝、样本不足灰蓝（不冒充结论）。
 * 下行不用红色——跌不是错误，只是方向不同。
 */
export function trendVerdictTagType(verdict: TrendVerdict): 'success' | 'warning' | 'info' {
  if (verdict === 'sustained_up') return 'success';
  if (verdict === 'sustained_down') return 'warning';
  return 'info';
}

/**
 * 展示模型：页面只渲染这里给出的行，避免同一份判定在 review 与 studio 两页各写一套口径。
 * 样本不足时只留判定、指标、期数与交叉核对，位移 / 占比 / 波动一律不出现。
 */
export function trendRows(report: TrendReport): TrendRow[] {
  const rows: TrendRow[] = [{ label: '判定', value: report.label }];
  if (report.metricLabel) rows.push({ label: '指标', value: report.metricLabel });
  rows.push({ label: '期数', value: `${report.points} 期` });
  if (report.insufficient) {
    rows.push({ label: '交叉核对', value: report.corroborationText });
    return rows;
  }
  if (report.period) rows.push({ label: '区间', value: `${report.period.from} → ${report.period.to}` });
  if (report.netChangePct !== undefined) {
    rows.push({ label: '整体位移（首末）', value: trendSignedPct(report.netChangePct) });
  }
  if (report.medianShiftPct !== undefined) {
    rows.push({ label: '中位位移（三段）', value: trendSignedPct(report.medianShiftPct) });
  }
  if (report.signAgreement !== undefined) {
    rows.push({ label: '同向点对占比', value: trendRatioPct(report.signAgreement) });
  }
  if (report.volatilityPct !== undefined) {
    rows.push({ label: '区间波动幅度', value: trendPlainPct(report.volatilityPct) });
  }
  rows.push({ label: '交叉核对', value: report.corroborationText });
  return rows;
}
