/**
 * 分镜的展示模型：把后端写进 script.json 的 scenes[].beat / scene_type / on_screen_text 读出来。
 *
 * 只转述，不重算不补字段——这一屏用什么画面、承担什么叙事节点、上屏写哪句话，
 * 都是写稿时就定下的；页面不从旁白里另推一份分镜出来。
 * 产物损坏就说损坏：解析失败返回 null，不返回半份。
 */

/** 叙事节点的中文说法。取值域与后端 StoryboardContract.BEATS 一致。 */
export const BEAT_LABELS: Record<string, string> = {
  HOOK: '钩子',
  CONTEXT: '铺垫',
  QUESTION: '提问',
  EVIDENCE: '证据',
  COMPARISON: '对比',
  REVEAL: '揭示',
  EXPLANATION: '解释',
  INSIGHT: '洞察',
  CONCLUSION: '收束'
};

/** 画面组件的中文说法。取值域与后端 StoryboardContract.SCENE_TYPES 一致。 */
export const SCENE_TYPE_LABELS: Record<string, string> = {
  headline: '大标题屏',
  text: '文字屏',
  chart: '图表屏',
  number: '数字屏',
  compare: '对比屏',
  timeline: '时间轴屏',
  image: '配图屏',
  quote: '引用屏',
  list: '清单屏',
  rank: '排行屏',
  qa: '问答屏'
};

export interface StoryboardScene {
  /** 屏次，1 起。 */
  index: number;
  beat: string;
  beatLabel: string;
  sceneType: string;
  sceneTypeLabel: string;
  /** 上屏的那一行短句；空表示沿用领句。 */
  onScreenText: string;
  /** 旁白领句。 */
  lead: string;
}

export interface Storyboard {
  scenes: StoryboardScene[];
  /** 写了分镜的段数。整篇为 0 说明这是还没用分镜的旧稿。 */
  storyboardScenes: number;
  /** 用到哪几种画面组件，按首次出现排序。 */
  components: string[];
}

interface RawScene {
  lead?: unknown;
  body?: unknown;
  beat?: unknown;
  scene_type?: unknown;
  on_screen_text?: unknown;
}

const str = (value: unknown): string => (typeof value === 'string' ? value : '');

/**
 * 解析 script.json。
 *
 * @returns 分镜；产物不是脚本契约时返回 null
 */
export function parseStoryboard(raw: string): Storyboard | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const scenes = (parsed as { scenes?: unknown }).scenes;
  if (!Array.isArray(scenes)) return null;

  const out: StoryboardScene[] = [];
  const components: string[] = [];
  let storyboardScenes = 0;
  scenes.forEach((item, index) => {
    const scene = item as RawScene;
    const beat = str(scene.beat);
    const sceneType = str(scene.scene_type);
    if (beat) storyboardScenes += 1;
    if (sceneType && !components.includes(sceneType)) components.push(sceneType);
    out.push({
      index: index + 1,
      beat,
      beatLabel: BEAT_LABELS[beat] || beat,
      sceneType,
      sceneTypeLabel: SCENE_TYPE_LABELS[sceneType] || sceneType,
      onScreenText: str(scene.on_screen_text),
      lead: str(scene.lead)
    });
  });
  return { scenes: out, storyboardScenes, components };
}
