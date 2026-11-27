<template>
  <div class="p-2">
    <el-card shadow="hover" class="table-panel">
      <template #header>
        <div class="toolbar-shell">
          <div class="table-heading">
            <span class="panel-kicker">Publish Inventory</span>
            <h3>待发布池</h3>
            <p>共 {{ total }} 条；自动发布与人工发布共用同一条预占，评分明细可展开。</p>
          </div>
          <div class="toolbar-actions">
            <el-select v-model="queryParams.curationStatus" class="w-160" @change="handleQuery">
              <el-option label="合格待发布" value="eligible" />
              <el-option label="待评估" value="pending" />
              <el-option label="暂缓" value="hold" />
              <el-option label="已淘汰" value="rejected" />
              <el-option label="已过期" value="expired" />
              <el-option label="全部状态" value="" />
            </el-select>
            <el-button icon="Refresh" @click="getList()">刷新</el-button>
          </div>
        </div>
      </template>

      <el-table v-loading="loading" border :data="rows">
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="score-detail">
              <el-descriptions :column="1" border size="small">
                <el-descriptions-item label="AI 评估理由">{{ row.curationReason || '未评估' }}</el-descriptions-item>
                <el-descriptions-item label="评估版本">{{ row.curatorVersion || '-' }}</el-descriptions-item>
                <el-descriptions-item label="评估时间">{{ utcText(row.evaluatedAt) }}</el-descriptions-item>
                <el-descriptions-item label="有效期至">{{ utcText(row.expiresAt) }}</el-descriptions-item>
              </el-descriptions>
              <div v-if="scoreItems(row as PublishInventory).length" class="score-list">
                <div
                  v-for="item in scoreItems(row as PublishInventory)"
                  :key="item.name"
                  class="score-item"
                >
                  <span class="score-name">{{ item.name }}</span>
                  <el-progress :percentage="item.score" :stroke-width="10" class="score-bar" />
                  <span class="score-note">{{ item.note }}</span>
                </div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="优先分" width="90" align="center">
          <template #default="{ row }">
            <span class="score-num">{{ row.priorityScore ?? '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="封面" width="86">
          <template #default="{ row }">
            <el-image
              v-if="row.coverUrl"
              :src="row.coverUrl"
              :preview-src-list="[row.coverUrl]"
              fit="cover"
              class="cover-thumb"
              preview-teleported
            />
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="内容线" width="100">
          <template #default="{ row }">{{ bizLineText[row.bizLine] || row.bizLine }}</template>
        </el-table-column>
        <el-table-column label="时长" width="80" align="right">
          <template #default="{ row }">{{ Math.round((row.durationMs ?? 0) / 1000) }}s</template>
        </el-table-column>
        <el-table-column label="评估状态" width="90">
          <template #default="{ row }">
            <el-tag :type="curationTag[row.curationStatus] || 'info'">
              {{ curationText[row.curationStatus] || row.curationStatus }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="发布状态" width="90">
          <template #default="{ row }">
            <el-tag :type="publishTag[row.publishStatus] || 'info'" effect="plain">
              {{ publishText[row.publishStatus] || row.publishStatus }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="作品" prop="workId" min-width="150" show-overflow-tooltip />
        <el-table-column label="评估时间" width="160">
          <template #default="{ row }">{{ utcText(row.evaluatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.curationStatus === 'eligible' && row.publishStatus === 'waiting'"
              v-hasPermi="['heron:publish:publish']"
              link
              type="primary"
              :loading="reservingId === row.id"
              @click="handleReserve(row as PublishInventory)"
            >
              立即发布
            </el-button>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty :description="emptyText" />
        </template>
      </el-table>

      <pagination
        v-show="total > 0"
        v-model:page="queryParams.pageNum"
        v-model:limit="queryParams.pageSize"
        :total="total"
        @pagination="() => getList()"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts" name="PublishInventory">
import { listPublishInventory, reservePublishInventory } from '@/api/heron/publish';
import type { PublishInventory, PublishInventoryQuery } from '@/api/heron/publish/types';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;

const loading = ref(true);
const rows = ref<PublishInventory[]>([]);
const total = ref(0);
const reservingId = ref('');
const queryParams = ref<PublishInventoryQuery>({ pageNum: 1, pageSize: 10, curationStatus: 'eligible' });

const bizLineText: Record<string, string> = {
  news_explainer: '文稿解说',
  data_board: '数据看板',
  trend_insight: '趋势洞察',
  knowledge_explainer: '知识解释',
  music_video: '音乐视频'
};
const curationText: Record<string, string> = {
  pending: '待评估',
  eligible: '合格',
  hold: '暂缓',
  rejected: '淘汰',
  expired: '过期'
};
const curationTag: Record<string, 'primary' | 'success' | 'info' | 'warning' | 'danger'> = {
  eligible: 'success',
  hold: 'warning',
  rejected: 'danger'
};
const publishText: Record<string, string> = {
  waiting: '待发布',
  reserved: '已预占',
  publishing: '发布中',
  unknown: '待核对',
  published: '已发布',
  withdrawn: '已撤回',
  superseded: '已替代'
};
const publishTag: Record<string, 'primary' | 'success' | 'info' | 'warning' | 'danger'> = {
  waiting: 'info',
  reserved: 'warning',
  publishing: 'warning',
  published: 'success',
  unknown: 'danger'
};
const emptyText = computed(
  () => (queryParams.value.curationStatus === 'eligible' ? '库存暂无合格条目，宁缺毋滥' : '暂无记录')
);

const getList = async () => {
  loading.value = true;
  try {
    const { data } = await listPublishInventory(queryParams.value);
    rows.value = data.rows;
    total.value = data.total;
  } finally {
    loading.value = false;
  }
};

const handleQuery = () => {
  queryParams.value.pageNum = 1;
  getList();
};

const handleReserve = async (row: PublishInventory) => {
  reservingId.value = row.id;
  try {
    await reservePublishInventory(row.id);
    await proxy?.$modal.msgSuccess('已预占并提交发布链');
    await getList();
  } catch (e) {
    await getList();
  } finally {
    reservingId.value = '';
  }
};

const scoreItems = (row: PublishInventory): { name: string; score: number; note: string }[] => {
  if (!row.scoreBreakdown) return [];
  try {
    const parsed = JSON.parse(row.scoreBreakdown) as Record<string, { score: number; note?: string }>;
    return Object.entries(parsed).map(([name, item]) => ({
      name,
      score: Math.max(0, Math.min(100, item.score ?? 0)),
      note: item.note || ''
    }));
  } catch {
    return [];
  }
};

const utcText = (value?: string | null): string => (value ? new Date(value).toLocaleString() : '-');

onMounted(() => {
  getList();
});
</script>

<style scoped>
.cover-thumb {
  width: 48px;
  height: 85px;
  border-radius: 4px;
  overflow: hidden;
}
.score-num {
  font-size: 20px;
  font-weight: 700;
}
.score-detail {
  padding: 8px 16px;
}
.score-list {
  margin-top: 12px;
  display: grid;
  gap: 8px;
}
.score-item {
  display: grid;
  grid-template-columns: 120px 1fr 220px;
  align-items: center;
  gap: 12px;
}
.score-name {
  font-weight: 600;
}
.score-bar {
  flex: 1;
}
.score-note {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
</style>
