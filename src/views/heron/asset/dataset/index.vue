<template>
  <div class="p-2 app-container heron-dataset-page">
    <el-card shadow="hover" class="toolbar-panel">
      <div class="dataset-toolbar">
        <div class="toolbar-fields">
          <el-input v-model="queryParams.category" placeholder="分类" clearable class="w-[140px]" @keyup.enter="handleQuery" />
          <el-select v-model="queryParams.commercialOk" placeholder="全部授权" clearable class="w-[150px]" @change="handleQuery">
            <el-option label="可商用" value="true" />
            <el-option label="不可商用" value="false" />
            <el-option label="授权未知" value="unknown" />
          </el-select>
          <el-select v-model="queryParams.probeStatus" placeholder="全部探测" clearable class="w-[150px]" @change="handleQuery">
            <el-option label="正常" value="ok" />
            <el-option label="被拦截" value="blocked" />
            <el-option label="无权限" value="no_permission" />
          </el-select>
          <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
          <el-button icon="Refresh" @click="resetQuery">重置</el-button>
        </div>
        <right-toolbar v-model:show-search="showSearch" :search="false" @query-table="getList"></right-toolbar>
      </div>
      <p class="toolbar-hint">
        数据集是注册表，不在这里新增：端点与授权由人审过再走 SQL 迁移进库。
        <strong>授权 unknown 的数据不能商用</strong>，下面标红的行都属于这一类。
      </p>
    </el-card>

    <el-card shadow="hover" class="table-panel">
      <el-table v-loading="loading" border class="data-table" :data="rows">
        <el-table-column label="名称" prop="name" min-width="180" show-overflow-tooltip />
        <el-table-column label="标识" prop="sourceKey" min-width="170" show-overflow-tooltip>
          <template #default="{ row }"><span class="mono">{{ row.sourceKey }}</span></template>
        </el-table-column>
        <el-table-column label="分类" prop="category" width="110" align="center" />
        <el-table-column label="形态" prop="shapes" width="130" align="center" />
        <el-table-column label="更新" prop="cadence" width="100" align="center" />
        <el-table-column label="授权" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="commercialTag(row.commercialOk)" effect="plain">
              {{ commercialText(row.commercialOk) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="探测" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="probeTag(row.probeStatus)" effect="plain">{{ probeText(row.probeStatus) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="启用" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.enabled === '0' ? 'success' : 'info'" effect="plain">
              {{ row.enabled === '0' ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="最近更新" width="160" align="center">
          <template #default="{ row }">{{ timeText(row.lastUpdated) }}</template>
        </el-table-column>
        <el-table-column label="失败" width="70" align="center">
          <template #default="{ row }">
            <span :class="{ 'is-bad': (row.failureCount || 0) > 0 }">{{ row.failureCount ?? 0 }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="90" align="center">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row as DataSource)">详情</el-button>
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

    <el-dialog v-model="dialog.visible" :title="detail?.name || '数据集'" width="720px" append-to-body>
      <el-descriptions v-if="detail" :column="2" border>
        <el-descriptions-item label="标识"><span class="mono">{{ detail.sourceKey }}</span></el-descriptions-item>
        <el-descriptions-item label="分类">{{ detail.category || '-' }}</el-descriptions-item>
        <el-descriptions-item label="授权">
          <el-tag :type="commercialTag(detail.commercialOk)" effect="plain">
            {{ commercialText(detail.commercialOk) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="条款">{{ detail.termsUrl || '-' }}</el-descriptions-item>
        <el-descriptions-item label="形态">{{ detail.shapes || '-' }}</el-descriptions-item>
        <el-descriptions-item label="更新频率">{{ detail.cadence || '-' }}</el-descriptions-item>
        <el-descriptions-item label="历史天数">{{ detail.historyDays ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="数据格式">{{ detail.dataFormat || '-' }}</el-descriptions-item>
        <el-descriptions-item label="端点" :span="2">
          <span class="mono break">{{ detail.endpoint || '-' }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="历史端点" :span="2">
          <span class="mono break">{{ detail.historyEndpoint || '-' }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="探测状态">
          <el-tag :type="probeTag(detail.probeStatus)" effect="plain">{{ probeText(detail.probeStatus) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="最近更新">{{ timeText(detail.lastUpdated) }}</el-descriptions-item>
        <el-descriptions-item label="探测备注" :span="2">{{ detail.probeNote || '-' }}</el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialog.visible = false">关 闭</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="HeronDataset" lang="ts">
import type { DataSource, DataSourceQuery } from '@/api/heron/dataSource/types';
import { getDataSource, listDataSource } from '@/api/heron/dataSource';
import { useLoading } from '@/hooks/async/useLoading';
import { useSearchToggle } from '@/hooks/form/useSearchToggle';
import { utcText } from '../../heron-time';

const rows = ref<DataSource[]>([]);
const total = ref(0);
const detail = ref<DataSource>();
const dialog = ref({ visible: false });
const { loading, withLoading } = useLoading(true);
const { showSearch } = useSearchToggle();

const queryParams = ref<DataSourceQuery>({
  pageNum: 1,
  pageSize: 20,
  category: undefined,
  commercialOk: undefined,
  probeStatus: undefined
});

const timeText = utcText;

const commercialText = (value?: string) =>
  value === 'true' ? '可商用' : value === 'false' ? '不可商用' : '授权未知';
/** unknown 必须比 false 更显眼：false 是已知不能用，unknown 是没人确认过。 */
const commercialTag = (value?: string) => (value === 'true' ? 'success' : value === 'false' ? 'warning' : 'danger');

const probeText = (value?: string) =>
  ({ ok: '正常', blocked: '被拦截', no_permission: '无权限' })[value || ''] || value || '-';
const probeTag = (value?: string) => (value === 'ok' ? 'success' : 'danger');

const getList = async () => {
  await withLoading(async () => {
    const res = await listDataSource(queryParams.value);
    rows.value = res.data?.rows || [];
    total.value = res.data?.total || 0;
  });
};

const handleQuery = () => {
  queryParams.value.pageNum = 1;
  getList();
};

const resetQuery = () => {
  queryParams.value.category = undefined;
  queryParams.value.commercialOk = undefined;
  queryParams.value.probeStatus = undefined;
  handleQuery();
};

const openDetail = async (row: DataSource) => {
  const res = await getDataSource(row.sourceKey);
  detail.value = res.data;
  dialog.value.visible = true;
};

onMounted(getList);
</script>

<style lang="scss" scoped>
.heron-dataset-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.toolbar-panel,
.table-panel {
  border: 1px solid var(--app-surface-border);
}

.dataset-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.toolbar-fields {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.toolbar-hint {
  margin: 12px 0 0;
  color: var(--app-text-faint);
  font-size: var(--app-font-size-xs);
  line-height: 1.7;

  strong {
    color: var(--app-danger);
    font-weight: 600;
  }
}

.mono {
  font-family: var(--app-font-mono);
  font-size: var(--app-font-size-xs);
}

.break {
  word-break: break-all;
}

.is-bad {
  color: var(--app-danger);
  font-weight: 600;
}
</style>
