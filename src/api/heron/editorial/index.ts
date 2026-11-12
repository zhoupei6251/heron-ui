import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';
import type { EditorialRun, EditorialRunQuery } from './types';

export const listEditorialRuns = (query: EditorialRunQuery): AxiosPromise<PageResult<EditorialRun>> => {
  return request({ url: '/heron/editorial/runs', method: 'get', params: query });
};

/** 槽位时刻就是 cron 表达式，含空格与星号，只能走查询参数。 */
export const getEditorialRun = (slotDate: string, slotTime: string): AxiosPromise<EditorialRun> => {
  return request({ url: '/heron/editorial/runs/detail', method: 'get', params: { slotDate, slotTime } });
};
