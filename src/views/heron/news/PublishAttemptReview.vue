<template>
  <section v-if="attempt || canSubmitReviewedVersion(version)" class="publish-review">
    <div class="publish-heading">
      <h3>07 发布核对</h3>
      <div class="publish-actions">
        <el-tag :type="publicationTag[state]" effect="plain">{{ publicationText[state] }}</el-tag>
        <el-button link size="small" :loading="refreshing" :disabled="busy" @click="refreshStatus">刷新状态</el-button>
      </div>
    </div>
    <template v-if="attempt">
      <el-descriptions :column="1" border size="small">
        <el-descriptions-item label="目标账号">{{ attempt.account || '未记录，请核对发布配置' }}</el-descriptions-item>
        <el-descriptions-item label="尝试登记时间">{{ utcText(attempt.startedAt) }}</el-descriptions-item>
        <el-descriptions-item label="成片指纹"><span class="fingerprint">{{ attempt.videoSha }}</span></el-descriptions-item>
      </el-descriptions>
      <p v-if="attempt.status === 'started'" class="publish-hint">
        上传尝试已登记。若长时间停留，请检查上传是否仍在运行，并核对目标账号的平台结果。
      </p>
      <p v-else-if="attempt.status === 'unknown' || attempt.status === 'submitted'" class="publish-hint">
        平台发布结果尚未确认，系统不会重复上传。请先到目标账号核对这条视频。
      </p>
      <p v-if="attempt.resolutionReason" class="publish-hint">
        核对记录：{{ attempt.resolutionReason }} · {{ utcText(attempt.resolvedAt) }}
      </p>
    </template>

    <el-form v-if="isUnresolvedAttempt(attempt)" v-hasPermi="['heron:newsWork:publish']"
      :model="form" label-position="top" size="small" class="resolution-form" @submit.prevent="submitResolution">
      <el-form-item label="平台核对结果" required>
        <el-radio-group v-model="form.decision" :disabled="busy">
          <el-radio value="published">确认已发布</el-radio>
          <el-radio value="not_published">确认未发出</el-radio>
        </el-radio-group>
      </el-form-item>
      <template v-if="form.decision === 'published'">
        <el-form-item label="平台作品链接" required>
          <el-input v-model="form.workUrl" :disabled="busy" placeholder="https://www.douyin.com/video/..." maxlength="2048" />
        </el-form-item>
        <el-form-item label="平台账号" required>
          <el-input v-model="form.account" :disabled="busy || !!attempt?.account" maxlength="120" />
        </el-form-item>
        <el-form-item label="实际发布时间（本地时间）" required>
          <el-date-picker v-model="form.publishedEpoch" type="datetime" value-format="x" :disabled="busy"
            placeholder="按平台显示的实际时间填写" class="w-full" />
        </el-form-item>
      </template>
      <el-form-item v-else required>
        <el-checkbox v-model="form.uploadStopped" :disabled="busy">
          我已确认上传停止，且目标账号的平台上确实没有这条作品
        </el-checkbox>
        <p class="publish-hint">上传仍在运行时不能解除保护；刚登记的尝试需等上传结束或超时后再核对。</p>
      </el-form-item>
      <el-form-item label="核对理由" required>
        <el-input v-model="form.reason" type="textarea" :rows="3" maxlength="1000" show-word-limit :disabled="busy"
          placeholder="说明核对了哪个账号、哪条视频以及结果" />
      </el-form-item>
      <el-alert v-if="errorMessage" :title="errorMessage" type="error" :closable="false" show-icon class="mb-2" />
      <el-button type="primary" :loading="busy" :disabled="resolutionIncomplete" @click="submitResolution">保存核对结果</el-button>
    </el-form>

    <div v-if="canSubmitReviewedVersion(version)" v-hasPermi="['heron:newsWork:publish']" class="retry-box">
      <p class="publish-hint">提交当前已通过审片的版本，沿用已核对的成片与九宫格指纹。</p>
      <el-button :loading="busy" type="primary" plain @click="submitReviewed">
        {{ attempt?.status === 'not_published' ? '重新提交本版' : '提交本版' }}
      </el-button>
      <el-alert v-if="errorMessage" :title="errorMessage" type="error" :closable="false" show-icon class="mt-2" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type { NewsVideoVersion } from '@/api/heron/newsWork/types';
