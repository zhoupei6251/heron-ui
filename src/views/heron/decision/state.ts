import type { DecisionStatus, DecisionType } from '@/api/heron/decision/types';

export const decisionTypeText: Record<DecisionType, string> = {
  PRODUCE: '值得做',
  OBSERVE: '再观察',
  REJECT: '不值得做'
};

/** PRODUCE 才用 success：它只是「建议生产」，最终能不能生产仍由业务闸决定。 */
export const decisionTypeTag: Record<DecisionType, 'success' | 'warning' | 'info'> = {
  PRODUCE: 'success',
  OBSERVE: 'warning',
  REJECT: 'info'
};

export const decisionStatusText: Record<DecisionStatus, string> = {
  proposed: '待处理',
  accepted: '已采纳',
  rejected: '已否决'
};

export const decisionStatusTag: Record<DecisionStatus, 'warning' | 'success' | 'danger'> = {
  proposed: 'warning',
  accepted: 'success',
  rejected: 'danger'
};
