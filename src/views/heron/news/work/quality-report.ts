import type { NewsEditorialReview } from '@/api/heron/newsWork/types';

/**
 * 视频级质量报告的解析层：只把后端已经返回的字段读出来，不推断、不补齐。
 *
 * 三份来源都是后端落库的 JSON 字符串：
 * - checks：十道生成闸的实测报告，每道闸带 measured（数值或布尔）。
 * - editorialReview：AI 审稿记录，后端 EditorialReviewer.Verdict#toRecord 的形状。
 * - script：成片实际用的稿件，两条线形状不同但共用 title/scenes/closing/source_name。
 *
 * 解析失败只说明这条记录异常，不能让整页崩掉，所以每个解析器都返回空值而不是抛错。
 */

/** 一道闸的实测值：后端只写数值或布尔，不写字符串。 */
export type GateMeasured = Record<string, number | boolean>;

export interface QualityGate {
  gate: string;
  passed: boolean;
  reason: string;
  inputLocator: string;
  measured: GateMeasured;
}

/** 稿件里的一屏。 */
export interface ScriptSceneReport {
  index: number;
  label: string;
  sceneId?: string;
  lead: string;
  body: string;
  durationS?: number;
  sceneType?: string;
  /** 解说线 v2 稿的画面说明；数据看板线没有落库对应字段。 */
  visualLayout?: string;
  visualMotion?: string;
  visualAssets?: number;
  /** 这屏引用的事实占位符路径，如 facts.last.value。 */
  facts: string[];
}

export interface ScriptReport {
  title?: string;
  closing?: string;
  sourceName?: string;
  /** 解说线的出处链接。 */
  sourceUrl?: string;
  /** 数据看板线的选源键。 */
  sourceKey?: string;
  datasetSha?: string;
  bodySha?: string;
  chart?: string;
  scenes: ScriptSceneReport[];
  /** 全片引用过的事实占位符路径，去重后按出现顺序。 */
  facts: string[];
}

/**
 * 后端尚未提供的报告项。这里只登记「还没有」，不造占位数据：
 * 等 story/1 与发布建议字段落地后，逐条换成真实字段再从这张表里删掉。
 */
export const PENDING_REPORT_FIELDS: { label: string; note: string }[] = [
  {
    label: '选题主题 / 故事角度 / 每段叙事目的',
    note: '后端未提供该字段：story/1 结构化叙事尚未落地，当前稿件里没有「这段为什么存在」。'
  },
  {
    label: '开场钩子类型',
    note: '后端未提供该字段：标题生成时选定的钩子类型没有随稿落库，只有成稿标题本身。'
  },
  {
    label: '画面重点（数据看板线）',
    note: '后端未提供该字段：画面重点在渲染期算出来就丢，没有落库；解说线的场景类型与版式另见上表。'
  },
  {
    label: '是否建议发布',
    note: '后端未提供该字段：人工审片结论、AI 审稿结论与自动发布闸是三段分离判定，没有统一的发布建议。'
  },
  {
    label: '逐段关键帧 / 分镜预览',
    note: '后端未提供该字段：产物只有九宫格一张，与分段不是一一对应，不能当作分镜预览。'
  },
  {
    label: '事实引用的可读形态',
    note: '后端未提供该字段：稿件里只有 facts.* 占位符路径，没有「这句话引用了哪个数的多少」。'
  }
];

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const text = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() ? value : undefined);

const FACT_REF = /\{\{((?:facts\.)[^{}]+)\}\}/g;

/** 抽出稿件里引用的事实占位符路径（含 facts. 前缀）；顺序即出现顺序，重复的只留一次。 */
export function extractFactRefs(content?: string): string[] {
  if (!content) return [];
  const refs: string[] = [];
  for (const match of content.matchAll(FACT_REF)) {
    const ref = match[1]?.trim();
    if (ref && !refs.includes(ref)) refs.push(ref);
  }
  return refs;
}

