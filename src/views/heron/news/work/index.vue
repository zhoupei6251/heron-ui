<template>
  <div class="p-2 app-container heron-news-work-page">
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
            <h3>新闻工作台</h3>
            <p>认领后的新闻在此编辑草稿、发起生成、逐版审片；只有人工通过的版本才能正式下载。</p>
          </div>
          <div class="toolbar-actions">
            <right-toolbar v-model:show-search="showSearch" :search="false" @query-table="getList"></right-toolbar>
          </div>
        </div>
      </template>

      <el-table v-loading="loading" border class="data-table" :data="works">
        <el-table-column label="标题" prop="title" min-width="240" show-overflow-tooltip />
        <el-table-column label="修订" width="70" align="center" prop="revision" />
        <el-table-column label="当前版本" width="110" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.currentVersion" :type="reviewTag[row.currentVersion.reviewStatus] || 'info'">
              v{{ row.currentVersion.versionNo }} ·
              {{ reviewText[row.currentVersion.reviewStatus] || row.currentVersion.reviewStatus }}
            </el-tag>
            <span v-else>未生成</span>
          </template>
        </el-table-column>
        <el-table-column label="发布" width="110" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.currentVersion?.publishSource" type="success">
              {{ publishSourceText[row.currentVersion.publishSource] || row.currentVersion.publishSource }}
            </el-tag>
            <span v-else>未发布</span>
          </template>
        </el-table-column>
        <el-table-column label="进行中任务" width="120" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.activeTask" :type="productionStatusTag[row.activeTask.status] || 'info'">
              {{ productionStatusText[row.activeTask.status] || row.activeTask.status }}
            </el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="更新时间" width="160" align="center">
          <template #default="{ row }">{{ timeText(row.updateTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120" align="center" class-name="small-padding fixed-width">
          <template #default="{ row }">
            <el-button link type="primary" icon="Tickets" @click="openWork(row as NewsWork)">进入</el-button>
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

    <el-drawer v-model="workDialog.visible" size="920px" :title="work?.title || '新闻作品'" append-to-body>
      <el-skeleton v-if="!work" :rows="6" animated />
      <template v-else>
        <el-alert
          v-for="reason in capabilityReasons"
          :key="reason"
          class="mb-2"
          type="warning"
          :closable="false"
          :title="reason"
        />

        <h4 class="section-title">草稿</h4>
        <el-form ref="draftFormRef" :model="draftForm" :rules="draftRules" label-width="88px">
          <el-form-item label="标题" prop="title">
            <el-input v-model="draftForm.title" maxlength="200" show-word-limit />
          </el-form-item>
          <el-form-item label="口播稿" prop="draft">
            <el-input v-model="draftForm.draft" type="textarea" :rows="7" maxlength="16000" show-word-limit />
          </el-form-item>
          <el-form-item label="模板" prop="templateKey">
            <el-input v-model="draftForm.templateKey" class="w-[180px]" disabled />
          </el-form-item>
          <el-form-item label="音色" prop="voiceKey">
            <el-input v-model="draftForm.voiceKey" class="w-[180px]" disabled />
          </el-form-item>
          <el-form-item>
            <div class="toolbar-actions">
              <el-button
                v-hasPermi="['heron:newsWork:edit']"
                :loading="savingDraft"
                type="primary"
                plain
                @click="handleSaveDraft"
              >
                保存草稿
              </el-button>
              <el-button
                v-hasPermi="['heron:newsWork:generate']"
                :loading="generating"
                :disabled="Boolean(work.activeTaskId)"
                type="primary"
                @click="handleGenerate"
              >
                发起生成
              </el-button>
              <span class="revision-tip">当前修订 {{ work.revision }}；冲突会被后端拒绝，不会覆盖他人改动</span>
            </div>
          </el-form-item>
        </el-form>

        <el-alert
          v-if="liveTask"
          class="mb-2"
          :type="liveTask.status === 'failed' ? 'error' : liveTask.status === 'succeeded' ? 'success' : 'info'"
          :closable="false"
          show-icon
        >
          <template #title>
            {{ productionStatusText[liveTask.status] || liveTask.status }}
            <template v-if="liveTask.stage">　阶段 {{ liveTask.stage }}</template>
            <template v-if="liveTask.progress != null">　进度 {{ liveTask.progress }}%</template>
          </template>
          <div v-if="liveTask.errorReason" class="task-reason">{{ liveTask.errorReason }}</div>
        </el-alert>

        <h4 class="section-title">版本</h4>
        <el-table
          v-loading="versionLoading"
          border
          :data="versions"
          highlight-current-row
          @current-change="selectVersion"
        >
          <el-table-column label="版本" width="70" align="center">
            <template #default="{ row }">v{{ row.versionNo }}</template>
          </el-table-column>
          <el-table-column label="任务状态" width="110" align="center">
            <template #default="{ row }">
              <el-tag :type="productionStatusTag[row.taskStatus || ''] || 'info'">
                {{ productionStatusText[row.taskStatus || ''] || row.taskStatus || '-' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="审片" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="reviewTag[row.reviewStatus] || 'info'">
                {{ reviewText[row.reviewStatus] || row.reviewStatus }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="时长" width="90" align="center">
            <template #default="{ row }">
              {{ row.durationMs ? Math.round(row.durationMs / 1000) + ' 秒' : '-' }}
            </template>
          </el-table-column>
          <el-table-column label="生成时间" min-width="160">
            <template #default="{ row }">{{ timeText(row.createTime) }}</template>
          </el-table-column>
        </el-table>
        <pagination
          v-show="versionTotal > 0"
          v-model:page="versionQuery.pageNum"
          v-model:limit="versionQuery.pageSize"
          :total="versionTotal"
          @pagination="loadVersions"
        />

        <template v-if="selected">
          <h4 class="section-title">版本 v{{ selected.versionNo }} 详情</h4>
          <el-table border :data="selected.artifacts || []">
            <el-table-column label="产物" prop="kind" width="140" />
            <el-table-column label="大小" width="100" align="center">
              <template #default="{ row }">{{ (row.bytes / 1024).toFixed(1) }} KB</template>
            </el-table-column>
            <el-table-column label="指纹" min-width="200">
              <template #default="{ row }">
                <span class="sha-text">{{ row.sha256.slice(0, 24) }}…</span>
              </template>
            </el-table-column>
            <el-table-column label="可用" width="80" align="center">
              <template #default="{ row }">
                <el-tag :type="row.available ? 'success' : 'danger'">{{ row.available ? '是' : '否' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="130" align="center">
              <template #default="{ row }">
                <el-button
                  v-if="row.kind === 'contact_sheet' || row.kind === 'mp4'"
                  v-hasPermi="['heron:newsWork:reviewPreview']"
                  link
                  type="primary"
                  @click="handlePreview(row as ProductionFile)"
                >
                  预览
                </el-button>
                <el-button
                  v-if="row.kind === 'mp4'"
                  v-hasPermi="['heron:newsWork:download']"
                  link
                  type="primary"
                  :disabled="selected.reviewStatus !== 'approved'"
                  @click="handleDownload(row as ProductionFile)"
                >
                  正式下载
                </el-button>
              </template>
            </el-table-column>
          </el-table>
          <div v-if="previewUrl" class="preview-shell">
            <img
              v-if="previewKind === 'contact_sheet'"
              :src="previewUrl"
              alt="成片九宫格核对图"
              class="contact-sheet"
            />
            <video v-else :src="previewUrl" controls class="player" />
          </div>

          <h4 class="section-title">生成门禁</h4>
          <el-table border :data="checkRows">
            <el-table-column label="门禁" prop="gate" width="160" />
            <el-table-column label="结果" width="90" align="center">
              <template #default="{ row }">
                <el-tag :type="row.passed ? 'success' : 'danger'">{{ row.passed ? '通过' : '未通过' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="说明与定位" prop="detail" min-width="300" show-overflow-tooltip />
          </el-table>
          <p v-if="selected.checks && !checkRows.length" class="revision-tip">门禁记录无法解析，请核对原始数据。</p>

          <template v-if="selected.reviewStatus === 'pending'">
            <h4 class="section-title">人工审片</h4>
            <el-form ref="reviewFormRef" :model="reviewForm" :rules="reviewRules" label-width="88px">
              <el-form-item label="决议" prop="decision">
                <el-radio-group v-model="reviewForm.decision">
                  <el-radio value="approved">通过</el-radio>
                  <el-radio value="rejected">驳回</el-radio>
                </el-radio-group>
              </el-form-item>
              <el-form-item v-if="reviewForm.decision === 'rejected'" label="驳回理由" prop="reason">
                <el-input v-model="reviewForm.reason" type="textarea" :rows="3" maxlength="1000" show-word-limit />
              </el-form-item>
              <el-form-item label="指纹">
                <el-checkbox v-model="fingerprintsConfirmed">
                  我已核对九宫格与视频指纹（{{ shortSha(contactSha) }} / {{ shortSha(videoSha) }}）
                </el-checkbox>
              </el-form-item>
              <el-form-item>
                <el-button
                  v-hasPermi="['heron:newsWork:review']"
                  :loading="reviewing"
                  :disabled="!fingerprintsConfirmed || !contactSha || !videoSha"
                  type="primary"
                  @click="handleReview"
                >
                  提交审片
                </el-button>
              </el-form-item>
            </el-form>
          </template>
          <template v-else>
            <el-descriptions class="mt-2" :column="1" border>
              <el-descriptions-item label="审片结论">
                {{ reviewText[selected.reviewStatus] || selected.reviewStatus }}
              </el-descriptions-item>
              <el-descriptions-item label="审片时间">{{ timeText(selected.reviewAt) }}</el-descriptions-item>
              <el-descriptions-item label="理由">{{ selected.reviewReason || '-' }}</el-descriptions-item>
            </el-descriptions>
          </template>

          <template v-if="selected.reviewStatus === 'approved'">
            <h4 class="section-title">人工发布回执</h4>
            <el-descriptions v-if="selected.publishSource" :column="1" border>
              <el-descriptions-item label="来源">
                <el-tag type="success">{{ publishSourceText[selected.publishSource] || selected.publishSource }}</el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="作品链接">{{ selected.publishUrl || '-' }}</el-descriptions-item>
              <el-descriptions-item label="发布账号">{{ selected.publishAccount || '-' }}</el-descriptions-item>
              <el-descriptions-item label="发布时间">{{ timeText(selected.publishAt) }}</el-descriptions-item>
              <el-descriptions-item label="成片指纹">
                <span class="sha-text">{{ selected.publishVideoSha || '-' }}</span>
              </el-descriptions-item>
            </el-descriptions>
            <el-form v-else ref="publishFormRef" :model="publishForm" :rules="publishRules" label-width="88px">
              <el-alert
                class="mb-2"
                type="info"
                :closable="false"
                show-icon
                title="先在抖音人工发布本版本成片，再回填链接、账号与发布时间；同一版本重复回填不会产生第二条记录。"
              />
              <el-form-item label="作品链接" prop="workUrl">
                <el-input v-model="publishForm.workUrl" maxlength="2048" placeholder="https://www.douyin.com/video/…" />
              </el-form-item>
              <el-form-item label="发布账号" prop="account">
                <el-input v-model="publishForm.account" maxlength="120" placeholder="发布所用的账号标识" />
              </el-form-item>
              <el-form-item label="发布时间" prop="publishedAt">
                <el-date-picker
                  v-model="publishForm.publishedAt"
                  type="datetime"
                  format="YYYY-MM-DD HH:mm:ss"
                  value-format="YYYY-MM-DD HH:mm:ss"
                  placeholder="实际发布时间"
                />
              </el-form-item>
              <el-form-item label="合规确认">
                <el-checkbox v-model="publishConfirmed">
                  我已确认成片带「内容由 AI 生成」声明与来源标注（{{ shortSha(videoSha) }}）
                </el-checkbox>
              </el-form-item>
              <el-form-item>
                <el-button
                  v-hasPermi="['heron:newsWork:publish']"
                  :loading="publishing"
                  :disabled="!publishConfirmed"
                  type="primary"
                  @click="handlePublish"
                >
                  回填发布回执
                </el-button>
              </el-form-item>
            </el-form>
          </template>
        </template>
      </template>
    </el-drawer>
  </div>
</template>

<script setup name="HeronNewsWork" lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type {
  NewsDraftForm,
  NewsPublishForm,
  NewsReviewForm,
  NewsVideoVersion,
  NewsWork,
  NewsWorkQuery
} from '@/api/heron/newsWork/types';
import type { ProductionCapabilities, ProductionFile, ProductionTask } from '@/api/heron/production/types';
import {
  fetchNewsPreview,
  generateNewsVideo,
  getNewsWork,
  listNewsVersions,
  listNewsWork,
  publishNewsVersion,
  reviewNewsVersion,
  saveNewsDraft
} from '@/api/heron/newsWork';
import { getProduction, getProductionCapabilities } from '@/api/heron/production';
import { useLoading } from '@/hooks/async/useLoading';
import { useDialogState } from '@/hooks/dialog/useDialogState';
import { useSearchReset } from '@/hooks/form/useSearchReset';
import { useSearchToggle } from '@/hooks/form/useSearchToggle';
import modal from '@/plugins/modal';
import { download } from '@/utils/request';
import { parseTime } from '@/utils/ruoyi';
import { isProductionActive, productionStatusTag, productionStatusText } from '../../production/task-state';

const reviewText: Record<string, string> = { pending: '待审片', approved: '已通过', rejected: '已驳回' };
const reviewTag: Record<string, 'info' | 'success' | 'danger'> = {
  pending: 'info',
  approved: 'success',
  rejected: 'danger'
};
// 两种来源必须分开显示：接了开放平台后历史数据才分得清
const publishSourceText: Record<string, string> = { manual: '人工已发布', api: 'API 已发布' };

const works = ref<NewsWork[]>([]);
const total = ref(0);
const { loading, withLoading } = useLoading(true);
const { showSearch } = useSearchToggle();
const queryFormRef = ref<ElFormInstance>();
const draftFormRef = ref<ElFormInstance>();
const reviewFormRef = ref<ElFormInstance>();
const publishFormRef = ref<ElFormInstance>();

const queryParams = ref<NewsWorkQuery>({ pageNum: 1, pageSize: 10, title: undefined });
const { dialog: workDialog } = useDialogState('新闻作品');

const work = ref<NewsWork>();
// 模板与音色由部署侧锁定（heron.news.production-assets），自由文本必然撞上 503 news_assets_unavailable
const LOCKED_TEMPLATE_KEY = 'news-9x16';
const LOCKED_VOICE_KEY = 'zh-CN-XiaoxiaoNeural';
const draftForm = ref<NewsDraftForm>({
  expectedRevision: 0,
  title: '',
  draft: '',
  templateKey: LOCKED_TEMPLATE_KEY,
  voiceKey: LOCKED_VOICE_KEY
});
const savingDraft = ref(false);
const generating = ref(false);
const versionLoading = ref(false);
const versions = ref<NewsVideoVersion[]>([]);
const versionTotal = ref(0);
const versionQuery = ref<PageQuery>({ pageNum: 1, pageSize: 10 });
const selected = ref<NewsVideoVersion>();
const reviewing = ref(false);
const fingerprintsConfirmed = ref(false);
const reviewForm = ref<NewsReviewForm>({ decision: 'approved', contactSha256: '', videoSha256: '', reason: '' });
const publishing = ref(false);
const publishConfirmed = ref(false);
const publishForm = ref<NewsPublishForm>({ workUrl: '', account: '', publishedAt: '', videoSha256: '' });
const previewUrl = ref('');
const previewKind = ref('');
const capabilities = ref<ProductionCapabilities>();

// shortcut: 生成受理键在打开作品时生成一次，重试复用同一个键；需要跨会话恢复时改由后端下发。
const newRequestKey = () => crypto.randomUUID?.() ?? `ui-${Date.now()}-${Math.random().toString(36).slice(2)}`;
let requestKey = newRequestKey();

const draftRules: Record<string, any> = {
  title: [
    { required: true, message: '标题不能为空', trigger: 'blur' },
    { max: 200, message: '标题不能超过 200 字', trigger: 'blur' }
  ],
  draft: [
    { required: true, message: '口播稿不能为空', trigger: 'blur' },
    { max: 16000, message: '口播稿过长', trigger: 'blur' }
  ],
  templateKey: [{ required: true, pattern: /^[a-zA-Z0-9_-]{1,80}$/, message: '模板标识不合法', trigger: 'blur' }],
  voiceKey: [{ required: true, pattern: /^[a-zA-Z0-9_-]{1,80}$/, message: '音色标识不合法', trigger: 'blur' }]
};
const reviewRules: Record<string, any> = {
  decision: [{ required: true, message: '请选择决议', trigger: 'change' }],
  reason: [{ required: true, message: '驳回必须写明理由', trigger: 'blur' }]
};
const publishRules: Record<string, any> = {
  workUrl: [
    { required: true, message: '作品链接不能为空', trigger: 'blur' },
    { pattern: /^https:\/\/([a-z0-9-]+\.)+douyin\.com\/.+$/i, message: '只接受 douyin.com 的 https 作品链接', trigger: 'blur' }
  ],
  account: [{ required: true, max: 120, message: '发布账号不能为空且不超过 120 字', trigger: 'blur' }],
  publishedAt: [{ required: true, message: '发布时间不能为空', trigger: 'change' }]
};

const contactSha = computed(() => artifact('contact_sheet')?.sha256 || '');
const videoSha = computed(() => artifact('mp4')?.sha256 || '');

const checkRows = computed(() => {
  if (!selected.value?.checks) return [];
  try {
    const parsed: unknown = JSON.parse(selected.value.checks);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item: any) => ({
      gate: String(item.gate ?? '-'),
      passed: Boolean(item.passed),
      detail: [item.reason, item.inputLocator].filter(Boolean).join(' · ')
    }));
  } catch {
    return [];
  }
});

const capabilityReasons = computed(() => {
  const news = capabilities.value?.news;
  if (!news || news.available || !news.reasons?.length) return [];
  return [`新闻生成当前不可用：${news.reasons.join('；')}`];
});

const timeText = (value?: string) => (value ? (parseTime(value, '{y}-{m}-{d} {h}:{i}:{s}') as string) : '-');
const shortSha = (value?: string) => (value ? value.slice(0, 12) + '…' : '缺产物');

function artifact(kind: string) {
  return selected.value?.artifacts?.find(file => file.kind === kind);
}

/** 查询作品列表 */
const getList = async () => {
  await withLoading(async () => {
    const res = await listNewsWork(queryParams.value);
    works.value = res.data?.rows || [];
    total.value = res.data?.total || 0;
  });
};

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

const openWork = async (row: NewsWork) => {
  releasePreview();
  stopWatch();
  liveTask.value = undefined;
  requestKey = newRequestKey();
  selected.value = undefined;
  versions.value = [];
  versionTotal.value = 0;
  versionQuery.value.pageNum = 1;
  workDialog.visible = true;
  await reloadWork(row.workId);
  await loadVersions();
  if (work.value?.activeTask) {
    void watchTask(work.value.activeTask.taskId);
  }
};

const reloadWork = async (workId: string) => {
  const res = await getNewsWork(workId);
  work.value = res.data;
  draftForm.value = {
    expectedRevision: res.data.revision,
    title: res.data.title,
    draft: res.data.draft || '',
    templateKey: LOCKED_TEMPLATE_KEY,
    voiceKey: LOCKED_VOICE_KEY
  };
};

/**
 * 生成是分钟级的真渲染，页面不能停在「已受理」。静默盯任务详情而不是重读工作台，
 * 是为了不覆盖操作员正在输入的草稿；到终态才整页刷新一次。
 */
let watchTimer: number | undefined;
const liveTask = ref<ProductionTask>();

const stopWatch = () => {
  if (watchTimer !== undefined) {
    window.clearTimeout(watchTimer);
    watchTimer = undefined;
  }
};

const watchTask = async (taskId: string) => {
  try {
    const res = await getProduction(taskId);
    liveTask.value = res.data;
    if (isProductionActive(res.data.status)) {
      // shortcut: 后台标签页会被浏览器降频到约 1 次/分钟；要秒级恢复就照 production/index.vue 补 visibilitychange。
      watchTimer = window.setTimeout(() => void watchTask(taskId), 2000);
      return;
    }
    await Promise.all([reloadWork(res.data.bizId), loadVersions()]);
  } catch {
    stopWatch();
  }
};

/** 版本列表 */
const loadVersions = async () => {
  if (!work.value) return;
  versionLoading.value = true;
  try {
    const res = await listNewsVersions(work.value.workId, versionQuery.value);
    versions.value = res.data?.rows || [];
    versionTotal.value = res.data?.total || 0;
  } finally {
    versionLoading.value = false;
  }
};

const selectVersion = (row?: NewsVideoVersion) => {
  releasePreview();
  fingerprintsConfirmed.value = false;
  reviewForm.value = { decision: 'approved', contactSha256: '', videoSha256: '', reason: '' };
  publishConfirmed.value = false;
  publishForm.value = {
    workUrl: '',
    account: '',
    publishedAt: (parseTime(new Date(), '{y}-{m}-{d} {h}:{i}:{s}') as string) || '',
    videoSha256: ''
  };
  selected.value = row;
};

const releasePreview = () => {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
    previewUrl.value = '';
  }
  previewKind.value = '';
};

/** 保存草稿：expectedRevision 由后端校验，成功后取回新的修订号 */
const handleSaveDraft = () => {
  draftFormRef.value?.validate(async (valid: boolean) => {
    if (!valid || !work.value) return;
    savingDraft.value = true;
    try {
      await saveNewsDraft(work.value.workId, draftForm.value);
      modal.msgSuccess('草稿已保存');
      await reloadWork(work.value.workId);
    } finally {
      savingDraft.value = false;
    }
  });
};

const handleGenerate = async () => {
  if (!work.value) return;
  try {
    await modal.confirm('发起生成会排队执行真实渲染，能力未放行时后端会直接拒绝。确定现在发起？');
  } catch {
    return;
  }
  generating.value = true;
  try {
    const res = await generateNewsVideo(work.value.workId, {
      requestKey,
      expectedRevision: draftForm.value.expectedRevision
    });
    modal.msgSuccess(`已受理，任务 ${res.data.taskId}`);
    requestKey = newRequestKey();
    await reloadWork(work.value.workId);
    await loadVersions();
    void watchTask(res.data.taskId);
  } finally {
    generating.value = false;
  }
};

/** 预览取回 blob：产物受登录态保护，不能用直链 */
const handlePreview = async (file: ProductionFile) => {
  if (!work.value || !selected.value) return;
  releasePreview();
  const blob = await fetchNewsPreview(work.value.workId, selected.value.versionId, file.artifactId);
  previewKind.value = file.kind;
  previewUrl.value = URL.createObjectURL(blob);
};

/** 正式下载必须带视频指纹，后端据此确认下载的就是刚审过的那一版 */
const handleDownload = (file: ProductionFile) => {
  if (!work.value || !selected.value) return;
  const video = artifact('mp4');
  if (!video) {
    modal.msgError('该版本没有视频产物');
    return;
  }
  void download(
    `/heron/newsWork/${work.value.workId}/versions/${selected.value.versionId}/download`,
    { artifactId: file.artifactId, videoSha256: video.sha256 },
    `${video.sha256.slice(0, 8)}.mp4`
  );
};

const handleReview = () => {
  reviewFormRef.value?.validate(async (valid: boolean) => {
    if (!valid || !work.value || !selected.value) return;
    reviewing.value = true;
    try {
      const res = await reviewNewsVersion(work.value.workId, selected.value.versionId, {
        ...reviewForm.value,
        contactSha256: contactSha.value,
        videoSha256: videoSha.value
      });
      modal.msgSuccess('审片结论已记录');
      // 复核后的版本对象直接回到选中态，避免再取一次才知道结论
      selectVersion(res.data);
      await loadVersions();
    } finally {
      reviewing.value = false;
    }
  });
};

const toUtcText = (value: string) => new Date(value.replace(' ', 'T')).toISOString().slice(0, 19).replace('T', ' ');

/** 发布回执绑定当前版本的 MP4 指纹；时间存 UTC 墙钟，本机直填会被判成未来时间 */
const handlePublish = () => {
  publishFormRef.value?.validate(async (valid: boolean) => {
    if (!valid || !work.value || !selected.value || !videoSha.value) return;
    publishing.value = true;
    try {
      const res = await publishNewsVersion(work.value.workId, selected.value.versionId, {
        ...publishForm.value,
        publishedAt: toUtcText(publishForm.value.publishedAt),
        videoSha256: videoSha.value
      });
      modal.msgSuccess('发布回执已记录');
      selectVersion(res.data);
      await Promise.all([loadVersions(), reloadWork(work.value.workId)]);
    } finally {
      publishing.value = false;
    }
  });
};

const loadCapabilities = async () => {
  try {
    const res = await getProductionCapabilities();
    capabilities.value = res.data;
  } catch {
    // 能力信息失败不阻塞工作台，请求层已提示
  }
};

onBeforeUnmount(() => {
  stopWatch();
  releasePreview();
});
onMounted(() => {
  void loadCapabilities();
  getList();
});
</script>

<style scoped>
.section-title {
  margin: 18px 0 8px;
}
.revision-tip {
  margin-left: 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.sha-text {
  font-family: var(--el-font-family-monospace, monospace);
}
.task-reason {
  margin-top: 4px;
  white-space: pre-wrap;
  word-break: break-all;
}
.preview-shell {
  margin-top: 12px;
}
.contact-sheet {
  width: 100%;
  border: 1px solid var(--el-border-color);
}
.player {
  width: 100%;
  max-height: 420px;
  background: #000;
}
</style>
