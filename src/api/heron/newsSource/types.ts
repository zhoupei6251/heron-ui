/** 来源类型：前四类为通用抓取，中间五类为直连热榜，最后一类为 NewsNow 聚合。 */
export type NewsSourceType =
  | 'rss'
  | 'atom'
  | 'text'
  | 'weibo'
  | 'baidu'
  | 'toutiao'
  | 'bilibili'
  | 'thepaper'
  | 'zhihu'
  | 'newsnow';

/** NewsNow 平台目录项；enabled 表示同平台来源已存在。 */
export interface NewsNowPlatform {
  platformId: string;
  name: string;
  url: string;
  enabled: boolean;
}

export interface NewsSourceQuery extends PageQuery {
  name?: string;
  sourceType?: NewsSourceType | '';
  enabled?: string;
}

export interface NewsSource {
  sourceId: string;
  name: string;
  sourceType: NewsSourceType;
  url: string;
  intervalSeconds: number;
  /** '0' 启用、'1' 停用，与若依基座的布尔字符列一致。 */
  enabled: string;
  /** '0' 允许自动产出、'1' 不允许；新源默认不允许。 */
  auto: string;
  lastAttemptAt?: string;
  lastSuccessAt?: string;
  nextFetchAt?: string;
  failureCount: number;
  errorCode?: string;
  errorReason?: string;
}

export interface NewsSourceForm {
  sourceId?: string;
  name: string;
  sourceType: NewsSourceType;
  url: string;
  intervalSeconds: number;
  enabled: string;
  auto: string;
}
