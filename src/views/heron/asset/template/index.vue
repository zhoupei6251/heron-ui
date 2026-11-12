<template>
  <div class="p-2 app-container heron-template-page">
    <el-card shadow="hover" class="toolbar-panel">
      <div class="template-toolbar">
        <div class="table-heading">
          <h3>视频模板</h3>
          <p>
            模板是 <code>data/templates</code> 下带 <code>LOCK.json</code> 的目录，不是数据库记录；加模板仍然是加目录。
            资产锁由模板自带，谁改模板谁重新生成 LOCK——这里只读。
          </p>
        </div>
        <el-button icon="Refresh" :loading="loading" @click="getList">刷新</el-button>
      </div>
    </el-card>

    <div v-loading="loading" class="template-grid">
      <article v-for="item in templates" :key="item.key" class="template-card" :class="{ 'is-broken': !item.locked }">
        <header class="card-head">
          <span class="template-key">{{ item.key }}</span>
          <el-tag :type="item.locked ? 'success' : 'danger'" effect="plain" size="small">
            {{ item.locked ? 'LOCK 有效' : 'LOCK 异常' }}
          </el-tag>
        </header>
        <h3 class="template-name">{{ item.name }}</h3>
        <p class="template-desc">{{ item.description || '（模板未写描述）' }}</p>
        <dl v-if="item.locked" class="template-meta">
          <div><dt>版本</dt><dd class="mono">{{ item.templateVersion || '-' }}</dd></div>
          <div><dt>音色</dt><dd class="mono">{{ item.voiceKey || '-' }}</dd></div>
          <div><dt>画幅</dt><dd class="mono">{{ item.aspectRatio || '-' }}</dd></div>
          <div>
            <dt>推荐时长</dt>
            <dd class="mono">
              {{ item.minDuration ?? '-' }}–{{ item.maxDuration ?? '-' }} 秒
            </dd>
          </div>
          <div><dt>资产指纹</dt><dd class="mono">{{ short(item.assetManifestSha256) }}</dd></div>
        </dl>
        <div v-if="item.locked" class="template-scenes">
          <span class="scenes-label">支持场景</span>
          <span class="scenes-tags">
            <el-tag
              v-for="scene in item.supportedSceneTypes || []"
              :key="scene"
              size="small"
              effect="plain"
              :type="scene === 'image' ? 'success' : 'info'"
            >
              {{ scene }}
            </el-tag>
            <span v-if="!(item.supportedSceneTypes || []).length" class="no-scenes">未声明</span>
          </span>
        </div>
        <el-alert v-else :closable="false" type="error" :title="item.lockProblem || 'LOCK.json 不可用'" />
      </article>

      <el-empty v-if="!loading && !templates.length" class="template-empty" description="模板目录为空，或文章线未开启" />
    </div>
  </div>
</template>

<script setup name="HeronTemplate" lang="ts">
import type { VideoTemplate } from '@/api/heron/template/types';
import { listVideoTemplate } from '@/api/heron/template';

const templates = ref<VideoTemplate[]>([]);
const loading = ref(true);

const short = (value?: string) => (value ? value.slice(0, 16) + '…' : '-');

const getList = async () => {
  loading.value = true;
  try {
    const res = await listVideoTemplate();
    templates.value = res.data || [];
  } finally {
    loading.value = false;
  }
};

onMounted(getList);
</script>

<style lang="scss" scoped>
.heron-template-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.toolbar-panel {
  border: 1px solid var(--app-surface-border);
}

.template-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.table-heading h3 {
  margin: 0 0 4px;
  color: var(--app-text-title);
  font-size: var(--app-font-size-lg);
  font-weight: 600;
}

.table-heading p {
  margin: 0;
  max-width: 760px;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: 1.7;
}

.table-heading code {
  padding: 1px 5px;
  border: 1px solid var(--app-surface-border);
  border-radius: 4px;
  background: var(--app-surface-sunken);
  font-family: var(--app-font-mono);
  font-size: var(--app-font-size-2xs);
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
  min-height: 140px;
}

.template-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  border: 1px solid var(--app-surface-border);
  border-radius: var(--app-radius-base);
  background: var(--app-surface-bg);

  &.is-broken {
    border-color: var(--app-danger);
  }
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.template-key {
  color: var(--app-text-faint);
  font-family: var(--app-font-mono);
  font-size: var(--app-font-size-2xs);
}

.template-name {
  margin: 0;
  color: var(--app-text-title);
  font-size: var(--app-font-size-base);
  font-weight: 600;
}

.template-desc {
  margin: 0;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: 1.7;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.template-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 4px 0 0;
  padding-top: 8px;
  border-top: 1px solid var(--app-surface-border);
  font-size: var(--app-font-size-xs);

  div {
    display: flex;
    justify-content: space-between;
    gap: 12px;
  }

  dt {
    color: var(--app-text-faint);
  }

  dd {
    margin: 0;
    color: var(--app-text-body);
  }
}

.mono {
  font-family: var(--app-font-mono);
  font-size: var(--app-font-size-2xs);
}

.template-scenes {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--app-surface-border);
}

.scenes-label {
  flex-shrink: 0;
  color: var(--app-text-faint);
  font-size: var(--app-font-size-2xs);
}

.scenes-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.no-scenes {
  color: var(--app-text-faint);
  font-size: var(--app-font-size-2xs);
}

.template-empty {
  grid-column: 1 / -1;
}
</style>
