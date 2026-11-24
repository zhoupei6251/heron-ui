import { describe, expect, it, vi, afterEach } from 'vitest';
import type { NewsVideoVersion } from '@/api/heron/newsWork/types';
import { publicationState, confirmationMessage, canSubmitReviewedVersion, resolutionPayload } from './publish-state';

const sha = 'a'.repeat(64);
const version = (changes: Partial<NewsVideoVersion> = {}): NewsVideoVersion => ({
  workId: '1', id: '2', versionNo: 1, reviewStatus: 'approved', taskStatus: 'succeeded',
  reviewVideoSha: sha, reviewContactSha: 'b'.repeat(64), ...changes
});
const attempt = { id: '3', versionId: '2', videoSha: sha, source: 'douyin-cli', account: 'heron', status: 'submitted' as const };
const form = { decision: 'published' as const, reason: '已核对平台', uploadStopped: false,
  workUrl: 'https://www.douyin.com/video/7400000000000000000', account: 'heron', publishedEpoch: '1794974400000' };

afterEach(() => vi.useRealTimers());

describe('发布尝试与已发布事实分离', () => {
  it('仅submitted不能显示成已发布，未知状态同样不允许重试', () => {
    const row = version({ publishAttempt: attempt });
    expect(publicationState(row)).toBe('submitted');
    expect(confirmationMessage(row)).toContain('核对');
    expect(canSubmitReviewedVersion(row)).toBe(false);
    expect(canSubmitReviewedVersion(version({ publishAttempt: { ...attempt, status: 'unknown' } }))).toBe(false);
    expect(canSubmitReviewedVersion(version({ publishAttempt: { ...attempt, status: 'started' } }))).toBe(false);
  });

  it('人工确认未发出后才能重新提交；沙箱和历史提交保留各自口径', () => {
    expect(canSubmitReviewedVersion(version({ publishAttempt: { ...attempt, status: 'not_published' } }))).toBe(true);
    expect(canSubmitReviewedVersion(version({ reviewVideoSha: undefined }))).toBe(false);
    expect(publicationState(version({ publishAt: '2026-11-18T04:00:00', publishSource: 'sandbox' }))).toBe('sandbox');
    expect(publicationState(version({ publishAt: '2026-11-18T04:00:00', publishSource: 'douyin-cli' }))).toBe('legacy_submitted');
    expect(publicationState(version({ publishAt: '2026-11-18T04:00:00', publishSource: 'douyin-cli', publishUrl: form.workUrl }))).toBe('legacy_submitted');
    expect(publicationState(version({ publishAt: '2026-11-18T04:00:00', publishSource: 'manual', publishUrl: form.workUrl }))).toBe('published');
  });

  it('实际本地选择的时刻转UTC墙钟，必须输入真实时间而不默认为现在', () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-11-18T08:00:00Z'));
    const payload = resolutionPayload(attempt, form);
    expect(payload.videoSha256).toBe(sha);
    expect(payload.receipt?.videoSha256).toBe(sha);
    expect(payload.receipt?.publishedAt).toBe('2026-11-18T04:00:00');
    expect(() => resolutionPayload(attempt, { ...form, publishedEpoch: '' })).toThrow('实际发布时间');
    expect(() => resolutionPayload(attempt, { ...form, publishedEpoch: String(Date.now() + 1000) })).toThrow('未来');
  });

  it('解除保护必须明确停掉上传并填理由，回执不能绑定其他账号或伪造域名', () => {
    expect(() => resolutionPayload(attempt, { ...form, decision: 'not_published' })).toThrow('停止');
    expect(resolutionPayload(attempt, { ...form, decision: 'not_published', uploadStopped: true }).receipt).toBeUndefined();
    expect(() => resolutionPayload(attempt, { ...form, reason: ' ' })).toThrow('理由');
    expect(() => resolutionPayload(attempt, { ...form, account: 'other' })).toThrow('账号');
    expect(() => resolutionPayload(attempt, { ...form, workUrl: 'https://www.douyin.com.evil.test/video/1' })).toThrow('链接');
  });
});
