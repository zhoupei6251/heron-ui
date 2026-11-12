<template>
  <div class="p-2 app-container heron-work-studio-page">
    <el-card shadow="hover" class="studio-panel">
      <div class="studio-bar">
        <el-button link icon="ArrowLeft" @click="goBack">返回视频作品</el-button>
        <div class="studio-bar-meta">
          <el-tag v-if="work?.currentVersion" :type="reviewTag[work.currentVersion.reviewStatus] || 'info'" size="small">
            v{{ work.currentVersion.versionNo }} ·
            {{ reviewText[work.currentVersion.reviewStatus] || work.currentVersion.reviewStatus }}
          </el-tag>
          <span class="revision-badge">修订 {{ work?.revision ?? '-' }}</span>
        </div>
      </div>

      <el-skeleton v-if="loading" :rows="8" animated />

      <el-empty v-else-if="!work" description="这个作品不存在，或你没有访问权限" />

      <template v-else>
        <h1 class="studio-title">{{ work.title }}</h1>

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
              <span class="revision-tip">冲突会被后端拒绝，不会覆盖他人改动</span>
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
          <el-button
            v-if="isProductionActive(liveTask.status)"
            v-hasPermi="['heron:production:cancel']"
            link
            type="warning"
            @click="handleCancelTask"
          >
            取消这次生成
          </el-button>
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
              <el-tag :type="productionStatusTag[row.taskStatus || ''] || 'info'" :title="row.taskErrorReason || ''">
                {{ productionStatusText[row.taskStatus || ''] || row.taskStatus || '-' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="审片" width="100" align="center">
            <template #default="{ row }">
              <span v-if="row.taskStatus !== 'succeeded'">-</span>
              <el-tag v-else :type="reviewTag[row.reviewStatus] || 'info'">
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

          <template v-if="selected.taskStatus === 'succeeded' && selected.reviewStatus === 'pending'">
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
                  {{ reviewForm.decision === 'approved' ? '确认并发布' : '提交驳回' }}
                </el-button>
                <span v-if="reviewForm.decision === 'approved'" class="review-hint">
                  通过后由系统立即发布并写入回执，不需要再去抖音手动上传
                </span>
              </el-form-item>
            </el-form>
          </template>
          <el-alert
            v-else-if="selected.reviewStatus === 'pending'"
            class="mt-2"
            type="error"
            :closable="false"
            show-icon
            :title="`这一版没有可审的成片（任务状态 ${productionStatusText[selected.taskStatus || ''] || selected.taskStatus || '-'}${selected.taskErrorCode ? '，' + selected.taskErrorCode : ''}）`"
            :description="selected.taskErrorReason || '失败原因未记录，可到生产任务页查该任务的阶段与用量。'"
          />
          <template v-else>
            <el-descriptions class="mt-2" :column="1" border>
              <el-descriptions-item label="审片结论">
                {{ reviewText[selected.reviewStatus] || selected.reviewStatus }}
              </el-descriptions-item>
              <el-descriptions-item label="审片时间">{{ timeText(selected.reviewAt) }}</el-descriptions-item>
              <el-descriptions-item label="理由">{{ selected.reviewReason || '-' }}</el-descriptions-item>
            </el-descriptions>
          </template>

          <template v-if="selected.publishSource">
            <h4 class="section-title">发布回执</h4>
            <el-alert
              v-if="selected.publishSource === 'sandbox'"
              class="mb-2"
              type="warning"
              :closable="false"
              show-icon
              title="沙箱发布：仅验证链路，未上抖音"
              description="开放平台凭据到位前，回执由沙箱适配器生成；作品链接为 sandbox:// 前缀，平台侧看不到这条内容。"
            />
            <el-alert
              v-else-if="selected.publishSource === 'douyin-cli' && !selected.publishUrl"
              class="mb-2"
              type="info"
              :closable="false"
              show-icon
              title="已提交，待补链接"
              description="命令行已在抖音后台提交发布，但命令不回传作品链接；从抖音后台复制一次链接补进来即可。"
            />
            <el-descriptions :column="1" border>
              <el-descriptions-item label="来源">
                <el-tag :type="selected.publishSource === 'sandbox' ? 'warning' : 'success'">
                  {{ publishSourceText[selected.publishSource] || selected.publishSource }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="作品链接">
                <a v-if="selected.publishUrl" :href="selected.publishUrl" target="_blank" rel="noopener noreferrer">
                  {{ selected.publishUrl }}
                </a>
                <div v-else-if="selected.publishSource === 'douyin-cli'" class="publish-url-fix">
                  <el-input v-model="publishUrlInput" placeholder="粘贴抖音作品链接" clearable />
                  <el-button :loading="publishUrlSaving" :disabled="!publishUrlInput.trim()" @click="savePublishUrl">
                    补链接
                  </el-button>
                </div>
                <span v-else>-</span>
              </el-descriptions-item>
              <el-descriptions-item label="发布账号">{{ selected.publishAccount || '-' }}</el-descriptions-item>
              <el-descriptions-item label="发布时间">{{ timeText(selected.publishAt) }}</el-descriptions-item>
              <el-descriptions-item label="成片指纹">
                <span class="sha-text">{{ selected.publishVideoSha || '-' }}</span>
              </el-descriptions-item>
            </el-descriptions>

            <h4 class="section-title">发布表现</h4>
            <div class="metric-grid">
              <el-input-number v-model="metricForm.plays" :min="0" :controls="false" placeholder="播放量" />
              <el-input-number v-model="metricForm.completion" :min="0" :max="100" :controls="false" placeholder="完播率 %" />
              <el-input-number v-model="metricForm.likes" :min="0" :controls="false" placeholder="点赞" />
              <el-button :loading="metricSaving" @click="saveMetric">记录表现</el-button>
            </div>
            <p v-if="latestMetric" class="form-tip">
              最近一次：播放 {{ latestMetric.plays ?? '-' }} · 完播 {{ metricPercent(latestMetric.completionRate) }} ·
              {{ timeText(latestMetric.fetchedAt) }}
            </p>
            <p v-else class="form-tip">还没有表现数据；填一次后，选题器会参考它判断同类选题。</p>
          </template>
          <el-alert
            v-else-if="selected.reviewStatus === 'approved'"
            class="mt-2"
            type="warning"
            :closable="false"
            show-icon
            title="这一版已通过审片但没有发布回执"
            description="旧数据或发布失败留下的状态；可在生产任务页确认后重新确认发布。"
          />
        </template>
      </template>
    </el-card>
  </div>
</template>

<script setup name="HeronNewsWorkStudio" lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { NewsDraftForm, NewsReviewForm, NewsVideoVersion, NewsWork } from '@/api/heron/newsWork/types';
import type { ProductionCapabilities, ProductionFile, ProductionTask } from '@/api/heron/production/types';
import {
  fetchNewsPreview,
  generateNewsVideo,
  getNewsWork,
  listNewsVersions,
  confirmNewsVersion,
  backfillNewsPublishUrl,
  saveNewsDraft
} from '@/api/heron/newsWork';
import { getProduction, getProductionCapabilities, cancelProduction } from '@/api/heron/production';
import { listNewsMetrics, saveNewsMetric } from '@/api/heron/metrics';
import type { NewsMetric } from '@/api/heron/metrics';
import modal from '@/plugins/modal';
import { download } from '@/utils/request';
import { utcText } from '../../heron-time';
import { isProductionActive, productionStatusTag, productionStatusText } from '../../production/task-state';

const reviewText: Record<string, string> = { pending: '待审片', approved: '已通过', rejected: '已驳回' };
const reviewTag: Record<string, 'info' | 'success' | 'danger'> = {
  pending: 'info',
  approved: 'success',
  rejected: 'danger'
};
// 两种来源必须分开显示：接了开放平台后历史数据才分得清
const publishSourceText: Record<string, string> = {
  manual: '人工已发布',
  api: 'API 已发布',
  'douyin-cli': '命令行已提交',
  sandbox: '沙箱发布（未上抖音）'
};

const route = useRoute();
const router = useRouter();

const loading = ref(true);
const draftFormRef = ref<ElFormInstance>();
const reviewFormRef = ref<ElFormInstance>();

const work = ref<NewsWork>();
// 模板与音色由模板目录的 LOCK.json 锁定；服务端在认领时已经选定，这两个常量只在服务端没给值时兜底
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
// 发布表现：平台后台的数字由人录进来，选题器读最近几条做参考
const metricForm = ref<{ plays?: number; completion?: number; likes?: number }>({});
const latestMetric = ref<NewsMetric>();
const metricSaving = ref(false);

const metricPercent = (rate?: number) => (rate === null || rate === undefined ? '-' : `${Math.round(rate * 100)}%`);

const loadMetrics = async (versionId?: string) => {
  latestMetric.value = undefined;
  if (!versionId) return;
  try {
    const res = await listNewsMetrics(versionId);
    latestMetric.value = res.data?.[0];
  } catch {
    // 读不到表现不影响审片，静默留空
  }
};

const saveMetric = async () => {
  if (!selected.value) return;
  metricSaving.value = true;
  try {
    await saveNewsMetric({
      versionId: selected.value.versionId,
      platform: 'douyin',
      plays: metricForm.value.plays,
      completionRate: metricForm.value.completion === undefined ? undefined : metricForm.value.completion / 100,
      likes: metricForm.value.likes
    });
    modal.msgSuccess('表现已记录');
    await loadMetrics(selected.value.versionId);
  } finally {
    metricSaving.value = false;
  }
};
// 命令行发布不回传链接：人从抖音后台复制一次补进来，不伪造也不阻塞发布
const publishUrlInput = ref('');
const publishUrlSaving = ref(false);

const savePublishUrl = async () => {
  const url = publishUrlInput.value.trim();
  if (!work.value || !selected.value || !url) return;
  publishUrlSaving.value = true;
  try {
    const res = await backfillNewsPublishUrl(work.value.workId, selected.value.versionId, url);
    modal.msgSuccess('作品链接已补上');
    publishUrlInput.value = '';
    selectVersion(res.data);
    await Promise.all([loadVersions(), reloadWork(work.value.workId)]);
  } finally {
    publishUrlSaving.value = false;
  }
};

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

const timeText = utcText;
const shortSha = (value?: string) => (value ? value.slice(0, 12) + '…' : '缺产物');

function artifact(kind: string) {
  return selected.value?.artifacts?.find(file => file.kind === kind);
}

const goBack = () => {
  router.push('/heron/work');
};

const reloadWork = async (workId: string) => {
  const res = await getNewsWork(workId);
  work.value = res.data;
  draftForm.value = {
    expectedRevision: res.data.revision,
    title: res.data.title,
    draft: res.data.draft || '',
    templateKey: res.data.templateKey || LOCKED_TEMPLATE_KEY,
    voiceKey: res.data.voiceKey || LOCKED_VOICE_KEY
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
  selected.value = row;
  void loadMetrics(row?.versionId);
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

/** 就地取消：执行中的任务先进入取消中，进程确认停止后才算已取消；轮询会自己把结局带回来。 */
const handleCancelTask = async () => {
  if (!liveTask.value) return;
  try {
    await modal.confirm('确定取消这次生成？执行中的渲染会先收到停止信号，确认进程退出后才显示已取消。');
  } catch {
    return;
  }
  await cancelProduction(liveTask.value.taskId);
  modal.msgSuccess('已提交取消');
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
      const res = await confirmNewsVersion(work.value.workId, selected.value.versionId, {
        ...reviewForm.value,
        contactSha256: contactSha.value,
        videoSha256: videoSha.value
      });
      modal.msgSuccess(reviewForm.value.decision === 'approved' ? '已确认，发布回执已写入' : '驳回已记录');
      // 复核后的版本对象直接回到选中态，避免再取一次才知道结论
      selectVersion(res.data);
      await Promise.all([loadVersions(), reloadWork(work.value.workId)]);
    } finally {
      reviewing.value = false;
    }
  });
};

const loadCapabilities = async () => {
  try {
    const res = await getProductionCapabilities();
    capabilities.value = res.data;
  } catch {
    // 能力信息失败不阻塞工作室，请求层已提示
  }
};

/** 路由参数是这一页的唯一入口：详情页和列表页都带 workId 进来 */
const load = async () => {
  stopWatch();
  releasePreview();
  liveTask.value = undefined;
  requestKey = newRequestKey();
  selected.value = undefined;
  versions.value = [];
  versionTotal.value = 0;
  versionQuery.value.pageNum = 1;
  const workId = String(route.query.workId || '');
  if (!workId) {
    work.value = undefined;
    loading.value = false;
    return;
  }
  loading.value = true;
  try {
    await reloadWork(workId);
    await loadVersions();
    if (work.value?.activeTask) {
      void watchTask(work.value.activeTask.taskId);
    }
  } catch {
    work.value = undefined;
  } finally {
    loading.value = false;
  }
};

onBeforeUnmount(() => {
  stopWatch();
  releasePreview();
});
onMounted(() => {
  void loadCapabilities();
  void load();
});
watch(() => route.query.workId, load);
</script>

<style scoped>
.studio-panel {
  border: 1px solid var(--app-surface-border);
  max-width: 1200px;
}
.studio-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--app-surface-border);
}
.studio-bar-meta {
  display: flex;
  align-items: center;
  gap: 10px;
}
.revision-badge {
  color: var(--app-text-faint);
  font-family: var(--app-font-mono);
  font-size: var(--app-font-size-2xs);
  font-variant-numeric: tabular-nums;
}
.studio-title {
  margin: 18px 0 4px;
  color: var(--app-text-title);
  font-size: var(--app-font-size-xl);
  font-weight: 600;
  line-height: 1.4;
}
.section-title {
  margin: 22px 0 8px;
  color: var(--app-text-title);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
  letter-spacing: 0.02em;
}
.revision-tip {
  margin-left: 8px;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-2xs);
}
.review-hint {
  margin-left: 12px;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}
.metric-grid {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;

  .el-input-number {
    width: 130px;
  }
}
.publish-url-fix {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 560px;
}
.sha-text {
  font-family: var(--app-font-mono);
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
  border: 1px solid var(--app-surface-border);
}
.player {
  width: 100%;
  max-height: 420px;
  background: #000;
}
</style>
