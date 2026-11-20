<template>
  <div class="p-2 app-container heron-editorial-page">
    <el-card shadow="hover" class="toolbar-panel">
      <div class="editorial-toolbar">
        <div class="toolbar-fields">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            unlink-panels
            @change="handleQuery"
          />
          <el-select v-model="queryParams.selectedLine" placeholder="全部线路" clearable class="w-[150px]" @change="handleQuery">
            <el-option label="数据看板" value="DATA_BOARD" />
            <el-option label="新闻解说" value="NEWS_EXPLAINER" />
            <el-option label="今天不发" value="NO_PUBLISH" />
          </el-select>
          <el-select v-model="queryParams.status" placeholder="全部状态" clearable class="w-[130px]" @change="handleQuery">
            <el-option label="已产出" value="produced" />
            <el-option label="已跳过" value="skipped" />
            <el-option label="失败" value="failed" />
          </el-select>
        </div>
        <right-toolbar v-model:show-search="showSearch" :search="false" @query-table="getList"></right-toolbar>
      </div>
      <p class="toolbar-hint">
        每一行是一次定时运行。它记录总编辑当时看到的两条线候选、选了哪条线、为什么，
        以及最后产出了哪条作品——不是任务日志，是决策记录。
      </p>
    </el-card>

    <div class="editorial-split">
      <el-card shadow="hover" class="run-list-panel">
        <div v-loading="loading" class="run-list">
          <button
            v-for="row in runs"
            :key="runKey(row)"
            :class="['run-item', { 'is-active': selected && runKey(selected) === runKey(row) }]"
            @click="selectRun(row)"
          >
            <span class="run-time">{{ row.slotDate }} <em>{{ row.slotTime }}</em></span>
            <span class="run-line">
              <el-tag size="small" :type="lineTag(row.selectedLine)" effect="plain">{{ lineText(row.selectedLine) }}</el-tag>
              <el-tag size="small" :type="statusTag(row.status)" effect="plain">{{ statusText(row.status) }}</el-tag>
            </span>
            <span class="run-intent">{{ row.editorialIntent || row.decisionReason || row.detail || '（无记录）' }}</span>
          </button>
          <el-empty v-if="!loading && !runs.length" description="这段时间没有运行记录" />
        </div>
        <pagination
          v-show="total > 0"
          v-model:page="queryParams.pageNum"
          v-model:limit="queryParams.pageSize"
          :total="total"
          @pagination="getList"
        />
      </el-card>

      <el-card shadow="hover" class="run-detail-panel">
        <el-skeleton v-if="detailLoading" :rows="8" animated />
        <template v-else-if="selected">
          <header class="detail-head">
            <div>
              <span class="eyebrow">Run {{ selected.slotDate }} · {{ selected.slotTime }}</span>
              <h2>{{ lineText(selected.selectedLine) }}</h2>
            </div>
            <el-tag :type="statusTag(selected.status)" effect="plain">{{ statusText(selected.status) }}</el-tag>
          </header>

          <section class="detail-block">
            <h3 class="block-title">决策</h3>
            <dl class="kv">
              <dt>选题意图</dt>
              <dd>{{ selected.editorialIntent || '—' }}</dd>
              <dt>判断理由</dt>
              <dd>{{ selected.decisionReason || '—' }}</dd>
              <dt>原始记录</dt>
              <dd class="mono">{{ selected.detail || '—' }}</dd>
            </dl>
          </section>

          <section v-if="pools" class="detail-block">
            <h3 class="block-title">它当时看到的候选</h3>
            <div class="pool-grid">
              <div v-for="group in poolGroups" :key="group.key" class="pool-card">
                <span class="pool-label">{{ group.label }}</span>
                <strong class="pool-count">{{ group.items.length }}</strong>
                <ul v-if="group.items.length" class="pool-items">
                  <li v-for="(item, index) in group.items.slice(0, 8)" :key="index">{{ item }}</li>
                  <li v-if="group.items.length > 8" class="pool-more">还有 {{ group.items.length - 8 }} 条…</li>
                </ul>
                <p v-else class="pool-empty">空</p>
              </div>
            </div>
          </section>
          <el-alert
            v-else
            class="mt-2"
            type="info"
            :closable="false"
            show-icon
            title="这次运行没有候选池快照"
            description="结构化快照是后加的能力；更早的运行只留了一段文本记录。"
          />

          <section v-if="selection" class="detail-block">
            <h3 class="block-title">线内编辑的选择</h3>
            <dl class="kv">
              <dt>候选</dt>
              <dd class="mono">{{ selection.candidateId ?? '—' }}</dd>
              <dt>模板</dt>
              <dd class="mono">{{ selection.templateId || '—' }}</dd>
              <dt>叙事角度</dt>
              <dd>{{ selection.storyAngle || '—' }}</dd>
              <dt>数据源</dt>
              <dd class="mono">
                {{ selection.dataSourceKey || '—' }}
                <span v-if="selection.digest" class="muted">（速览）</span>
              </dd>
            </dl>
          </section>
          <el-alert
            v-else-if="selected.workId"
            class="mt-2"
            type="info"
            :closable="false"
            show-icon
            title="这一版没有线内编辑记录"
            description="选择记录从决策链接通之后才开始落盘，更早的版本只有总编辑那一段。"
          />

          <section v-if="review" class="detail-block">
            <h3 class="block-title">AI 审稿</h3>
            <dl class="kv">
              <dt>结论</dt>
              <dd>
                <el-tag size="small" effect="plain" :type="review.result === 'PASS' ? 'success' : 'danger'">
                  {{ review.result || '—' }}
                </el-tag>
                <span v-if="review.repairAttempts" class="muted">修了 {{ review.repairAttempts }} 轮</span>
              </dd>
              <dt>核心断言</dt>
              <dd>
                <el-tag
                  v-if="review.coreFacts"
                  size="small"
                  effect="plain"
                  :type="review.coreFacts === 'supported' ? 'success' : 'danger'"
                >
                  {{ coreFactsText[review.coreFacts] || review.coreFacts }}
                </el-tag>
                <span v-else class="muted">未记录（旧审稿契约，自动发布会拒）</span>
              </dd>
              <dt>审稿版本</dt>
              <dd class="mono">{{ review.promptVersion || '—' }}</dd>
              <dt>审于</dt>
              <dd>{{ review.reviewedAt || '—' }}</dd>
            </dl>
            <ul v-if="review.issues?.length" class="issue-list">
              <li v-for="(issue, index) in review.issues" :key="index" class="issue">
                <span :class="['issue-severity', 'is-' + (issue.severity || '').toLowerCase()]">{{ issue.severity }}</span>
                <span class="issue-segment">{{ issue.segmentId }}</span>
                <span class="issue-text">{{ issue.description }}</span>
              </li>
            </ul>
            <p v-else class="muted">没有问题条目。</p>
          </section>
          <el-alert
            v-else-if="selected.workId"
            class="mt-2"
            type="warning"
            :closable="false"
            show-icon
            title="这一版没有 AI 审稿记录"
            description="自动发布门禁会直接拒掉它——没有记录就无法证明审稿发生过。"
          />

          <section class="detail-block">
            <h3 class="block-title">历史表现参考</h3>
            <p class="muted">
              按这次选择的内容维度列出历史分组的表现。这张卡只给人看，不进提示词，也不会自动改变编辑策略。
            </p>
            <p v-if="!referenceQuery" class="muted">本槽没有可用于参考的内容属性。</p>
            <el-skeleton v-else-if="referenceLoading" :rows="3" animated />
            <el-alert
              v-else-if="referenceError"
              type="info"
              :closable="false"
              show-icon
              title="参考卡暂不可用"
              :description="referenceError"
            />
            <template v-else-if="reference">
              <dl class="kv">
                <dt>维度</dt>
                <dd>{{ referenceDimensionLabel }}</dd>
                <dt>分组值</dt>
                <dd class="mono">{{ reference.bucketValue || '—' }}</dd>
                <dt>证据等级</dt>
                <dd>
                  <el-tag size="small" effect="plain" :type="reference.tier === 'L4' ? 'success' : 'info'">
                    {{ reference.tier || '—' }}
                  </el-tag>
                </dd>
                <dt>生成于</dt>
                <dd>{{ reference.generatedAt || '—' }}</dd>
              </dl>
              <el-alert
                v-if="reference.locked"
                class="mt-2"
                type="warning"
                :closable="false"
                show-icon
                title="本维度已被人工锁定"
                :description="`锁定理由：${reference.lockReason || '未记录'}；锁定至：${reference.scopeUntil || '未记录期限'}。锁定期间不展示聚合结论。`"
              />
              <template v-else>
                <p v-if="reference.notice" class="muted">{{ reference.notice }}</p>
                <el-table v-if="reference.buckets.length" :data="reference.buckets" size="small" border>
                  <el-table-column label="分组" prop="bucket" min-width="120" />
                  <el-table-column label="样本" width="76" align="center">
                    <template #default="{ row }">{{ row.samples }} 条</template>
                  </el-table-column>
                  <el-table-column label="播放中位数" width="112" align="right">
                    <template #default="{ row }">{{ referenceNumber(row.medianPlays) }}</template>
                  </el-table-column>
                  <el-table-column label="p25–p75" width="140" align="right">
                    <template #default="{ row }">{{ referenceRange(row.p25Plays, row.p75Plays) }}</template>
                  </el-table-column>
                  <el-table-column label="离群倍数" width="98" align="right">
                    <template #default="{ row }">{{ referenceRatio(row.outlierRatio) }}</template>
                  </el-table-column>
                  <el-table-column label="等级" width="76" align="center">
                    <template #default="{ row }">
                      <el-tag size="small" effect="plain">{{ row.tier }}</el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column label="稳定" width="76" align="center">
                    <template #default="{ row }">
                      <el-tag size="small" effect="plain" :type="row.stable ? 'success' : 'danger'">
                        {{ row.stable ? '稳' : '不稳' }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column label="结论" min-width="220">
                    <template #default="{ row }">{{ row.summary || '—' }}</template>
                  </el-table-column>
                </el-table>
                <p v-else class="muted">这一维度还没有可展示的历史分组。</p>
              </template>
            </template>
            <p v-else class="muted">这一维度还没有历史表现可参考。</p>
          </section>

          <section class="detail-block">
            <h3 class="block-title">产出</h3>
            <p v-if="selected.workId" class="work-link">
              <router-link :to="{ path: '/heron/work-studio', query: { workId: selected.workId } }">
                {{ selected.workTitle || '作品 ' + selected.workId }}
              </router-link>
              <el-tag v-if="selected.workReviewStatus" size="small" effect="plain">
                {{ reviewText[selected.workReviewStatus] || selected.workReviewStatus }}
              </el-tag>
            </p>
            <p v-else class="muted">这一槽没有产出作品。</p>
          </section>
        </template>
        <el-empty v-else description="选择左边的一次运行查看决策过程" />
      </el-card>
    </div>
  </div>
</template>

<script setup name="HeronEditorial" lang="ts">
import type { EditorialPools, EditorialReviewRecord, EditorialRun, EditorialRunQuery, EditorialSelection } from '@/api/heron/editorial/types';
import { listEditorialRuns } from '@/api/heron/editorial';
import type { InsightDimension, MetricReference } from '@/api/heron/metrics';
import { getMetricReference } from '@/api/heron/metrics';
import { useLoading } from '@/hooks/async/useLoading';
import { useSearchToggle } from '@/hooks/form/useSearchToggle';
import { extractErrorMessage } from '@/utils/request';

const runs = ref<EditorialRun[]>([]);
const total = ref(0);
const selected = ref<EditorialRun>();
const detailLoading = ref(false);
const dateRange = ref<[string, string] | null>(null);
const { loading, withLoading } = useLoading(true);
const { showSearch } = useSearchToggle();

const queryParams = ref<EditorialRunQuery>({ pageNum: 1, pageSize: 20, status: undefined, selectedLine: undefined });

const lineText = (line?: string) => {
  if (line === 'DATA_BOARD') return '数据看板';
  if (line === 'NEWS_EXPLAINER') return '新闻解说';
  if (line === 'NO_PUBLISH') return '今天不发';
  return line || '未决策';
};
const lineTag = (line?: string) => (line === 'DATA_BOARD' ? 'success' : line === 'NEWS_EXPLAINER' ? 'warning' : 'info');
const statusText = (status?: string) =>
  ({ produced: '已产出', skipped: '已跳过', failed: '失败' })[status || ''] || status || '-';
const statusTag = (status?: string) => (status === 'produced' ? 'success' : status === 'failed' ? 'danger' : 'info');
const reviewText: Record<string, string> = { pending: '待审片', approved: '已通过', rejected: '已驳回' };

/** 核心断言的证据状态：核得住 / 核不了 / 没依据。只有第一种能自动发布。 */
const coreFactsText: Record<string, string> = {
  supported: '有据',
  unverifiable: '核不了',
  unsupported: '无据'
};

const runKey = (row: EditorialRun) => `${row.slotDate}#${row.slotTime}`;

/** poolJson 是后端写入的快照，解析失败只说明这条记录异常，不能让整页崩掉。 */
const pools = computed<EditorialPools | null>(() => {
  if (!selected.value?.poolJson) return null;
  try {
    return JSON.parse(selected.value.poolJson) as EditorialPools;
  } catch {
    return null;
  }
});

const selection = computed<EditorialSelection | null>(() => {
  if (!selected.value?.selectionJson) return null;
  try {
    return JSON.parse(selected.value.selectionJson) as EditorialSelection;
  } catch {
    return null;
  }
});

const review = computed<EditorialReviewRecord | null>(() => {
  if (!selected.value?.reviewJson) return null;
  try {
    return JSON.parse(selected.value.reviewJson) as EditorialReviewRecord;
  } catch {
    return null;
  }
});

const poolGroups = computed(() => {
  const p = pools.value;
  if (!p) return [];
  return [
    { key: 'hot', label: '热榜标题', items: p.hotHeadlines || [] },
    { key: 'article', label: '有正文的 RSS', items: p.articleCandidates || [] },
    { key: 'dataset', label: '可用数据集', items: p.dataSources || [] },
    { key: 'recent', label: '最近发过的', items: p.recentPublications || [] }
  ];
});

/**
 * 参考卡按这次选择里能直接读到的维度取历史表现。
 * 故事角度与模板 id 前端拿得到；栏目要到 Java 侧映射才知道，所以这里只用这两个维度，
 * 拿不到就不请求，不拿别的维度的结论凑数。
 */
const referenceQuery = computed<{ dimension: InsightDimension; bucketValue: string } | null>(() => {
  const current = selection.value;
  const angle = current?.storyAngle?.trim();
  if (angle) return { dimension: 'angle', bucketValue: angle };
  const template = current?.templateId?.trim();
  if (template) return { dimension: 'template', bucketValue: template };
  return null;
});

const referenceDimensionLabel = computed(() => {
  const key = referenceQuery.value?.dimension;
  if (key === 'angle') return '叙事角度';
  if (key === 'template') return '模板';
  return '分组';
});

const reference = ref<MetricReference | null>(null);
const referenceLoading = ref(false);
const referenceError = ref('');
let referenceRequest = 0;

/**
 * 取参考卡。接口还没上线（404）或取不到时降级成一句话，
 * 不能让整页报错堆栈，也不能白屏——这张卡只是给人参考的。
 */
const loadReference = async () => {
  const query = referenceQuery.value;
  const request = ++referenceRequest;
  reference.value = null;
  referenceError.value = '';
  if (!query) return;
  referenceLoading.value = true;
  try {
    const res = await getMetricReference(query.dimension, query.bucketValue);
    const data = res.data as MetricReference | undefined;
    if (request !== referenceRequest) return;
    reference.value = data ? { ...data, buckets: data.buckets ?? [] } : null;
  } catch (error) {
    if (request !== referenceRequest) return;
    reference.value = null;
    referenceError.value = (await extractErrorMessage(error)) || '后端还没有提供参考卡接口。';
  } finally {
    if (request === referenceRequest) referenceLoading.value = false;
  }
};

watch(
  referenceQuery,
  () => {
    void loadReference();
  },
  { immediate: true }
);

/** 聚合值为空就是没有，不能拿 0 顶替。 */
const referenceNumber = (value?: number | null) =>
  value === null || value === undefined ? '无数据' : Math.round(value).toLocaleString('zh-CN');

const referenceRatio = (value?: number | null) =>
  value === null || value === undefined ? '无数据' : `×${value.toFixed(1)}`;

const referenceRange = (low?: number | null, high?: number | null) => {
  if ((low === null || low === undefined) && (high === null || high === undefined)) return '无数据';
  return `${referenceNumber(low)} – ${referenceNumber(high)}`;
};

const getList = async () => {
  await withLoading(async () => {
    const res = await listEditorialRuns(queryParams.value);
    runs.value = res.data?.rows || [];
    total.value = res.data?.total || 0;
    if (!selected.value && runs.value.length) {
      selectRun(runs.value[0]);
    }
  });
};

const handleQuery = () => {
  queryParams.value.pageNum = 1;
  queryParams.value.params = { beginDate: dateRange.value?.[0], endDate: dateRange.value?.[1] };
  selected.value = undefined;
  getList();
};

/** 列表行已经带全部字段，选中不再多打一次接口；detailLoading 留给以后加更重的详情。 */
const selectRun = (row: EditorialRun) => {
  detailLoading.value = false;
  selected.value = row;
};

onMounted(() => {
  getList();
});
</script>

<style lang="scss" scoped>
.heron-editorial-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.toolbar-panel {
  border: 1px solid var(--app-surface-border);
}

.editorial-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.toolbar-fields {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.toolbar-hint {
  margin: 12px 0 0;
  color: var(--app-text-faint);
  font-size: var(--app-font-size-xs);
  line-height: 1.7;
}

.editorial-split {
  display: grid;
  grid-template-columns: minmax(320px, 400px) 1fr;
  gap: 12px;
  align-items: start;
}

.run-list-panel,
.run-detail-panel {
  border: 1px solid var(--app-surface-border);
}

.run-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-height: 120px;
  max-height: 620px;
  overflow: auto;
}

.run-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: var(--app-accent-softer);
  }

  &.is-active {
    border-color: var(--app-accent-border);
    background: var(--app-accent-soft);
  }
}

