export interface ReviewSegment {
  id: string;
  label: string;
  startMs: number;
  endMs: number;
  text: string;
}

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const millis = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

/** 只展示后端实际对齐记录；旧版本不从模型声明时长推算。 */
export function reviewTimeline(checks?: string, subtitles?: string): ReviewSegment[] {
  let measured: Record<string, unknown>;
  try {
    const gates: unknown = JSON.parse(checks || 'null');
    if (!Array.isArray(gates)) return [];
    const gate = gates.find(item => record(item) && item.gate === 'subtitles' && item.passed === true);
    if (!record(gate) || !record(gate.measured)) return [];
    measured = gate.measured;
  } catch {
    return [];
  }
  const count = measured.alignedScenes;
  if (!millis(count) || count < 1 || count > 6) return [];
  const segments: ReviewSegment[] = [];
  for (let index = 1; index <= count + 1; index++) {
    const closing = index === count + 1;
    const id = closing ? 'closing' : `scene${index}`;
    const startMs = measured[`${id}StartMs`];
    const endMs = measured[`${id}EndMs`];
    if (!millis(startMs) || !millis(endMs) || endMs <= startMs
      || startMs !== (segments.at(-1)?.endMs ?? 0)) return [];
    segments.push({ id, label: closing ? '结尾' : `第${index}段`, startMs, endMs, text: '' });
  }
  try {
    const cues: unknown = JSON.parse(subtitles || 'null');
    if (Array.isArray(cues)) {
      for (const segment of segments) {
        segment.text = cues.filter(cue => record(cue) && millis(cue.startMs) && millis(cue.endMs)
          && cue.endMs > cue.startMs && cue.startMs >= segment.startMs && cue.endMs <= segment.endMs
          && typeof cue.text === 'string')
          .map(cue => cue.text.replace(/\s+/g, ' ').trim()).join('');
      }
    }
  } catch {
    // 字幕不可用不影响已经验证的分段时间。
  }
  return segments;
}

export function timelineTime(ms: number): string {
  return `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${(ms % 60000 / 1000).toFixed(1).padStart(4, '0')}`;
}
