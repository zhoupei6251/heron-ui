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

    <el-card v-if="cost" shadow="hover" class="cost-panel">
      <div class="cost-row">
        <div class="cost-item">
          <span class="cost-label">近 {{ cost.days }} 天研究</span>
          <span class="cost-value">{{ cost.researchCount }}</span>
        </div>
        <div class="cost-item">
          <span class="cost-label">平均 token / 次</span>
          <span class="cost-value">{{ num(cost.avgTokens) }}</span>
        </div>
        <div class="cost-item">
          <span class="cost-label">工具调用</span>
          <span class="cost-value">{{ num(cost.toolCalls) }}</span>
        </div>
        <div class="cost-item">
          <span class="cost-label">采纳率</span>
          <span class="cost-value">{{ cost.acceptanceRate ? Math.round(Number(cost.acceptanceRate) * 100) + '%' : '-' }}</span>
        </div>
        <div class="cost-item">
          <span class="cost-label">核验 / 冲突</span>
          <span class="cost-value">{{ cost.verifiedCount }} / {{ cost.conflictCount }}</span>
        </div>
        <div class="cost-grades">
          <el-tag v-for="g in cost.byGrade" :key="g.grade" size="small" effect="plain" class="grade-tag">
            {{ g.grade }} · {{ g.count }} 次 · {{ num(g.avgTokens) }} token
          </el-tag>
        </div>
      </div>
      <p class="cost-hint">
        分档均值分开算——L1 和 L3 的单次成本差一个数量级，混在一起的平均值没有参考价值。
        采纳率的分母是已出决策的研究，不是全部研究。
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
              type="success"
              :disabled="row.decisionType !== 'PRODUCE'"
              :title="row.decisionType !== 'PRODUCE' ? '只有「建议生产」的判断能提升为候选' : ''"
              @click="handlePromote(row as ContentDecision)"
            >
              提升
            </el-button>
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

    <el-dialog :title="'决策 ' + (detail?.id || '')" :model-value="detailVisible" width="760px" append-to-body
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
        <p v-if="detail.verificationOverrideReason" class="verify-label">
          人工放行理由：{{ detail.verificationOverrideReason }}
        </p>
      </div>
      <p v-else-if="detail" class="faint verify-none">
        这条判断没有经过独立核验（只对「建议生产」的判断跑核验）。
      </p>
      <p v-if="detail?.evidenceOverrideReason" class="report-label">
        证据链人工放行理由：{{ detail.evidenceOverrideReason }}
      </p>
      <template #footer>
        <div class="dialog-footer">
          <el-button
            v-if="detail?.status === 'proposed'"
            v-hasPermi="['heron:decision:decide']"
            type="primary"
            :disabled="detail?.decisionType !== 'PRODUCE'"
            @click="handlePromote(detail!)"
          >
            采纳并提升
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
import type { ContentDecision, ContentDecisionQuery, DecisionStatus, DecisionType, ResearchCost } from '@/api/heron/decision/types';
import { acceptDecision, getDecision, getResearchCost, listDecision, promoteDecision, rejectDecision } from '@/api/heron/decision';
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

const cost = ref<ResearchCost>();

const num = (value?: number | null) =>
  value === null || value === undefined ? '-' : value.toLocaleString();

const loadCost = async () => {
  try {
    cost.value = (await getResearchCost(30)).data;
  } catch {
    // 成本概览失败不阻塞决策列表
  }
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
  const res = await getDecision(row.id);
  detail.value = res.data;
  detailVisible.value = true;
};

const openDecide = (row: ContentDecision, accepted: boolean) => {
  decide.value = { visible: true, accepted, note: '', target: row, submitting: false };
};

/**
 * 采纳并提升为候选。两个动作合成一步：只采纳不提升，那条判断就停在决策中心没人用。
 * 提升只产出候选，不建生产任务——生产仍由人认领。
 *
 * <p>两道闸都要人工写理由：核验判了冲突、证据链不完整。
 * 证据链那条只能在被拒之后才知道——后端拒绝时采纳会一并回滚，所以重试是安全的。
 */
const finishPromote = async (candidateId?: string) => {
  modal.msgSuccess('已提升为候选 ' + (candidateId || ''));
  detailVisible.value = false;
  await getList();
};

const errorText = (error: unknown) =>
  String((error as { message?: string })?.message || (error as { msg?: string })?.msg || '');

const handlePromote = async (row: ContentDecision) => {
  if (row.decisionType !== 'PRODUCE') {
    modal.msgWarning('只有「建议生产」的判断能提升为候选');
    return;
  }
  try {
    await modal.confirm(`采纳判断并提升为选题候选？
候选进入选题池，仍需人认领才生产。`);
  } catch {
    return;
  }
  let verificationOverride: string | undefined;
  if (row.verificationVerdict === 'DISAGREE') {
    try {
      const { value } = await modal.prompt('独立核验与研究员结论冲突，说明放行理由后才能提升：');
      verificationOverride = (value || '').trim();
    } catch {
      return;
    }
    if (!verificationOverride) {
      modal.msgWarning('核验冲突必须有放行理由');
      return;
    }
  }
  try {
    const res = await promoteDecision(row.id, verificationOverride);
    await finishPromote(res.data?.candidateId);
  } catch (error) {
    if (!errorText(error).includes('证据链')) throw error;
    let evidenceOverride: string | undefined;
    try {
      const { value } = await modal.prompt(
        '这条判断的证据链不完整：模型声称查过的引用在本次执行记录里找不到。说明放行理由后继续：'
      );
      evidenceOverride = (value || '').trim();
    } catch {
      return;
    }
    if (!evidenceOverride) {
      modal.msgWarning('证据链不完整必须有放行理由');
      return;
    }
    const res = await promoteDecision(row.id, verificationOverride, evidenceOverride);
    await finishPromote(res.data?.candidateId);
  }
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
      await acceptDecision(target.id, decide.value.note || undefined);
      modal.msgSuccess('已采纳');
    } else {
      await rejectDecision(target.id, decide.value.note.trim());
      modal.msgSuccess('已否决');
    }
    decide.value.visible = false;
    detailVisible.value = false;
    await getList();
  } finally {
    decide.value.submitting = false;
  }
};

onMounted(() => {
  void getList();
  void loadCost();
});
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

.cost-panel {
  border: 1px solid var(--app-surface-border);
}

.cost-row {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}

.cost-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cost-label {
  color: var(--app-text-faint);
  font-size: var(--app-font-size-xs);
}

.cost-value {
  font-family: var(--app-font-mono);
  font-size: var(--app-font-size-lg);
  font-weight: 600;
}

.cost-grades {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.grade-tag {
  font-family: var(--app-font-mono);
}

.cost-hint {
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
