<template>
  <div class="p-2 app-container heron-media-asset-page">
    <div class="search-wrap">
      <el-card shadow="hover" class="search-panel" :class="{ 'is-collapsed': !showSearch }">
        <template #header>
          <div class="panel-heading search-panel-toggle" @click.stop="showSearch = !showSearch">
            <div><h3>筛选条件</h3></div>
          </div>
        </template>
        <el-form ref="queryFormRef" :model="queryParams" :inline="true" class="query-form">
          <el-form-item label="素材名称" prop="name">
            <el-input v-model="queryParams.name" placeholder="请输入素材名称" clearable @keyup.enter="handleQuery" />
          </el-form-item>
          <el-form-item label="许可" prop="licenseCode">
            <el-select v-model="queryParams.licenseCode" placeholder="全部许可" clearable class="w-[170px]">
              <el-option v-for="(label, value) in licenseText" :key="value" :label="label" :value="value" />
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
            <h3>画面素材</h3>
            <p>尺寸、SHA-256 与 OSS 指针由后端实算；未知或非白名单许可拒绝入库，并在选材时复核。</p>
          </div>
          <div class="toolbar-actions">
            <el-button v-hasPermi="['heron:mediaAsset:add']" type="primary" plain icon="Plus" @click="handleAdd">入库</el-button>
            <el-button
              v-hasPermi="['heron:mediaAsset:remove']"
              type="danger"
              plain
              icon="Delete"
              :disabled="multiple"
              @click="handleDelete()"
            >
              删除
            </el-button>
            <right-toolbar v-model:show-search="showSearch" :search="false" @query-table="getList" />
          </div>
        </div>
      </template>

      <el-table
        v-loading="loading"
        border
        class="data-table"
        :data="assets"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" align="center" />
        <el-table-column label="预览" width="90" align="center">
          <template #default="{ row }">
            <image-preview :src="row.ossUrl" :width="52" :height="52" />
          </template>
        </el-table-column>
        <el-table-column label="名称" prop="name" min-width="140" show-overflow-tooltip />
        <el-table-column label="许可" width="120" align="center">
          <template #default="{ row }">
            <el-tag type="success" effect="plain">{{ licenseText[row.licenseCode] || row.licenseCode }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="尺寸" width="110" align="center">
          <template #default="{ row }">{{ row.width }} × {{ row.height }}</template>
        </el-table-column>
        <el-table-column label="场景标签" prop="tags" min-width="150" show-overflow-tooltip />
        <el-table-column label="SHA-256" width="150" align="center">
          <template #default="{ row }">
            <el-tooltip :content="row.contentSha256" placement="top">
              <span class="mono">{{ short(row.contentSha256) }}</span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="来源" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <a :href="row.sourceUri" target="_blank" rel="noopener noreferrer">{{ row.sourceUri }}</a>
          </template>
        </el-table-column>
        <el-table-column label="入库时间" width="160" align="center">
          <template #default="{ row }">{{ timeText(row.createTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="90" align="center" class-name="small-padding fixed-width">
          <template #default="{ row }">
            <el-button v-hasPermi="['heron:mediaAsset:edit']" link type="primary" icon="Edit" @click="handleUpdate(row as MediaAsset)" />
            <el-button v-hasPermi="['heron:mediaAsset:remove']" link type="primary" icon="Delete" @click="handleDelete(row as MediaAsset)" />
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

    <el-dialog v-model="dialog.visible" :title="dialog.title" width="620px" append-to-body>
      <el-form ref="assetFormRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="素材名称" prop="name">
          <el-input v-model="form.name" placeholder="最多 100 字" maxlength="100" />
        </el-form-item>
        <el-form-item label="素材文件" prop="file" v-if="!form.id">
          <el-upload
            class="upload-block"
            drag
            :auto-upload="false"
            :show-file-list="false"
            accept=".png,.jpg,.jpeg,image/png,image/jpeg"
            :on-change="handleFileChange"
          >
            <el-icon class="el-icon--upload"><upload-filled /></el-icon>
            <div class="el-upload__text">PNG/JPEG，单文件不超过 10 MiB</div>
          </el-upload>
          <p v-if="selectedFile" class="form-tip">已选择：{{ selectedFile.name }}</p>
        </el-form-item>
        <el-form-item label="来源地址" prop="sourceUri">
          <el-input v-model="form.sourceUri" placeholder="https://source.example.test/asset" />
        </el-form-item>
        <el-form-item label="生产许可" prop="licenseCode">
          <el-select v-model="form.licenseCode" placeholder="请选择显式许可" class="w-full">
            <el-option v-for="(label, value) in licenseText" :key="value" :label="label" :value="value" />
          </el-select>
          <p class="form-tip">UNKNOWN、空白和自定义许可不会进入生产；这里不提供“未知”选项。</p>
        </el-form-item>
        <el-form-item label="许可证明" prop="licenseEvidenceUri">
          <el-input v-model="form.licenseEvidenceUri" placeholder="https://license.example.test/terms" />
        </el-form-item>
        <el-form-item label="署名" prop="attribution">
          <el-input v-model="form.attribution" placeholder="按许可要求填写作者或出处" maxlength="1000" />
        </el-form-item>
        <el-form-item label="场景标签" prop="tags">
          <el-input v-model="form.tags" placeholder="城市,夜景,科技" maxlength="500" />
          <p class="form-tip">逗号分隔；选材时所有场景关键词都必须命中。</p>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button :loading="buttonLoading" type="primary" @click="submitForm">确 定</el-button>
          <el-button @click="cancel">取 消</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="HeronMediaAsset" lang="ts">
import type { UploadFile } from 'element-plus';
import type { MediaAsset, MediaAssetForm, MediaAssetLicense, MediaAssetQuery } from '@/api/heron/mediaAsset/types';
import { addMediaAsset, delMediaAsset, getMediaAsset, listMediaAsset, updateMediaAsset } from '@/api/heron/mediaAsset';
import { useLoading } from '@/hooks/async/useLoading';
import { useFormDialog } from '@/hooks/dialog/useFormDialog';
import { useSearchReset } from '@/hooks/form/useSearchReset';
import { useSearchToggle } from '@/hooks/form/useSearchToggle';
import { useTableSelection } from '@/hooks/table/useTableSelection';
import modal from '@/plugins/modal';
import { utcText } from '../../heron-time';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const licenseText: Record<MediaAssetLicense, string> = {
  OWNED: '自有/已授权',
  PUBLIC_DOMAIN: '公有领域',
  CC0: 'CC0',
  CC_BY: 'CC BY',
  CC_BY_SA: 'CC BY-SA'
};

const assets = ref<MediaAsset[]>([]);
const total = ref(0);
const buttonLoading = ref(false);
const selectedFile = ref<File>();
const { loading, withLoading } = useLoading(true);
const { showSearch } = useSearchToggle();
const { ids, multiple, handleSelectionChange, clearSelection } = useTableSelection<MediaAsset>(row => row.id);

const queryFormRef = ref<ElFormInstance>();
const assetFormRef = ref<ElFormInstance>();
const initFormData: MediaAssetForm = {
  name: '',
  sourceUri: '',
  licenseCode: '',
  licenseEvidenceUri: '',
  attribution: '',
  tags: ''
};
const data = reactive<PageData<MediaAssetForm, MediaAssetQuery>>({
  form: { ...initFormData },
  queryParams: { pageNum: 1, pageSize: 10, name: undefined, licenseCode: '' },
  rules: {
    name: [
      { required: true, message: '素材名称不能为空', trigger: 'blur' },
      { max: 100, message: '素材名称不能超过 100 字', trigger: 'blur' }
    ],
    sourceUri: [
      { required: true, message: '来源地址不能为空', trigger: 'blur' },
      { max: 2048, message: '来源地址过长', trigger: 'blur' }
    ],
    licenseCode: [{ required: true, message: '生产许可不能为空', trigger: 'change' }],
    licenseEvidenceUri: [
      { required: true, message: '许可证明不能为空', trigger: 'blur' },
      { max: 2048, message: '许可证明地址过长', trigger: 'blur' }
    ],
    attribution: [{ max: 1000, message: '署名不能超过 1000 字', trigger: 'blur' }],
    tags: [{ max: 500, message: '场景标签不能超过 500 字', trigger: 'blur' }]
  }
});
const { queryParams, form, rules } = toRefs(data);
const { dialog, resetForm, openDialog, showDialog, closeDialog } = useFormDialog({
  form,
  formRef: assetFormRef,
  initialFormData: initFormData
});

const timeText = utcText;
const short = (value: string) => (value ? value.slice(0, 12) + '…' : '-');

const getList = async () => {
  await withLoading(async () => {
    const res = await listMediaAsset(queryParams.value);
    assets.value = res.data?.rows || [];
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
  afterReset: () => handleQuery()
});

const handleAdd = () => {
  selectedFile.value = undefined;
  openDialog('素材入库');
};

const handleFileChange = (file: UploadFile) => {
  selectedFile.value = file.raw;
  if (file.raw && file.raw.size > MAX_UPLOAD_BYTES) {
    modal.msgError('素材文件不能超过 10 MiB');
    selectedFile.value = undefined;
  }
};

const handleUpdate = async (row: MediaAsset) => {
  resetForm();
  const res = await getMediaAsset(row.id);
  Object.assign(form.value, editableMetadata(res.data));
  showDialog('修改素材');
};

const editableMetadata = (row: MediaAsset): MediaAssetForm => ({
  id: row.id,
  name: row.name,
  sourceUri: row.sourceUri,
  licenseCode: row.licenseCode,
  licenseEvidenceUri: row.licenseEvidenceUri,
  attribution: row.attribution,
  tags: row.tags
});

const submitForm = () => {
  assetFormRef.value?.validate(async (valid: boolean) => {
    if (!valid) return;
    if (!form.value.id && !selectedFile.value) {
      modal.msgError('请选择素材文件');
      return;
    }
    buttonLoading.value = true;
    try {
      if (form.value.id) {
        await updateMediaAsset(form.value);
      } else {
        const payload = new FormData();
        payload.append('metadata', new Blob([JSON.stringify(form.value)], { type: 'application/json' }));
        payload.append('file', selectedFile.value!);
        await addMediaAsset(payload);
      }
      modal.msgSuccess('保存成功');
      closeDialog();
      clearSelection();
      await getList();
    } finally {
      buttonLoading.value = false;
    }
  });
};

const handleDelete = async (row?: MediaAsset) => {
  const targetIds = row ? [row.id] : ids.value;
  if (!targetIds.length) return;
  if (targetIds.length > 100) {
    modal.msgError('单次最多删除 100 个素材');
    return;
  }
  try {
    await modal.confirm(`确定删除 ${targetIds.length} 个素材？素材将退出后续选材，OSS 对象与历史作品不会被删除。`);
  } catch {
    return;
  }
  await delMediaAsset(targetIds);
  modal.msgSuccess('删除成功');
  clearSelection();
  await getList();
};

const cancel = () => {
  selectedFile.value = undefined;
  resetForm();
  closeDialog();
};

onMounted(getList);
</script>

<style scoped>
.form-tip {
  margin: 4px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
}

.upload-block {
  width: 100%;
}

.mono {
  font-family: var(--app-font-mono);
  font-size: var(--app-font-size-xs);
}

a {
  color: var(--el-color-primary);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}
</style>
