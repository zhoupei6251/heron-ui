import { describe, expect, it } from 'vitest';
import {
  extractFactRefs,
  measuredText,
  parseEditorialReview,
  parseQualityGates,
  parseQualityReport,
  parseScriptReport,
  QUALITY_NOTE_LABELS,
  qualitySummary,
  sortQualityCriteria,
  summaryConsistent
} from './quality-report';

const checks = JSON.stringify([
  {
    gate: 'subtitles',
    inputLocator: 'subtitles.vtt',
    passed: true,
    reason: '字幕覆盖音频九成以上',
    measured: { audioMs: 41500, coveredMs: 41000, cues: 86, alignedScenes: 3 }
  },
  {
    gate: 'assets',
    inputLocator: 'LOCK.json',
    passed: true,
    reason: '资产指纹一致',
    measured: { fontMatched: true, templateMatched: true }
  }
]);

describe('质量报告的解析层', () => {
  it('闸的实测值原样带出，不在解析时丢掉', () => {
    const gates = parseQualityGates(checks);
    expect(gates.map(gate => gate.gate)).toEqual(['subtitles', 'assets']);
    expect(gates[0].measured).toEqual({ audioMs: 41500, coveredMs: 41000, cues: 86, alignedScenes: 3 });
    expect(gates[1].measured).toEqual({ fontMatched: true, templateMatched: true });
    expect(measuredText(gates[0].measured)).toContain('audioMs=41500');
    expect(measuredText(gates[1].measured)).toBe('fontMatched=是 · templateMatched=是');
  });

  it('坏报告与缺字段都不伪造闸', () => {
    expect(parseQualityGates(undefined)).toEqual([]);
    expect(parseQualityGates('{')).toEqual([]);
    expect(parseQualityGates('{"gate":"audio"}')).toEqual([]);
    expect(parseQualityGates(JSON.stringify([{ gate: 'audio', passed: true }]))[0].measured).toEqual({});
  });

  it('审稿记录按后端落盘的形状读出，问题条目与待改建议都在', () => {
    const raw = JSON.stringify({
      schemaVersion: '1.0',
      result: 'FAIL',
      coreFacts: 'unverifiable',
      issues: [{ severity: 'MAJOR', segmentId: 'scene_002', description: '数字讲过了头', suggestion: '改回区间口径' }],
      minorSuggestions: ['第二段偏长'],
      repairAttempts: 1,
      promptVersion: 'editorial-review@v3',
      reviewedAt: '2026-11-19T02:00:00'
    });
    const review = parseEditorialReview(raw);
    expect(review?.result).toBe('FAIL');
    expect(review?.coreFacts).toBe('unverifiable');
    expect(review?.issues?.[0].suggestion).toBe('改回区间口径');
    expect(review?.minorSuggestions).toEqual(['第二段偏长']);
    expect(parseEditorialReview('{')).toBeNull();
    expect(parseEditorialReview(undefined)).toBeNull();
  });

  it('数据看板线稿件读出标题、分段与事实占位符', () => {
    const script = JSON.stringify({
      dataset_sha256: 'a'.repeat(64),
      source_key: 'gold',
      title: '金价连续三日走高',
      scenes: [
        { lead: '金价站上两千四', body: '这是连续第三个交易日上涨', duration_s: 8 },
        { lead: '涨幅 {{facts.change_pct}}', body: '涨幅主要来自避险资金', duration_s: 10 }
      ],
      closing: '这轮上涨的持续性还要看下一个交易日的开盘',
      source_name: '示例交易所',
      chart: 'line'
    });
    const report = parseScriptReport(script);
    expect(report?.title).toBe('金价连续三日走高');
    expect(report?.chart).toBe('line');
    expect(report?.scenes.map(scene => scene.label)).toEqual(['第1段', '第2段']);
    expect(report?.scenes[1].facts).toEqual(['facts.change_pct']);
    expect(report?.facts).toEqual(['facts.change_pct']);
    expect(report?.sourceKey).toBe('gold');
    expect(report?.sourceUrl).toBeUndefined();
  });

  it('解说线 v2 稿的画面说明随场景读出', () => {
    const script = JSON.stringify({
      source_url: 'https://example.com/a',
      fetched_at: '2026-11-19T00:00:00Z',
      body_sha256: 'b'.repeat(64),
      title: '某地发布新规',
      scenes: [
        { lead: '新规今天落地', body: '首批覆盖三个行业', duration_s: 9, scene_id: 'scene_001', scene_type: 'image',
          visual: { layout: 'full-bleed', motion: 'zoom-in', assets: [{ asset_id: 'a1', role: 'image', source_url: '' }] } }
      ],
      closing: '新规细则见原文',
      source_name: '示例来源',
      schema_version: '2'
    });
    const report = parseScriptReport(script);
    expect(report?.scenes[0].sceneType).toBe('image');
    expect(report?.scenes[0].visualLayout).toBe('full-bleed');
    expect(report?.scenes[0].visualAssets).toBe(1);
    expect(report?.sourceUrl).toBe('https://example.com/a');
    expect(report?.datasetSha).toBeUndefined();
  });

  it('坏稿件不报错，也不编出分段', () => {
    expect(parseScriptReport('{')).toBeNull();
    expect(parseScriptReport(undefined)).toBeNull();
    expect(parseScriptReport('[]')).toBeNull();
    expect(parseScriptReport(JSON.stringify({ title: '只有标题' }))?.scenes).toEqual([]);
  });

  it('事实占位符按出现顺序去重', () => {
    expect(extractFactRefs('{{facts.last.value}} 与 {{facts.change_pct}} 还有 {{facts.last.value}}')).toEqual([
      'facts.last.value',
      'facts.change_pct'
    ]);
    expect(extractFactRefs(undefined)).toEqual([]);
  });
});