import { confirmNewsVersion, getNewsVersion, resolveNewsPublishAttempt } from '@/api/heron/newsWork';
import modal from '@/plugins/modal';
import { utcText } from '../heron-time';
import { canSubmitReviewedVersion, confirmationMessage, isUnresolvedAttempt, publicationState, publicationTag,
  publicationText, resolutionPayload } from './publish-state';
import type { PublishResolutionForm } from './publish-state';

const props = defineProps<{ version: NewsVideoVersion }>();
const emit = defineEmits<{ updated: [version: NewsVideoVersion] }>();
const attempt = computed(() => props.version.publishAttempt);
const state = computed(() => publicationState(props.version));
const busy = ref(false);
const refreshing = ref(false);
const errorMessage = ref('');
const freshForm = (): PublishResolutionForm => ({ decision: 'published', reason: '', uploadStopped: false,
  workUrl: '', account: attempt.value?.account || '', publishedEpoch: '' });
const form = ref(freshForm());
let mounted = true;
onBeforeUnmount(() => { mounted = false; });
watch([() => props.version.id, () => attempt.value?.id, () => attempt.value?.status], () => {
  form.value = freshForm();
  errorMessage.value = '';
});

const resolutionIncomplete = computed(() => !form.value.reason.trim() || (form.value.decision === 'not_published'
  ? !form.value.uploadStopped : !form.value.workUrl.trim() || !form.value.account.trim() || !form.value.publishedEpoch));

const refreshStatus = async () => {
  if (busy.value || refreshing.value) return;
  const version = props.version;
  refreshing.value = true;
  try {
    const result = await getNewsVersion(version.workId, version.id);
    if (mounted) emit('updated', result.data);
  } catch {
    errorMessage.value = '暂时读不到最新状态，请稍后刷新；不会自动重试上传。';
  } finally { refreshing.value = false; }
};

const refreshAfterFailure = async (version: NewsVideoVersion) => {
  try {
    const result = await getNewsVersion(version.workId, version.id);
    if (mounted) emit('updated', result.data);
  } catch {
    errorMessage.value += ' 暂时读不到最新状态，请刷新后核对；不会自动重试上传。';
  }
};

const submitResolution = async () => {
  const version = props.version;
  const current = attempt.value;
  if (busy.value || !current) return;
  errorMessage.value = '';
  let payload;
  try { payload = resolutionPayload(current, form.value); }
  catch (error) { errorMessage.value = error instanceof Error ? error.message : '核对信息不完整'; return; }
  busy.value = true;
  try {
    const result = await resolveNewsPublishAttempt(version.workId, version.id, current.id, payload);
    if (!mounted) return;
    modal.msgSuccess(payload.decision === 'published' ? '已记录核对后的发布回执' : '已记录未发出，可以重新提交本版');
    emit('updated', result.data);
  } catch {
    errorMessage.value = '核对结果未保存，请确认最新状态后再处理。';
    await refreshAfterFailure(version);
  } finally { busy.value = false; }
};

const submitReviewed = async () => {
  const version = props.version;
  if (busy.value || !canSubmitReviewedVersion(version)) return;
  busy.value = true;
  errorMessage.value = '';
  try {
    const result = await confirmNewsVersion(version.workId, version.id, { decision: 'approved',
      contactSha256: version.reviewContactSha!, videoSha256: version.reviewVideoSha! });
    if (!mounted) return;
    modal.msgSuccess(confirmationMessage(result.data));
    emit('updated', result.data);
  } catch {
    errorMessage.value = '提交结果尚未确认，请先核对状态；不会自动重试上传。';
    await refreshAfterFailure(version);
  } finally { busy.value = false; }
};
</script>

<style scoped lang="scss">
.publish-review {
  padding: 14px 16px;
  border: 1px solid var(--app-surface-border);
  border-radius: var(--app-radius-base);
  background: var(--app-surface-bg);
}
.publish-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
  h3 { margin: 0; font-size: var(--app-font-size-sm); color: var(--app-text-title); }
}
.publish-hint { margin: 10px 0; line-height: 1.7; font-size: var(--app-font-size-xs); color: var(--app-text-muted); }
.publish-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.fingerprint { overflow-wrap: anywhere; font-family: var(--app-font-mono); font-size: var(--app-font-size-2xs); }
.resolution-form { margin-top: 16px; }
.resolution-form :deep(.el-checkbox) { height: auto; white-space: normal; align-items: flex-start; }
.resolution-form :deep(.el-checkbox__label) { white-space: normal; line-height: 1.6; }
.retry-box { margin-top: 12px; }
</style>
