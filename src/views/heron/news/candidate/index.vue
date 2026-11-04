<template>
  <div class="p-2 app-container heron-news-candidate-page">
    <div class="search-wrap">
      <el-card shadow="hover" class="search-panel" :class="{ 'is-collapsed': !showSearch }">
        <template #header>
          <div class="panel-heading search-panel-toggle" @click.stop="showSearch = !showSearch">
            <div><h3>筛选条件</h3></div>
          </div>
        </template>
        <el-form ref="queryFormRef" :model="queryParams" :inline="true" class="query-form">
          <el-form-item label="标题" prop="title">
            <el-input v-model="queryParams.title" placeholder="请输入标题关键字" clearable @keyup.enter="handleQuery" />
          </el-form-item>
          <el-form-item label="认领状态" prop="claimed">
            <el-select v-model="queryParams.claimed" placeholder="全部" clearable class="w-[180px]">
              <el-option label="未认领" :value="false" />
              <el-option label="已认领" :value="true" />
            </el-select>
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
            <h3>候选新闻</h3>
            <p>同一条新闻的多个来源会合并为一条候选并保留全部证据；认领后进入新闻工作台。</p>
          </div>
          <div class="toolbar-actions">
            <el-button
              v-hasPermi="['heron:newsCandidate:manual']"
              type="primary"
              plain
              icon="Plus"
              @click="handleManual"
            >
              手工录入
            </el-button>
            <right-toolbar v-model:show-search="showSearch" :search="false" @query-table="getList"></right-toolbar>
          </div>
        </div>
      </template>

      <el-table v-loading="loading" border class="data-table" :data="candidates">
        <el-table-column label="标题" prop="title" min-width="220" show-overflow-tooltip />
        <el-table-column label="摘要" prop="summary" min-width="260" show-overflow-tooltip />
        <el-table-column label="来源数" width="80" align="center" prop="hitCount" />
        <el-table-column label="热度" width="80" align="center" prop="heatScore" />
        <el-table-column label="最佳排名" width="90" align="center">
          <template #default="{ row }">{{ row.bestRank ?? '-' }}</template>
        </el-table-column>
        <el-table-column label="最新出现" width="160" align="center">
          <template #default="{ row }">{{ timeText(row.lastSeenAt) }}</template>
        </el-table-column>
        <el-table-column label="认领" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.claimedAt ? 'success' : 'info'">{{ row.claimedAt ? '已认领' : '未认领' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" align="center" class-name="small-padding fixed-width">
          <template #default="{ row }">
            <el-tooltip content="证据详情" placement="top">
              <el-button link type="primary" icon="Document" @click="openDetail(row as NewsCandidate)"></el-button>
            </el-tooltip>
            <el-tooltip content="认领到工作台" placement="top">
              <el-button
                v-hasPermi="['heron:newsCandidate:claim']"
                link
                type="primary"
                icon="Position"
                @click="handleClaim(row as NewsCandidate)"
              ></el-button>
            </el-tooltip>
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

    <el-dialog v-model="detailDialog.visible" :title="detailDialog.title" width="720px" append-to-body>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="标题" :span="2">{{ detail?.title }}</el-descriptions-item>
        <el-descriptions-item label="首次出现">{{ timeText(detail?.firstSeenAt) }}</el-descriptions-item>
        <el-descriptions-item label="最新出现">{{ timeText(detail?.lastSeenAt) }}</el-descriptions-item>
        <el-descriptions-item label="摘要" :span="2">
          <div class="summary-text">{{ detail?.summary }}</div>
        </el-descriptions-item>
      </el-descriptions>

      <h4 class="section-title">来源证据</h4>
      <el-table :data="evidenceItems" border>
        <el-table-column label="来源" width="120">
          <template #default="{ row }">{{ row.manual ? '手工录入' : row.sourceId }}</template>
        </el-table-column>
        <el-table-column label="链接" prop="sourceUrl" min-width="220" show-overflow-tooltip />
        <el-table-column label="抓取时间" width="160" align="center">
          <template #default="{ row }">{{ timeText(row.fetchedAt) }}</template>
        </el-table-column>
        <el-table-column label="内容指纹" min-width="180">
          <template #default="{ row }">
            <span class="sha-text">{{ row.contentSha256 ? row.contentSha256.slice(0, 16) + '…' : '-' }}</span>
          </template>
        </el-table-column>
      </el-table>
      <el-alert
        v-if="evidenceTruncated"
        class="mt-2"
        type="warning"
        :closable="false"
        title="证据条目过多，已丢弃中间条目以保留首条与最新一条"
      />

      <template #footer>
        <div class="dialog-footer">
          <el-button v-hasPermi="['heron:newsCandidate:claim']" type="primary" @click="handleClaim(detail)">
            认领
          </el-button>
          <el-button @click="closeDetail">关 闭</el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog v-model="formDialog.visible" :title="formDialog.title" width="640px" append-to-body>
      <el-form ref="candidateFormRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="标题" prop="title">
          <el-input v-model="form.title" placeholder="最多 200 字" maxlength="200" show-word-limit />
        </el-form-item>
        <el-form-item label="事实摘要" prop="summary">
          <el-input
            v-model="form.summary"
            type="textarea"
            :rows="8"
            maxlength="16000"
            show-word-limit
            placeholder="只写已核对来源的事实；授权与素材可用性由人工在后续环节判断"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button :loading="buttonLoading" type="primary" @click="submitForm">确 定</el-button>
          <el-button @click="formDialog.visible = false">取 消</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="HeronNewsCandidate" lang="ts">
