/** 模板是 data/templates 下带 LOCK.json 的目录，不是数据库记录。 */
export interface VideoTemplate {
  key: string;
  name: string;
  description?: string;
  locked: boolean;
  lockProblem?: string;
  templateVersion?: string;
  voiceKey?: string;
  assetManifestSha256?: string;
}
