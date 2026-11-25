/** 只有显式白名单许可可进入生产；UNKNOWN/空白/自定义许可由后端拒绝。 */
export type MediaAssetLicense = 'OWNED' | 'PUBLIC_DOMAIN' | 'CC0' | 'CC_BY' | 'CC_BY_SA';

export interface MediaAssetQuery extends PageQuery {
  name?: string;
  licenseCode?: MediaAssetLicense | '';
  assetKind?: 'IMAGE' | '';
  params?: Record<string, unknown>;
}

export interface MediaAsset {
  id: string;
  name: string;
  assetKind: 'IMAGE';
  sourceUri: string;
  licenseCode: MediaAssetLicense;
  licenseEvidenceUri: string;
  attribution?: string;
  tags?: string;
  width: number;
  height: number;
  orientation: 'PORTRAIT' | 'LANDSCAPE' | 'SQUARE';
  contentSha256: string;
  sizeBytes: number;
  mediaType: 'image/png' | 'image/jpeg';
  ossConfigKey: string;
  ossKey: string;
  ossUrl: string;
  createTime?: string;
  updateTime?: string;
}

export interface MediaAssetForm {
  id?: string;
  name: string;
  sourceUri: string;
  licenseCode: MediaAssetLicense | '';
  licenseEvidenceUri: string;
  attribution?: string;
  tags?: string;
}

export interface MediaAssetSelectionRequest {
  sceneId: string;
  sceneNumber: number;
  sceneType: string;
  assetId?: string;
  orientation?: 'PORTRAIT' | 'LANDSCAPE' | 'SQUARE';
  keywords?: string[];
}

export interface MediaAssetGate {
  gate: 'assets';
  inputLocator: string;
  passed: boolean;
  reason: string;
  measured: {
    licenseChecked: boolean;
    assetPresent: boolean;
    assetId?: string;
    fallbackToText: boolean;
  };
}

/**
 * imageValue 选中时是 OSS 源地址，V2 落盘后替换为模板相对文件名；
 * TEXT_ONLY 时为空串，模板据此关闭图片区。
 */
export interface MediaAssetSelection {
  sceneId: string;
  sceneNumber: number;
  sceneType: string;
  status: 'SELECTED' | 'TEXT_ONLY';
  reasonCode: string;
  reason: string;
  imageVariable: string;
  imageValue: string;
  assetId?: string;
  assetName?: string;
  licenseCode?: MediaAssetLicense;
  licenseEvidenceUri?: string;
  attribution?: string;
  sourceUri?: string;
  contentSha256?: string;
  width?: number;
  height?: number;
  ossConfigKey?: string;
  ossKey?: string;
  gate: MediaAssetGate;
}
