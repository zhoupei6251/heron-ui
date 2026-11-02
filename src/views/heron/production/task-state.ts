import type { ProductionStatus } from '@/api/heron/production/types';

export const isProductionActive = (status: ProductionStatus) =>
  status === 'queued' || status === 'running' || status === 'cancelling';

export const productionStatusText: Record<ProductionStatus, string> = {
  queued: '排队中',
  running: '执行中',
  cancelling: '取消中',
  succeeded: '已完成',
  failed: '失败',
  cancelled: '已取消'
};

export const productionStatusTag: Record<ProductionStatus, string> = {
  queued: 'info',
  running: 'primary',
  cancelling: 'warning',
  succeeded: 'success',
  failed: 'danger',
  cancelled: 'info'
};

export const productionBizText: Record<string, string> = {
  news_video: '热点新闻',
  prototype: '原型工坊'
};
