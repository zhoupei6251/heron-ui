<template>
  <div class="p-2 app-container heron-publish-page">
    <el-card shadow="hover" class="table-panel">
      <template #header>
        <div class="toolbar-shell">
          <div class="table-heading">
            <h3>发布记录</h3>
            <p>只要落过发布事实就列出，沙箱与命令行提交也算。命令行发布不回传作品链接，需要从抖音后台复制一次补进来。</p>
          </div>
          <div class="toolbar-actions">
            <right-toolbar v-model:show-search="showSearch" :search="false" @query-table="getList"></right-toolbar>
          </div>
        </div>
      </template>

      <el-table v-loading="loading" border class="data-table" :data="rows">
        <el-table-column label="作品" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <router-link class="work-link" :to="{ path: '/heron/work-studio', query: { workId: row.workId } }">
              {{ row.workTitle || '作品 ' + row.workId }}
            </router-link>
          </template>
        </el-table-column>
        <el-table-column label="版本" width="70" align="center">
          <template #default="{ row }">v{{ row.versionNo }}</template>
        </el-table-column>
        <el-table-column label="来源" width="150" align="center">
          <template #default="{ row }">
            <el-tag :type="row.publishSource === 'sandbox' ? 'warning' : 'success'" effect="plain">
              {{ publishSourceText[row.publishSource || ''] || row.publishSource || '-' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="账号" width="130" align="center">
          <template #default="{ row }">{{ row.publishAccount || '-' }}</template>
        </el-table-column>
        <el-table-column label="发布时间" width="170" align="center">
          <template #default="{ row }">{{ timeText(row.publishAt) }}</template>
        </el-table-column>
        <el-table-column label="作品链接" min-width="240">
          <template #default="{ row }">
            <a v-if="row.publishUrl" :href="row.publishUrl" target="_blank" rel="noopener noreferrer">
              {{ row.publishUrl }}
            </a>
            <span v-else-if="row.publishSource === 'douyin-cli'" class="link-missing">待补链接</span>
            <span v-else class="muted">-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" align="center">
          <template #default="{ row }">
            <el-button
              v-if="row.publishSource === 'douyin-cli' && !row.publishUrl"
              v-hasPermi="['heron:newsWork:publish']"
              link
              type="primary"
              @click="openBackfill(row as NewsVideoVersion)"
            >
              补链接
            </el-button>
            <span v-else class="muted">—</span>
          </template>
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

    <el-dialog v-model="dialog.visible" title="补作品链接" width="520px" append-to-body>
      <p class="dialog-hint">命令行在抖音后台提交发布后不回传链接；从抖音后台复制作品地址粘贴进来即可。</p>
      <el-input v-model="workUrl" placeholder="https://www.douyin.com/video/..." clearable />
      <template #footer>
        <div class="dialog-footer">
          <el-button :loading="saving" :disabled="!workUrl.trim()" type="primary" @click="submitBackfill">确 定</el-button>
          <el-button @click="dialog.visible = false">取 消</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="HeronPublish" lang="ts">
import type { NewsVideoVersion } from '@/api/heron/newsWork/types';
import { backfillNewsPublishUrl, listPublishedVersions } from '@/api/heron/newsWork';
import { useLoading } from '@/hooks/async/useLoading';
import { useSearchToggle } from '@/hooks/form/useSearchToggle';
import modal from '@/plugins/modal';
import { utcText } from '../heron-time';

const publishSourceText: Record<string, string> = {
  manual: '人工已发布',
  api: 'API 已发布',
  'douyin-cli': '命令行已提交',
  sandbox: '沙箱发布（未上抖音）'
};

const rows = ref<NewsVideoVersion[]>([]);
const total = ref(0);
const page = ref<PageQuery>({ pageNum: 1, pageSize: 10 });
const { loading, withLoading } = useLoading(true);
const { showSearch } = useSearchToggle();

const dialog = ref<{ visible: boolean; row?: NewsVideoVersion }>({ visible: false });
const workUrl = ref('');
const saving = ref(false);

const timeText = utcText;

const getList = async () => {
  await withLoading(async () => {
    const res = await listPublishedVersions(page.value);
    rows.value = res.data?.rows || [];
    total.value = res.data?.total || 0;
  });
};

const openBackfill = (row: NewsVideoVersion) => {
  dialog.value = { visible: true, row };
  workUrl.value = '';
};

const submitBackfill = async () => {
  const row = dialog.value.row;
  const url = workUrl.value.trim();
  if (!row || !url) return;
  saving.value = true;
  try {
    await backfillNewsPublishUrl(row.workId, row.versionId, url);
    modal.msgSuccess('作品链接已补上');
    dialog.value = { visible: false };
    await getList();
  } finally {
    saving.value = false;
  }
};

onMounted(getList);
</script>

<style lang="scss" scoped>
.table-panel {
  border: 1px solid var(--app-surface-border);
}

.work-link {
  color: var(--app-accent-strong);
  font-weight: 600;
}

.link-missing {
  color: var(--app-warning);
  font-size: var(--app-font-size-xs);
}

.muted {
  color: var(--app-text-faint);
  font-size: var(--app-font-size-xs);
}

.dialog-hint {
  margin: 0 0 12px;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: 1.7;
}
</style>
