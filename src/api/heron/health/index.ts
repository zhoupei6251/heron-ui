import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';
import type { HeronHealth } from './types';

export const getHeronHealth = (): AxiosPromise<HeronHealth> => {
  return request({
    url: '/heron/health/overview',
    method: 'get'
  });
};