import type { NewsCandidate, NewsCandidateForm, NewsCandidateQuery } from '@/api/heron/newsCandidate/types';
import { addNewsCandidate, claimNewsCandidate, getNewsCandidate, listNewsCandidate } from '@/api/heron/newsCandidate';
import { useLoading } from '@/hooks/async/useLoading';
import { useDialogState } from '@/hooks/dialog/useDialogState';
import { useFormDialog } from '@/hooks/dialog/useFormDialog';
import { useSearchReset } from '@/hooks/form/useSearchReset';
import { useSearchToggle } from '@/hooks/form/useSearchToggle';
import modal from '@/plugins/modal';
import { utcText } from '../../heron-time';

interface EvidenceItem {
  sourceId?: string | number;
  sourceUrl?: string;
  manual?: boolean;
  fetchedAt?: string;
  title?: string;
  summary?: string;
  sourceItemId?: string;
  contentSha256?: string;
}

const candidates = ref<NewsCandidate[]>([]);
const total = ref(0);
const buttonLoading = ref(false);
const detail = ref<NewsCandidate>();
const { loading, withLoading } = useLoading(true);
const { showSearch } = useSearchToggle();

const queryFormRef = ref<ElFormInstance>();
const candidateFormRef = ref<ElFormInstance>();

const initFormData: NewsCandidateForm = { title: '', summary: '' };
const data = reactive<PageData<NewsCandidateForm, NewsCandidateQuery>>({
  form: { ...initFormData },
  queryParams: { pageNum: 1, pageSize: 10, title: undefined, claimed: undefined },
  rules: {
    title: [
      { required: true, message: '标题不能为空', trigger: 'blur' },
      { max: 200, message: '标题不能超过 200 字', trigger: 'blur' }
    ],
    summary: [
      { required: true, message: '事实摘要不能为空', trigger: 'blur' },
      { max: 16000, message: '摘要过长', trigger: 'blur' }
    ]
  }
});
const { queryParams, form, rules } = toRefs(data);

/** 详情弹窗只做展示，录入走 useFormDialog，两者状态不互相污染。 */
const { dialog: detailDialog, closeDialog: closeDetail } = useDialogState('候选新闻详情');
const {
  dialog: formDialog,
  resetForm: reset,
  openDialog
} = useFormDialog({ form, formRef: candidateFormRef, initialFormData: initFormData });

const evidenceItems = computed<EvidenceItem[]>(() => {
  const raw = detail.value?.evidence;
  if (!raw) return [];
  try {
    const items: unknown = (JSON.parse(raw) as { items?: unknown }).items;
    return Array.isArray(items) ? (items as EvidenceItem[]) : [];
  } catch {
    // 证据列由后端写入，解析失败只说明数据异常，不应让详情弹窗整体崩掉
    return [];
  }
});
const evidenceTruncated = computed(() => {
  try {
    return Boolean((JSON.parse(detail.value?.evidence || '{}') as { evidenceTruncated?: boolean }).evidenceTruncated);
  } catch {
    return false;
  }
});

const timeText = utcText;

/** 查询候选新闻列表 */
const getList = async () => {
  await withLoading(async () => {
    const res = await listNewsCandidate(queryParams.value);
    candidates.value = res.data?.rows || [];
    total.value = res.data?.total || 0;
  });
};

/** 搜索按钮操作 */
const handleQuery = () => {
  queryParams.value.pageNum = 1;
  getList();
};

const { resetQuery } = useSearchReset({
  queryFormRef,
  queryParams,
  pageNumKey: 'pageNum',
  afterReset: () => {
    handleQuery();
  }
});

/** 手工录入按钮操作 */
const handleManual = () => {
  reset();
  openDialog('手工录入候选新闻');
};

/** 提交录入 */
const submitForm = () => {
  candidateFormRef.value?.validate(async (valid: boolean) => {
    if (!valid) return;
    buttonLoading.value = true;
    try {
      await addNewsCandidate(form.value);
      modal.msgSuccess('已录入候选');
      formDialog.visible = false;
      await getList();
    } finally {
      buttonLoading.value = false;
    }
  });
};

const openDetail = async (row: NewsCandidate) => {
  const res = await getNewsCandidate(row.candidateId);
  detail.value = res.data;
  detailDialog.visible = true;
};

/** 认领是持久操作：同用户重复点击由后端幂等返回同一作品 */
const handleClaim = async (row?: Partial<NewsCandidate>) => {
  if (!row?.candidateId) return;
  const res = await claimNewsCandidate(row.candidateId);
  modal.msgSuccess(`已认领，作品 ${res.data.workId} 可在工作台编辑`);
  closeDetail();
  await getList();
};

onMounted(() => {
  getList();
});
</script>

<style scoped>
.summary-text {
  white-space: pre-wrap;
  line-height: 1.7;
}
.section-title {
  margin: 16px 0 8px;
}
.sha-text {
  font-family: var(--el-font-family-monospace, monospace);
}
</style>
