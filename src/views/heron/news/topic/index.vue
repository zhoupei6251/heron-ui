<template>
  <div class="p-2 app-container heron-topic-page">
    <el-card shadow="hover" class="toolbar-panel">
      <div class="topic-toolbar">
        <ul class="topic-tabs" role="tablist">
          <li
            v-for="tab in tabs"
            :key="tab.key"
            :class="['topic-tab', { 'is-active': activeTab === tab.key }]"
            role="tab"
            :aria-selected="activeTab === tab.key"
            @click="switchTab(tab.key)"
          >
            {{ tab.label }}
          </li>
        </ul>

        <div class="topic-tools">
          <el-input
            v-model="queryParams.title"
            class="topic-search"
            placeholder="按标题搜索"
            clearable
            prefix-icon="Search"
            @keyup.enter="handleQuery"
            @clear="handleQuery"
          />
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
      <p class="topic-hint">
        同一条新闻的多个来源会合并成一条候选并保留全部证据。「有正文」表示这条候选至少有一条带链接的原文来源，
        可以走新闻解说线；没有正文的只能靠热榜标题和数据看板线。
      </p>
    </el-card>

    <div v-loading="loading" class="topic-grid">
      <article v-for="row in candidates" :key="row.candidateId" class="topic-card">
        <header class="topic-card-head">
          <h3 class="topic-title" :title="row.title">{{ row.title }}</h3>
          <el-tag v-if="row.claimedAt" size="small" type="success" effect="plain">已认领</el-tag>
          <el-tag v-else-if="row.publishedAt" size="small" type="info" effect="plain">已发布</el-tag>
        </header>

        <p class="topic-summary">{{ plainText(row.summary) || '（无摘要）' }}</p>

        <dl class="topic-metrics">
          <div class="metric">
            <dt>来源证据</dt>
            <dd class="num">{{ evidenceCount(row) }}</dd>
          </div>
          <div class="metric">
            <dt>热度</dt>
            <dd class="num">{{ row.heatScore ?? '-' }}</dd>
          </div>
          <div class="metric">
            <dt>最佳排名</dt>
            <dd class="num">{{ row.bestRank == null ? '-' : '#' + row.bestRank }}</dd>
          </div>
          <div class="metric">
            <dt>正文</dt>
            <dd :class="['num', hasBody(row) ? 'is-yes' : 'is-no']">{{ hasBody(row) ? '有' : '无' }}</dd>
          </div>
        </dl>

        <footer class="topic-card-foot">
          <span class="topic-time">{{ timeText(row.lastSeenAt) }}</span>
          <div class="topic-actions">
            <el-button link type="primary" @click="openDetail(row)">查看依据</el-button>
            <el-button
              v-hasPermi="['heron:newsCandidate:claim']"
              link
              type="primary"
              :disabled="Boolean(row.claimedAt)"
              @click="handleClaim(row)"
            >
              {{ row.claimedAt ? '已认领' : '认领' }}
            </el-button>
          </div>
        </footer>
      </article>

      <el-empty v-if="!loading && !candidates.length" class="topic-empty" description="当前没有候选选题" />
    </div>

    <pagination
      v-show="total > 0"
      v-model:page="queryParams.pageNum"
      v-model:limit="queryParams.pageSize"
      :total="total"
      @pagination="getList"
    />

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

<script setup name="HeronTopic" lang="ts">
import type { NewsCandidate, NewsCandidateForm, NewsCandidateQuery } from '@/api/heron/newsCandidate/types';
import { addNewsCandidate, claimNewsCandidate, listNewsCandidate } from '@/api/heron/newsCandidate';
import { useLoading } from '@/hooks/async/useLoading';
import { useFormDialog } from '@/hooks/dialog/useFormDialog';
import { useSearchReset } from '@/hooks/form/useSearchReset';
import { useSearchToggle } from '@/hooks/form/useSearchToggle';
import modal from '@/plugins/modal';
import { utcText } from '../../heron-time';
import { plainText } from '../../heron-text';

interface EvidenceItem {
  sourceUrl?: string;
  manual?: boolean;
}

type TabKey = 'all' | 'unclaimed' | 'claimed';

const tabs: { key: TabKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'unclaimed', label: '未认领' },
  { key: 'claimed', label: '已认领' }
];

const candidates = ref<NewsCandidate[]>([]);
const total = ref(0);
const buttonLoading = ref(false);
const activeTab = ref<TabKey>('all');
const { loading, withLoading } = useLoading(true);
const { showSearch } = useSearchToggle();

const router = useRouter();
const queryFormRef = ref<ElFormInstance>();
const candidateFormRef = ref<ElFormInstance>();

