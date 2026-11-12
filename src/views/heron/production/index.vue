<template>
  <div class="p-2">
    <div class="search-wrap">
      <el-card shadow="hover" class="search-panel" :class="{ 'is-collapsed': !showSearch }">
        <template #header>
          <div class="panel-heading search-panel-toggle" @click.stop="showSearch = !showSearch">
            <div>
              <span class="panel-kicker">Production Tasks</span>
              <h3>筛选条件</h3>
            </div>
          </div>
        </template>
        <el-form ref="queryFormRef" :model="queryParams" :inline="true" class="query-form">
          <el-form-item label="业务线" prop="bizType">
            <el-select v-model="queryParams.bizType" placeholder="全部业务线" clearable class="w-180">
              <el-option label="热点新闻" value="news_video" />
              <el-option label="原型工坊" value="prototype" />
            </el-select>
          </el-form-item>
          <el-form-item label="状态" prop="status">
            <el-select v-model="queryParams.status" placeholder="全部状态" clearable class="w-180">
              <el-option v-for="(label, value) in productionStatusText" :key="value" :label="label" :value="value" />
            </el-select>
          </el-form-item>
          <el-form-item label="业务对象" prop="bizId">
            <el-input
              v-model="queryParams.bizId"
              placeholder="对象 ID"
              clearable
              class="w-180"
              @keyup.enter="handleQuery"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
            <el-button icon="Refresh" @click="resetQuery">重置</el-button>
          </el-form-item>
        </el-form>
      </el-card>
    </div>

    <el-card shadow="hover" class="table-panel">
      <template #header>
        <div class="toolbar-shell">
          <div class="table-heading">
            <span class="panel-kicker">Production Ledger</span>
            <h3>生产任务</h3>
            <p>共 {{ total }} 条记录；只显示你有权访问的业务对象。</p>
          </div>
          <div class="toolbar-actions">
            <el-button icon="Refresh" @click="getList()">刷新</el-button>
          </div>
        </div>
      </template>

      <el-alert
        v-for="reason in capabilityReasons"
        :key="reason"
        :title="reason"
        type="warning"
        :closable="false"
        class="mb-3"
      />

      <el-table v-loading="loading" border :data="tasks">
        <el-table-column label="任务 ID" prop="taskId" min-width="180" show-overflow-tooltip />
        <el-table-column label="业务线" width="110">
          <template #default="{ row }">{{ productionBizText[row.bizType] || row.bizType }}</template>
        </el-table-column>
        <el-table-column label="对象 ID" prop="bizId" width="160" show-overflow-tooltip />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="productionStatusTag[row.status] || 'info'">
              {{ productionStatusText[row.status] || row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="阶段" width="120">
          <template #default="{ row }">{{ row.stage || '-' }}</template>
        </el-table-column>
        <el-table-column label="进度" width="150">
          <template #default="{ row }">
            <div class="progress-cell">
              <span class="progress-track">
                <span class="progress-fill" :style="{ width: `${Math.min(100, Math.max(0, row.progress ?? 0))}%` }" />
              </span>
              <span class="progress-num">{{ row.progress ?? 0 }}%</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="尝试" prop="attemptNo" width="70" align="right" />
        <el-table-column label="开始时间" width="165">
          <template #default="{ row }">{{ utcText(row.startedAt) }}</template>
        </el-table-column>
        <el-table-column label="结束时间" width="165">
          <template #default="{ row }">{{ utcText(row.finishedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row as ProductionTask)">详情</el-button>
            <el-dropdown
              v-if="isProductionActive(row.status)"
              v-hasPermi="['heron:production:cancel']"
              trigger="click"
              @command="() => handleCancel(row as ProductionTask)"
            >
              <el-button link class="row-more" icon="MoreFilled" aria-label="更多操作" />
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="cancel">取消任务</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无生产任务" />
        </template>
      </el-table>

      <pagination
        v-show="total > 0"
        v-model:page="queryParams.pageNum"
        v-model:limit="queryParams.pageSize"
        :total="total"
        @pagination="() => getList()"
      />
    </el-card>

    <el-drawer v-model="detailDialog.visible" :title="detailDialog.title" size="760px" @closed="handleDetailClosed">
      <div v-loading="detailLoading">
        <template v-if="detail">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="任务 ID">{{ detail.taskId }}</el-descriptions-item>
            <el-descriptions-item label="业务线">
              {{ productionBizText[detail.bizType] || detail.bizType }}
            </el-descriptions-item>
            <el-descriptions-item label="对象 ID">{{ detail.bizId }}</el-descriptions-item>
            <el-descriptions-item label="状态">
              {{ productionStatusText[detail.status] || detail.status }}
            </el-descriptions-item>
            <el-descriptions-item label="阶段">{{ detail.stage || '-' }}</el-descriptions-item>
            <el-descriptions-item label="进度">{{ detail.progress ?? 0 }}%</el-descriptions-item>
            <el-descriptions-item label="尝试次数">{{ detail.attemptNo ?? '-' }}</el-descriptions-item>
            <el-descriptions-item label="版本">{{ detail.versionId || '-' }}</el-descriptions-item>
            <el-descriptions-item label="开始时间">{{ utcText(detail.startedAt) }}</el-descriptions-item>
            <el-descriptions-item label="结束时间">{{ utcText(detail.finishedAt) }}</el-descriptions-item>
          </el-descriptions>

          <el-alert
            v-if="detail.errorReason"
            :title="detail.errorCode ? detail.errorCode + '：' + detail.errorReason : detail.errorReason"
            type="error"
            :closable="false"
            class="mt-4"
          />

          <h4 class="detail-heading">阶段</h4>
          <el-table :data="detail.steps || []" border size="small">
            <el-table-column label="阶段" prop="stage" width="110" />
            <el-table-column label="状态" prop="status" width="90" />
            <el-table-column label="开始" width="160">
              <template #default="{ row }">{{ utcText(row.startedAt) }}</template>
            </el-table-column>
            <el-table-column label="结束" width="160">
              <template #default="{ row }">{{ utcText(row.finishedAt) }}</template>
            </el-table-column>
            <el-table-column label="错误" prop="errorReason" show-overflow-tooltip />
            <el-table-column label="证据" min-width="120" show-overflow-tooltip>
              <template #default="{ row }">{{ evidenceText(row.evidence) }}</template>
            </el-table-column>
            <template #empty>
              <el-empty description="暂无阶段记录" :image-size="60" />
            </template>
          </el-table>

          <h4 class="detail-heading">外部用量</h4>
          <el-table :data="detail.usage || []" border size="small">
            <el-table-column label="提供方" prop="provider" width="100" />
            <el-table-column label="模型" prop="model" width="130" show-overflow-tooltip />
            <el-table-column label="状态" prop="status" width="90" />
            <el-table-column label="输入 token" width="110">
              <template #default="{ row }">{{ tokenText(row.inputTokens) }}</template>
            </el-table-column>
            <el-table-column label="输出 token" width="110">
              <template #default="{ row }">{{ tokenText(row.outputTokens) }}</template>
            </el-table-column>
            <el-table-column label="耗时(ms)" width="100">
              <template #default="{ row }">{{ row.elapsedMs ?? '-' }}</template>
            </el-table-column>
            <template #empty>
              <el-empty description="暂无外部调用记录" :image-size="60" />
            </template>
          </el-table>
        </template>
      </div>
    </el-drawer>
  </div>
</template>

<script setup name="HeronProduction" lang="ts">
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref } from 'vue';
import type {
  ProductionCapabilities,
  ProductionFile,
  ProductionTask,
  ProductionTaskQuery
} from '@/api/heron/production/types';
import { cancelProduction, getProduction, getProductionCapabilities, listProduction } from '@/api/heron/production';
import { useLoading } from '@/hooks/async/useLoading';
import { useDialogState } from '@/hooks/dialog/useDialogState';
import { useSearchReset } from '@/hooks/form/useSearchReset';
import { useSearchToggle } from '@/hooks/form/useSearchToggle';
import modal from '@/plugins/modal';
import { checkPermi } from '@/utils/permission';
import { utcText } from '../heron-time';
import { isProductionActive, productionBizText, productionStatusTag, productionStatusText } from './task-state';

const { loading, withLoading } = useLoading(true);
const { showSearch } = useSearchToggle();

const queryFormRef = ref<ElFormInstance>();
const queryParams = ref<ProductionTaskQuery>({
  pageNum: 1,
  pageSize: 10,
  bizType: '',
  status: '',
  bizId: ''
});
const tasks = ref<ProductionTask[]>([]);
const total = ref(0);
const capabilities = ref<ProductionCapabilities>();
const { dialog: detailDialog } = useDialogState('任务详情');
const detailLoading = ref(false);
const detail = ref<ProductionTask>();
const detailTaskId = ref('');

const capabilityReasons = computed(() => {
  if (!capabilities.value) {
    return [];
  }
  return (['news', 'prototype'] as const).flatMap(key => {
    const capability = capabilities.value?.[key];
    if (!capability || capability.available || !capability.reasons?.length) {
      return [];
    }
    const label = key === 'news' ? '热点新闻' : '原型工坊';
    return [`${label}当前不可用：${capability.reasons.join('；')}`];
  });
});

let pollTimer: number | undefined;
let listSeq = 0;
let detailSeq = 0;
let refreshing = false;
let active = false;

const hasActiveTask = computed(
  () =>
    tasks.value.some(task => isProductionActive(task.status)) ||
    Boolean(detail.value && isProductionActive(detail.value.status))
);

const stopPolling = () => {
  if (pollTimer !== undefined) {
    window.clearTimeout(pollTimer);
    pollTimer = undefined;
  }
};

const schedulePolling = () => {
  stopPolling();
  if (!active || document.hidden || !hasActiveTask.value) {
    return;
  }
  pollTimer = window.setTimeout(() => {
    void refreshSilent();
  }, 2000);
};

const getList = async (silent = false) => {
  if (!active) return;
  const seq = ++listSeq;
  const run = async () => {
    const res = await listProduction({ ...queryParams.value });
    if (seq !== listSeq) {
      return;
    }
    tasks.value = res.data?.rows || [];
    total.value = res.data?.total || 0;
  };
  if (silent) {
    await run();
  } else {
    await withLoading(run);
    if (seq === listSeq) {
      schedulePolling();
    }
  }
};

const loadDetail = async (taskId: string, silent = false) => {
  if (!active || document.hidden) return;
  const seq = ++detailSeq;
  const run = async () => {
    const res = await getProduction(taskId);
    if (seq !== detailSeq || !detailDialog.visible || detailTaskId.value !== taskId) {
      return;
    }
    detail.value = res.data;
  };
  if (silent) {
    await run();
  } else {
    detailLoading.value = true;
    try {
      await run();
    } finally {
      detailLoading.value = false;
    }
  }
};

const refreshSilent = async () => {
  if (!active || document.hidden || refreshing) {
    return;
  }
  refreshing = true;
  try {
    await getList(true);
    if (detailDialog.visible && detailTaskId.value) {
      await loadDetail(detailTaskId.value, true);
    }
  } finally {
    refreshing = false;
    schedulePolling();
  }
};

const handleVisible = () => {
  if (document.hidden) {
    stopPolling();
    return;
  }
  if (hasActiveTask.value) {
    void refreshSilent();
  }
};

const loadCapabilities = async () => {
  if (!checkPermi(['heron:newsWork:query', 'heron:proto:query'])) {
    return;
  }
  try {
    const res = await getProductionCapabilities();
    capabilities.value = res.data;
  } catch {
    // 能力信息失败不阻塞任务列表，请求层已提示
  }
};

const handleQuery = async () => {
  queryParams.value.pageNum = 1;
  await getList();
};

const { resetQuery } = useSearchReset({
  queryFormRef,
  queryParams,
  pageNumKey: 'pageNum',
  pageSizeKey: 'pageSize',
  initialPageNum: 1,
  initialPageSize: 10,
  afterReset: () => {
    void getList();
  }
});

const openDetail = async (row: ProductionTask) => {
  detailTaskId.value = row.taskId;
  detail.value = row;
  detailDialog.visible = true;
  await loadDetail(row.taskId);
  schedulePolling();
};

const handleDetailClosed = () => {
  detailSeq++;
  detailTaskId.value = '';
  detail.value = undefined;
  schedulePolling();
};

const handleCancel = async (row: ProductionTask) => {
  try {
    await modal.confirm(`确定取消任务 ${row.taskId}？执行中的任务会先进入取消中，确认进程停止后才显示已取消。`);
  } catch {
    return;
  }
  await cancelProduction(row.taskId);
  modal.msgSuccess('已提交取消');
  await getList(true);
  if (detailDialog.visible && detailTaskId.value === row.taskId) {
    await loadDetail(row.taskId, true);
  }
  schedulePolling();
};

const tokenText = (value?: number | null) => (value === null || value === undefined ? '未知' : value);

const evidenceText = (evidence?: ProductionFile[]) =>
  evidence && evidence.length ? evidence.map(file => `${file.kind}·${file.artifactId.slice(0, 8)}`).join('，') : '-';

const activate = () => {
  if (active) return;
  active = true;
  void getList();
  if (detailDialog.visible && detailTaskId.value) void loadDetail(detailTaskId.value);
  document.addEventListener('visibilitychange', handleVisible);
  window.addEventListener('focus', handleVisible);
};

const deactivate = () => {
  active = false;
  stopPolling();
  listSeq++;
  detailSeq++;
  document.removeEventListener('visibilitychange', handleVisible);
  window.removeEventListener('focus', handleVisible);
};

onMounted(() => {
  void loadCapabilities();
  activate();
});
onActivated(activate);
onDeactivated(deactivate);
onBeforeUnmount(deactivate);
</script>

<style scoped lang="scss">
.search-panel-toggle {
  cursor: pointer;
}

.search-panel.is-collapsed :deep(.el-card__body) {
  display: none;
}

.w-180 {
  width: 180px;
}

.mb-3 {
  margin-bottom: 12px;
}

.mt-4 {
  margin-top: 16px;
}

.detail-heading {
  margin: 20px 0 8px;
  font-size: 14px;
}

.progress-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.progress-track {
  flex: 1;
  height: 4px;
  min-width: 36px;
  border-radius: 999px;
  background: var(--app-accent-softer);
  overflow: hidden;
}

.progress-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--app-accent-strong);
  transition: width var(--app-duration-base) var(--app-ease);
}

.progress-num {
  min-width: 32px;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  font-variant-numeric: tabular-nums;
  text-align: right;
}
</style>
