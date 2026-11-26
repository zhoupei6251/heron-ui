<template>
  <div class="p-2 app-container heron-analytics-page">
    <el-card shadow="hover" class="toolbar-panel">
      <div class="analytics-toolbar">
        <ul class="dim-tabs" role="tablist">
          <li
            v-for="tab in tabs"
            :key="tab.key"
            :class="['dim-tab', { 'is-active': dimension === tab.key }]"
            role="tab"
            :aria-selected="dimension === tab.key"
            @click="switchDimension(tab.key)"
          >
            {{ tab.label }}
          </li>
        </ul>
        <el-button icon="Refresh" :loading="loading" @click="getList">刷新</el-button>
      </div>
      <p class="toolbar-hint">
        表现数据目前由人工从平台后台回填，样本很少。主指标是
        <strong>中位数</strong>
        ，不是均值——一条爆款能把均值抬走。
        <strong>结论强度看证据等级 L0~L4 和稳定性</strong>
        ，等级低的分组只作参考，不要当规律。 自动采集要等开放平台凭据到位后才能接。
      </p>
    </el-card>

    <el-alert
      v-if="errorText"
      class="error-panel"
      type="error"
      :closable="false"
      :title="errorText"
      description="这一页拿不到归因结论时不会拿旧数据顶上。"
    />

    <el-card shadow="hover" class="summary-panel">
      <div class="summary-head">
        <h3 class="summary-title">这一页的结论能说到什么程度</h3>
        <div class="summary-tags">
          <el-tag :type="tierTagType(overview.tier)" :effect="tierTagEffect(overview.tier)" size="small">
            证据等级 {{ overview.tier }}
          </el-tag>
          <el-tag :type="conclusionTagType(overview.conclusion)" effect="plain" size="small">
            {{ conclusionText(overview.conclusion) }}
          </el-tag>
        </div>
      </div>
      <p class="summary-notice">{{ overview.notice }}</p>
      <ul class="summary-facts">
        <li>
          参与统计样本
          <strong>{{ overview.totalSamples }} 条</strong>
        </li>
        <li>
          覆盖
          <strong>{{ overview.weeks }} 个自然周</strong>
        </li>
        <li>
          分成
          <strong>{{ rows.length }} 组</strong>
        </li>
        <li>
          原始样本明细
          <strong>{{ overview.rawSamples?.length ?? 0 }} 条</strong>
        </li>
      </ul>
    </el-card>

    <el-card shadow="hover" class="table-panel">
      <el-table v-loading="loading" border class="data-table" :data="rows">
        <el-table-column type="expand" width="42">
          <template #default="{ row }">
            <div class="sample-detail">
              <p class="sample-note">
                原始样本明细：这一组里每条版本的一次采样。样本不足时只给明细，不给中位数与区间。
              </p>
              <el-table :data="sampleRows(row)" size="small" border>
                <el-table-column label="版本" prop="versionId" min-width="200" />
                <el-table-column label="播放" width="92" align="right">
                  <template #default="{ row: sample }">{{ sampleNumber(sample.plays) }}</template>
                </el-table-column>
                <el-table-column label="完播率" width="92" align="right">
                  <template #default="{ row: sample }">{{ samplePercent(sample.completionRate) }}</template>
                </el-table-column>
                <el-table-column label="点赞" width="82" align="right">
                  <template #default="{ row: sample }">{{ sampleNumber(sample.likes) }}</template>
                </el-table-column>
                <el-table-column label="采样时间" width="160">
                  <template #default="{ row: sample }">{{ sample.fetchedAt || '—' }}</template>
                </el-table-column>
                <el-table-column label="发布时间" width="160">
                  <template #default="{ row: sample }">{{ sample.publishAt || '—' }}</template>
                </el-table-column>
                <el-table-column label="标记" width="132" align="center">
                  <template #default="{ row: sample }">
                    <el-tag v-if="sample.isExtreme" type="warning" size="small" effect="plain">
                      极端离群样本
                    </el-tag>
                    <span v-else class="num is-faint">—</span>
                  </template>
                </el-table-column>
              </el-table>
              <p v-if="!sampleRows(row).length" class="muted">这一组没有可展示的样本明细。</p>
            </div>
          </template>
        </el-table-column>
        <el-table-column :label="bucketLabel" min-width="170">
          <template #default="{ row }">
            <span :class="['bucket-name', { 'is-unknown': row.bucket === '未记录' }]">
              {{ bucketText(dimension, row.bucket) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="样本" width="86" align="center">
          <template #default="{ row }">
            <span class="num">{{ row.samples }} 条</span>
          </template>
        </el-table-column>
        <el-table-column label="播放中位数 p50" width="176" align="right">
          <template #default="{ row }">
            <span v-if="hasAggregate(row)" class="num is-primary">{{ formatNumber(row.medianPlays) }}</span>
            <span v-else class="num is-faint">{{ insufficientText(row) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="p25–p75 区间" width="150" align="right">
          <template #default="{ row }">
            <span v-if="hasAggregate(row)" class="num">{{ formatRange(row.p25Plays, row.p75Plays) }}</span>
            <span v-else class="num is-faint">—</span>
          </template>
        </el-table-column>
        <el-table-column label="均值（仅对照）" width="134" align="right">
          <template #default="{ row }">
            <span class="num is-faint">{{ hasAggregate(row) ? formatNumber(row.avgPlays) : '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="最高播放" width="110" align="right">
          <template #default="{ row }">
            <span class="num">{{ hasAggregate(row) ? formatNumber(row.maxPlays) : '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="离群倍数" width="110" align="right">
          <template #default="{ row }">
            <el-tooltip content="最高播放 ÷ 中位播放。大于 5 说明这一组被单条极端值主导。" placement="top">
              <span :class="['num', { 'is-outlier': isOutlier(row.outlierRatio) }]">
                {{ hasAggregate(row) ? formatRatio(row.outlierRatio) : '—' }}
              </span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="极端离群样本" width="140" align="center">
          <template #default="{ row }">
            <el-tooltip
              v-if="hasExtreme(row)"
              content="这一组的最高播放远高于中位数，去掉它方向可能就变了。明细见左侧展开行。"
              placement="top"
            >
              <el-tag type="warning" size="small" effect="plain">含极端离群样本</el-tag>
            </el-tooltip>
            <span v-else class="num is-faint">—</span>
          </template>
        </el-table-column>
        <el-table-column label="完播中位数" width="116" align="right">
          <template #default="{ row }">
            <span class="num">{{ hasAggregate(row) ? formatPercent(row.medianCompletionRate) : '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="覆盖周数" width="98" align="center">
          <template #default="{ row }">
            <span class="num">{{ row.weeks }} 周</span>
          </template>
        </el-table-column>
        <el-table-column label="证据等级" width="102" align="center">
          <template #default="{ row }">
            <el-tag :type="tierTagType(row.tier)" :effect="tierTagEffect(row.tier)" size="small">
              {{ row.tier }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="结论类型" width="154" align="center">
          <template #default="{ row }">
            <el-tag :type="conclusionTagType(row.conclusion)" effect="plain" size="small">
              {{ conclusionText(row.conclusion) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="稳定性" width="140" align="center">
          <template #default="{ row }">
            <el-tooltip content="留一检验：去掉这一组最高的一条，方向还成立吗？" placement="top">
              <el-tag :type="row.stable ? 'success' : 'danger'" effect="plain" size="small">
                {{ row.stable ? '稳' : '不稳' }}
              </el-tag>
            </el-tooltip>
            <el-tag v-if="row.strategyEligible" class="eligible-tag" type="success" effect="dark" size="small">
              可用于策略
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="结论" min-width="360">
          <template #default="{ row }">
            <span class="summary-text">{{ row.summary }}</span>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!loading && !rows.length" description="还没有表现数据；在作品工作室里回填一条后再看" />
    </el-card>

    <el-card shadow="hover" class="hypothesis-panel">
      <div class="note-head">
        <h3 class="note-title">模型假设区</h3>
        <el-button
          v-hasPermi="['heron:newsWork:review']"
          size="small"
          :loading="hypothesisLoading"
          @click="generateHypotheses"
        >
          生成假设
        </el-button>
      </div>
      <p class="note-text">
        <strong>来源</strong>
        ：模型基于归因分组提出的策略假设，每条都记着模型与提示词版本。
      </p>
      <p class="note-text">
        <strong>怎么验证</strong>
        ：每条都带可证伪条件——需要多少样本（至少 30 条且跨 2 个自然周）、看哪个指标、出现什么结果算被证伪。
        写不清可证伪条件的假设不会进本区。本区只放待验证项，不能当结论用。
      </p>
      <el-alert v-if="hypothesisError" type="warning" :closable="false" show-icon :title="hypothesisError" />
      <ul v-if="hypotheses.length" class="hypothesis-list">
        <li v-for="item in hypotheses" :key="item.id" class="hypothesis-item">
          <span class="hypothesis-text">{{ item.claim }}</span>
          <span class="hypothesis-meta">来源：{{ item.dimension }} · {{ item.bucketValue }} · {{ item.source }}</span>
          <span class="hypothesis-meta">
            怎么验证：≥{{ item.minSamples }} 条且跨 {{ item.minWeeks }} 周，看{{ metricLabel[item.metric] || item.metric }}；
            {{ item.falsifyIf }} 算被证伪
          </span>
          <span class="hypothesis-meta">生成依据：{{ item.basis }}</span>
        </li>
      </ul>
      <el-empty v-else description="本区暂无假设" :image-size="72" />
    </el-card>

    <el-card shadow="hover" class="suggestion-panel">
      <h3 class="note-title">创作建议区</h3>
      <p class="note-text">
        <strong>来源</strong>
        ：L3 质量报告里的主观条目（subjective / hypothesis）。人工编辑写的建议还没有落库来源，这里暂时只显示前者。
      </p>
      <p class="note-text">
        <strong>来源必标</strong>
        ：每条建议都带判据号、类别与置信度；来自 L3 推测（hypothesis）的还要再标一次「这是推测」。采纳与否由人决定，
        采纳后必须走策略覆盖显式记录。本区只放建议，不对播放量、留存或效果下任何结论。
      </p>
      <el-alert v-if="suggestionError" type="warning" :closable="false" show-icon :title="suggestionError" />
      <ul v-if="suggestions.length" class="hypothesis-list">
        <li v-for="item in suggestions" :key="item.id" class="hypothesis-item">
          <span class="hypothesis-text">{{ item.text }}</span>
          <span class="hypothesis-meta">来源：{{ item.source }}</span>
          <el-tag type="info" size="small" effect="plain">{{ item.criterionClass }}</el-tag>
          <el-tag v-if="item.confidence" type="info" size="small" effect="plain">
            置信度 {{ item.confidence }}
          </el-tag>
          <el-tag v-if="item.hypothesis" type="info" size="small" effect="plain">这是推测</el-tag>
        </li>
      </ul>
      <el-empty v-else description="本区暂无建议" :image-size="72" />
    </el-card>

    <el-card shadow="hover" class="legend-panel">
      <h3 class="note-title">四类结论分别意味着什么</h3>
      <ul class="legend-list">
        <li v-for="item in conclusionLegend" :key="item.key">
          <el-tag :type="item.type" effect="plain" size="small">{{ item.label }}</el-tag>
          <span class="legend-text">{{ item.meaning }}</span>
        </li>
      </ul>

      <h3 class="note-title">本区结论的四种类型</h3>
      <ol class="type-list">
        <li>
          <strong>① 有证据的数据结论</strong>
          ：归因表里证据等级够、去掉最高一条方向不变的组，可以当结论用。
        </li>
        <li>
          <strong>② 样本不足的观察</strong>
          ：同一张表里的弱化行，写清「样本不足（n=…）」并列出原始样本明细，只作观察。
        </li>
        <li>
          <strong>③ 模型提出的策略假设</strong>
          ：独立的「模型假设区」，带来源与可证伪条件，明确标注未验证。
        </li>
        <li>
          <strong>④ 尚未验证的创作建议</strong>
          ：独立的「创作建议区」，带来源，明确标注未验证。
        </li>
      </ol>
      <p class="note-text">
        <strong>四者不可混排</strong>
        ：① ② 在归因表里分档显示，③ ④ 各占独立区。数据结论、样本观察、模型假设与创作建议不能放进同一个列表排序，
        也不能合成一个总分——一旦混排，读者就分不清哪些是数据、哪些是模型说的。
      </p>

      <h3 class="note-title">证据等级怎么来的</h3>
      <ul class="note-list">
        <li>
          <strong>L4</strong>
          ：样本 ≥ 30 条，且覆盖 ≥ 2 个自然周，结论可以当结论用。
        </li>
        <li>
          <strong>L3</strong>
          ：样本 ≥ 10 条；或样本够多但只覆盖 1 个自然周，只够作为待人工确认的策略假设。
        </li>
        <li>
          <strong>L2 / L1</strong>
          ：3–9 条 / 1–2 条样本，只能当观察。
        </li>
        <li>
          <strong>L0</strong>
          ：没有样本，任何说法都只是尚未验证的建议。
        </li>
        <li>去掉这一组最高的一条后方向翻了的，等级自动降一级，并在「稳定性」列标成不稳。</li>
      </ul>
    </el-card>

    <el-card shadow="hover" class="note-panel">
      <h3 class="note-title">这套数据现在能回答什么</h3>
      <ul class="note-list">
        <li>
          <strong>能回答</strong>
          ：某一类内容（模板、生产线、叙事角度、栏目、图表类型、时长、发布日、机会信号）的相对表现，
          以及这个结论能说到什么程度——样本够不够、稳不稳。
        </li>
        <li>
          <strong>不能回答</strong>
          ：为什么。播放量受发布时间、账号权重、平台推荐影响，这里只统计了内容侧的维度。
        </li>
        <li>
          <strong>不做什么</strong>
          ：这个页面不给综合评分，也不预测播放量。等级和稳定性说清楚了「这条结论能信到什么程度」， 剩下的由人决定。
        </li>
        <li>
          <strong>还不能做的</strong>
          ：让编辑策略自动参考历史表现。只有证据等级 L4 且去掉最高一条后方向不变，才算可用。
        </li>
      </ul>
    </el-card>
  </div>
</template>

<script setup name="HeronAnalytics" lang="ts">
import type {
  InsightBucket,
  InsightConclusion,
  InsightDimension,
  InsightRawSample,
  InsightTier,
  PerformanceInsight
} from '@/api/heron/metrics';
import {
  generateStrategyHypotheses,
  getMetricInsight,
  getMetricSuggestions,
  listStrategyHypotheses
} from '@/api/heron/metrics';
import type { MetricHypothesis, MetricSuggestion } from '@/api/heron/metrics';
import { extractErrorMessage } from '@/utils/request';
import { bucketText } from './buckets';

const tabs: { key: InsightDimension; label: string; bucket: string }[] = [
  { key: 'line', label: '按生产线', bucket: '生产线' },
  { key: 'angle', label: '按叙事角度', bucket: '叙事角度' },
  { key: 'source', label: '按来源', bucket: '来源' },
  { key: 'column', label: '按栏目', bucket: '栏目' },
  { key: 'kind', label: '按内容形态', bucket: '内容形态' },
  { key: 'chart', label: '按图表类型', bucket: '图表类型' },
  { key: 'duration', label: '按时长区间', bucket: '时长区间' },
  { key: 'weekday', label: '按发布日', bucket: '发布日' },
  { key: 'signal', label: '按机会信号', bucket: '机会信号' },
  { key: 'style', label: '按视觉风格', bucket: '视觉风格' },
  { key: 'voice', label: '按配音音色', bucket: '配音音色' },
  { key: 'publishHour', label: '按发布时段', bucket: '发布时段' },
  { key: 'hook', label: '按标题钩子', bucket: '标题钩子' },
  { key: 'opening', label: '按开头结构', bucket: '开头结构' }
];

/**
 * 模型假设区：来自后端 strategy_hypothesis 表。
 * 每条都带可证伪条件；页面只负责显示，不自己拼假设。
 */
const hypotheses = ref<MetricHypothesis[]>([]);
const hypothesisLoading = ref(false);
const hypothesisError = ref('');

/**
 * 创作建议区：来自 L3 质量报告的 subjective / hypothesis 条目。
 * 后端只下发已经落在那份报告里的条目，页面不自己拼建议。
 */
const suggestions = ref<MetricSuggestion[]>([]);

const dimension = ref<InsightDimension>('line');
const insight = ref<PerformanceInsight | null>(null);
const loading = ref(false);
const errorText = ref('');

const rows = computed(() => insight.value?.buckets ?? []);

const overview = computed<PerformanceInsight>(
  () =>
    insight.value ?? {
      dimension: dimension.value,
      totalSamples: 0,
      weeks: 0,
      tier: 'L0',
      conclusion: 'unvalidated_suggestion',
      notice: '还没有取到归因结论。',
      buckets: []
    }
);

const bucketLabel = computed(() => tabs.find(tab => tab.key === dimension.value)?.bucket || '分组');

const conclusionLegend: {
  key: InsightConclusion;
  label: string;
  meaning: string;
  type: 'success' | 'warning' | 'info' | 'danger';
}[] = [
  {
    key: 'evidence_conclusion',
    label: '有证据的结论',
    meaning: '样本够、覆盖周期够、去掉最高一条方向不变，可以当结论用。',
    type: 'success'
  },
  {
    key: 'strategy_hypothesis',
    label: '待人工确认的假设',
    meaning: '看得出相关，但还不能直接改生产策略，要人确认。',
    type: 'warning'
  },
  {
    key: 'insufficient_sample',
    label: '样本不足的观察',
    meaning: '样本不够或只覆盖了很短一段周期，只是一个观察。',
    type: 'info'
  },
  {
    key: 'unvalidated_suggestion',
    label: '未验证的建议',
    meaning: '没有样本，任何说法都只是建议，不能当依据。',
    type: 'danger'
  }
];

/** 等级越高越可信，标签的颜色和填充都要不一样，不能让低等级的组看起来一样强。 */
const tierTagType = (tier: InsightTier): 'success' | 'primary' | 'warning' | 'info' => {
  switch (tier) {
    case 'L4':
      return 'success';
    case 'L3':
      return 'primary';
    case 'L2':
      return 'warning';
    default:
      return 'info';
  }
};

const tierTagEffect = (tier: InsightTier): 'dark' | 'light' | 'plain' => {
  switch (tier) {
    case 'L4':
      return 'dark';
    case 'L3':
      return 'light';
    default:
      return 'plain';
  }
};

const conclusionTagType = (conclusion: InsightConclusion): 'success' | 'warning' | 'info' | 'danger' => {
  switch (conclusion) {
    case 'evidence_conclusion':
      return 'success';
    case 'strategy_hypothesis':
      return 'warning';
    case 'insufficient_sample':
      return 'info';
    default:
      return 'danger';
  }
};

const conclusionText = (conclusion: InsightConclusion) =>
  conclusionLegend.find(item => item.key === conclusion)?.label || conclusion;

/** 没有可用播放数的组显示「无数据」，不能拿 0 顶替。 */
const formatNumber = (value?: number | null) =>
  value === null || value === undefined ? '无数据' : Math.round(value).toLocaleString('zh-CN');

const formatRatio = (value?: number | null) =>
  value === null || value === undefined ? '无数据' : `×${value.toFixed(1)}`;

const formatPercent = (value?: number | null) =>
  value === null || value === undefined ? '无数据' : `${Math.round(value * 100)}%`;

const formatRange = (low?: number | null, high?: number | null) => {
  if ((low === null || low === undefined) && (high === null || high === undefined)) return '无数据';
  return `${formatNumber(low)} – ${formatNumber(high)}`;
};

/**
 * 归因表插槽给的行类型是宽松的（Record），这里只声明真正用到的字段，
 * 全部可选，宽松行才传得进来；取值仍按后端给的口径，不自己补。
 */
type BucketRow = Partial<
  Pick<
    InsightBucket,
    | 'samples'
    | 'medianPlays'
    | 'p25Plays'
    | 'p75Plays'
    | 'avgPlays'
    | 'maxPlays'
    | 'outlierRatio'
    | 'medianCompletionRate'
    | 'extremeSample'
    | 'rawSamples'
  >
>;

/** 原始样本明细的一行。 */
type SampleRow = Partial<InsightRawSample>;

/**
 * 这一组有没有可用的聚合值。L0/L1 的桶后端会把聚合字段置空，
 * 那是「样本不足」，不是 0：这种桶只能看原始样本明细，不能显示中位数。
 */
const hasAggregate = (row: BucketRow) => row.medianPlays !== null && row.medianPlays !== undefined;

/** 样本不足的桶写清缺的是条数，不拿 0 或占位数字顶替。 */
const insufficientText = (row: BucketRow) =>
  (row.samples ?? 0) > 0 ? `样本不足（n=${row.samples}）` : '无样本';

/** 这一组是不是被单条极端值主导：离群倍数大于 5，且后端给出了那一条。 */
const hasExtreme = (row: BucketRow) => Boolean(row.extremeSample) && isOutlier(row.outlierRatio);

/** 明细里哪一条是极端离群样本。 */
const isExtremeSample = (row: BucketRow, sample: SampleRow) =>
  Boolean(row.extremeSample?.versionId) && row.extremeSample?.versionId === sample.versionId;

/**
 * 明细行自带「是不是极端离群样本」的标记。
 * 标记在这里算好，展开行里的表格就不用再回头找外层那个桶。
 */
const sampleRows = (row: BucketRow) =>
  (row.rawSamples ?? []).map(sample => ({ ...sample, isExtreme: isExtremeSample(row, sample) }));

/** 样本明细里的数值：没有就是没有，显示短横线，不显示 0。 */
const sampleNumber = (value?: number | null) =>
  value === null || value === undefined ? '—' : Math.round(value).toLocaleString('zh-CN');

const samplePercent = (value?: number | null) =>
  value === null || value === undefined ? '—' : `${Math.round(value * 100)}%`;

const isOutlier = (value?: number | null) => value !== null && value !== undefined && value > 5;

const getList = async () => {
  loading.value = true;
  errorText.value = '';
  try {
    const res = await getMetricInsight(dimension.value);
    insight.value = res.data ?? null;
  } catch (error) {
    insight.value = null;
    errorText.value = (await extractErrorMessage(error)) || '归因结论取不到';
  } finally {
    loading.value = false;
  }
};

const suggestionError = ref('');

const metricLabel: Record<string, string> = {
  medianPlays: '播放中位数',
  medianCompletionRate: '完播中位数',
  outlierRatio: '离群比'
};

const loadHypotheses = async () => {
  hypothesisError.value = '';
  try {
    const res = await listStrategyHypotheses(20);
    hypotheses.value = res.data ?? [];
  } catch {
    hypotheses.value = [];
    hypothesisError.value = '策略假设取不到；这不影响上面的归因结论。';
  }
};

const generateHypotheses = async () => {
  if (hypothesisLoading.value) return;
  hypothesisLoading.value = true;
  hypothesisError.value = '';
  try {
    const res = await generateStrategyHypotheses();
    hypotheses.value = res.data ?? [];
  } catch (error) {
    hypothesisError.value = (await extractErrorMessage(error)) || '生成假设失败';
  } finally {
    hypothesisLoading.value = false;
  }
};

const loadSuggestions = async () => {
  suggestionError.value = '';
  try {
    const res = await getMetricSuggestions(20);
    suggestions.value = res.data ?? [];
  } catch {
    suggestions.value = [];
    suggestionError.value = '创作建议取不到，本区按空处理；这不影响上面的归因结论。';
  }
};

const switchDimension = (key: InsightDimension) => {
  if (dimension.value === key) return;
  dimension.value = key;
  void getList();
};

onMounted(() => {
  void getList();
  void loadHypotheses();
  void loadSuggestions();
});
</script>

<style lang="scss" scoped>
.heron-analytics-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.toolbar-panel,
.summary-panel,
.table-panel,
.legend-panel,
.note-panel,
.hypothesis-panel,
.suggestion-panel {
  border: 1px solid var(--app-surface-border);
}

.error-panel {
  margin: 0;
}

.analytics-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.dim-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dim-tab {
  padding: 6px 14px;
  border: 1px solid transparent;
  border-radius: 8px;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
  cursor: pointer;
  transition:
    background-color var(--app-duration-fast) var(--app-ease),
    color var(--app-duration-fast) var(--app-ease);

  &:hover {
    background: var(--app-accent-softer);
    color: var(--app-text-title);
  }

  &.is-active {
    border-color: var(--app-accent-border);
    background: var(--app-accent-soft);
    color: var(--app-text-title);
    font-weight: 600;
  }
}

.toolbar-hint {
  margin: 12px 0 0;
  color: var(--app-text-faint);
  font-size: var(--app-font-size-xs);
  line-height: 1.7;

  strong {
    color: var(--app-warning);
    font-weight: 600;
  }
}

.summary-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.summary-title {
  margin: 0;
  color: var(--app-text-title);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.summary-tags {
  display: flex;
  align-items: center;
  gap: 6px;
}

.summary-notice {
  margin: 10px 0 0;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: 1.8;
}

.summary-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 24px;
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);

  strong {
    color: var(--app-text-title);
    font-family: var(--app-font-mono);
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }
}

.bucket-name {
  font-family: var(--app-font-mono);
  font-size: var(--app-font-size-xs);
  color: var(--app-text-title);

  &.is-unknown {
    color: var(--app-text-faint);
    font-style: italic;
  }
}

.num {
  font-family: var(--app-font-mono);
  font-variant-numeric: tabular-nums;
  color: var(--app-text-body);

  &.is-primary {
    color: var(--el-color-primary);
    font-weight: 600;
  }

  &.is-faint {
    color: var(--app-text-faint);
  }

  &.is-outlier {
    color: var(--app-warning);
    font-weight: 600;
  }
}

.eligible-tag {
  margin-left: 4px;
}

.summary-text {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: 1.7;
}

.muted {
  margin: 0;
  color: var(--app-text-faint);
  font-size: var(--app-font-size-xs);
}

.note-title {
  margin: 0 0 10px;
  color: var(--app-text-title);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

/* 卡片标题与动作同一行：标题左边，生成按钮右边。 */
.note-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}

.note-head .note-title {
  margin: 0;
}

.note-text {
  margin: 0 0 8px;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: 1.8;

  strong {
    color: var(--app-text-body);
    font-weight: 600;
  }
}

/* 归因表展开行里的原始样本明细：样本不足时，唯一能看的就是这一层。 */
.sample-detail {
  padding: 4px 12px 12px 48px;
}

.sample-note {
  margin: 0 0 8px;
  color: var(--app-text-faint);
  font-size: var(--app-font-size-xs);
  line-height: 1.7;
}

/* 四种类型的清单：归因表两类、假设区与建议区各一类，位置写清楚。 */
.type-list {
  margin: 0 0 10px;
  padding-left: 20px;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: 1.9;

  strong {
    color: var(--app-text-body);
    font-weight: 600;
  }
}

.hypothesis-list {
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--app-surface-border);
}

.hypothesis-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 0;
  border-bottom: 1px solid var(--app-surface-border);
}

.hypothesis-text {
  color: var(--app-text-body);
  font-size: var(--app-font-size-xs);
  line-height: 1.7;
}

.hypothesis-meta {
  color: var(--app-text-faint);
  font-size: var(--app-font-size-2xs);
  line-height: 1.6;
}

.legend-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0 0 16px;
  padding: 0;
  list-style: none;

  li {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
}

.legend-text {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: 1.7;
}

.note-list {
  margin: 0;
  padding-left: 18px;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: 1.9;

  strong {
    color: var(--app-text-body);
    font-weight: 600;
  }
}
</style>
