import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';
import type { VideoTemplate } from './types';

export const listVideoTemplate = (): AxiosPromise<VideoTemplate[]> => {
  return request({ url: '/heron/template/list', method: 'get' });
};
