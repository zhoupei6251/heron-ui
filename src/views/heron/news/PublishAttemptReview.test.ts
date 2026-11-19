import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import ElementPlus from 'element-plus';
import { describe, expect, it, vi } from 'vitest';
import type { NewsVideoVersion } from '@/api/heron/newsWork/types';
import PublishAttemptReview from './PublishAttemptReview.vue';

vi.mock('@/api/heron/newsWork', () => ({
  confirmNewsVersion: vi.fn(), getNewsVersion: vi.fn(), resolveNewsPublishAttempt: vi.fn()
}));
vi.mock('@/plugins/modal', () => ({ default: { msgSuccess: vi.fn(), msgWarning: vi.fn() } }));
vi.mock('../heron-time', () => ({ utcText: (value?: string) => value || '-' }));

const version = (status: 'submitted' | 'unknown' | 'not_published' | 'published'): NewsVideoVersion => ({
  workId: '1', versionId: '2', versionNo: 1, reviewStatus: 'approved', taskStatus: 'succeeded',
  reviewVideoSha: 'a'.repeat(64), reviewContactSha: 'b'.repeat(64),
  publishAttempt: { attemptId: '3', versionId: '2', videoSha: 'a'.repeat(64), source: 'douyin-cli',
    account: 'heron', status, startedAt: '2026-11-18T04:00:00' }
});

async function render(row: NewsVideoVersion) {
  const app = createSSRApp({ render: () => h(PublishAttemptReview, { version: row }) });
  app.use(ElementPlus);
  app.directive('hasPermi', {});
  return renderToString(app);
}

describe('实际发布核对组件的可见状态', () => {
  it('submitted展示核对表单，时间保持空白，未填写信息时不能保存', async () => {
    const html = await render(version('submitted'));
    expect(html).toContain('已提交，待核对');
    expect(html).toContain('平台作品链接');
    const timeInput = [...html.matchAll(/<input\b[^>]*>/g)].map(match => match[0])
      .find(tag => tag.includes('按平台显示的实际时间填写'));
    expect(timeInput).toBeDefined();
    expect(timeInput).not.toMatch(/\bvalue="[^"]+"/);
    const save = [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)]
      .find(match => match[2].includes('保存核对结果'));
    expect(save?.[1]).toContain('disabled');
    expect(html).not.toContain('重新提交本版');
  });

  it('结果未知只引导核对，不提供再次上传入口', async () => {
    const html = await render(version('unknown'));
    expect(html).toContain('结果未知');
    expect(html).toContain('系统不会重复上传');
    expect(html).not.toContain('重新提交本版');
  });

  it('已核对未发出显示重新提交，核对表单退出', async () => {
    const html = await render(version('not_published'));
    expect(html).toContain('重新提交本版');
    expect(html).not.toContain('保存核对结果');
  });

  it('沙箱明确未上抖音，不能当作真实发布再次上传', async () => {
    const row = version('published');
    row.publishSource = 'sandbox';
    row.publishAt = '2026-11-18T04:00:00';
    const html = await render(row);
    expect(html).toContain('未上抖音');
    expect(html).not.toContain('保存核对结果');
    expect(html).not.toContain('重新提交本版');
  });
});