/** 解析生成闸报告；坏 JSON 与非数组都当没有记录。 */
export function parseQualityGates(checks?: string): QualityGate[] {
  if (!checks) return [];
  try {
    const parsed: unknown = JSON.parse(checks);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item: unknown) => {
      if (!record(item)) return [];
      const measured: GateMeasured = {};
      if (record(item.measured)) {
        for (const [key, value] of Object.entries(item.measured)) {
          if (typeof value === 'number' || typeof value === 'boolean') measured[key] = value;
        }
      }
      return [
        {
          gate: text(item.gate) ?? '-',
          passed: item.passed === true,
          reason: text(item.reason) ?? '',
          inputLocator: text(item.inputLocator) ?? '',
          measured
        }
      ];
    });
  } catch {
    return [];
  }
}

/** 实测值排成一行：名字=值，值是布尔的写成是/否。 */
export function measuredText(measured?: GateMeasured): string {
  if (!measured) return '';
  return Object.entries(measured)
    .map(([key, value]) => `${key}=${typeof value === 'boolean' ? (value ? '是' : '否') : value}`)
    .join(' · ');
}

/** 解析 AI 审稿记录；坏 JSON 当没有记录。 */
export function parseEditorialReview(raw?: string): NewsEditorialReview | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return record(parsed) ? (parsed as NewsEditorialReview) : null;
  } catch {
    return null;
  }
}

/**
 * 解析成片实际用的稿件。两条线字段名不同（解说线 source_url/body_sha256，
 * 数据看板线 dataset_sha256/source_key/chart），但 title/scenes/closing/source_name 共用，
 * 所以一个解析器够用；缺席的字段留空，不拿另一条线的名字硬凑。
 */
export function parseScriptReport(script?: string): ScriptReport | null {
  if (!script) return null;
  try {
    const parsed: unknown = JSON.parse(script);
    if (!record(parsed)) return null;
    const scenes: ScriptSceneReport[] = Array.isArray(parsed.scenes)
      ? parsed.scenes.flatMap((scene: unknown, index: number) => {
          if (!record(scene)) return [];
          const lead = text(scene.lead) ?? '';
          const body = text(scene.body) ?? '';
          const visual = record(scene.visual) ? scene.visual : undefined;
          const assets = visual && Array.isArray(visual.assets) ? visual.assets.length : undefined;
          return [
            {
              index: index + 1,
              label: `第${index + 1}段`,
              sceneId: text(scene.scene_id),
              lead,
              body,
              durationS: typeof scene.duration_s === 'number' ? scene.duration_s : undefined,
              sceneType: text(scene.scene_type),
              visualLayout: visual ? text(visual.layout) : undefined,
              visualMotion: visual ? text(visual.motion) : undefined,
              visualAssets: assets,
              facts: extractFactRefs(`${lead} ${body}`)
            }
          ];
        })
      : [];
    const facts: string[] = [];
    for (const scene of scenes) {
      for (const ref of scene.facts) {
        if (!facts.includes(ref)) facts.push(ref);
      }
    }
    return {
      title: text(parsed.title),
      closing: text(parsed.closing),
      sourceName: text(parsed.source_name),
      sourceUrl: text(parsed.source_url),
      sourceKey: text(parsed.source_key),
      datasetSha: text(parsed.dataset_sha256),
      bodySha: text(parsed.body_sha256),
      chart: text(parsed.chart),
      scenes,
      facts
    };
  } catch {
    return null;
  }
}

/**
 * 成片级质量审稿报告（L3）。这是第三层结论：它只说明「这条片子满足了哪些判据」，
 * 不参与发布放行，也不改写任何一道客观闸，所以解析时照样只读后端写下的字段，
 * 不推断、不补齐、不合成总分。
 */

/** 判定结果。unknown 是合法值，表示证据不足，不等于通过。 */
export type QualityVerdict = 'pass' | 'minor' | 'fail' | 'unknown';