.run-time {
  color: var(--app-text-title);
  font-family: var(--app-font-mono);
  font-size: var(--app-font-size-xs);
  font-variant-numeric: tabular-nums;

  em {
    color: var(--app-text-faint);
    font-style: normal;
  }
}

.run-line {
  display: flex;
  gap: 6px;
}

.run-intent {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.detail-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--app-surface-border);

  h2 {
    margin: 6px 0 0;
    color: var(--app-text-title);
    font-size: var(--app-font-size-xl);
    font-weight: 600;
  }
}

.eyebrow {
  color: var(--app-text-faint);
  font-family: var(--app-font-mono);
  font-size: var(--app-font-size-2xs);
  letter-spacing: var(--app-tracking-eyebrow);
  text-transform: uppercase;
}

.detail-block {
  margin-top: 22px;
}

.block-title {
  margin: 0 0 10px;
  color: var(--app-text-title);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.kv {
  display: grid;
  grid-template-columns: 84px 1fr;
  gap: 8px 12px;
  margin: 0;
  font-size: var(--app-font-size-sm);

  dt {
    color: var(--app-text-faint);
  }

  dd {
    margin: 0;
    color: var(--app-text-body);
    line-height: 1.7;
  }
}

.mono {
  font-family: var(--app-font-mono);
  font-size: var(--app-font-size-xs);
  word-break: break-all;
}

.pool-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1px;
  background: var(--app-surface-border);
  border: 1px solid var(--app-surface-border);
  border-radius: 8px;
  overflow: hidden;
}

