import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';
import type { DataSource, DataSourceQuery } from './types';

export const listDataSource = (query: DataSourceQuery): AxiosPromise<PageResult<DataSource>> => {
  return request({ url: '/heron/dataSource/list', method: 'get', params: query });
};

export const getDataSource = (sourceKey: string): AxiosPromise<DataSource> => {
  return request({ url: '/heron/dataSource/' + sourceKey, method: 'get' });
};