const initFormData: NewsCandidateForm = { title: '', summary: '' };
const data = reactive<PageData<NewsCandidateForm, NewsCandidateQuery>>({
  form: { ...initFormData },
  queryParams: { pageNum: 1, pageSize: 12, title: undefined, claimed: undefined },
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

const {
  dialog: formDialog,
  resetForm: reset,
  openDialog
} = useFormDialog({ form, formRef: candidateFormRef, initialFormData: initFormData });

const timeText = utcText;

/** 证据列是后端写入的 JSON 文本，解析失败只说明数据异常，不能让整个列表崩掉。 */
const evidenceItems = (row: NewsCandidate): EvidenceItem[] => {
  if (!row.evidence) return [];
  try {
    const items: unknown = (JSON.parse(row.evidence) as { items?: unknown }).items;
    return Array.isArray(items) ? (items as EvidenceItem[]) : [];
  } catch {
    return [];
  }
};

const evidenceCount = (row: NewsCandidate) => evidenceItems(row).length;

/** 「有正文」= 至少一条证据带原文链接；热榜来源不写链接，因此只能靠标题。 */
const hasBody = (row: NewsCandidate) => evidenceItems(row).some(item => Boolean(item.sourceUrl));

const getList = async () => {
  await withLoading(async () => {
    const res = await listNewsCandidate(queryParams.value);
    candidates.value = res.data?.rows || [];
    total.value = res.data?.total || 0;
  });
};

const handleQuery = () => {
  queryParams.value.pageNum = 1;
  getList();
};

const switchTab = (key: TabKey) => {
  activeTab.value = key;
  // 空串让后端按「不过滤」处理，与下拉框清空同一语义
  queryParams.value.claimed = key === 'all' ? undefined : key === 'claimed';
  handleQuery();
};

const { resetQuery } = useSearchReset({
  queryFormRef,
  queryParams,
  pageNumKey: 'pageNum',
  afterReset: () => {
    activeTab.value = 'all';
    handleQuery();
  }
});

const handleManual = () => {
  reset();
  openDialog('手工录入候选新闻');
};

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

const openDetail = (row: NewsCandidate) => {
  router.push({ path: '/heron/topic-detail', query: { candidateId: row.candidateId } });
};

/** 认领是持久操作：同用户重复点击由后端幂等返回同一作品。 */
const handleClaim = async (row: NewsCandidate) => {
  const res = await claimNewsCandidate(row.candidateId);
  modal.msgSuccess('已认领，可在视频作品里继续编辑');
  await getList();
  if (res.data?.workId) {
    router.push({ path: '/heron/work-studio', query: { workId: res.data.workId } });
  }
};

onMounted(() => {
  getList();
});
</script>

<style lang="scss" scoped>
.heron-topic-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.toolbar-panel {
  border: 1px solid var(--app-surface-border);
}

.topic-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.topic-tabs {
  display: flex;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.topic-tab {
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

.topic-tools {
  display: flex;
  align-items: center;
  gap: 8px;
}

.topic-search {
  width: 220px;
}

.topic-hint {
  margin: 12px 0 0;
  color: var(--app-text-faint);
  font-size: var(--app-font-size-xs);
  line-height: 1.7;
}

.topic-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 12px;
  min-height: 160px;
}

.topic-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  border: 1px solid var(--app-surface-border);
  border-radius: var(--app-radius-base);
  background: var(--app-surface-bg);
  transition: border-color var(--app-duration-fast) var(--app-ease);

  &:hover {
    border-color: var(--app-accent-border);
  }
}

.topic-card-head {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.topic-title {
  flex: 1;
  margin: 0;
  color: var(--app-text-title);
  font-size: var(--app-font-size-base);
  font-weight: 600;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.topic-summary {
  margin: 0;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: 1.7;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.topic-metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  margin: 0;
  padding: 0;
  border: 1px solid var(--app-surface-border);
  border-radius: 8px;
  background: var(--app-surface-border);
  overflow: hidden;
}

.metric {
  padding: 8px 10px;
  background: var(--app-surface-sunken);

  dt {
    color: var(--app-text-faint);
    font-size: var(--app-font-size-2xs);
    letter-spacing: 0.04em;
  }

  dd {
    margin: 2px 0 0;
  }
}

.num {
  color: var(--app-text-title);
  font-family: var(--app-font-mono);
  font-size: var(--app-font-size-sm);
  font-variant-numeric: tabular-nums;

  &.is-yes {
    color: var(--app-success);
  }

  &.is-no {
    color: var(--app-text-faint);
  }
}

.topic-card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: auto;
  padding-top: 10px;
  border-top: 1px solid var(--app-surface-border);
}

.topic-time {
  color: var(--app-text-faint);
  font-family: var(--app-font-mono);
  font-size: var(--app-font-size-2xs);
}

.topic-actions {
  display: flex;
  gap: 4px;
}

.topic-empty {
  grid-column: 1 / -1;
}
</style>
