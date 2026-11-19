import { describe, expect, it } from 'vitest';
import { reviewTimeline, timelineTime } from './review-timeline';

const measured = {
  alignedScenes: 3, interpolatedBoundaries: 0,
  scene1StartMs: 0, scene1EndMs: 6000,
  scene2StartMs: 6000, scene2EndMs: 20000,
  scene3StartMs: 20000, scene3EndMs: 28000,
  closingStartMs: 28000, closingEndMs: 41500
};
const checks = (values = measured, passed = true) => JSON.stringify([{ gate: 'subtitles', passed, measured: values }]);

describe('逐段审片时间轴', () => {
  it('使用实测的不同段长和完整结尾，并按字幕时间归入实际口播', () => {
    const cues = JSON.stringify([
      { startMs: 100, endMs: 2500, text: '第一句。' },
      { startMs: 2600, endMs: 5900, text: '多行\n字幕。' },
      { startMs: 6000, endMs: 8500, text: '第二段。' },
      { startMs: 28000, endMs: 41000, text: '较长结尾。' }
    ]);
    const rows = reviewTimeline(checks(), cues);
    expect(rows.map(row => [row.startMs, row.endMs])).toEqual([[0, 6000], [6000, 20000], [20000, 28000], [28000, 41500]]);
    expect(rows[0].text).toBe('第一句。多行 字幕。');
    expect(rows[3].label).toBe('结尾');
    expect(rows[3].text).toBe('较长结尾。');
    expect(timelineTime(41500)).toBe('00:41.5');
  });

  it('旧版本、坏报告和不连续时间均不伪造分段', () => {
    expect(reviewTimeline(undefined)).toEqual([]);
    expect(reviewTimeline('{')).toEqual([]);
    expect(reviewTimeline(checks(measured, false))).toEqual([]);
    expect(reviewTimeline(checks({ ...measured, scene2StartMs: 6500 }))).toEqual([]);
    expect(reviewTimeline(checks({ ...measured, closingEndMs: NaN }))).toEqual([]);
  });

  it('字幕读取失败仍保留可信跳转；估算边界的跨段cue不会冒充单段精确口播', () => {
    expect(reviewTimeline(checks(), 'bad')[0].text).toBe('');
    const cues = JSON.stringify([{ startMs: 5800, endMs: 6200, text: '跨段短cue' }]);
    const rows = reviewTimeline(checks({ ...measured, interpolatedBoundaries: 1 }), cues);
    expect(rows[0].text).toBe('');
    expect(rows[1].text).toBe('');
  });
});
