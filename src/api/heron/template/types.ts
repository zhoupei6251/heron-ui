/** 视觉风格。色值来自模板的 design token，前端不另抄一份。 */
export interface VideoStyle {
  key: string;
  name: string;
  label: string;
  role?: string;
  bg?: string;
  fg?: string;
  accent?: string;
}

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
  /** 能跑哪条生产线；空的表示老模板没声明，后端会按名字前缀推断。 */
  supportedLines?: string[];
  /** 能渲染哪些场景类型。image 在列才说明这套模板放得下配图。 */
  supportedSceneTypes?: string[];
  aspectRatio?: string;
  minDuration?: number;
  maxDuration?: number;
  /** 老模板没有风格声明时为 null。 */
  style?: VideoStyle | null;
  /** 视觉模式：2d 默认；3d 只服务空间数据（geo），由后端按模板声明给出。 */
  visualMode?: '2d' | '3d';
}
