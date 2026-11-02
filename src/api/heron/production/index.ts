import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';
import type { ProductionCapabilities, ProductionTask, ProductionTaskQuery } from './types';

export const listProduction = (query: ProductionTaskQuery): AxiosPromise<PageResult<ProductionTask>> => {
  return request({
    url: '/heron/production/list',
    method: 'get',
    params: query
  });
};

export const getProduction = (taskId: string): AxiosPromise<ProductionTask> => {
  return request({
    url: '/heron/production/' + taskId,
    method: 'get'
  });
};

export const cancelProduction = (taskId: string): AxiosPromise<ProductionTask> => {
  return request({
    url: '/heron/production/' + taskId + '/cancel',
    method: 'post'
  });
};

export const getProductionCapabilities = (): AxiosPromise<ProductionCapabilities> => {
  return request({
    url: '/heron/production/capabilities',
    method: 'get'
  });
};
