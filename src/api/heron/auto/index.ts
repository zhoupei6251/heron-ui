import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

export interface AutoStatus {
  enabled: boolean;
  paused: boolean;
  confirmEnabled: boolean;
  slots: string[];
}

export const getAutoStatus = (): AxiosPromise<AutoStatus> => {
  return request({ url: '/heron/auto/status', method: 'get' });
};

export const pauseAuto = (): AxiosPromise<void> => {
  return request({ url: '/heron/auto/pause', method: 'post' });
};

export const resumeAuto = (): AxiosPromise<void> => {
  return request({ url: '/heron/auto/resume', method: 'post' });
};
