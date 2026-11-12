export interface DataSourceQuery extends PageQuery {
  category?: string;
  commercialOk?: string;
  probeStatus?: string;
}

/**
 * 数据源注册表一行。enabled '0' 启用、'1' 停用，与新闻来源一致。
 * commercialOk 是授权口径：true / false / unknown，unknown 不能商用。
 */
export interface DataSource {
  sourceKey: string;
  name: string;
  category?: string;
  endpoint?: string;
  historyEndpoint?: string;
  httpMethod?: string;
  dataFormat?: string;
  cadence?: string;
  historyDays?: number;
  commercialOk?: 'true' | 'false' | 'unknown' | string;
  termsUrl?: string;
  shapes?: string;
  enabled?: string;
  probeStatus?: 'ok' | 'blocked' | 'no_permission' | string;
  probeNote?: string;
  lastUpdated?: string;
  failureCount?: number;
}