/** 结论的三种来源：客观事实、模型主观判断、模型推测。三者不可混排。 */
export type QualityCriterionClass = 'objective' | 'subjective' | 'hypothesis';

/** 置信度。与 class 有强约束：客观只有 high，主观只有 medium/low，推测只有 low。 */
export type QualityConfidence = 'high' | 'medium' | 'low';

/** 严重度。blocker 只可能出现在 objective 且 verdict=fail。 */
export type QualitySeverity = 'none' | 'minor' | 'major' | 'blocker';

/** 一条证据：定位符 + 原文片段。 */
export interface QualityEvidence {
  locator: string;
  quote: string;
}

/** 一条判据的结论。 */
export interface QualityCriterion {
  id: string;
  /** 判据的中文名；后端只给 id，页面读中文名。 */
  label: string;
  verdict: QualityVerdict;
  class: QualityCriterionClass;
  confidence: QualityConfidence;
  machineVerifiable: boolean;
  severity: QualitySeverity;
  repairable: boolean;
  evidence: QualityEvidence[];
  reason: string;
}

/** 报告落库的分类计数。只有分类计数，没有总分。 */
export interface QualitySummaryCounts {
  pass: number;
  minor: number;
  fail: number;
  unknown: number;
  objectiveFail: number;
  subjectiveFail: number;
  hypothesisFail: number;
  objectiveVerified: number;
  subjectiveVerified: number;
}

/** 能从判据条目本身重算出来的分类计数。 */
export type QualityVerdictCounts = Pick<
  QualitySummaryCounts,
  'pass' | 'minor' | 'fail' | 'unknown' | 'objectiveFail' | 'subjectiveFail' | 'hypothesisFail'
>;

/** 定向修复的记账。 */
export interface QualityRepairInfo {
  attempted: number;
  max: number;
  changedSegments: string[];
  rechecked: boolean;
}

/** 本次用了哪一级画面证据。只记级别，不记图片本身。 */
export interface QualityScreenshotInfo {
  level: string;
  frames: number;
  extraBrowserRender: boolean;
  reason: string;
}

/** 一份成片级质量审稿报告。 */
export interface QualityReport {
  schemaVersion?: string;
  versionId?: string;
  mode?: string;
  reviewedAt?: string;
  promptVersion?: string;
  modelId?: string;
  criteria: QualityCriterion[];
  summary: QualitySummaryCounts;
  repair: QualityRepairInfo;
  screenshot: QualityScreenshotInfo;
  notes: string[];
}

/** 九条判据的固定顺序与中文名。后端给的是 id，页面读中文名。 */
export const QUALITY_CRITERION_LABELS: Record<string, string> = {
  hook_3s: '开场前三秒',
  early_payoff: '前段兑现',
  mid_progression: '中段推进',
  peak_focus: '高潮与重点',
  visual_sync: '画面与旁白一致',
  style_consistency: '视觉风格统一',
  pacing_variation: '节奏变化',
  no_redundancy: '画面冗余',
  closing_value: '结尾价值'
};

/** 九条判据的固定顺序；同一类里按这个顺序排，不按模型给的顺序排。 */
export const QUALITY_CRITERION_ORDER = [
  'hook_3s',
  'early_payoff',
  'mid_progression',
  'peak_focus',
  'visual_sync',
  'style_consistency',
  'pacing_variation',
  'no_redundancy',
  'closing_value'
];

/** 三类结论各自的标题与说明。三个区互不混排，各说各的。 */
export const QUALITY_CLASS_META: { key: QualityCriterionClass; label: string; note: string }[] = [
  {
    key: 'objective',
    label: '客观结论',
    note: '由代码或外部工具算出，同样的输入重跑得到同样的值；机器可复核，不经过模型。'
  },
  {
    key: 'subjective',
    label: '模型主观判断',
    note: '模型读了真实内容后给出的判断，有直接证据但没有客观刻度；由人复核。'
  },
  {
    key: 'hypothesis',
    label: '模型推测',
    note: '模型没有直接证据时的外推，不可复核，只能被后续证据证伪。'
  }
];

