<template>
  <div class="p-2 app-container heron-decision-page">
    <el-card shadow="hover" class="toolbar-panel">
      <div class="decision-toolbar">
        <div class="toolbar-fields">
          <el-select v-model="queryParams.decisionType" placeholder="全部判断" clearable class="w-[140px]" @change="handleQuery">
            <el-option v-for="(label, value) in decisionTypeText" :key="value" :label="label" :value="value" />
          </el-select>
          <el-select v-model="queryParams.status" placeholder="全部状态" clearable class="w-[140px]" @change="handleQuery">
            <el-option v-for="(label, value) in decisionStatusText" :key="value" :label="label" :value="value" />
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
        <el-button icon="Refresh" @click="getList()">刷新</el-button>
      </div>
      <p class="toolbar-hint">
        Agent 给出的判断，加上人的裁决。<strong>采纳不等于允许生产</strong>——生产闸在自己的链路上，
        这里只记下人的意图；否决必须写理由，那是回头复盘和改提示词的依据。
      </p>
    </el-card>

    <el-card shadow="hover" class="table-panel">
      <el-table v-loading="loading" border class="data-table" :data="rows">
        <el-table-column label="判断" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="decisionTypeTag[row.decisionType as DecisionType] || 'info'" effect="plain">
              {{ decisionTypeText[row.decisionType as DecisionType] || row.decisionType }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="处理" width="85" align="center">
          <template #default="{ row }">
            <el-tag :type="decisionStatusTag[row.status as DecisionStatus] || 'info'" effect="plain">
              {{ decisionStatusText[row.status as DecisionStatus] || row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="核验" width="80" align="center">
          <template #default="{ row }">
            <el-tooltip v-if="row.verificationVerdict" :content="conflictSummary(row as ContentDecision)" placement="top">
              <el-tag :type="verdictTag(row.verificationVerdict)" effect="plain">
                {{ verdictText(row.verificationVerdict) }}
              </el-tag>
            </el-tooltip>
            <span v-else class="faint">未核验</span>
          </template>
        </el-table-column>
        <el-table-column label="把握" width="70" align="center">
          <template #default="{ row }">{{ confidenceText(row as ContentDecision) }}</template>
        </el-table-column>
        <el-table-column label="机会" min-width="140" align="center" show-overflow-tooltip>
          <template #default="{ row }"><span class="mono">{{ row.opportunityId || '-' }}</span></template>
        </el-table-column>
        <el-table-column label="理由" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">{{ row.decisionReason || '-' }}</template>
        </el-table-column>
        <el-table-column label="快照" width="95" align="center">
          <template #default="{ row }">
            <span v-if="row.evidenceRef" class="mono">{{ row.evidenceRef.slice(0, 8) }}…</span>
            <span v-else class="faint">未绑定</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="95" align="center" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row as ContentDecision)">详情</el-button>
            <el-button
              v-if="row.status === 'proposed'"
              v-hasPermi="['heron:decision:decide']"
              link
              type="warning"
              @click="openDecide(row as ContentDecision, false)"
            >
              否决
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

    <el-dialog :title="'决策 ' + (detail?.decisionId || '')" :model-value="detailVisible" width="760px" append-to-body
               @update:model-value="detailVisible = $event">
      <el-descriptions v-if="detail" :column="2" border>
        <el-descriptions-item label="判断">
          <el-tag :type="decisionTypeTag[detail.decisionType] || 'info'" effect="plain">
            {{ decisionTypeText[detail.decisionType] || detail.decisionType }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="把握">{{ confidenceText(detail) }}</el-descriptions-item>
        <el-descriptions-item label="处理状态">
          <el-tag :type="decisionStatusTag[detail.status] || 'info'" effect="plain">
            {{ decisionStatusText[detail.status] || detail.status }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="尝试次数">{{ detail.attemptNo ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="机会" :span="2">
          <span class="mono">{{ detail.opportunityId || '-' }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="理由" :span="2">{{ detail.decisionReason || '-' }}</el-descriptions-item>
        <el-descriptions-item label="快照标识" :span="2">
          <span v-if="detail.evidenceRef" class="mono break">{{ detail.evidenceRef }}</span>
          <span v-else class="faint">当时没有可绑定的快照，这条结论无法按数据版本复核</span>
        </el-descriptions-item>
        <el-descriptions-item label="模型">{{ detail.modelId || '-' }}</el-descriptions-item>
        <el-descriptions-item label="提示词版本">{{ detail.promptVersion || '-' }}</el-descriptions-item>
        <el-descriptions-item v-if="detail.decisionNote" label="人工意见" :span="2">
          {{ detail.decisionNote }}
        </el-descriptions-item>
      </el-descriptions>

      <div v-if="detail?.verificationVerdict" class="verify-block">
        <h4>
          独立核验
          <el-tag :type="verdictTag(detail.verificationVerdict)" effect="plain" size="small">
            {{ verdictText(detail.verificationVerdict) }}
          </el-tag>
        </h4>
        <p class="verify-reason">{{ detail.verificationReason || '-' }}</p>
        <template v-if="conflicts(detail).length">
          <p class="verify-label">核验员指出的问题（{{ conflicts(detail).length }} 条）</p>
          <ul class="verify-list">
            <li v-for="(item, index) in conflicts(detail)" :key="index">{{ item }}</li>
          </ul>
        </template>
        <p v-else class="faint">核验员没有指出具体问题</p>
      </div>
      <p v-else-if="detail" class="faint verify-none">
        这条判断没有经过独立核验（只对「建议生产」的判断跑核验）。
      </p>
      <template #footer>
        <div class="dialog-footer">
          <el-button
            v-if="detail?.status === 'proposed'"
            v-hasPermi="['heron:decision:decide']"
            type="primary"
            @click="openDecide(detail!, true)"
          >
            采 纳
          </el-button>
          <el-button @click="detailVisible = false">关 闭</el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog v-model="decide.visible" :title="decide.accepted ? '采纳判断' : '否决判断'" width="520px" append-to-body>
      <p class="decide-hint">
        {{ decide.accepted
          ? '采纳只表示你认可这个判断，不等于允许生产——生产闸在自己的链路上。'
          : '否决必须写理由：说不出为什么否决的否决，事后没法复盘，也没法用来改提示词。' }}
      </p>
      <el-input
        v-model="decide.note"
        type="textarea"
        :rows="4"
        maxlength="500"
        show-word-limit
        :placeholder="decide.accepted ? '可选' : '必填'"
      />
      <template #footer>
        <div class="dialog-footer">
          <el-button :type="decide.accepted ? 'primary' : 'danger'" :loading="decide.submitting" @click="submitDecide">
            确 定
          </el-button>
          <el-button @click="decide.visible = false">取 消</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="HeronDecision" lang="ts">
import type { ContentDecision, ContentDecisionQuery, DecisionStatus, DecisionType } from '@/api/heron/decision/types';
import { acceptDecision, getDecision, listDecision, rejectDecision } from '@/api/heron/decision';
import { useLoading } from '@/hooks/async/useLoading';
import modal from '@/plugins/modal';
import { decisionStatusTag, decisionStatusText, decisionTypeTag, decisionTypeText } from './state';

const { loading, withLoading } = useLoading(true);
const rows = ref<ContentDecision[]>([]);
const total = ref(0);

const queryParams = ref<ContentDecisionQuery>({
  pageNum: 1,
  pageSize: 10,
  decisionType: undefined,
  status: undefined,
  opportunityId: undefined
});

const detail = ref<ContentDecision>();
const detailVisible = ref(false);
const decide = ref({ visible: false, accepted: true, note: '', target: undefined as ContentDecision | undefined, submitting: false });


const confidenceText = (row?: ContentDecision) =>
  row?.confidence ? `${Math.round(Number(row.confidence) * 100)}%` : '未知';

const verdictText = (verdict?: string) =>
  ({ AGREE: '一致', DISAGREE: '不一致', UNCERTAIN: '无法判断' })[verdict || ''] || verdict || '';

/** 只有 DISAGREE 才是「结论错了」；AGREE 也可能带瑕疵，所以颜色分开。 */
const verdictTag = (verdict?: string) =>
  (verdict === 'AGREE' ? 'success' : verdict === 'DISAGREE' ? 'danger' : 'warning') as
    | 'success'
    | 'danger'
    | 'warning';

/** verificationConflicts 是 JSON 数组文本；解析失败就当没有，不要在页面上抛错。 */
const conflicts = (row?: ContentDecision): string[] => {
  if (!row?.verificationConflicts) return [];
  try {
    const parsed = JSON.parse(row.verificationConflicts);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
};

const conflictSummary = (row?: ContentDecision) => {
  const count = conflicts(row).length;
  return count ? `核验提出 ${count} 条问题，点详情查看` : '核验未指出具体问题';
};

const getList = async () => {
  await withLoading(async () => {
    const res = await listDecision({ ...queryParams.value });
    rows.value = res.data?.rows || [];
    total.value = res.data?.total || 0;
  });
};

const handleQuery = () => {
  queryParams.value.pageNum = 1;
  void getList();
};

const resetQuery = () => {
  queryParams.value.decisionType = undefined;
  queryParams.value.status = undefined;
  queryParams.value.opportunityId = undefined;
  handleQuery();
};

const openDetail = async (row: ContentDecision) => {
  const res = await getDecision(row.decisionId);
  detail.value = res.data;
  detailVisible.value = true;
};

const openDecide = (row: ContentDecision, accepted: boolean) => {
  decide.value = { visible: true, accepted, note: '', target: row, submitting: false };
};

const submitDecide = async () => {
  const target = decide.value.target;
  if (!target) return;
  if (!decide.value.accepted && !decide.value.note.trim()) {
    modal.msgWarning('否决必须写理由');
    return;
  }
  decide.value.submitting = true;
  try {
    if (decide.value.accepted) {
      await acceptDecision(target.decisionId, decide.value.note || undefined);
      modal.msgSuccess('已采纳');
    } else {
      await rejectDecision(target.decisionId, decide.value.note.trim());
      modal.msgSuccess('已否决');
    }
    decide.value.visible = false;
    detailVisible.value = false;
    await getList();
  } finally {
    decide.value.submitting = false;
  }
};

onMounted(getList);
</script>

<style lang="scss" scoped>
.heron-decision-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.toolbar-panel,
.table-panel {
  border: 1px solid var(--app-surface-border);
}

.decision-toolbar {
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

.decide-hint {
  margin: 0 0 12px;
  color: var(--app-text-faint);
  font-size: var(--app-font-size-xs);
  line-height: 1.7;
}

.verify-block {
  margin-top: 16px;

  h4 {
    margin: 0 0 8px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--app-font-size-sm);
    font-weight: 600;
  }
}

.verify-reason {
  margin: 0;
  color: var(--app-text-faint);
  font-size: var(--app-font-size-xs);
  line-height: 1.8;
  white-space: pre-wrap;
}

.verify-label {
  margin: 12px 0 6px;
  font-size: var(--app-font-size-xs);
  font-weight: 600;
}

.verify-list {
  margin: 0;
  padding-left: 18px;
  color: var(--app-text-faint);
  font-size: var(--app-font-size-xs);
  line-height: 1.8;

  li + li {
    margin-top: 4px;
  }
}

.verify-none {
  margin: 16px 0 0;
}

.mono {
  font-family: var(--app-font-mono);
  font-size: var(--app-font-size-xs);
}

.faint {
  color: var(--app-text-faint);
  font-size: var(--app-font-size-xs);
}

.break {
  word-break: break-all;
}
</style>
