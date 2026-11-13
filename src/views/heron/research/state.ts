import type { ResearchStatus } from '@/api/heron/research/types';

export const isResearchActive = (status?: string) => status === 'queued' || status === 'running';

export const researchStatusText: Record<ResearchStatus, string> = {
  queued: '排队中',
  running: '执行中',
  succeeded: '已完成',
  partial: '不完整',
  failed: '失败',
  cancelled: '已取消'
};

/** partial 用 warning 而不是 success：结论可用，但预算或轮数到点了。 */
export const researchStatusTag: Record<ResearchStatus, 'primary' | 'success' | 'info' | 'warning' | 'danger'> = {
  queued: 'info',
  running: 'primary',
  succeeded: 'success',
  partial: 'warning',
  failed: 'danger',
  cancelled: 'info'
};
