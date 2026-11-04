import { parseTime } from '@/utils/ruoyi';

/**
 * 服务端写的是 UTC 墙钟（Clock.systemUTC），naive 字符串直接渲染会差整个时区偏移；
 * 补上 Z 再交给 parseTime，就按浏览器本地时区显示。
 */
export const utcText = (value?: string | Date | null) => {
  if (!value) return '-';
  const naive = String(value).slice(0, 19).replace(' ', 'T');
  const iso = naive.includes('Z') || naive.includes('+') ? naive : `${naive}Z`;
  return (parseTime(new Date(iso), '{y}-{m}-{d} {h}:{i}:{s}') as string) || '-';
};
