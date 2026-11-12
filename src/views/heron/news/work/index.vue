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
            <h3>视频作品</h3>
            <p>认领后的作品在此进入工作室：编辑草稿、发起生成、逐版审片。只有人工通过的版本才能正式下载。</p>
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
            <el-button link type="primary" icon="Tickets" @click="openStudio(row as NewsWork)">进入工作室</el-button>
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
  </div>
</template>

<script setup name="HeronNewsWork" lang="ts">
import type { NewsWork, NewsWorkQuery } from '@/api/heron/newsWork/types';
import { listNewsWork } from '@/api/heron/newsWork';
import { useLoading } from '@/hooks/async/useLoading';
import { useSearchReset } from '@/hooks/form/useSearchReset';
import { useSearchToggle } from '@/hooks/form/useSearchToggle';
import { utcText } from '../../heron-time';
import { productionStatusTag, productionStatusText } from '../../production/task-state';

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

const works = ref<NewsWork[]>([]);
const total = ref(0);
const { loading, withLoading } = useLoading(true);
const { showSearch } = useSearchToggle();
const queryFormRef = ref<ElFormInstance>();

const queryParams = ref<NewsWorkQuery>({ pageNum: 1, pageSize: 10, title: undefined });

const router = useRouter();
const timeText = utcText;

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

/** 作品详情是独立页面而不是抽屉：创作动作多，抽屉装不下 */
const openStudio = (row: NewsWork) => {
  router.push({ path: '/heron/work-studio', query: { workId: row.workId } });
};

onMounted(() => {
  getList();
});
</script>
