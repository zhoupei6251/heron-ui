<template>
  <div class="p-2 app-container heron-news-source-page">
    <div class="search-wrap">
      <el-card shadow="hover" class="search-panel" :class="{ 'is-collapsed': !showSearch }">
        <template #header>
          <div class="panel-heading search-panel-toggle" @click.stop="showSearch = !showSearch">
            <div><h3>筛选条件</h3></div>
          </div>
        </template>
        <el-form ref="queryFormRef" :model="queryParams" :inline="true" class="query-form">
          <el-form-item label="来源名称" prop="name">
            <el-input v-model="queryParams.name" placeholder="请输入来源名称" clearable @keyup.enter="handleQuery" />
          </el-form-item>
          <el-form-item label="类型" prop="sourceType">
            <el-select v-model="queryParams.sourceType" placeholder="全部类型" clearable class="w-[180px]">
              <el-option v-for="(label, value) in sourceTypeText" :key="value" :label="label" :value="value" />
            </el-select>
          </el-form-item>
          <el-form-item label="状态" prop="enabled">
            <el-select v-model="queryParams.enabled" placeholder="全部状态" clearable class="w-[180px]">
              <el-option label="启用" value="0" />
              <el-option label="停用" value="1" />
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
            <h3>新闻来源</h3>
            <p>来源能否出网由部署白名单与地址策略在采集时裁决，未登记的域名不会发起请求。</p>
          </div>
          <div class="toolbar-actions">
            <el-button v-hasPermi="['heron:newsSource:add']" type="primary" plain icon="Plus" @click="handleAdd">
              新增
            </el-button>
            <right-toolbar v-model:show-search="showSearch" :search="false" @query-table="getList"></right-toolbar>
          </div>
        </div>
      </template>

      <el-table v-loading="loading" border class="data-table" :data="sources">
        <el-table-column label="名称" prop="name" min-width="140" show-overflow-tooltip />
        <el-table-column label="类型" width="90" align="center">
          <template #default="{ row }">{{ sourceTypeText[row.sourceType] || row.sourceType }}</template>
        </el-table-column>
        <el-table-column label="地址" prop="url" min-width="240" show-overflow-tooltip />
        <el-table-column label="周期" width="90" align="center">
          <template #default="{ row }">{{ row.intervalSeconds }} 秒</template>
        </el-table-column>
        <el-table-column label="状态" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.enabled === '0' ? 'success' : 'info'">
              {{ row.enabled === '0' ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="上次采集" width="160" align="center">
          <template #default="{ row }">{{ timeText(row.lastAttemptAt) }}</template>
        </el-table-column>
        <el-table-column label="下次采集" width="160" align="center">
          <template #default="{ row }">{{ timeText(row.nextFetchAt) }}</template>
        </el-table-column>
        <el-table-column label="失败" width="150" align="center">
          <template #default="{ row }">
            <el-tooltip v-if="row.errorCode" :content="row.errorReason || row.errorCode" placement="top">
              <el-tag type="danger">{{ row.errorCode }} · {{ row.failureCount }} 次</el-tag>
            </el-tooltip>
            <el-tag v-else-if="row.failureCount" type="warning">{{ row.failureCount }} 次</el-tag>
            <span v-else>正常</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="170" align="center" class-name="small-padding fixed-width">
          <template #default="{ row }">
            <el-tooltip content="立即采集" placement="top">
              <el-button
                v-hasPermi="['heron:newsSource:fetch']"
                link
                type="primary"
                icon="Refresh"
                :disabled="row.enabled !== '0'"
                @click="handleFetch(row)"
              ></el-button>
            </el-tooltip>
            <el-tooltip content="修改" placement="top">
              <el-button
                v-hasPermi="['heron:newsSource:edit']"
                link
                type="primary"
                icon="Edit"
                @click="handleUpdate(row)"
              ></el-button>
            </el-tooltip>
            <el-tooltip content="删除" placement="top">
              <el-button
                v-hasPermi="['heron:newsSource:remove']"
                link
                type="primary"
                icon="Delete"
                @click="handleDelete(row)"
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

    <el-dialog v-model="dialog.visible" :title="dialog.title" width="560px" append-to-body>
      <el-form ref="sourceFormRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="来源名称" prop="name">
          <el-input v-model="form.name" placeholder="最多 100 字" maxlength="100" />
        </el-form-item>
        <el-form-item label="来源类型" prop="sourceType">
          <el-select v-model="form.sourceType" placeholder="请选择类型">
            <el-option v-for="(label, value) in sourceTypeText" :key="value" :label="label" :value="value" />
          </el-select>
        </el-form-item>
        <el-form-item label="来源地址" prop="url">
          <el-input v-model="form.url" placeholder="https://example.test/feed" />
          <div class="form-tip">只允许 http/https、默认端口、无用户名口令；保存时会归一为 ASCII 域名。</div>
        </el-form-item>
        <el-form-item label="采集周期" prop="intervalSeconds">
          <el-input-number v-model="form.intervalSeconds" :min="60" :step="60" controls-position="right" />
          <span class="ml-2">秒（不小于 60）</span>
        </el-form-item>
        <el-form-item label="状态" prop="enabled">
          <el-radio-group v-model="form.enabled">
            <el-radio value="0">启用</el-radio>
            <el-radio value="1">停用</el-radio>
          </el-radio-group>
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

<script setup name="HeronNewsSource" lang="ts">
import type { NewsSource, NewsSourceForm, NewsSourceQuery } from '@/api/heron/newsSource/types';
import {
  addNewsSource,
  delNewsSource,
  fetchNewsSource,
  getNewsSource,
  listNewsSource,
  updateNewsSource
} from '@/api/heron/newsSource';
import { useLoading } from '@/hooks/async/useLoading';
import { useFormDialog } from '@/hooks/dialog/useFormDialog';
import { useSearchReset } from '@/hooks/form/useSearchReset';
import { useSearchToggle } from '@/hooks/form/useSearchToggle';
import modal from '@/plugins/modal';
import { utcText } from '../../heron-time';

const sourceTypeText: Record<string, string> = { rss: 'RSS', atom: 'Atom', text: '文本' };

const sources = ref<NewsSource[]>([]);
const total = ref(0);
const buttonLoading = ref(false);
const { loading, withLoading } = useLoading(true);
const { showSearch } = useSearchToggle();

const queryFormRef = ref<ElFormInstance>();
const sourceFormRef = ref<ElFormInstance>();

const initFormData: NewsSourceForm = {
  sourceId: undefined,
  name: '',
  sourceType: 'rss',
  url: '',
  intervalSeconds: 600,
  enabled: '0'
};
const data = reactive<PageData<NewsSourceForm, NewsSourceQuery>>({
  form: { ...initFormData },
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    name: undefined,
    sourceType: '',
    enabled: ''
  },
  rules: {
    name: [
      { required: true, message: '来源名称不能为空', trigger: 'blur' },
      { max: 100, message: '来源名称不能超过 100 字', trigger: 'blur' }
    ],
    sourceType: [{ required: true, message: '来源类型不能为空', trigger: 'change' }],
    url: [
      { required: true, message: '来源地址不能为空', trigger: 'blur' },
      { max: 2048, message: '来源地址过长', trigger: 'blur' }
    ],
    intervalSeconds: [{ required: true, message: '采集周期不能为空', trigger: 'blur' }],
    enabled: [{ required: true, message: '状态不能为空', trigger: 'change' }]
  }
});
const { queryParams, form, rules } = toRefs(data);

const {
  dialog,
  resetForm: reset,
  openDialog,
  showDialog,
  closeDialog
} = useFormDialog({
  form,
  formRef: sourceFormRef,
  initialFormData: initFormData
});

const timeText = utcText;

/** 查询来源列表 */
const getList = async () => {
  await withLoading(async () => {
    const res = await listNewsSource(queryParams.value);
    sources.value = res.data?.rows || [];
    total.value = res.data?.total || 0;
  });
};

/** 取消按钮 */
const cancel = () => {
  reset();
  closeDialog();
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

/** 新增按钮操作 */
const handleAdd = () => {
  reset();
  openDialog('添加新闻来源');
};

/** 修改按钮操作 */
const handleUpdate = async (row: Partial<NewsSource>) => {
  reset();
  const res = await getNewsSource(row.sourceId!);
  Object.assign(form.value, res.data);
  showDialog('修改新闻来源');
};

/** 提交按钮 */
const submitForm = () => {
  sourceFormRef.value?.validate(async (valid: boolean) => {
    if (!valid) return;
    buttonLoading.value = true;
    try {
      if (form.value.sourceId) {
        await updateNewsSource(form.value);
      } else {
        await addNewsSource(form.value);
      }
      modal.msgSuccess('保存成功');
      closeDialog();
      await getList();
    } finally {
      buttonLoading.value = false;
    }
  });
};

/** 删除按钮操作 */
const handleDelete = async (row: Partial<NewsSource>) => {
  try {
    await modal.confirm(`确定删除来源「${row.name}」？已入库的候选新闻与成片不会随之删除。`);
  } catch {
    return;
  }
  await delNewsSource(row.sourceId!);
  modal.msgSuccess('删除成功');
  await getList();
};

/** 手动采集：同来源并发由后端租约挡下，这里只如实展示返回的错误 */
const handleFetch = async (row: Partial<NewsSource>) => {
  try {
    await modal.confirm(`立即采集「${row.name}」？地址会先过部署白名单与公网地址校验，不通过则不会发起请求。`);
  } catch {
    return;
  }
  await fetchNewsSource(row.sourceId!);
  modal.msgSuccess('已提交采集');
  await getList();
};

onMounted(() => {
  getList();
});
</script>

<style scoped>
.form-tip {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
}
</style>