const QUALITY_VERDICTS: QualityVerdict[] = ['pass', 'minor', 'fail', 'unknown'];
const QUALITY_CLASSES: QualityCriterionClass[] = ['objective', 'subjective', 'hypothesis'];
const QUALITY_CONFIDENCES: QualityConfidence[] = ['high', 'medium', 'low'];
const QUALITY_SEVERITIES: QualitySeverity[] = ['none', 'minor', 'major', 'blocker'];

/** 枚举取值；不在枚举内就退回兜底值，页面不展示非法枚举。 */
const oneOf = <T extends string>(value: unknown, allowed: T[], fallback: T): T =>
  typeof value === 'string' && (allowed as string[]).includes(value) ? (value as T) : fallback;

/** class 决定置信度上限：客观 high，主观 medium，推测 low。 */
const confidenceFor = (cls: QualityCriterionClass): QualityConfidence =>
  cls === 'objective' ? 'high' : cls === 'subjective' ? 'medium' : 'low';

/**
 * blocker 只可能出现在 objective 且 fail。
 * 不满足的一律降一级，免得一条主观意见在页面上显示成阻断。
 */
const severityFor = (severity: QualitySeverity, cls: QualityCriterionClass, verdict: QualityVerdict): QualitySeverity => {
  if (severity !== 'blocker') return severity;
  return cls === 'objective' && verdict === 'fail' ? 'blocker' : 'major';
};

const numberOr = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/** 原文片段要原样留着，换行与缩进都不动，所以这里不裁空白。 */
const rawText = (value: unknown): string => (typeof value === 'string' ? value : '');

const criterionOf = (value: unknown): QualityCriterion | null => {
  if (!record(value)) return null;
  const id = text(value.id);
  if (!id) return null;
  const cls = oneOf(value.class, QUALITY_CLASSES, 'hypothesis');
  const verdict = oneOf(value.verdict, QUALITY_VERDICTS, 'unknown');
  const confidence = oneOf(value.confidence, QUALITY_CONFIDENCES, confidenceFor(cls));
  const severity = severityFor(oneOf(value.severity, QUALITY_SEVERITIES, 'none'), cls, verdict);
  const evidence = Array.isArray(value.evidence)
    ? value.evidence.flatMap((item: unknown) => {
        if (!record(item)) return [];
        const locator = text(item.locator);
        if (!locator) return [];
        return [{ locator, quote: rawText(item.quote) }];
      })
    : [];
  return {
    id,
    label: QUALITY_CRITERION_LABELS[id] ?? id,
    verdict,
    class: cls,
    confidence,
    // 契约规定：客观必然机器可核，主观与推测必然只能由人核。
    machineVerifiable: cls === 'objective',
    severity,
    repairable: value.repairable === true,
    evidence,
    reason: text(value.reason) ?? ''
  };
};

const summaryOf = (value: unknown): QualitySummaryCounts => {
  const source = record(value) ? value : {};
  const count = (key: string) => numberOr(source[key], 0);
  return {
    pass: count('pass'),
    minor: count('minor'),
    fail: count('fail'),
    unknown: count('unknown'),
    objectiveFail: count('objectiveFail'),
    subjectiveFail: count('subjectiveFail'),
    hypothesisFail: count('hypothesisFail'),
    objectiveVerified: count('objectiveVerified'),
    subjectiveVerified: count('subjectiveVerified')
  };
};

const repairOf = (value: unknown): QualityRepairInfo => {
  const source = record(value) ? value : {};
  return {
    attempted: numberOr(source.attempted, 0),
    max: numberOr(source.max, 0),
    changedSegments: Array.isArray(source.changedSegments)
      ? source.changedSegments.filter((item): item is string => typeof item === 'string')
      : [],
    rechecked: source.rechecked === true
  };
};

