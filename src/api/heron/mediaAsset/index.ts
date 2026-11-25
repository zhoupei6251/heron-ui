import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';
import type {
  MediaAsset,
  MediaAssetForm,
  MediaAssetQuery,
  MediaAssetSelection,
  MediaAssetSelectionRequest
} from './types';

export const listMediaAsset = (query: MediaAssetQuery): AxiosPromise<PageResult<MediaAsset>> => {
  return request({ url: '/heron/mediaAsset/list', method: 'get', params: query });
};

export const getMediaAsset = (assetId: string | number): AxiosPromise<MediaAsset> => {
  return request({ url: '/heron/mediaAsset/' + assetId, method: 'get' });
};

/** 文件与元数据一起提交；尺寸、SHA-256 和 OSS 指针由后端实算。 */
export const addMediaAsset = (data: FormData): AxiosPromise<MediaAsset> => {
  return request({ url: '/heron/mediaAsset', method: 'post', data });
};

export const updateMediaAsset = (data: MediaAssetForm): AxiosPromise<MediaAsset> => {
  return request({ url: '/heron/mediaAsset', method: 'put', data });
};

export const delMediaAsset = (assetIds: string | number | Array<string | number>): AxiosPromise<void> => {
  return request({ url: '/heron/mediaAsset/' + assetIds, method: 'delete' });
};

/** V2 场景选材契约；缺素材返回 TEXT_ONLY 与空 imageValue，不返回空帧。 */
export const selectMediaAsset = (data: MediaAssetSelectionRequest): AxiosPromise<MediaAssetSelection> => {
  return request({ url: '/heron/mediaAsset/select', method: 'post', data });
};
