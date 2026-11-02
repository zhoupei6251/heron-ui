import type { ProductionReceipt } from '@/api/heron/production/types';
import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';
import type {
  ProtoDeliverForm,
  ProtoDelivery,
  ProtoGenerateForm,
  ProtoNativeVerification,
  ProtoProject,
  ProtoProjectForm,
  ProtoProjectQuery,
  ProtoReviewForm,
  ProtoVerificationForm,
  ProtoVersion
} from './types';

export const listProtoProject = (query: ProtoProjectQuery): AxiosPromise<PageResult<ProtoProject>> => {
  return request({ url: '/heron/proto/list', method: 'get', params: query });
};

export const getProtoProject = (projectId: string): AxiosPromise<ProtoProject> => {
  return request({ url: '/heron/proto/' + projectId, method: 'get' });
};

export const addProtoProject = (data: ProtoProjectForm): AxiosPromise<ProtoProject> => {
  return request({ url: '/heron/proto', method: 'post', data });
};

/** 保存草稿带 expectedRevision：版本冲突由后端拒绝，前端不静默覆盖。 */
export const updateProtoProject = (projectId: string, data: ProtoProjectForm): AxiosPromise<ProtoProject> => {
  return request({ url: '/heron/proto/' + projectId, method: 'put', data });
};

export const archiveProtoProject = (projectId: string): AxiosPromise<ProtoProject> => {
  return request({ url: '/heron/proto/' + projectId + '/archive', method: 'post' });
};

export const generateProto = (projectId: string, data: ProtoGenerateForm): AxiosPromise<ProductionReceipt> => {
  return request({ url: '/heron/proto/' + projectId + '/generate', method: 'post', data });
};

export const listProtoVersions = (projectId: string, query: PageQuery): AxiosPromise<PageResult<ProtoVersion>> => {
  return request({ url: '/heron/proto/' + projectId + '/versions', method: 'get', params: query });
};

export const getProtoVersion = (projectId: string, versionId: string): AxiosPromise<ProtoVersion> => {
  return request({ url: `/heron/proto/${projectId}/versions/${versionId}`, method: 'get' });
};

export const reviewProtoVersion = (
  projectId: string,
  versionId: string,
  data: ProtoReviewForm
): AxiosPromise<ProtoVersion> => {
  return request({ url: `/heron/proto/${projectId}/versions/${versionId}/review`, method: 'post', data });
};

/** 人工原生验证声明：只有用户显式勾选才可能记为通过。 */
export const verifyProtoVersion = (
  projectId: string,
  versionId: string,
  data: ProtoVerificationForm
): AxiosPromise<ProtoNativeVerification> => {
  return request({ url: `/heron/proto/${projectId}/versions/${versionId}/native-verifications`, method: 'post', data });
};

export const deliverProtoVersion = (
  projectId: string,
  versionId: string,
  data: ProtoDeliverForm
): AxiosPromise<ProtoDelivery> => {
  return request({ url: `/heron/proto/${projectId}/versions/${versionId}/deliver`, method: 'post', data });
};

/**
 * 预览要带登录头，<img> 直链拿不到令牌；拦截器对 blob 直接返回 res.data。
 */
export const fetchProtoPreview = (projectId: string, versionId: string, artifactId: string): Promise<Blob> => {
  return request({
    url: `/heron/proto/${projectId}/versions/${versionId}/preview/${artifactId}`,
    method: 'get',
    responseType: 'blob'
  }) as unknown as Promise<Blob>;
};