const screenshotOf = (value: unknown): QualityScreenshotInfo => {
  const source = record(value) ? value : {};
  return {
    level: text(source.level) ?? '',
    frames: numberOr(source.frames, 0),
    extraBrowserRender: source.extraBrowserRender === true,
    reason: text(source.reason) ?? ''
  };
};

/**
 * 解析成片级质量审稿报告。坏 JSON、空串、非对象都当没有报告（返回 null），
 * 缺字段的项用兜底值补齐结构，但不会凭空造出判据条目或证据。
 */
export function parseQualityReport(json?: string): QualityReport | null {
  if (!json) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (!record(parsed)) return null;
  const criteria = Array.isArray(parsed.criteria)
    ? parsed.criteria.flatMap((item: unknown) => {
        const criterion = criterionOf(item);
        return criterion ? [criterion] : [];
      })
    : [];
  const notes = Array.isArray(parsed.notes)
    ? parsed.notes.filter((item): item is string => typeof item === 'string')
    : [];
  return {
    schemaVersion: text(parsed.schemaVersion),
    // versionId 后端可能写成 JSON 数字；19 位长整型在 JSON.parse 阶段就已经被四舍五入，
    // 这里只保证读出来是字符串，不做别的加工。
    versionId: typeof parsed.versionId === 'string' || typeof parsed.versionId === 'number' ? String(parsed.versionId) : undefined,
    mode: text(parsed.mode),
    reviewedAt: text(parsed.reviewedAt),
    promptVersion: text(parsed.promptVersion),
    modelId: text(parsed.modelId),
    criteria,
    summary: summaryOf(parsed.summary),
    repair: repairOf(parsed.repair),
    screenshot: screenshotOf(parsed.screenshot),
    notes
  };
}

/**
 * 按判据条目重算分类计数。
 * 报告里的 summary 由后端写，前端不重算口径；这个函数只用来核对
 * 「后端写的计数」与「页面上展示的条目」是否对得上。
 */
export function qualitySummary(criteria: QualityCriterion[]): QualityVerdictCounts {
  const counts: QualityVerdictCounts = {
    pass: 0,
    minor: 0,
    fail: 0,
    unknown: 0,
    objectiveFail: 0,
    subjectiveFail: 0,
    hypothesisFail: 0
  };
  for (const item of criteria) {
    if (item.verdict === 'pass') counts.pass += 1;
    else if (item.verdict === 'minor') counts.minor += 1;
    else if (item.verdict === 'fail') counts.fail += 1;
    else counts.unknown += 1;
    if (item.verdict === 'fail') {
      if (item.class === 'objective') counts.objectiveFail += 1;
      else if (item.class === 'subjective') counts.subjectiveFail += 1;
      else counts.hypothesisFail += 1;
    }
  }
  return counts;
}

/**
 * 报告落库的计数与判据条目是否一致。
 * 对不上说明这份记录本身有问题，页面要如实标出来，而不是悄悄改数字。
 */
export function summaryConsistent(report: QualityReport): boolean {
  const counted = qualitySummary(report.criteria);
  const stored = report.summary;
  return (
    stored.pass === counted.pass &&
    stored.minor === counted.minor &&
    stored.fail === counted.fail &&
    stored.unknown === counted.unknown &&
    stored.objectiveFail === counted.objectiveFail &&
    stored.subjectiveFail === counted.subjectiveFail &&
    stored.hypothesisFail === counted.hypothesisFail
  );
}

/** 同一类判据内部的固定排序；不在九条之列的排最后，保持稳定。 */
export function sortQualityCriteria(criteria: QualityCriterion[]): QualityCriterion[] {
  return criteria.toSorted((left, right) => {
    const a = QUALITY_CRITERION_ORDER.indexOf(left.id);
    const b = QUALITY_CRITERION_ORDER.indexOf(right.id);
    const rank = (value: number) => (value < 0 ? QUALITY_CRITERION_ORDER.length : value);
    return rank(a) - rank(b);
  });
}
