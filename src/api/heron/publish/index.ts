import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';
import type { PublishInventory, PublishInventoryQuery, PublishReservation } from './types';

export const listPublishInventory = (
  query: PublishInventoryQuery
): AxiosPromise<PageResult<PublishInventory>> => {
  return request({
    url: '/heron/publish/inventory/list',
    method: 'get',
    params: query
  });
};

export const reservePublishInventory = (id: string): AxiosPromise<PublishReservation> => {
  return request({
    url: `/heron/publish/inventory/${id}/reserve`,
    method: 'post'
  });
};
