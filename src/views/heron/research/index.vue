<template>
  <div class="p-2 app-container heron-research-page">
    <el-card shadow="hover" class="toolbar-panel">
      <div class="research-toolbar">
        <div class="toolbar-fields">
          <el-select v-model="queryParams.status" placeholder="全部状态" clearable class="w-[140px]" @change="handleQuery">
            <el-option v-for="(label, value) in researchStatusText" :key="value" :label="label" :value="value" />
          </el-select>
          <el-input
            v-model="queryParams.opportunityId"
            placeholder="机会 ID"
            clearable
            class="w-[200px]"
            @keyup.enter="handleQuery"
          />
          <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
          <el-button icon="Refresh" @click="resetQuery">重置</el-button>
        </div>
        <div class="toolbar-actions">
          <el-button v-hasPermi="['heron:research:run']" type="primary" plain icon="Plus" @click="openCreate">
            发起研究
          </el-button>
          <el-button icon="Refresh" @click="getList()">刷新</el-button>
        </div>
      </div>
      <p class="toolbar-hint">
        Agent 对一条数据机会做的判断。执行中每 {{ POLL_MS / 1000 }} 秒自动刷新；
        <strong>不完整</strong> 表示预算到点或轮数跑满，结论可用但没查完。
      </p>
    </el-card>

    <el-card shadow="hover" class="table-panel">
      <el-table v-loading="loading" border class="data-table" :data="rows">
        <el-table-column label="研究编号" min-width="140" align="center" show-overflow-tooltip>
          <template #default="{ row }"><span class="mono">{{ row.researchNo || '-' }}</span></template>
        </el-table-column>
        <el-table-column label="机会" min-width="150" align="center" show-overflow-tooltip>
          <template #default="{ row }"><span class="mono">{{ row.opportunityId }}</span></template>
        </el-table-column>
        <el-table-column label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="researchStatusTag[row.status as ResearchStatus] || 'info'" effect="plain">
              {{ researchStatusText[row.status as ResearchStatus] || row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="轮数" width="60" align="center">
          <template #default="{ row }">{{ row.rounds ?? '-' }}</template>
        </el-table-column>
        <el-table-column label="工具" width="60" align="center">
          <template #default="{ row }">{{ row.toolCalls ?? '-' }}</template>
        </el-table-column>
        <el-table-column label="token 输入/输出" width="130" align="center">
          <template #default="{ row }"><span class="mono">{{ tokenText(row as ResearchTask) }}</span></template>
        </el-table-column>
        <el-table-column label="发起时间" width="150" align="center">
          <template #default="{ row }">{{ timeText(row.createTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="100" align="center" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row as ResearchTask)">详情</el-button>
            <el-button
              v-if="canCancel(row.status)"
              v-hasPermi="['heron:research:cancel']"
              link
              type="danger"
              @click="handleCancel(row as ResearchTask)"
            >
              取消
            </el-button>
            <el-button
              v-else
              v-hasPermi="['heron:research:run']"
              link
              type="warning"
              @click="handleRerun(row as ResearchTask)"
            >
              重跑
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <pagination
        v-show="total > 0"
        v-model:page="queryParams.pageNum"
        v-model:limit="queryParams.pageSize"
        :total="total"
        @pagination="getList"
      />
    </el-card>

    <el-dialog v-model="createDialog.visible" title="发起研究" width="560px" append-to-body @closed="handleCreateClosed">
      <el-form ref="createFormRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="机会 ID" prop="opportunityId">
          <el-input v-model="form.opportunityId" placeholder="数字 ID，例如 2121151796750819328" class="mono" />
        </el-form-item>
        <el-form-item label="研究目标" prop="goal">
          <el-input
            v-model="form.goal"
            type="textarea"
            :rows="4"
            maxlength="500"
            show-word-limit
            placeholder="留空则用默认目标：判断这条机会值不值得做成一条 60 秒的数据视频"
          />
        </el-form-item>
      </el-form>
      <p class="dialog-hint">
        同一机会同一天只会建一个任务；发起后会消耗模型额度，执行中最长 10 分钟。
      </p>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" :loading="submitting" @click="submitCreate">发 起</el-button>
          <el-button @click="createDialog.visible = false">取 消</el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog
      v-model="detailDialog.visible"
      :title="'研究 ' + (detail?.researchNo || '')"
      width="860px"
      append-to-body
      @closed="handleDetailClosed"
    >
      <div v-loading="detailLoading">
        <el-descriptions v-if="detail" :column="2" border>
          <el-descriptions-item label="状态">
            <el-tag :type="researchStatusTag[detail.status] || 'info'" effect="plain">
              {{ researchStatusText[detail.status] || detail.status }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="机会">
            <span class="mono">{{ detail.opportunityId }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="决策">{{ detail.decisionType || '-' }}</el-descriptions-item>
          <el-descriptions-item label="尝试次数">{{ detail.attemptNo ?? '-' }}</el-descriptions-item>
          <el-descriptions-item label="轮数">{{ detail.rounds ?? '-' }}</el-descriptions-item>
          <el-descriptions-item label="工具调用">{{ detail.toolCalls ?? '-' }}</el-descriptions-item>
          <el-descriptions-item label="token">{{ tokenText(detail) }}</el-descriptions-item>
          <el-descriptions-item label="会话">
            <span class="mono">{{ detail.sessionId || '-' }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="目标" :span="2">{{ detail.goal || '-' }}</el-descriptions-item>
          <el-descriptions-item v-if="detail.errorCode" label="错误码" :span="2">
            <span class="is-bad mono">{{ detail.errorCode }}</span>
            <p class="error-reason">{{ detail.errorReason || '' }}</p>
          </el-descriptions-item>
        </el-descriptions>

        <div v-if="report" class="report-block">
          <h4>结构化报告</h4>
          <p class="report-head">
            <el-tag :type="decisionTag(report.decision)" effect="plain">
              {{ report.decision || '无结论' }}
            </el-tag>
            <span class="faint">把握 {{ report.confidence || '-' }}</span>
          </p>
          <p v-if="report.reason" class="report-reason">{{ report.reason }}</p>
          <template v-if="report.keyInsights && report.keyInsights.length">
            <p class="report-label">关键要点</p>
            <ul class="report-list">
              <li v-for="(item, index) in report.keyInsights" :key="index">{{ item }}</li>
            </ul>
          </template>
          <template v-if="report.riskWarnings && report.riskWarnings.length">
            <p class="report-label">风险与不确定性</p>
            <ul class="report-list">
              <li v-for="(item, index) in report.riskWarnings" :key="index">{{ item }}</li>
            </ul>
          </template>
          <p v-if="report.snapshot?.bound" class="report-label">
            依据的数据版本：
            <span class="mono">{{ report.snapshot.dataSha256 || '-' }}</span>
            <span class="faint">（取于 {{ report.snapshot.retrievedAt || '未知时间' }}）</span>
          </p>
          <p v-else class="faint">这次研究没有绑定数据快照，结论事后无法复核。</p>
        </div>

        <div v-if="evidence" class="report-block">
          <h4>
            证据轨迹
            <span class="faint">
              {{ evidence.toolCallCount || 0 }} 次调用 · 冻结快照 {{ evidence.snapshotCount || 0 }} 份
            </span>
          </h4>
          <el-table v-if="evidence.snapshots && evidence.snapshots.length" :data="evidence.snapshots" size="small" border>
            <el-table-column prop="sourceKey" label="数据源" min-width="170" />
            <el-table-column label="数据版本" min-width="150">
              <template #default="{ row }">
                <span class="mono">{{ shortSha(row.dataSha256) }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="retrievedAt" label="取数时间" min-width="160" />
          </el-table>
          <p v-else class="faint">这次研究没有冻结任何数据快照——结论的数字无从复核。</p>
          <p v-if="evidence.unverifiedCitations && evidence.unverifiedCitations.length" class="report-label is-bad">
            模型声称查过、账本里找不到的引用：{{ evidence.unverifiedCitations.join('、') }}
          </p>
          <el-collapse>
            <el-collapse-item :title="'工具调用（' + (evidence.calls?.length || 0) + '）'">
              <div v-for="call in evidence.calls || []" :key="call.callId" class="call-row">
                <p class="call-head">
                  <span class="mono">#{{ call.callId }}</span>
                  <span>{{ call.tool }}</span>
                  <el-tag :type="call.errorCode ? 'danger' : 'info'" size="small" effect="plain">
                    {{ call.status }}
                  </el-tag>
                  <span v-if="call.snapshotSourceKey" class="faint">
                    {{ call.snapshotSourceKey }} @ {{ call.snapshotRetrievedAt }}（{{ shortSha(call.snapshotSha256) }}）
                  </span>
                </p>
                <pre class="call-body">{{ call.request }}</pre>
                <pre class="call-body">{{ call.response }}</pre>
              </div>
            </el-collapse-item>
          </el-collapse>
        </div>

        <div v-if="detail?.resultText" class="result-block">
          <h4>结论文本</h4>
          <pre class="result-text">{{ detail.resultText }}</pre>
        </div>
        <el-empty v-else-if="detail && !isResearchActive(detail.status)" description="这次研究没有留下结论" />
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="detailDialog.visible = false">关 闭</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="HeronResearch" lang="ts">
import type { ResearchStatus, ResearchTask, ResearchTaskForm, ResearchTaskQuery } from '@/api/heron/research/types';
import { addResearch, cancelResearch, getResearch, listResearch, rerunResearch } from '@/api/heron/research';
import { useLoading } from '@/hooks/async/useLoading';
import { useDialogState } from '@/hooks/dialog/useDialogState';
import modal from '@/plugins/modal';
import { utcText } from '../heron-time';
import { canCancel, isResearchActive, researchStatusTag, researchStatusText } from './state';

/** 研究是长任务（最长 10 分钟），轮询只为让状态自己往前走。 */
const POLL_MS = 5000;

const { loading, withLoading } = useLoading(true);
const rows = ref<ResearchTask[]>([]);
const total = ref(0);

const queryParams = ref<ResearchTaskQuery>({
  pageNum: 1,
  pageSize: 10,
  status: undefined,
  opportunityId: undefined
});

const createFormRef = ref<ElFormInstance>();
const { dialog: createDialog } = useDialogState('发起研究');
const form = ref<ResearchTaskForm>({ opportunityId: undefined, goal: undefined });
const rules: ElFormRules = {
  opportunityId: [
    { required: true, message: '机会 ID 不能为空', trigger: 'blur' },
    { pattern: /^\d+$/, message: '机会 ID 只能是数字', trigger: 'blur' }
  ]
};
const submitting = ref(false);

const detailDialog = useDialogState('研究详情').dialog;
const detailLoading = ref(false);
const detail = ref<ResearchTask>();
const detailId = ref('');

/** 结构化报告：后端存的是 JSON 文本。 */
interface ResearchReportView {
  decision?: string | null;
  confidence?: string | null;
  reason?: string | null;
  keyInsights?: string[];
  riskWarnings?: string[];
  snapshot?: { bound?: boolean; dataSha256?: string; retrievedAt?: string };
}

/** 证据链：工具调用轨迹 + 本次 attempt 冻结的数据快照。 */
interface ResearchEvidenceView {
  toolCallCount?: number;
  snapshotCount?: number;
  unverifiedCitations?: string[];
  snapshots?: { sourceKey: string; dataSha256?: string; retrievedAt?: string }[];
  calls?: {
    callId: string;
    tool?: string;
    status?: string;
    errorCode?: string;
    request?: string;
    response?: string;
    snapshotSourceKey?: string;
    snapshotSha256?: string;
    snapshotRetrievedAt?: string;
  }[];
}

/** 解析失败时宁可不显示，也不要让整个详情页因为一条脏 JSON 打不开。 */
const parseJson = <T,>(text?: string | null): T | null => {
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
};

const report = computed(() => parseJson<ResearchReportView>(detail.value?.reportJson));
const evidence = computed(() => parseJson<ResearchEvidenceView>(detail.value?.evidenceJson));

const decisionTag = (decision?: string | null) =>
  decision === 'PRODUCE' ? 'success' : decision === 'REJECT' ? 'danger' : 'info';

const shortSha = (sha?: string | null) => (sha ? sha.slice(0, 12) : '-');

const timeText = utcText;

const tokenText = (row?: ResearchTask) => {
  if (!row) return '-';
  const input = row.inputTokens;
  const output = row.outputTokens;
  if ((input === null || input === undefined) && (output === null || output === undefined)) {
    return '未知';
  }
  return `${input ?? 0} / ${output ?? 0}`;
};

let pollTimer: number | undefined;
let listSeq = 0;
let detailSeq = 0;
let refreshing = false;
let active = false;

const hasActive = computed(
  () => rows.value.some(item => isResearchActive(item.status)) || Boolean(detail.value && isResearchActive(detail.value.status))
);

const stopPolling = () => {
  if (pollTimer !== undefined) {
    window.clearTimeout(pollTimer);
    pollTimer = undefined;
  }
};

const schedulePolling = () => {
  stopPolling();
  if (!active || document.hidden || !hasActive.value) return;
  pollTimer = window.setTimeout(() => {
    void refreshSilent();
  }, POLL_MS);
};

const getList = async (silent = false) => {
  if (!active) return;
  const seq = ++listSeq;
  const run = async () => {
    const res = await listResearch({ ...queryParams.value });
    if (seq !== listSeq) return;
    rows.value = res.data?.rows || [];
    total.value = res.data?.total || 0;
  };
  if (silent) {
    await run();
  } else {
    await withLoading(run);
    if (seq === listSeq) schedulePolling();
  }
};

const loadDetail = async (researchId: string, silent = false) => {
  if (!active || document.hidden) return;
  const seq = ++detailSeq;
  const run = async () => {
    const res = await getResearch(researchId);
    if (seq !== detailSeq || !detailDialog.visible || detailId.value !== researchId) return;
    detail.value = res.data;
  };
  if (silent) {
    await run();
    return;
  }
  detailLoading.value = true;
  try {
    await run();
  } finally {
    detailLoading.value = false;
  }
};

const refreshSilent = async () => {
  if (!active || document.hidden || refreshing) return;
  refreshing = true;
  try {
    await getList(true);
    if (detailDialog.visible && detailId.value) await loadDetail(detailId.value, true);
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
  if (hasActive.value) void refreshSilent();
};

const handleQuery = () => {
  queryParams.value.pageNum = 1;
  void getList();
};

const resetQuery = () => {
  queryParams.value.status = undefined;
  queryParams.value.opportunityId = undefined;
  handleQuery();
};

const openDetail = async (row: ResearchTask) => {
  detailId.value = row.researchId;
  detail.value = row;
  detailDialog.visible = true;
  await loadDetail(row.researchId);
  schedulePolling();
};

const handleDetailClosed = () => {
  detailSeq++;
  detailId.value = '';
  detail.value = undefined;
  schedulePolling();
};

const openCreate = () => {
  form.value = { opportunityId: undefined, goal: undefined };
  createDialog.visible = true;
};

const handleCreateClosed = () => {
  createFormRef.value?.resetFields();
  form.value = { opportunityId: undefined, goal: undefined };
};

const submitCreate = async () => {
  const valid = await createFormRef.value?.validate().catch(() => false);
  if (!valid) return;
  submitting.value = true;
  try {
    const res = await addResearch({ ...form.value });
    modal.msgSuccess(`已发起研究 ${res.data?.researchNo || ''}`);
    createDialog.visible = false;
    await getList(true);
    schedulePolling();
  } finally {
    submitting.value = false;
  }
};

const handleCancel = async (row: ResearchTask) => {
  try {
    await modal.confirm(`确定取消研究 ${row.researchNo || row.researchId}？已查到的数据会保留，执行中的最多 15 秒后停下。`);
  } catch {
    return;
  }
  await cancelResearch(row.researchId);
  modal.msgSuccess('已提交取消');
  await getList(true);
  if (detailDialog.visible && detailId.value === row.researchId) await loadDetail(row.researchId, true);
  schedulePolling();
};

const handleRerun = async (row: ResearchTask) => {
  try {
    await modal.confirm(`重跑研究 ${row.researchNo || row.researchId}？会沿用同一段会话，可能继续消耗模型额度。`);
  } catch {
    return;
  }
  await rerunResearch(row.researchId);
  modal.msgSuccess('已排上执行');
  await getList(true);
  schedulePolling();
};

const activate = () => {
  if (active) return;
  active = true;
  void getList();
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

onMounted(activate);
onActivated(activate);
onDeactivated(deactivate);
onBeforeUnmount(deactivate);
</script>

<style lang="scss" scoped>
.heron-research-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.toolbar-panel,
.table-panel {
  border: 1px solid var(--app-surface-border);
}

.research-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.toolbar-fields,
.toolbar-actions {
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

  strong {
    color: var(--app-warning, #b88230);
    font-weight: 600;
  }
}

.mono {
  font-family: var(--app-font-mono);
  font-size: var(--app-font-size-xs);
}

.is-bad {
  color: var(--app-danger);
  font-weight: 600;
}

.error-reason {
  margin: 6px 0 0;
  color: var(--app-text-faint);
  font-size: var(--app-font-size-xs);
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}

.dialog-hint {
  margin: 0;
  color: var(--app-text-faint);
  font-size: var(--app-font-size-xs);
  line-height: 1.7;
}

.result-block {
  margin-top: 16px;

  h4 {
    margin: 0 0 8px;
    font-size: var(--app-font-size-sm);
    font-weight: 600;
  }
}

.report-block {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--app-surface-border);

  h4 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 8px;
    font-size: var(--app-font-size-sm);
  }
}

.report-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 6px;
}

.report-reason {
  margin: 0;
  line-height: 1.8;
  word-break: break-word;
}

.report-label {
  margin: 10px 0 4px;
  color: var(--app-text-faint);
  font-size: var(--app-font-size-xs);
}

.report-list {
  margin: 0;
  padding-left: 18px;
  font-size: var(--app-font-size-xs);
  line-height: 1.8;
}

.call-row {
  padding: 8px 0;
  border-bottom: 1px dashed var(--app-surface-border);

  &:last-child {
    border-bottom: none;
  }
}

.call-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin: 0 0 4px;
  font-size: var(--app-font-size-xs);
}

.call-body {
  margin: 4px 0;
  padding: 6px 8px;
  max-height: 140px;
  overflow: auto;
  border-radius: 4px;
  background: var(--app-surface-subtle, transparent);
  font-family: var(--app-font-mono);
  font-size: var(--app-font-size-xs);
  white-space: pre-wrap;
  word-break: break-all;
}

.result-text {
  margin: 0;
  max-height: 380px;
  overflow: auto;
  padding: 12px;
  border: 1px solid var(--app-surface-border);
  border-radius: 4px;
  background: var(--app-surface-subtle, transparent);
  font-family: var(--app-font-mono);
  font-size: var(--app-font-size-xs);
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
