import { describe, expect, it } from 'vitest';
import { parseStoryboard } from './storyboard';

const storyboardScript = JSON.stringify({
  title: '关注指数十二期走势',
  scenes: [
    { lead: '这轮抬升是趋势吗', body: '旁白正文一', scene_type: 'headline', beat: 'HOOK', on_screen_text: '这轮抬升是趋势吗' },
    { lead: '九个月收涨', body: '旁白正文二', scene_type: 'chart', beat: 'CONTEXT' },
    { lead: '拐点看下一期斜率', body: '旁白正文三', scene_type: 'number', beat: 'CONCLUSION' }
  ],
  closing: '以上只描述示例快照的走势。'
});

const legacyScript = JSON.stringify({
  title: '旧稿',
  scenes: [
    { lead: '第一段', body: '正文一', duration_s: 15 },
    { lead: '第二段', body: '正文二', duration_s: 15 },
    { lead: '第三段', body: '正文三', duration_s: 15 }
  ],
  closing: '结尾。'
});

describe('分镜展示模型', () => {
  it('读出每屏的节点、组件与上屏文字', () => {
    const report = parseStoryboard(storyboardScript);
    expect(report).not.toBeNull();
    expect(report!.storyboardScenes).toBe(3);
    expect(report!.components).toEqual(['headline', 'chart', 'number']);
    expect(report!.scenes[0].beatLabel).toBe('钩子');
    expect(report!.scenes[0].sceneTypeLabel).toBe('大标题屏');
    expect(report!.scenes[0].onScreenText).toBe('这轮抬升是趋势吗');
  });

  it('没写上屏文字的屏如实留空，页面才知道要显示「沿用领句」', () => {
    const report = parseStoryboard(storyboardScript);
    expect(report!.scenes[1].onScreenText).toBe('');
  });

  it('旧稿没有分镜：段数照读，但不谎称有分镜', () => {
    const report = parseStoryboard(legacyScript);
    expect(report!.storyboardScenes).toBe(0);
    expect(report!.scenes.length).toBe(3);
    expect(report!.components).toEqual([]);
  });

  it('产物不是脚本契约时返回 null，不返回半份', () => {
    expect(parseStoryboard('not json')).toBeNull();
    expect(parseStoryboard('{"title":"没有 scenes"}')).toBeNull();
  });
});