.pool-card {
  padding: 10px 12px;
  background: var(--app-surface-bg);
}

.pool-label {
  color: var(--app-text-faint);
  font-size: var(--app-font-size-2xs);
}

.pool-count {
  display: block;
  margin: 2px 0 6px;
  color: var(--app-text-title);
  font-family: var(--app-font-mono);
  font-size: var(--app-font-size-lg);
  font-variant-numeric: tabular-nums;
}

.pool-items {
  margin: 0;
  padding-left: 16px;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: 1.7;
}

.pool-more {
  list-style: none;
  margin-left: -16px;
  color: var(--app-text-faint);
}

.pool-empty {
  margin: 0;
  color: var(--app-text-faint);
  font-size: var(--app-font-size-xs);
}

.work-link {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: var(--app-font-size-sm);

  a {
    color: var(--app-accent-strong);
    font-weight: 600;
  }
}

.muted {
  margin: 0;
  color: var(--app-text-faint);
  font-size: var(--app-font-size-sm);
}

.issue-list {
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--app-surface-border);
}

.issue {
  display: grid;
  grid-template-columns: 62px 84px 1fr;
  gap: 8px;
  padding: 7px 0;
  border-bottom: 1px solid var(--app-surface-border);
  font-size: var(--app-font-size-xs);
  line-height: 1.6;
}

.issue-severity {
  font-family: var(--app-font-mono);
  font-size: var(--app-font-size-2xs);
  letter-spacing: 0.04em;
  color: var(--app-text-faint);

  &.is-blocker,
  &.is-major {
    color: var(--app-danger);
  }

  &.is-minor {
    color: var(--app-warning);
  }
}

.issue-segment {
  font-family: var(--app-font-mono);
  color: var(--app-text-faint);
  word-break: break-all;
}

.issue-text {
  color: var(--app-text-body);
}

@media (max-width: 1100px) {
  .editorial-split {
    grid-template-columns: 1fr;
  }
}
</style>
