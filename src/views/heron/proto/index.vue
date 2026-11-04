<template>
  <div class="p-2 app-container heron-proto-page">
    <div class="search-wrap">
      <el-card shadow="hover" class="search-panel" :class="{ 'is-collapsed': !showSearch }">
        <template #header>
          <div class="panel-heading search-panel-toggle" @click.stop="showSearch = !showSearch">
            <div><h3>筛选条件</h3></div>
          </div>
        </template>
        <el-form ref="queryFormRef" :model="queryParams" :inline="true" class="query-form">
          <el-form-item label="项目名称" prop="name">
            <el-input
              v-model="queryParams.name"
              placeholder="请输入项目名称关键字"
              clearable
              @keyup.enter="handleQuery"
            />
          </el-form-item>
          <el-form-item label="归档状态" prop="archived">
            <el-select v-model="queryParams.archived" class="w-[180px]">
              <el-option label="未归档" value="0" />
              <el-option label="已归档" value="1" />
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
            <h3>原型项目</h3>
            <p>需求写成中文描述后由固定流水线生成 RP/1 与原生 .rp；产物需人工审核并声明原生验证后才可交付。</p>
          </div>
          <div class="toolbar-actions">
            <el-button v-hasPermi="['heron:proto:add']" type="primary" plain icon="Plus" @click="handleAdd">
              新建项目
            </el-button>
            <right-toolbar v-model:show-search="showSearch" :search="false" @query-table="getList"></right-toolbar>
          </div>
        </div>
      </template>

      <el-table v-loading="loading" border class="data-table" :data="projects">
        <el-table-column label="项目名称" prop="name" min-width="180" show-overflow-tooltip />
        <el-table-column label="画布" width="90" align="center">
          <template #default="{ row }">{{ row.canvas === 'web' ? '网页' : '移动端' }}</template>
        </el-table-column>
        <el-table-column label="草稿修订" prop="revision" width="90" align="center" />
        <el-table-column label="下一版本" prop="nextVersion" width="90" align="center" />
        <el-table-column label="在途任务" width="100" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.activeTaskId" type="warning">执行中</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.archived === '1' ? 'info' : 'success'">
              {{ row.archived === '1' ? '已归档' : '在制' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="更新时间" width="160" align="center">
          <template #default="{ row }">{{ timeText(row.updateTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="150" align="center" class-name="small-padding fixed-width">
          <template #default="{ row }">
            <el-button link type="primary" icon="Tickets" @click="openProject(row as ProtoProject)">进入</el-button>
            <el-button
              v-hasPermi="['heron:proto:edit']"
              v-if="row.archived === '0'"
              link
              type="warning"
              icon="Box"
              @click="handleArchive(row as ProtoProject)"
            >
              归档
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

    <el-dialog v-model="dialog.visible" :title="dialog.title" width="640px" append-to-body>
      <el-form ref="projectFormRef" :model="form" :rules="projectRules" label-width="96px">
        <el-form-item label="项目名称" prop="name">
          <el-input v-model="form.name" maxlength="100" show-word-limit placeholder="例如：订单中心原型" />
        </el-form-item>
        <el-form-item label="画布" prop="canvas">
          <el-radio-group v-model="form.canvas">
            <el-radio value="web">网页</el-radio>
            <el-radio value="mobile">移动端</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="需求" prop="requirement">
          <el-input v-model="form.requirement" type="textarea" :rows="6" maxlength="8000" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="cancel">取 消</el-button>
          <el-button type="primary" :loading="buttonLoading" @click="submitForm">确 定</el-button>
        </div>
      </template>
    </el-dialog>

    <el-drawer v-model="workDialog.visible" size="960px" :title="project?.name || '原型项目'" append-to-body>
      <el-skeleton v-if="!project" :rows="6" animated />
      <template v-else>
        <el-alert
          v-for="reason in capabilityReasons"
          :key="reason"
          class="mb-2"
          type="warning"
          :closable="false"
          :title="reason"
        />

        <h4 class="section-title">需求草稿</h4>
        <el-form ref="draftFormRef" :model="draftForm" :rules="projectRules" label-width="96px">
          <el-form-item label="项目名称" prop="name">
            <el-input v-model="draftForm.name" maxlength="100" show-word-limit :disabled="isArchived" />
          </el-form-item>
          <el-form-item label="画布" prop="canvas">
            <el-radio-group v-model="draftForm.canvas" :disabled="isArchived">
              <el-radio value="web">网页</el-radio>
              <el-radio value="mobile">移动端</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="需求" prop="requirement">
            <el-input
              v-model="draftForm.requirement"
              type="textarea"
              :rows="6"
              maxlength="8000"
              show-word-limit
              :disabled="isArchived"
            />
          </el-form-item>
          <el-form-item label="主题">
            <el-input v-model="draftForm.themeKey" disabled />
            <span class="form-tip">主题尚未通过支持基准，只能使用 default。</span>
          </el-form-item>
          <el-form-item v-if="!isArchived">
            <el-button v-hasPermi="['heron:proto:edit']" type="primary" :loading="savingDraft" @click="handleSaveDraft">
              保存草稿
            </el-button>
            <el-button
              v-hasPermi="['heron:proto:generate']"
              type="success"
              plain
              :loading="generating"
              :disabled="Boolean(project.activeTaskId)"
              @click="handleGenerate"
            >
              发起生成
            </el-button>
            <span class="revision-tip">
              当前修订 {{ draftForm.expectedRevision }}，保存后才会 +1；生成必须落在已保存的修订上。
            </span>
          </el-form-item>
          <el-alert
            v-else
            class="mb-2"
            type="info"
            :closable="false"
            title="项目已归档，草稿不可再编辑，历史版本仍可审核与下载。"
          />
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

        <h4 class="section-title">历史版本</h4>
        <el-table
          v-loading="versionLoading"
          border
          class="data-table"
          :data="versions"
          highlight-current-row
          @current-change="selectVersion"
        >
          <el-table-column label="版本" prop="versionNo" width="70" align="center" />
          <el-table-column label="任务状态" width="110" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.status" :type="productionStatusTag[row.status]">
                {{ productionStatusText[row.status] }}
              </el-tag>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="审核" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="reviewTag[row.reviewStatus]">
                {{ reviewText[row.reviewStatus] || row.reviewStatus }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="交付" width="110" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.delivery" :type="row.delivery.nativeVerifiedAtDelivery ? 'success' : 'warning'">
                {{ row.delivery.nativeVerifiedAtDelivery ? '已交付(已验证)' : '已交付(未验证)' }}
              </el-tag>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="引擎提交" width="120" align="center">
            <template #default="{ row }">{{ shortValue(row.engineCommit) }}</template>
          </el-table-column>
          <el-table-column label="生成时间" width="160" align="center">
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
          <h4 class="section-title">版本 {{ selected.versionNo }} 产物</h4>
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="冻结修订">{{ selected.input?.revision ?? '-' }}</el-descriptions-item>
            <el-descriptions-item label="任务 ID">{{ selected.taskId || '-' }}</el-descriptions-item>
            <el-descriptions-item label="支持控件">
              <el-tag v-for="widget in selected.input?.supportedWidgets || []" :key="widget" class="widget-tag">
                {{ widget }}
              </el-tag>
              <span v-if="!selected.input?.supportedWidgets?.length">-</span>
            </el-descriptions-item>
            <el-descriptions-item label="模板数">
              {{ Object.keys(selected.input?.templateManifest || {}).length }}
            </el-descriptions-item>
          </el-descriptions>

          <el-table border class="data-table artifact-table" :data="selected.artifacts || []">
            <el-table-column label="类型" prop="kind" width="150" />
            <el-table-column label="大小" width="110" align="right">
              <template #default="{ row }">{{ sizeText(row.bytes) }}</template>
            </el-table-column>
            <el-table-column label="SHA256" min-width="160">
              <template #default="{ row }">
                <span class="sha-text">{{ shortValue(row.sha256, 16) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="220" align="center">
              <template #default="{ row }">
                <el-button
                  v-if="row.kind === 'page_preview' || row.kind === 'preview_summary'"
                  v-hasPermi="['heron:proto:reviewPreview']"
                  link
                  type="primary"
                  @click="handlePreview(row as ProductionFile)"
                >
                  预览
                </el-button>
                <el-button
                  v-if="reviewKinds.includes(row.kind)"
                  v-hasPermi="['heron:proto:reviewPreview']"
                  link
                  type="primary"
                  @click="handleReviewDownload(row as ProductionFile)"
                >
                  审核下载
                </el-button>
                <el-button
                  v-if="row.kind === 'native_rp'"
                  v-hasPermi="['heron:proto:download']"
                  link
                  type="primary"
                  :disabled="!canFormalDownload"
                  @click="handleDownload(row as ProductionFile)"
                >
                  正式下载
                </el-button>
              </template>
            </el-table-column>
          </el-table>
          <div v-if="previewUrl" class="preview-shell">
            <img :src="previewUrl" alt="原型页面预览图" class="page-preview" />
          </div>

          <h4 class="section-title">流水线校验</h4>
          <el-descriptions :column="3" border size="small">
            <el-descriptions-item label="结构">{{ boolText(selected.audit?.structuralOk) }}</el-descriptions-item>
            <el-descriptions-item label="原生格式">
              {{ boolText(selected.audit?.nativeFormatChecked) }}
            </el-descriptions-item>
            <el-descriptions-item label="页面数">{{ selected.audit?.pages?.length ?? '-' }}</el-descriptions-item>
            <el-descriptions-item label="配色">{{ boolText(selected.audit?.audit?.colorPassed) }}</el-descriptions-item>
            <el-descriptions-item label="字体">{{ boolText(selected.audit?.audit?.fontPassed) }}</el-descriptions-item>
            <el-descriptions-item label="语义命名">
              {{ boolText(selected.audit?.audit?.semanticNamePassed) }}
            </el-descriptions-item>
            <el-descriptions-item label="分组">
              {{ boolText(selected.audit?.audit?.groupingPassed) }}
            </el-descriptions-item>
            <el-descriptions-item label="RP/1 指纹">
              <span class="sha-text">{{ shortValue(selected.audit?.sourceRp1Sha256, 16) }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="引擎提交">{{ shortValue(selected.audit?.engineCommit) }}</el-descriptions-item>
          </el-descriptions>

          <h4 class="section-title">人工审核</h4>
          <el-form
            v-if="selected.reviewStatus === 'pending'"
            ref="reviewFormRef"
            :model="reviewForm"
            label-width="96px"
          >
            <el-form-item label="决议">
              <el-radio-group v-model="reviewForm.decision">
                <el-radio value="approved">通过</el-radio>
                <el-radio value="rejected">驳回</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item v-if="reviewForm.decision === 'rejected'" label="驳回理由">
              <el-input v-model="reviewForm.reason" type="textarea" :rows="3" maxlength="1000" show-word-limit />
            </el-form-item>
            <el-form-item>
              <el-checkbox v-model="fingerprintsConfirmed">
                我已核对下载的原生文件 {{ shortValue(rpSha) }} 与预览汇总 {{ shortValue(previewSha) }}，与下方指纹一致。
              </el-checkbox>
            </el-form-item>
            <el-form-item>
              <el-button
                v-hasPermi="['heron:proto:review']"
                type="primary"
                :loading="reviewing"
                :disabled="!fingerprintsConfirmed || !rpSha || !previewSha"
                @click="handleReview"
              >
                提交审核
              </el-button>
              <span v-if="!rpSha || !previewSha" class="form-tip">该版本还缺原生文件或预览汇总，无法审核。</span>
            </el-form-item>
          </el-form>
          <el-descriptions v-else :column="2" border size="small">
            <el-descriptions-item label="决议">{{ reviewText[selected.reviewStatus] }}</el-descriptions-item>
            <el-descriptions-item label="审核人">{{ selected.reviewBy ?? '-' }}</el-descriptions-item>
            <el-descriptions-item label="审核时间">{{ timeText(selected.reviewAt) }}</el-descriptions-item>
            <el-descriptions-item label="理由">{{ selected.reviewReason || '-' }}</el-descriptions-item>
            <el-descriptions-item label="审核指纹(原生)">
              <span class="sha-text">{{ shortValue(selected.reviewRpSha, 16) }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="审核指纹(预览)">
              <span class="sha-text">{{ shortValue(selected.reviewPreviewSha, 16) }}</span>
            </el-descriptions-item>
          </el-descriptions>

          <h4 class="section-title">原生验证声明</h4>
          <p class="form-tip">
            请在 Axure 中真实执行以下动作后再逐项勾选；通过与否由服务端比对部署配置的目标 Axure
            版本，未配置时一律记为未通过。
          </p>
          <el-form :model="verificationForm" label-width="96px">
            <el-form-item label="目标版本">
              <el-input
                v-model="verificationForm.targetVersion"
                maxlength="160"
                :readonly="Boolean(targetAxure)"
                :placeholder="targetAxure || '例如：Axure RP 9'"
                class="w-[260px]"
              />
            </el-form-item>
            <el-form-item label="验证动作">
              <el-checkbox v-model="verificationForm.opened">已打开</el-checkbox>
              <el-checkbox v-model="verificationForm.edited">已编辑</el-checkbox>
              <el-checkbox v-model="verificationForm.saved">已保存</el-checkbox>
              <el-checkbox v-model="verificationForm.reopened">已重开</el-checkbox>
              <el-checkbox v-model="verificationForm.navigationChecked">已验证页面跳转</el-checkbox>
            </el-form-item>
            <el-form-item label="备注">
              <el-input v-model="verificationForm.note" type="textarea" :rows="2" maxlength="8000" show-word-limit />
            </el-form-item>
            <el-form-item>
              <el-button
                v-hasPermi="['heron:proto:verify']"
                type="primary"
                plain
                :loading="verifying"
                :disabled="!rpSha || !verificationForm.targetVersion"
                @click="handleVerify"
              >
                记录验证
              </el-button>
              <span class="form-tip">记录的是人工声明，不会自动改写成引擎验证结论。</span>
            </el-form-item>
          </el-form>
          <el-table
            v-if="selected.nativeVerifications?.length"
            border
            class="data-table"
            :data="selected.nativeVerifications"
          >
            <el-table-column label="结论" width="90" align="center">
              <template #default="{ row }">
                <el-tag :type="row.passed ? 'success' : 'info'">{{ row.passed ? '通过' : '未通过' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="目标版本" prop="targetVersion" min-width="140" show-overflow-tooltip />
            <el-table-column label="文件指纹" min-width="150">
              <template #default="{ row }">
                <span class="sha-text">{{ shortValue(row.rpSha256, 16) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="验证时间" width="160" align="center">
              <template #default="{ row }">{{ timeText(row.verifiedAt) }}</template>
            </el-table-column>
            <el-table-column label="备注" prop="note" min-width="160" show-overflow-tooltip />
          </el-table>

          <h4 class="section-title">交付</h4>
          <div v-if="!selected.delivery" class="deliver-row">
            <el-button
              v-hasPermi="['heron:proto:deliver']"
              type="warning"
              :loading="delivering"
              :disabled="!canDeliver"
              @click="handleDeliver"
            >
              确认为交付
            </el-button>
            <span class="form-tip">{{ deliverHint }}</span>
          </div>
          <el-descriptions v-else :column="2" border size="small">
            <el-descriptions-item label="交付人">{{ selected.delivery.actorId }}</el-descriptions-item>
            <el-descriptions-item label="交付时间">{{ timeText(selected.delivery.deliveredAt) }}</el-descriptions-item>
            <el-descriptions-item label="交付时原生验证">
              {{ selected.delivery.nativeVerifiedAtDelivery ? '是' : '否' }}
            </el-descriptions-item>
            <el-descriptions-item label="验证记录">
              {{ selected.delivery.verificationId ? shortValue(selected.delivery.verificationId, 8) : '无' }}
            </el-descriptions-item>
            <el-descriptions-item label="交付指纹(原生)">
              <span class="sha-text">{{ shortValue(selected.delivery.rpSha256, 16) }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="交付指纹(预览)">
              <span class="sha-text">{{ shortValue(selected.delivery.previewSha256, 16) }}</span>
            </el-descriptions-item>
          </el-descriptions>
        </template>
      </template>
    </el-drawer>
  </div>
</template>

<script setup name="HeronProto" lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, toRefs } from 'vue';
import type { ProductionCapabilities, ProductionFile, ProductionTask } from '@/api/heron/production/types';
import type {
  ProtoProject,
  ProtoProjectForm,
  ProtoProjectQuery,
  ProtoReviewForm,
  ProtoVerificationForm,
  ProtoVersion
} from '@/api/heron/proto/types';
import { getProduction, getProductionCapabilities } from '@/api/heron/production';
import {
  addProtoProject,
  archiveProtoProject,
  deliverProtoVersion,
  fetchProtoPreview,
  generateProto,
  getProtoProject,
  getProtoVersion,
  listProtoProject,
  listProtoVersions,
  reviewProtoVersion,
  updateProtoProject,
  verifyProtoVersion
} from '@/api/heron/proto';
import { useLoading } from '@/hooks/async/useLoading';
import { useDialogState } from '@/hooks/dialog/useDialogState';
import { useFormDialog } from '@/hooks/dialog/useFormDialog';
import { useSearchReset } from '@/hooks/form/useSearchReset';
import { useSearchToggle } from '@/hooks/form/useSearchToggle';
import modal from '@/plugins/modal';
import { download } from '@/utils/request';
import { parseTime } from '@/utils/ruoyi';
import { isProductionActive, productionStatusTag, productionStatusText } from '../production/task-state';

const reviewText: Record<string, string> = { pending: '待审核', approved: '已通过', rejected: '已驳回' };
const reviewTag: Record<string, 'info' | 'success' | 'danger'> = {
  pending: 'info',
  approved: 'success',
  rejected: 'danger'
};
/** 审核期允许取回的证据文件；原生 .rp 正式下载另走交付校验。 */
const reviewKinds = ['native_rp', 'rp1', 'audit', 'engine_check'];
const fileSuffix: Record<string, string> = { native_rp: '.rp', rp1: '.json', audit: '.json', engine_check: '.json' };

const projects = ref<ProtoProject[]>([]);
const total = ref(0);
const buttonLoading = ref(false);
const { loading, withLoading } = useLoading(true);
const { showSearch } = useSearchToggle();

const queryFormRef = ref<ElFormInstance>();
const projectFormRef = ref<ElFormInstance>();
const draftFormRef = ref<ElFormInstance>();
const reviewFormRef = ref<ElFormInstance>();

const initFormData: ProtoProjectForm = {
  projectId: undefined,
  name: '',
  requirement: '',
  canvas: 'web',
  themeKey: 'default',
  expectedRevision: 0
};
const projectRules = reactive({
  name: [
    { required: true, message: '项目名称不能为空', trigger: 'blur' },
    { max: 100, message: '项目名称不能超过 100 字', trigger: 'blur' }
  ],
  canvas: [{ required: true, message: '画布只能为网页或移动端', trigger: 'change' }],
  requirement: [
    { required: true, message: '需求不能为空', trigger: 'blur' },
    { max: 8000, message: '需求不能超过 8000 字', trigger: 'blur' }
  ]
});
const data = reactive<PageData<ProtoProjectForm, ProtoProjectQuery>>({
  form: { ...initFormData },
  queryParams: { pageNum: 1, pageSize: 10, name: undefined, archived: '0' },
  rules: projectRules
});
const { queryParams, form } = toRefs(data);

const {
  dialog,
  resetForm: reset,
  openDialog,
  closeDialog
} = useFormDialog({ form, formRef: projectFormRef, initialFormData: initFormData });

const { dialog: workDialog } = useDialogState('原型项目');
const project = ref<ProtoProject>();
const draftForm = ref<ProtoProjectForm>({ ...initFormData });
const savingDraft = ref(false);
const generating = ref(false);
const versionLoading = ref(false);
const versions = ref<ProtoVersion[]>([]);
const versionTotal = ref(0);
const versionQuery = ref<PageQuery>({ pageNum: 1, pageSize: 10 });
const selected = ref<ProtoVersion>();
const reviewing = ref(false);
const verifying = ref(false);
const delivering = ref(false);
const fingerprintsConfirmed = ref(false);
const reviewForm = ref<ProtoReviewForm>({ decision: 'approved', rpSha256: '', previewSha256: '', reason: '' });
const verificationForm = ref<ProtoVerificationForm>({
  requestKey: '',
  rpSha256: '',
  targetVersion: '',
  opened: false,
  edited: false,
  saved: false,
  reopened: false,
  navigationChecked: false,
  note: ''
});
const previewUrl = ref('');
const capabilities = ref<ProductionCapabilities>();

// shortcut: 生成/验证/交付的请求键在打开项目时各生成一次，重试复用同键；需要跨会话恢复时改由后端下发。
const newRequestKey = () => crypto.randomUUID?.() ?? `ui-${Date.now()}-${Math.random().toString(36).slice(2)}`;
let generateKey = newRequestKey();
let verifyKey = newRequestKey();
let deliverKey = newRequestKey();

const isArchived = computed(() => project.value?.archived === '1');
const rpFile = computed(() => artifact('native_rp'));
const summaryFile = computed(() => artifact('preview_summary'));
const rpSha = computed(() => rpFile.value?.sha256 || '');
const previewSha = computed(() => summaryFile.value?.sha256 || '');
const canDeliver = computed(
  () => selected.value?.reviewStatus === 'approved' && Boolean(rpSha.value) && Boolean(previewSha.value)
);
const canFormalDownload = computed(
  () => selected.value?.reviewStatus === 'approved' && Boolean(selected.value?.delivery)
);
const deliverHint = computed(() => {
  if (!selected.value) return '请先选择版本。';
  if (selected.value.reviewStatus !== 'approved') return '审核通过后才能确认交付。';
  return canDeliver.value
    ? '交付会固化当前指纹与当时的原生验证结论，之后补的验证不改变交付事实。'
    : '缺少原生文件或预览汇总指纹，无法交付。';
});
const capabilityReasons = computed(() => {
  const proto = capabilities.value?.prototype;
  if (!proto || proto.available || !proto.reasons?.length) return [];
  return [`原型生成当前不可用：${proto.reasons.join('；')}`];
});
/** 目标 Axure 版本由部署配置给出：让操作员逐字确认，而不是猜一个后端认识的字符串。 */
const targetAxure = computed(() => capabilities.value?.prototype?.targetAxureVersion || '');

const timeText = (value?: string) => (value ? (parseTime(value, '{y}-{m}-{d} {h}:{i}:{s}') as string) : '-');
const shortValue = (value?: string, size = 8) => (value ? value.slice(0, size) + '…' : '-');
const sizeText = (bytes?: number) => (bytes == null ? '-' : `${(bytes / 1024).toFixed(1)} KiB`);
const boolText = (value?: boolean) => (value === undefined ? '未知' : value ? '通过' : '未通过');

function artifact(kind: string) {
  return selected.value?.artifacts?.find(file => file.kind === kind);
}

/** 查询项目列表 */
const getList = async () => {
  await withLoading(async () => {
    const res = await listProtoProject(queryParams.value);
    projects.value = res.data?.rows || [];
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

const handleAdd = () => {
  reset();
  openDialog('新建原型项目');
};

const cancel = () => {
  reset();
  closeDialog();
};

const submitForm = () => {
  projectFormRef.value?.validate(async (valid: boolean) => {
    if (!valid) return;
    buttonLoading.value = true;
    try {
      await addProtoProject(form.value);
      modal.msgSuccess('项目已创建');
      closeDialog();
      await getList();
    } finally {
      buttonLoading.value = false;
    }
  });
};

const handleArchive = async (row: ProtoProject) => {
  try {
    await modal.confirm(`确定归档「${row.name}」？归档后草稿不可编辑，历史版本仍可审核与下载。`);
  } catch {
    return;
  }
  await archiveProtoProject(row.projectId);
  modal.msgSuccess('已归档');
  await getList();
};

const openProject = async (row: ProtoProject) => {
  releasePreview();
  stopWatch();
  liveTask.value = undefined;
  generateKey = newRequestKey();
  verifyKey = newRequestKey();
  deliverKey = newRequestKey();
  selected.value = undefined;
  versions.value = [];
  versionTotal.value = 0;
  versionQuery.value.pageNum = 1;
  workDialog.visible = true;
  await reloadProject(row.projectId);
  await loadVersions();
  if (project.value?.activeTask) {
    void watchTask(project.value.activeTask.taskId);
  }
};

const reloadProject = async (projectId: string) => {
  const res = await getProtoProject(projectId);
  project.value = res.data;
  draftForm.value = {
    projectId: res.data.projectId,
    name: res.data.name,
    requirement: res.data.requirement,
    canvas: res.data.canvas,
    themeKey: res.data.themeKey || 'default',
    expectedRevision: res.data.revision
  };
};

/**
 * 生成会真起引擎子进程，页面不能停在「已受理」。盯任务详情而不是重读项目，是为了不覆盖
 * 操作员正在编辑的需求草稿；到终态才整页刷新一次。
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
    await Promise.all([reloadProject(res.data.bizId), loadVersions()]);
  } catch {
    stopWatch();
  }
};

/** 版本列表 */
const loadVersions = async () => {
  if (!project.value) return;
  versionLoading.value = true;
  try {
    const res = await listProtoVersions(project.value.projectId, versionQuery.value);
    versions.value = res.data?.rows || [];
    versionTotal.value = res.data?.total || 0;
  } finally {
    versionLoading.value = false;
  }
};

const selectVersion = (row?: ProtoVersion) => {
  releasePreview();
  fingerprintsConfirmed.value = false;
  reviewForm.value = { decision: 'approved', rpSha256: '', previewSha256: '', reason: '' };
  verificationForm.value = {
    ...verificationForm.value,
    requestKey: verifyKey,
    rpSha256: '',
    targetVersion: targetAxure.value,
    note: ''
  };
  selected.value = row;
};

const releasePreview = () => {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
    previewUrl.value = '';
  }
};

/** 保存草稿：expectedRevision 由后端校验，成功后取回新的修订号 */
const handleSaveDraft = () => {
  draftFormRef.value?.validate(async (valid: boolean) => {
    if (!valid || !project.value) return;
    savingDraft.value = true;
    try {
      await updateProtoProject(project.value.projectId, draftForm.value);
      modal.msgSuccess('草稿已保存');
      await reloadProject(project.value.projectId);
    } finally {
      savingDraft.value = false;
    }
  });
};

const handleGenerate = async () => {
  if (!project.value) return;
  try {
    await modal.confirm('发起生成会排队执行真实装配，能力未放行时后端会直接拒绝。确定现在发起？');
  } catch {
    return;
  }
  generating.value = true;
  try {
    const res = await generateProto(project.value.projectId, {
      requestKey: generateKey,
      expectedRevision: draftForm.value.expectedRevision
    });
    modal.msgSuccess(`已受理，任务 ${res.data.taskId}`);
    generateKey = newRequestKey();
    await reloadProject(project.value.projectId);
    await loadVersions();
    void watchTask(res.data.taskId);
  } finally {
    generating.value = false;
  }
};

/** 预览取回 blob：产物受登录态保护，不能用直链 */
const handlePreview = async (file: ProductionFile) => {
  if (!project.value || !selected.value) return;
  releasePreview();
  const blob = await fetchProtoPreview(project.value.projectId, selected.value.versionId, file.artifactId);
  previewUrl.value = URL.createObjectURL(blob);
};

const handleReviewDownload = (file: ProductionFile) => {
  if (!project.value || !selected.value) return;
  void download(
    `/heron/proto/${project.value.projectId}/versions/${selected.value.versionId}/review-download`,
    { artifactId: file.artifactId },
    `proto-v${selected.value.versionNo}-${file.kind}${fileSuffix[file.kind] ?? ''}`
  );
};

/** 正式下载必须带交付时的原生指纹，后端据此确认下载的就是交付的那一版 */
const handleDownload = (file: ProductionFile) => {
  if (!project.value || !selected.value || !rpFile.value) return;
  void download(
    `/heron/proto/${project.value.projectId}/versions/${selected.value.versionId}/download`,
    { artifactId: file.artifactId, rpSha256: rpFile.value.sha256 },
    `${project.value.name}-v${selected.value.versionNo}.rp`
  );
};

const handleReview = () => {
  reviewFormRef.value?.validate(async (valid: boolean) => {
    if (!valid || !project.value || !selected.value) return;
    if (reviewForm.value.decision === 'rejected' && !reviewForm.value.reason?.trim()) {
      modal.msgError('驳回必须写明理由');
      return;
    }
    reviewing.value = true;
    try {
      const res = await reviewProtoVersion(project.value.projectId, selected.value.versionId, {
        ...reviewForm.value,
        rpSha256: rpSha.value,
        previewSha256: previewSha.value
      });
      modal.msgSuccess('审核结论已记录');
      // 复核后的版本对象直接回到选中态，避免再取一次才知道结论
      selectVersion(res.data);
      await loadVersions();
    } finally {
      reviewing.value = false;
    }
  });
};

const handleVerify = async () => {
  if (!project.value || !selected.value) return;
  verifying.value = true;
  try {
    const res = await verifyProtoVersion(project.value.projectId, selected.value.versionId, {
      ...verificationForm.value,
      requestKey: verifyKey,
      rpSha256: rpSha.value
    });
    modal.msgSuccess(res.data.passed ? '验证记录已保存：通过' : '验证记录已保存：未通过（服务端比对目标 Axure 版本）');
    await reloadVersion();
  } finally {
    verifying.value = false;
  }
};

/** 验证成功后重取版本详情，失败时保留当前视图（请求层已提示） */
const reloadVersion = async () => {
  if (!project.value || !selected.value) return;
  try {
    const res = await getProtoVersion(project.value.projectId, selected.value.versionId);
    selectVersion(res.data);
  } catch {
    // 取回失败不覆盖当前选中态
  }
};

const handleDeliver = async () => {
  if (!project.value || !selected.value || !canDeliver.value) return;
  try {
    await modal.confirm('交付会把当前原生文件与预览指纹固化，之后补的验证不会改写交付事实。确定交付？');
  } catch {
    return;
  }
  delivering.value = true;
  try {
    await deliverProtoVersion(project.value.projectId, selected.value.versionId, {
      requestKey: deliverKey,
      rpSha256: rpSha.value,
      previewSha256: previewSha.value
    });
    modal.msgSuccess('交付事实已记录');
    deliverKey = newRequestKey();
    await reloadVersion();
    await loadVersions();
  } finally {
    delivering.value = false;
  }
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
.revision-tip,
.form-tip {
  margin-left: 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
}
.sha-text {
  font-family: var(--el-font-family-monospace, monospace);
}
.task-reason {
  margin-top: 4px;
  white-space: pre-wrap;
  word-break: break-all;
}
.artifact-table,
.data-table {
  margin-top: 8px;
}
.widget-tag {
  margin-right: 4px;
}
.preview-shell {
  margin-top: 12px;
}
.deliver-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.page-preview {
  width: 100%;
  border: 1px solid var(--el-border-color);
}
</style>
