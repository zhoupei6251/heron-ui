/**
 * RSS 摘要是 HTML 片段（`<p data-vmark=…>`、`<img>`、`<strong>`），直接渲染会把标签显示出来。
 * 这里只剥标签、解常见实体、压空白——不用 v-html：正文来自外部站点，注入面太大。
 */
export const plainText = (html?: string | null) =>
  (html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