/** 一份符合契约的成片级质量审稿报告（quality-review/1）。 */
const qualityReportJson = JSON.stringify({
  schemaVersion: 'quality-review/1',
  versionId: '1900000000000000001',
  mode: 'final',
  reviewedAt: '2026-11-19T10:20:30',
  promptVersion: 'quality-review-v1',
  modelId: 'provider/model',
  criteria: [
    {
      id: 'hook_3s',
      verdict: 'pass',
      class: 'objective',
      confidence: 'high',
      machineVerifiable: true,
      severity: 'none',
      repairable: false,
      evidence: [{ locator: 'script.scenes[0].lead', quote: '金价收于 2381 美元' }],
      reason: '首屏引用 facts.change，第一句即给出可验证结论。'
    },
    {
      id: 'pacing_variation',
      verdict: 'minor',
      class: 'subjective',
      confidence: 'medium',
      machineVerifiable: false,
      severity: 'minor',
      repairable: true,
      evidence: [
        { locator: 'checks[subtitles].measured.scene2StartMs', quote: '3120' },
        { locator: 'checks[subtitles].measured.scene2EndMs', quote: '10980' }
      ],
      reason: '第二段实测 7.9 秒，是全文最长段，但内容只是过渡。'
    },
    {
      id: 'closing_value',
      verdict: 'fail',
      class: 'subjective',
      confidence: 'medium',
      machineVerifiable: false,
      severity: 'major',
      repairable: false,
      evidence: [],
      reason: '结尾只给了结论，没有可讨论的点。'
    },
    {
      id: 'no_redundancy',
      verdict: 'unknown',
      class: 'hypothesis',
      confidence: 'low',
      machineVerifiable: false,
      severity: 'none',
      repairable: false,
      evidence: [],
      reason: '证据不足，无法判断。'
    }
  ],
  summary: {
    pass: 1,
    minor: 1,
    fail: 1,
    unknown: 1,
    objectiveFail: 0,
    subjectiveFail: 1,
    hypothesisFail: 0,
    objectiveVerified: 1,
    subjectiveVerified: 2
  },
  repair: { attempted: 0, max: 1, changedSegments: [], rechecked: false },
  screenshot: { level: 'contact_sheet', frames: 6, extraBrowserRender: false, reason: '模板与脚本均未变更' },
  notes: []
});

