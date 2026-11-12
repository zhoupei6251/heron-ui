<template>
  <div class="p-2 app-container heron-review-page">
    <el-card shadow="hover" class="toolbar-panel">
      <div class="review-toolbar">
        <div class="table-heading">
          <h3>待审片</h3>
          <p>跨作品的待审版本。渲染失败的版本也会列出并标出状态——把它藏起来会让「生成了却没得审」变成看不见的问题。</p>
        </div>
        <right-toolbar v-model:show-search="showSearch" :search="false" @query-table="getList"></right-toolbar>
      </div>
    </el-card>

    <div class="review-split">
      <el-card shadow="hover" class="queue-panel">
        <el-table
          v-loading="loading"
          border
          :data="queue"
          highlight-current-row
          class="data-table"
          @current-change="selectVersion"
        >
          <el-table-column label="作品" prop="workTitle" min-width="200" show-overflow-tooltip>
            <template #default="{ row }">{{ row.workTitle || '作品 ' + row.workId }}</template>
          </el-table-column>
          <el-table-column label="版本" width="70" align="center">
            <template #default="{ row }">v{{ row.versionNo }}</template>
          </el-table-column>
          <el-table-column label="时长" width="90" align="center">
            <template #default="{ row }">
              {{ row.durationMs ? Math.round(row.durationMs / 1000) + ' 秒' : '-' }}
            </template>
          </el-table-column>
          <el-table-column label="渲染" width="110" align="center">
            <template #default="{ row }">
              <el-tag :type="productionStatusTag[row.taskStatus || ''] || 'info'">
                {{ productionStatusText[row.taskStatus || ''] || row.taskStatus || '-' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="生成时间" width="160" align="center">
            <template #default="{ row }">{{ timeText(row.createTime) }}</template>
          </el-table-column>
        </el-table>
        <pagination
          v-show="total > 0"
          v-model:page="page.pageNum"
          v-model:limit="page.pageSize"
          :total="total"
          @pagination="getList"
        />
      </el-card>

      <el-card shadow="hover" class="review-panel">
        <template v-if="selected">
          <header class="panel-head">
            <div>
              <span class="eyebrow">Review · v{{ selected.versionNo }}</span>
              <h2>{{ selected.workTitle || '作品 ' + selected.workId }}</h2>
            </div>
            <el-tag :type="productionStatusTag[selected.taskStatus || ''] || 'info'" effect="plain">
              {{ productionStatusText[selected.taskStatus || ''] || selected.taskStatus || '-' }}
            </el-tag>
          </header>

          <template v-if="selected.taskStatus === 'succeeded'">
            <div class="preview-bar">
              <el-button link type="primary" @click="openStudio">在工作室打开</el-button>
            </div>
            <div class="preview-grid">
              <section v-for="kind in previewKinds" :key="kind" class="preview-cell">
                <header class="preview-cell-head">{{ previewLabels[kind] }}</header>
                <div v-loading="previews[kind].loading" class="preview-stage">
                  <img
                    v-if="previews[kind].url && kind === 'contact_sheet'"
                    :src="previews[kind].url"
                    alt="成片九宫格核对图"
                    class="contact-sheet"
                  />
                  <video v-else-if="previews[kind].url" :src="previews[kind].url" controls class="player" />
                  <p v-else-if="previews[kind].error" class="preview-fallback">{{ previews[kind].error }}</p>
                  <p v-else class="preview-fallback">这一版没有可显示的{{ previewLabels[kind] }}</p>
                </div>
              </section>
            </div>

            <el-form class="review-form" label-width="88px">
              <el-form-item label="决议">
                <el-radio-group v-model="form.decision">
                  <el-radio value="approved">通过</el-radio>
                  <el-radio value="rejected">驳回</el-radio>
                </el-radio-group>
              </el-form-item>
              <el-form-item v-if="form.decision === 'rejected'" label="驳回理由" required>
                <el-input v-model="form.reason" type="textarea" :rows="3" maxlength="1000" show-word-limit />
              </el-form-item>
              <el-form-item label="指纹">
                <el-checkbox v-model="fingerprintsConfirmed">
                  我已核对九宫格与视频指纹（{{ shortSha(contactSha) }} / {{ shortSha(videoSha) }}）
                </el-checkbox>
              </el-form-item>
              <el-form-item>
                <el-button
                  :loading="submitting"
                  :disabled="!canSubmit"
                  type="primary"
                  @click="submitReview"
                >
                  {{ form.decision === 'approved' ? '确认并发布' : '提交驳回' }}
                </el-button>
                <span v-if="form.decision === 'approved'" class="submit-hint">
                  通过后由发布适配器立即发布并写入回执
                </span>
              </el-form-item>
            </el-form>
          </template>

          <el-alert
            v-else
            class="mt-2"
            type="error"
            :closable="false"
            show-icon
            :title="`这一版没有可审的成片（${selected.taskErrorCode || '未记录错误码'}）`"
            :description="selected.taskErrorReason || '到生产任务页查该任务的阶段与用量。'"
          />
        </template>
        <el-empty v-else description="从左边选一个版本开始审片" />
      </el-card>
    </div>
  </div>
</template>

<script setup name="HeronReview" lang="ts">
import type { NewsReviewForm, NewsVideoVersion } from '@/api/heron/newsWork/types';
import { confirmNewsVersion, fetchNewsPreview, listReviewQueue } from '@/api/heron/newsWork';
import { useLoading } from '@/hooks/async/useLoading';
import { useSearchToggle } from '@/hooks/form/useSearchToggle';
import modal from '@/plugins/modal';
import { utcText } from '../heron-time';
import { productionStatusTag, productionStatusText } from '../production/task-state';

const queue = ref<NewsVideoVersion[]>([]);
const total = ref(0);
const selected = ref<NewsVideoVersion>();
const page = ref<PageQuery>({ pageNum: 1, pageSize: 10 });
const { loading, withLoading } = useLoading(true);
const { showSearch } = useSearchToggle();

type PreviewKind = 'contact_sheet' | 'mp4';
const previewKinds: PreviewKind[] = ['contact_sheet', 'mp4'];
const previewLabels: Record<PreviewKind, string> = { contact_sheet: '九宫格', mp4: '成片' };
const previews = reactive<Record<PreviewKind, { url: string; loading: boolean; error: string }>>({
  contact_sheet: { url: '', loading: false, error: '' },
  mp4: { url: '', loading: false, error: '' }
});
const submitting = ref(false);
const fingerprintsConfirmed = ref(false);
const form = ref<NewsReviewForm>({ decision: 'approved', contactSha256: '', videoSha256: '', reason: '' });

const timeText = utcText;

const artifact = (kind: string) => selected.value?.artifacts?.find(file => file.kind === kind);
const contactSha = computed(() => artifact('contact_sheet')?.sha256 || '');
const videoSha = computed(() => artifact('mp4')?.sha256 || '');
const shortSha = (value?: string) => (value ? value.slice(0, 12) + '…' : '缺产物');

const canSubmit = computed(
  () =>
    Boolean(selected.value) &&
    fingerprintsConfirmed.value &&
    Boolean(contactSha.value) &&
    Boolean(videoSha.value) &&
    (form.value.decision === 'approved' || Boolean(form.value.reason?.trim()))
);

const getList = async () => {
  await withLoading(async () => {
    const res = await listReviewQueue(page.value);
    queue.value = res.data?.rows || [];
    total.value = res.data?.total || 0;
    if (selected.value && !queue.value.some(row => row.versionId === selected.value?.versionId)) {
      selectVersion(undefined);
    }
  });
};

const selectVersion = (row?: NewsVideoVersion) => {
  releasePreview();
  fingerprintsConfirmed.value = false;
  form.value = { decision: 'approved', contactSha256: '', videoSha256: '', reason: '' };
  selected.value = row;
  if (row?.taskStatus === 'succeeded') {
    previewKinds.forEach(loadPreview);
  }
};

/** 两个 blob 都要 revoke，否则翻几十条就会漏内存。ticket 让切版本后到达的旧 blob 直接丢弃。 */
let previewTicket = 0;
const releasePreview = () => {
  previewTicket += 1;
  previewKinds.forEach(kind => {
    if (previews[kind].url) {
      URL.revokeObjectURL(previews[kind].url);
      previews[kind].url = '';
    }
    previews[kind].loading = false;
    previews[kind].error = '';
  });
};

/** 产物受登录态保护，不能用直链；blob 用完必须 revoke。 */
const loadPreview = async (kind: PreviewKind) => {
  const cell = previews[kind];
  if (!selected.value || !artifact(kind)) {
    cell.error = '';
    return;
  }
  const ticket = previewTicket;
  const { workId, versionId } = selected.value;
  const file = artifact(kind)!;
  cell.loading = true;
  cell.error = '';
  try {
    const blob = await fetchNewsPreview(workId, versionId, file.artifactId);
    if (ticket !== previewTicket) return;
    if (cell.url) URL.revokeObjectURL(cell.url);
    cell.url = URL.createObjectURL(blob);
  } catch {
    if (ticket === previewTicket) cell.error = `${previewLabels[kind]}加载失败，可再选一次该版本重试`;
  } finally {
    if (ticket === previewTicket) cell.loading = false;
  }
};

const submitReview = async () => {
  if (!selected.value) return;
  submitting.value = true;
  try {
    await confirmNewsVersion(selected.value.workId, selected.value.versionId, {
      ...form.value,
      contactSha256: contactSha.value,
      videoSha256: videoSha.value
    });
    modal.msgSuccess(form.value.decision === 'approved' ? '已确认，发布回执已写入' : '驳回已记录');
    selectVersion(undefined);
    await getList();
  } finally {
    submitting.value = false;
  }
};

const openStudio = () => {
  if (!selected.value) return;
  window.open(`#/heron/work-studio?workId=${selected.value.workId}`, '_blank');
};

onBeforeUnmount(releasePreview);
onMounted(getList);
</script>

<style lang="scss" scoped>
.heron-review-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.toolbar-panel,
.queue-panel,
.review-panel {
  border: 1px solid var(--app-surface-border);
}

.review-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.table-heading h3 {
  margin: 0 0 4px;
  color: var(--app-text-title);
  font-size: var(--app-font-size-lg);
  font-weight: 600;
}

.table-heading p {
  margin: 0;
  max-width: 720px;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: 1.7;
}

.review-split {
  display: grid;
  grid-template-columns: minmax(420px, 1fr) minmax(380px, 520px);
  gap: 12px;
  align-items: start;
}

.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--app-surface-border);

  h2 {
    margin: 6px 0 0;
    color: var(--app-text-title);
    font-size: var(--app-font-size-lg);
    font-weight: 600;
    line-height: 1.4;
  }
}

.eyebrow {
  color: var(--app-text-faint);
  font-family: var(--app-font-mono);
  font-size: var(--app-font-size-2xs);
  letter-spacing: var(--app-tracking-eyebrow);
  text-transform: uppercase;
}

.preview-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 14px 0 0;
}

.preview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 10px;
}

.preview-cell-head {
  margin-bottom: 6px;
  color: var(--app-text-faint);
  font-family: var(--app-font-mono);
  font-size: var(--app-font-size-2xs);
  letter-spacing: var(--app-tracking-eyebrow);
  text-transform: uppercase;
}

.preview-stage {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 120px;
  background: var(--app-surface-sunken);
  border: 1px solid var(--app-surface-border);
}

.preview-fallback {
  margin: 0;
  padding: 12px;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: 1.7;
  text-align: center;
}

.contact-sheet {
  width: 100%;
}

.player {
  width: 100%;
  max-height: 320px;
  background: #000;
}

.review-form {
  margin-top: 16px;
}

.submit-hint {
  margin-left: 12px;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

@media (max-width: 1180px) {
  .review-split {
    grid-template-columns: 1fr;
  }

  .preview-grid {
    grid-template-columns: 1fr;
  }
}
</style>
