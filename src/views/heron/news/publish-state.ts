import type { NewsPublishAttempt, NewsPublishResolution, NewsVideoVersion } from '@/api/heron/newsWork/types';

export type PublicationState = NewsPublishAttempt['status'] | 'none' | 'sandbox' | 'legacy_submitted';
export const publicationText: Record<PublicationState, string> = {
  none: '未提交', started: '尝试已登记', unknown: '结果未知', submitted: '已提交，待核对',
  published: '已核对发布', not_published: '已核对未发出', sandbox: '沙箱完成（未上抖音）', legacy_submitted: '历史命令行记录'
};
export const publicationTag: Record<PublicationState, 'info' | 'success' | 'warning' | 'danger'> = {
  none: 'info', started: 'warning', unknown: 'danger', submitted: 'warning', published: 'success',
  not_published: 'info', sandbox: 'warning', legacy_submitted: 'warning'
};
export const publishSourceText: Record<string, string> = {
  manual: '人工核对回执', api: '平台接口回执', 'douyin-cli': '命令行提交', sandbox: '沙箱（未上抖音）'
};

export function isUnresolvedAttempt(attempt?: NewsPublishAttempt): boolean {
  return !!attempt && ['started', 'unknown', 'submitted'].includes(attempt.status);
}

export function publicationState(version?: Pick<NewsVideoVersion, 'publishAt' | 'publishSource' | 'publishUrl' | 'publishAttempt'>): PublicationState {
  if (!version) return 'none';
  const attempt = version.publishAttempt;
  if (isUnresolvedAttempt(attempt)) return attempt!.status;
  if (version.publishSource === 'sandbox' && version.publishAt) return 'sandbox';
  if (version.publishSource === 'douyin-cli' && version.publishAt && !attempt) return 'legacy_submitted';
  if (version.publishAt) return 'published';
  if (attempt?.status === 'not_published') return 'not_published';
  return attempt ? 'unknown' : 'none';
}

export function confirmationMessage(version: NewsVideoVersion): string {
  if (version.reviewStatus === 'rejected') return '驳回已记录';
  switch (publicationState(version)) {
    case 'sandbox': return '沙箱流程已完成，未发布到抖音';
    case 'published': return '发布回执已记录';
    case 'submitted': return '已提交，请核对平台结果';
    case 'started': case 'unknown': return '已有发布尝试，请先核对结果';
    case 'legacy_submitted': return '已有历史提交记录，请核对平台结果';
    default: return '处理结果已记录';
  }
}

export function canSubmitReviewedVersion(version?: NewsVideoVersion): boolean {
  if (!version || version.reviewStatus !== 'approved' || version.taskStatus !== 'succeeded' || version.publishAt) return false;
  const state = publicationState(version);
  return ['none', 'not_published'].includes(state)
    && /^[0-9a-f]{64}$/.test(version.reviewVideoSha || '') && /^[0-9a-f]{64}$/.test(version.reviewContactSha || '');
}

export interface PublishResolutionForm {
  decision: 'published' | 'not_published';
  reason: string;
  uploadStopped: boolean;
  workUrl: string;
  account: string;
  publishedEpoch: string;
}

export function resolutionPayload(attempt: NewsPublishAttempt, form: PublishResolutionForm): NewsPublishResolution {
  if (!isUnresolvedAttempt(attempt) || !/^[0-9a-f]{64}$/.test(attempt.videoSha)) throw new Error('缺少可核对的尝试或成片指纹');
  const reason = form.reason.trim();
  if (!reason || reason.length > 1000) throw new Error('请填写不超过1000字的核对理由');
  const payload: NewsPublishResolution = { decision: form.decision, videoSha256: attempt.videoSha, reason, uploadStopped: form.uploadStopped };
  if (form.decision === 'not_published') {
    if (!form.uploadStopped) throw new Error('请先确认上传已停止，且平台确实未发布');
    return payload;
  }
  const workUrl = form.workUrl.trim();
  let validUrl = false;
  try {
    const url = new URL(workUrl);
    const authority = workUrl.match(/^https:\/\/([^/?#]+)/)?.[1] || '';
    validUrl = /^(?:[a-z0-9-]+\.)*douyin\.com$/.test(authority) && url.pathname.length > 1 && workUrl.length <= 2048;
  } catch { /* 无效输入交由下面统一提示。 */ }
  if (!validUrl) throw new Error('请填写有效的抖音作品链接');
  const account = form.account.trim();
  if (!account || account.length > 120 || (attempt.account && account !== attempt.account)) throw new Error('核对账号必须与目标账号一致');
  const epoch = Number(form.publishedEpoch);
  if (!form.publishedEpoch || !Number.isFinite(epoch) || epoch <= 0 || Number.isNaN(new Date(epoch).getTime())) {
    throw new Error('请填写平台显示的实际发布时间');
  }
  if (epoch > Date.now()) throw new Error('实际发布时间不能是未来时间');
  payload.receipt = { workUrl, account, publishedAt: new Date(epoch).toISOString().slice(0, 19), videoSha256: attempt.videoSha };
  return payload;
}
