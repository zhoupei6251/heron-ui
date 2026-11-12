<template>
  <div class="p-2 app-container heron-work-studio-page">
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

      <div class="studio-grid">
        <!-- 左栏：内容结构 -->
        <aside class="studio-col studio-col--left">
          <section class="col-block">
            <h3 class="block-title">01 选题资料</h3>
            <dl class="kv">
              <dt>候选</dt>
              <dd class="mono">{{ work.candidateId }}</dd>
              <dt>模板</dt>
              <dd class="mono">{{ draftForm.templateKey }}</dd>
              <dt>音色</dt>
              <dd class="mono">{{ draftForm.voiceKey }}</dd>
            </dl>
          </section>

          <section class="col-block">
            <h3 class="block-title">02 标题与口播稿</h3>
            <el-form ref="draftFormRef" :model="draftForm" :rules="draftRules" label-position="top" size="small">
              <el-form-item label="标题" prop="title">
                <el-input v-model="draftForm.title" maxlength="200" show-word-limit />
              </el-form-item>
              <el-form-item label="口播稿" prop="draft">
                <el-input v-model="draftForm.draft" type="textarea" :rows="10" maxlength="16000" show-word-limit />
              </el-form-item>
              <div class="row-actions">
                <el-button
                  v-hasPermi="['heron:newsWork:edit']"
                  :loading="savingDraft"
                  type="primary"
                  plain
                  size="small"
                  @click="handleSaveDraft"
                >
                  保存草稿
                </el-button>
                <span class="revision-tip">冲突会被后端拒绝</span>
              </div>
            </el-form>
          </section>

          <section class="col-block">
            <h3 class="block-title">03 版本历史</h3>
            <ul v-loading="versionLoading" class="version-list">
              <li
                v-for="row in versions"
                :key="row.versionId"
                :class="['version-item', { 'is-active': selected?.versionId === row.versionId }]"
                @click="selectVersion(row)"
              >
                <span class="version-no">v{{ row.versionNo }}</span>
                <span class="version-meta">
                  <el-tag :type="productionStatusTag[row.taskStatus || ''] || 'info'" size="small" effect="plain">
                    {{ productionStatusText[row.taskStatus || ''] || row.taskStatus || '-' }}
                  </el-tag>
                  <el-tag v-if="row.taskStatus === 'succeeded'" :type="reviewTag[row.reviewStatus] || 'info'"
                    size="small" effect="plain">
                    {{ reviewText[row.reviewStatus] || row.reviewStatus }}
                  </el-tag>
                </span>
                <span class="version-time">{{ timeText(row.createTime) }}</span>
              </li>
            </ul>
            <pagination
              v-show="versionTotal > 0"
              v-model:page="versionQuery.pageNum"
              v-model:limit="versionQuery.pageSize"
              :total="versionTotal"
              small
              layout="prev, pager, next"
              @pagination="loadVersions"
            />
          </section>
        </aside>

        <!-- 中栏：预览与编辑 -->
        <main class="studio-col studio-col--center">
          <section class="col-block">
            <h3 class="block-title">
              04 画面预览
              <span v-if="selected" class="block-hint">v{{ selected.versionNo }}</span>
            </h3>
            <template v-if="selected">
              <div class="preview-bar">
                <el-button size="small" :loading="previewLoading" @click="loadPreview('contact_sheet')">
                  九宫格
                </el-button>
                <el-button size="small" :loading="previewLoading" @click="loadPreview('mp4')">成片</el-button>
                <el-button size="small" link type="primary" @click="handleDownload(artifact('mp4')!)"
                  :disabled="selected.reviewStatus !== 'approved'">
                  正式下载
                </el-button>
              </div>
              <div v-if="previewUrl" class="preview-shell">
                <img v-if="previewKind === 'contact_sheet'" :src="previewUrl" alt="成片九宫格核对图" class="contact-sheet" />
                <video v-else :src="previewUrl" controls class="player" />
              </div>
              <p v-else class="muted">点上面的按钮加载预览。产物受登录态保护，不能直接拖进播放器。</p>
            </template>
            <p v-else class="muted">先在左边选一个版本。</p>
          </section>

          <section class="col-block">
            <h3 class="block-title">05 生成门禁</h3>
            <el-table v-if="selected" :data="checkRows" size="small" border>
              <el-table-column label="门禁" prop="gate" width="140" />
              <el-table-column label="结果" width="86" align="center">
                <template #default="{ row }">
                  <el-tag :type="row.passed ? 'success' : 'danger'" size="small">{{ row.passed ? '通过' : '未通过' }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="说明与定位" prop="detail" min-width="240" show-overflow-tooltip />
            </el-table>
            <p v-else class="muted">未选版本。</p>
            <p v-if="selected?.checks && !checkRows.length" class="muted">门禁记录无法解析。</p>
          </section>

          <section v-if="selected?.taskStatus === 'succeeded'" class="col-block">
            <h3 class="block-title">06 人工审片</h3>
            <template v-if="selected.reviewStatus === 'pending'">
              <el-form ref="reviewFormRef" :model="reviewForm" :rules="reviewRules" label-width="88px" size="small">
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
                    通过后由系统立即发布并写入回执
                  </span>
                </el-form-item>
              </el-form>
            </template>
            <el-descriptions v-else :column="1" border size="small">
              <el-descriptions-item label="审片结论">
                {{ reviewText[selected.reviewStatus] || selected.reviewStatus }}
              </el-descriptions-item>
              <el-descriptions-item label="审片时间">{{ timeText(selected.reviewAt) }}</el-descriptions-item>
              <el-descriptions-item label="理由">{{ selected.reviewReason || '-' }}</el-descriptions-item>
            </el-descriptions>
          </section>
          <el-alert
            v-else-if="selected?.reviewStatus === 'pending'"
            class="mb-2"
            type="error"
            :closable="false"
            show-icon
            :title="`这一版没有可审的成片（${productionStatusText[selected.taskStatus || ''] || selected.taskStatus || '-'}${selected.taskErrorCode ? '，' + selected.taskErrorCode : ''}）`"
            :description="selected.taskErrorReason || '失败原因未记录，可到生产任务页查该任务的阶段与用量。'"
          />

          <section v-if="selected?.publishSource" class="col-block">
            <h3 class="block-title">07 发布回执</h3>
            <el-alert
              v-if="selected.publishSource === 'sandbox'"
              class="mb-2"
              type="warning"
              :closable="false"
              show-icon
              title="沙箱发布：仅验证链路，未上抖音"
            />
            <el-alert
              v-else-if="selected.publishSource === 'douyin-cli' && !selected.publishUrl"
              class="mb-2"
              type="info"
              :closable="false"
              show-icon
              title="已提交，待补链接"
            />
            <el-descriptions :column="1" border size="small">
              <el-descriptions-item label="来源">
                <el-tag :type="selected.publishSource === 'sandbox' ? 'warning' : 'success'" size="small">
                  {{ publishSourceText[selected.publishSource] || selected.publishSource }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="作品链接">
                <a v-if="selected.publishUrl" :href="selected.publishUrl" target="_blank" rel="noopener noreferrer">
                  {{ selected.publishUrl }}
                </a>
                <div v-else-if="selected.publishSource === 'douyin-cli'" class="publish-url-fix">
                  <el-input v-model="publishUrlInput" placeholder="粘贴抖音作品链接" clearable size="small" />
                  <el-button :loading="publishUrlSaving" :disabled="!publishUrlInput.trim()" size="small"
                    @click="savePublishUrl">
                    补链接
                  </el-button>
                </div>
                <span v-else>-</span>
              </el-descriptions-item>
              <el-descriptions-item label="发布账号">{{ selected.publishAccount || '-' }}</el-descriptions-item>
              <el-descriptions-item label="发布时间">{{ timeText(selected.publishAt) }}</el-descriptions-item>
            </el-descriptions>
          </section>

          <section v-if="selected?.publishSource" class="col-block">
            <h3 class="block-title">08 发布表现</h3>
            <div class="metric-grid">
              <el-input-number v-model="metricForm.plays" :min="0" :controls="false" placeholder="播放量" size="small" />
              <el-input-number v-model="metricForm.completion" :min="0" :max="100" :controls="false"
                placeholder="完播率 %" size="small" />
              <el-input-number v-model="metricForm.likes" :min="0" :controls="false" placeholder="点赞" size="small" />
              <el-button :loading="metricSaving" size="small" @click="saveMetric">记录表现</el-button>
            </div>
            <p v-if="latestMetric" class="muted">
              最近一次：播放 {{ latestMetric.plays ?? '-' }} · 完播 {{ metricPercent(latestMetric.completionRate) }} ·
              {{ timeText(latestMetric.fetchedAt) }}
            </p>
            <p v-else class="muted">还没有表现数据。</p>
          </section>
        </main>

        <!-- 右栏：创作设置 -->
        <aside class="studio-col studio-col--right">
          <section class="col-block">
            <h3 class="block-title">创作设置</h3>
            <el-form label-position="top" size="small">
              <el-form-item label="模板">
                <el-select v-model="draftForm.templateKey" class="w-full" placeholder="选择版式">
                  <el-option
                    v-for="item in templates"
                    :key="item.key"
                    :label="`${item.name}（${item.key}）`"
                    :value="item.key"
                    :disabled="!item.locked"
                  >
                    <span>{{ item.name }}</span>
                    <span class="option-hint">{{ item.key }}</span>
                  </el-option>
                </el-select>
                <p class="form-tip">
                  换模板只影响下一次生成；已产出的版本保留当时冻结的模板与资产指纹。
                </p>
              </el-form-item>

              <el-form-item label="音色">
                <el-input :model-value="draftForm.voiceKey" disabled />
                <p class="form-tip">音色由模板的资产锁固定，换音色要改模板并重新生成 LOCK。</p>
              </el-form-item>

              <el-form-item v-if="selectedTemplate" label="当前模板能力">
                <div class="capability">
                  <div class="cap-row">
                    <span class="cap-label">画幅</span>
                    <span class="cap-value mono">{{ selectedTemplate.aspectRatio || '-' }}</span>
                  </div>
                  <div class="cap-row">
                    <span class="cap-label">推荐时长</span>
                    <span class="cap-value mono">
                      {{ selectedTemplate.minDuration ?? '-' }}–{{ selectedTemplate.maxDuration ?? '-' }} 秒
                    </span>
                  </div>
                  <div class="cap-row">
                    <span class="cap-label">支持场景</span>
                    <span class="cap-value">
                      <el-tag
                        v-for="scene in selectedTemplate.supportedSceneTypes || []"
                        :key="scene"
                        size="small"
                        effect="plain"
                        :type="scene === 'image' ? 'success' : 'info'"
                      >
                        {{ scene }}
                      </el-tag>
                      <span v-if="!(selectedTemplate.supportedSceneTypes || []).length" class="muted">未声明</span>
                    </span>
                  </div>
                </div>
              </el-form-item>
            </el-form>
          </section>

          <section class="col-block">
            <h3 class="block-title">质量检查</h3>
            <ul class="check-list">
              <li v-for="row in checkRows" :key="row.gate" :class="['check-row', row.passed ? 'is-pass' : 'is-fail']">
                <span class="check-dot" />
                <span class="check-gate">{{ row.gate }}</span>
              </li>
              <li v-if="!checkRows.length" class="muted">未选版本或没有门禁记录。</li>
            </ul>
          </section>

          <section class="col-block">
            <h3 class="block-title">生成</h3>
            <el-button
              v-hasPermi="['heron:newsWork:generate']"
              :loading="generating"
              :disabled="Boolean(work.activeTaskId)"
              type="primary"
              class="w-full"
              @click="handleGenerate"
            >
              发起生成
            </el-button>
            <p class="form-tip">{{ work.activeTaskId ? '已有在途任务，等它结束再发起。' : '会排队执行真实渲染。' }}</p>
          </section>
        </aside>
      </div>
    </template>
  </div>
</template>

<script setup name="HeronNewsWorkStudio" lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { NewsDraftForm, NewsReviewForm, NewsVideoVersion, NewsWork } from '@/api/heron/newsWork/types';
import type { ProductionCapabilities, ProductionFile, ProductionTask } from '@/api/heron/production/types';
import type { VideoTemplate } from '@/api/heron/template/types';
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
import { listVideoTemplate } from '@/api/heron/template';
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
const templates = ref<VideoTemplate[]>([]);
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
const versionQuery = ref<PageQuery>({ pageNum: 1, pageSize: 20 });
const selected = ref<NewsVideoVersion>();
const reviewing = ref(false);
const fingerprintsConfirmed = ref(false);
const reviewForm = ref<NewsReviewForm>({ decision: 'approved', contactSha256: '', videoSha256: '', reason: '' });
const metricForm = ref<{ plays?: number; completion?: number; likes?: number }>({});
const latestMetric = ref<NewsMetric>();
const metricSaving = ref(false);

/** 右栏展示当前选中模板的能力：用户在选模板时就该看到它装不装得下这条内容。 */
const selectedTemplate = computed(() =>
  templates.value.find(item => item.key === draftForm.value.templateKey)
);

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
const previewLoading = ref(false);
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
  // 换了模板就得先把草稿存下去，否则这次生成用的还是服务端记录的旧模板
  if (draftForm.value.templateKey !== work.value.templateKey) {
    await handleSaveDraft();
    if (draftForm.value.templateKey !== work.value?.templateKey) return;
  }
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

const handlePreview = async (file: ProductionFile) => {
  if (!work.value || !selected.value) return;
  releasePreview();
  const blob = await fetchNewsPreview(work.value.workId, selected.value.versionId, file.artifactId);
  previewKind.value = file.kind;
  previewUrl.value = URL.createObjectURL(blob);
};

const loadPreview = async (kind: string) => {
  const file = artifact(kind);
  if (!file) {
    modal.msgError(kind === 'mp4' ? '这一版没有视频产物' : '这一版没有九宫格产物');
    return;
  }
  previewLoading.value = true;
  try {
    await handlePreview(file);
  } finally {
    previewLoading.value = false;
  }
};

const handleDownload = (file?: ProductionFile) => {
  if (!work.value || !selected.value) return;
  const video = file ?? artifact('mp4');
  if (!video) {
    modal.msgError('该版本没有视频产物');
    return;
  }
  void download(
    `/heron/newsWork/${work.value.workId}/versions/${selected.value.versionId}/download`,
    { artifactId: video.artifactId, videoSha256: video.sha256 },
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

const loadTemplates = async () => {
  try {
    const res = await listVideoTemplate();
    templates.value = res.data || [];
  } catch {
    // 模板目录读不到时右栏退化成只读文本框，不影响已有流程
  }
};

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
  void loadTemplates();
  void load();
});
watch(() => route.query.workId, load);
</script>

<style lang="scss" scoped>
.heron-work-studio-page {
  max-width: 1560px;
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
  margin: 16px 0 8px;
  color: var(--app-text-title);
  font-size: var(--app-font-size-xl);
  font-weight: 600;
  line-height: 1.4;
}

/* 三栏：左结构 / 中预览 / 右设置。中间给最多空间，因为它放视频。 */
.studio-grid {
  display: grid;
  grid-template-columns: minmax(260px, 1fr) minmax(420px, 1.7fr) minmax(240px, 0.9fr);
  gap: 12px;
  align-items: start;
}

.studio-col {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.col-block {
  padding: 14px 16px;
  border: 1px solid var(--app-surface-border);
  border-radius: var(--app-radius-base);
  background: var(--app-surface-bg);
}

.block-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0 0 10px;
  color: var(--app-text-title);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
  letter-spacing: 0.02em;
}

.block-hint {
  color: var(--app-text-faint);
  font-family: var(--app-font-mono);
  font-size: var(--app-font-size-2xs);
  font-weight: 400;
}

.kv {
  display: grid;
  grid-template-columns: 64px 1fr;
  gap: 6px 10px;
  margin: 0;
  font-size: var(--app-font-size-xs);

  dt {
    color: var(--app-text-faint);
  }

  dd {
    margin: 0;
    color: var(--app-text-body);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.mono {
  font-family: var(--app-font-mono);
  font-size: var(--app-font-size-2xs);
}

.row-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.revision-tip {
  color: var(--app-text-faint);
  font-size: var(--app-font-size-2xs);
}

.version-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 1px;
  max-height: 320px;
  overflow: auto;
}

.version-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color var(--app-duration-fast) var(--app-ease);

  &:hover {
    background: var(--app-accent-softer);
  }

  &.is-active {
    border-color: var(--app-accent-border);
    background: var(--app-accent-soft);
  }
}

.version-no {
  color: var(--app-text-title);
  font-family: var(--app-font-mono);
  font-size: var(--app-font-size-xs);
  font-weight: 600;
}

.version-meta {
  display: flex;
  gap: 4px;
}

.version-time {
  color: var(--app-text-faint);
  font-family: var(--app-font-mono);
  font-size: var(--app-font-size-2xs);
}

.preview-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.preview-shell {
  margin-top: 4px;
}

.contact-sheet {
  width: 100%;
  border: 1px solid var(--app-surface-border);
  border-radius: 8px;
}

.player {
  width: 100%;
  max-height: 480px;
  background: #000;
  border-radius: 8px;
}

.muted {
  margin: 0;
  color: var(--app-text-faint);
  font-size: var(--app-font-size-xs);
  line-height: 1.7;
}

.form-tip {
  margin: 4px 0 0;
  color: var(--app-text-faint);
  font-size: var(--app-font-size-2xs);
  line-height: 1.6;
}

.option-hint {
  float: right;
  color: var(--app-text-faint);
  font-family: var(--app-font-mono);
  font-size: var(--app-font-size-2xs);
}

.capability {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.cap-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  font-size: var(--app-font-size-xs);
}

.cap-label {
  color: var(--app-text-faint);
  flex-shrink: 0;
}

.cap-value {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: flex-end;
  color: var(--app-text-body);
}

.check-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.check-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--app-font-size-xs);
}

.check-dot {
  width: 6px;
  height: 6px;
  flex-shrink: 0;
  border-radius: 50%;
}

.is-pass .check-dot {
  background: var(--app-success);
}

.is-fail .check-dot {
  background: var(--app-danger);
}

.is-pass .check-gate {
  color: var(--app-text-muted);
}

.is-fail .check-gate {
  color: var(--app-danger);
  font-weight: 600;
}

.task-reason {
  margin-top: 4px;
  white-space: pre-wrap;
  word-break: break-all;
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
    width: 120px;
  }
}

.publish-url-fix {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 520px;
}

@media (max-width: 1180px) {
  .studio-grid {
    grid-template-columns: 1fr;
  }
}
</style>