describe('成片级质量审稿报告的解析层', () => {
  it('好 JSON 读出判据、计数、修复与截图级别', () => {
    const report = parseQualityReport(qualityReportJson);
    expect(report?.schemaVersion).toBe('quality-review/1');
    expect(report?.mode).toBe('final');
    expect(report?.versionId).toBe('1900000000000000001');
    expect(report?.criteria).toHaveLength(4);
    expect(report?.criteria[0].id).toBe('hook_3s');
    expect(report?.criteria[0].label).toBe('开场前三秒');
    expect(report?.criteria[0].class).toBe('objective');
    expect(report?.criteria[0].machineVerifiable).toBe(true);
    expect(report?.criteria[0].evidence[0].locator).toBe('script.scenes[0].lead');
    expect(report?.criteria[1].class).toBe('subjective');
    expect(report?.criteria[1].machineVerifiable).toBe(false);
    expect(report?.criteria[3].verdict).toBe('unknown');
    expect(report?.summary.pass).toBe(1);
    expect(report?.summary.objectiveFail).toBe(0);
    expect(report?.summary.subjectiveFail).toBe(1);
    expect(report?.repair).toEqual({ attempted: 0, max: 1, changedSegments: [], rechecked: false });
    expect(report?.screenshot.level).toBe('contact_sheet');
    expect(report?.screenshot.frames).toBe(6);
    expect(report?.notes).toEqual([]);
  });

  it('坏 JSON、空串与没有报告都返回 null，不抛错', () => {
    expect(parseQualityReport('{')).toBeNull();
    expect(parseQualityReport('')).toBeNull();
    expect(parseQualityReport(undefined)).toBeNull();
    expect(parseQualityReport('[]')).toBeNull();
    expect(parseQualityReport('"文本"')).toBeNull();
  });

  it('缺字段的报告仍能读出结构，但不凭空造判据', () => {
    const report = parseQualityReport(JSON.stringify({ schemaVersion: 'quality-review/1' }));
    expect(report?.criteria).toEqual([]);
    expect(report?.summary.pass).toBe(0);
    expect(report?.repair).toEqual({ attempted: 0, max: 0, changedSegments: [], rechecked: false });
    expect(report?.screenshot).toEqual({ level: '', frames: 0, extraBrowserRender: false, reason: '' });
    expect(report?.notes).toEqual([]);
  });

  it('版本号是数字时也读成字符串', () => {
    // 后端把 versionId 写成 JSON 数字时，JSON.parse 本身就会把 19 位长整型四舍五入，
    // 这里确认的是「数字也读成字符串」，精度问题不在解析层。
    const report = parseQualityReport(JSON.stringify({ versionId: Number('1900000000000000001') }));
    expect(report?.versionId).toBe('1900000000000000000');
  });

  it('非法枚举退回兜底值：verdict 归证据不足，class 归推测', () => {
    const report = parseQualityReport(
      JSON.stringify({
        criteria: [{ id: 'hook_3s', verdict: 'good', class: 'judgement', confidence: 'very-high', severity: 'urgent' }]
      })
    );
    expect(report?.criteria[0].verdict).toBe('unknown');
    expect(report?.criteria[0].class).toBe('hypothesis');
    expect(report?.criteria[0].confidence).toBe('low');
    expect(report?.criteria[0].severity).toBe('none');
    expect(report?.criteria[0].machineVerifiable).toBe(false);
  });

  it('blocker 只留给 objective 且 fail，其余降一级', () => {
    const report = parseQualityReport(
      JSON.stringify({
        criteria: [
          { id: 'hook_3s', verdict: 'fail', class: 'objective', severity: 'blocker' },
          { id: 'closing_value', verdict: 'fail', class: 'subjective', severity: 'blocker' }
        ]
      })
    );
    expect(report?.criteria[0].severity).toBe('blocker');
    expect(report?.criteria[1].severity).toBe('major');
  });

  it('证据片段的换行原样保留', () => {
    const report = parseQualityReport(
      JSON.stringify({
        criteria: [
          {
            id: 'hook_3s',
            class: 'objective',
            verdict: 'pass',
            evidence: [{ locator: 'script.scenes[0].body', quote: '第一行\n第二行' }]
          }
        ]
      })
    );
    expect(report?.criteria[0].evidence[0].quote).toBe('第一行\n第二行');
  });

  it('summary 与 criteria 不一致时如实报出来，计数按条目重算', () => {
    const report = parseQualityReport(
      JSON.stringify({
        criteria: [
          { id: 'hook_3s', class: 'objective', verdict: 'pass' },
          { id: 'closing_value', class: 'subjective', verdict: 'fail' }
        ],
        summary: { pass: 5, minor: 2, fail: 1, unknown: 1 }
      })
    );
    expect(report?.summary.pass).toBe(5);
    expect(summaryConsistent(report!)).toBe(false);
    expect(qualitySummary(report!.criteria)).toEqual({
      pass: 1,
      minor: 0,
      fail: 1,
      unknown: 0,
      objectiveFail: 0,
      subjectiveFail: 1,
      hypothesisFail: 0
    });
  });

  it('summary 与 criteria 一致时核对通过', () => {
    const report = parseQualityReport(qualityReportJson);
    expect(summaryConsistent(report!)).toBe(true);
  });

  it('同一类里的判据按九条固定顺序排，模型给的顺序不生效', () => {
    const report = parseQualityReport(
      JSON.stringify({
        criteria: [
          { id: 'closing_value', class: 'objective', verdict: 'pass' },
          { id: 'hook_3s', class: 'objective', verdict: 'pass' },
          { id: 'pacing_variation', class: 'objective', verdict: 'pass' }
        ]
      })
    );
    expect(sortQualityCriteria(report!.criteria).map(item => item.id)).toEqual([
      'hook_3s',
      'pacing_variation',
      'closing_value'
    ]);
  });

  it('备注码读成中文事实，不把内部码丢给人看', () => {
    expect(QUALITY_NOTE_LABELS.audio_bgm_dropped).toContain('配乐');
    expect(QUALITY_NOTE_LABELS.model_failed).toContain('模型');
    // 未知码仍然原样显示，不吞掉
    expect(QUALITY_NOTE_LABELS.some_unknown_note).toBeUndefined();
  });
});
