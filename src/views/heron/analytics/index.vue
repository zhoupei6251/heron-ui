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
        表现数据目前由人工从平台后台回填，样本很少。
        <strong>样本少于 3 条的分组只作参考，不要当规律</strong>——一两条视频的差异更像偶然。
        自动采集要等开放平台凭据到位后才能接。
      </p>
    </el-card>

    <el-card shadow="hover" class="table-panel">
      <el-table v-loading="loading" border class="data-table" :data="rows">
        <el-table-column :label="bucketLabel" min-width="180">
          <template #default="{ row }">
            <span :class="['bucket-name', { 'is-unknown': row.bucket === '未记录' }]">{{ row.bucket }}</span>
          </template>
        </el-table-column>
        <el-table-column label="样本" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.samples >= 3 ? 'info' : 'warning'" size="small" effect="plain">
              {{ row.samples }} 条
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="平均播放" width="120" align="right">
          <template #default="{ row }">
            <span class="num">{{ formatNumber(row.avgPlays) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="平均完播" width="120" align="right">
          <template #default="{ row }">
            <span class="num">{{ formatPercent(row.avgCompletionRate) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="平均点赞" width="110" align="right">
          <template #default="{ row }">
            <span class="num">{{ formatNumber(row.avgLikes) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="最高播放" width="120" align="right">
          <template #default="{ row }">
            <span class="num">{{ formatNumber(row.maxPlays) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="可信度" width="120" align="center">
          <template #default="{ row }">
            <span :class="['confidence', row.samples >= 3 ? 'is-ok' : 'is-thin']">
              {{ row.samples >= 3 ? '可参考' : '样本不足' }}
            </span>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!loading && !rows.length" description="还没有表现数据；在作品工作室里回填一条后再看" />
    </el-card>

    <el-card shadow="hover" class="note-panel">
      <h3 class="note-title">这套数据现在能回答什么</h3>
      <ul class="note-list">
        <li>
          <strong>能回答</strong>：某个模板、某条生产线、某个叙事角度在已有样本里的相对表现。
        </li>
        <li>
          <strong>不能回答</strong>：为什么。播放量受发布时间、账号权重、平台推荐影响，这里只统计了内容侧的三个维度。
        </li>
        <li>
          <strong>还不能做的</strong>：让编辑策略自动参考历史表现。样本量不足时自动参考等于放大偶然，
          要等自动采集接上、样本稳定后再开。
        </li>
      </ul>
    </el-card>
  </div>
</template>

<script setup name="HeronAnalytics" lang="ts">
import type { MetricBreakdown, MetricDimension } from '@/api/heron/metrics';
import { getMetricBreakdown } from '@/api/heron/metrics';

const tabs: { key: MetricDimension; label: string; bucket: string }[] = [
  { key: 'template', label: '按模板', bucket: '模板' },
  { key: 'line', label: '按生产线', bucket: '生产线' },
  { key: 'angle', label: '按叙事角度', bucket: '叙事角度' }
];

const dimension = ref<MetricDimension>('template');
const rows = ref<MetricBreakdown[]>([]);
const loading = ref(false);

const bucketLabel = computed(() => tabs.find(tab => tab.key === dimension.value)?.bucket || '分组');

const formatNumber = (value?: number) =>
  value === null || value === undefined ? '-' : Math.round(value).toLocaleString('zh-CN');

const formatPercent = (value?: number) =>
  value === null || value === undefined ? '-' : `${Math.round(value * 100)}%`;

const getList = async () => {
  loading.value = true;
  try {
    const res = await getMetricBreakdown(dimension.value);
    rows.value = res.data || [];
  } finally {
    loading.value = false;
  }
};

const switchDimension = (key: MetricDimension) => {
  if (dimension.value === key) return;
  dimension.value = key;
  void getList();
};

onMounted(getList);
</script>

<style lang="scss" scoped>
.heron-analytics-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.toolbar-panel,
.table-panel,
.note-panel {
  border: 1px solid var(--app-surface-border);
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
}

.confidence {
  font-size: var(--app-font-size-xs);

  &.is-ok {
    color: var(--app-text-muted);
  }

  &.is-thin {
    color: var(--app-warning);
  }
}

.note-title {
  margin: 0 0 10px;
  color: var(--app-text-title);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
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
