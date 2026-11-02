export type NewsSourceType = 'rss' | 'atom' | 'text';

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
}
