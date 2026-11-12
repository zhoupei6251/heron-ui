<template>
  <div class="p-2 heron-home">
    <section class="home-hero">
      <div class="hero-copy">
        <span class="eyebrow">Heron Workspace</span>
        <h1>工作台</h1>
        <p>{{ greeting }}，{{ nickname }}。今天要处理的事情都在下面。</p>
      </div>
      <div class="hero-meta">
        <div class="meta-item">
          <span>今天</span>
          <strong>{{ today }}</strong>
        </div>
      </div>
    </section>

    <section class="home-stats">
      <router-link v-for="stat in stats" :key="stat.key" :to="stat.to" class="stat-cell">
        <span class="stat-label">{{ stat.label }}</span>
        <strong class="stat-value" :class="{ 'is-alert': stat.alert }">{{ stat.value }}</strong>
        <span class="stat-hint">{{ stat.hint }}</span>
      </router-link>
    </section>

    <el-alert v-if="autoPaused" class="auto-bar" type="warning" :closable="false" show-icon>
      <template #title>自动生产已暂停：槽位不会产出新内容</template>
      <el-button
        v-hasPermi="['heron:newsWork:review']"
        link
        type="primary"
        :loading="resuming"
        @click="handleResume"
      >
        恢复自动生产
      </el-button>
    </el-alert>
    <el-alert v-else-if="autoStatus && !autoStatus.enabled" class="auto-bar" type="info" :closable="false" show-icon>
      <template #title>自动生产未开启</template>
      当前只在人工触发时产出；开关在部署配置里，不在这个页面。
    </el-alert>

    <section class="home-section">
      <header class="section-head">
        <div>
          <span class="eyebrow">Needs You</span>
          <h2>待我处理</h2>
        </div>
        <span class="section-meta">{{ needs.length }} 件</span>
      </header>

      <ul v-if="needs.length" class="needs-list">
        <li v-for="item in needs" :key="item.key" class="need-item" :class="`is-${item.level}`">
          <span class="need-badge">{{ item.badge }}</span>
          <span class="need-body">
            <strong>{{ item.title }}</strong>
            <span class="need-detail">{{ item.detail }}</span>
          </span>
          <router-link :to="item.to" class="need-link">处理</router-link>
        </li>
      </ul>
      <p v-else class="needs-empty">没有需要人工介入的事项。</p>
    </section>

    <section class="home-section">
      <header class="section-head">
        <div>
          <span class="eyebrow">Quick Access</span>
          <h2>快速入口</h2>
        </div>
        <span class="section-meta">{{ entries.length }} 个模块</span>
      </header>

      <div v-if="entries.length" class="entry-grid">
        <router-link v-for="entry in entries" :key="entry.path" :to="entry.path" class="entry-card">
          <span class="entry-icon">
            <svg-icon v-if="entry.icon && entry.icon !== '#'" :icon-class="entry.icon" />
            <span v-else class="entry-monogram">{{ entry.title.slice(0, 1) }}</span>
          </span>
          <span class="entry-body">
            <strong>{{ entry.title }}</strong>
            <span class="entry-path">{{ entry.path }}</span>
          </span>
          <span class="entry-arrow" aria-hidden="true">→</span>
        </router-link>
      </div>

      <el-empty v-else description="当前账号还没有可访问的模块，请联系管理员分配权限" />
    </section>
  </div>
</template>

<script setup name="Index" lang="ts">
import type { ProductionTask } from '@/api/heron/production/types';
import type { NewsSource } from '@/api/heron/newsSource/types';
import type { AutoStatus } from '@/api/heron/auto';
import { listNewsCandidate } from '@/api/heron/newsCandidate';
import { listNewsWork } from '@/api/heron/newsWork';
import { listProduction } from '@/api/heron/production';
import { listNewsSource } from '@/api/heron/newsSource';
import { getAutoStatus, resumeAuto } from '@/api/heron/auto';
import { usePermissionStore } from '@/store/modules/permission';
import { useUserStore } from '@/store/modules/user';
import modal from '@/plugins/modal';
import { utcText } from '@/views/heron/heron-time';

const permissionStore = usePermissionStore();
const userStore = useUserStore();

const nickname = computed(() => userStore.nickname || '管理员');
const greeting = computed(() => {
  const hour = new Date().getHours();
  if (hour < 6) return '凌晨好';
  if (hour < 12) return '上午好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
});
const today = new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' });

/** 首页数字全部来自现有列表接口的 total，没有聚合接口前不编造「今日」口径。 */
const unclaimedTopics = ref<number>();
const workTotal = ref<number>();
const runningTasks = ref<number>();
const failedTasks = ref<ProductionTask[]>([]);
const failedTaskTotal = ref(0);
const failingSources = ref<NewsSource[]>([]);
const autoStatus = ref<AutoStatus>();
const resuming = ref(false);

const autoPaused = computed(() => Boolean(autoStatus.value?.paused));

type Stat = { key: string; label: string; value: string; hint: string; to: string; alert?: boolean };

const show = (value?: number) => (value === undefined ? '—' : String(value));

const stats = computed<Stat[]>(() => [
  {
    key: 'topics',
    label: '待认领选题',
    value: show(unclaimedTopics.value),
    hint: '选题雷达',
    to: '/heron/topic'
  },
  {
    key: 'works',
    label: '作品总数',
    value: show(workTotal.value),
    hint: '视频作品',
    to: '/heron/work'
  },
  {
    key: 'running',
    label: '运行中任务',
    value: show(runningTasks.value),
    hint: '生产任务',
    to: '/heron/production'
  },
  {
    key: 'failed',
    label: '失败任务',
    value: show(failedTaskTotal.value),
    hint: '需要排查',
    to: '/heron/production',
    alert: failedTaskTotal.value > 0
  }
]);

type Need = { key: string; badge: string; title: string; detail: string; to: string; level: 'error' | 'warning' };

const needs = computed<Need[]>(() => {
  const items: Need[] = [];
  failedTasks.value.forEach(task => {
    items.push({
      key: `task-${task.taskId}`,
      badge: '任务失败',
      title: `${task.bizType === 'news_video' ? '新闻' : '原型'} ${task.taskId}`,
      detail: [task.stage ? `阶段 ${task.stage}` : '', task.errorCode || '', task.errorReason || '']
        .filter(Boolean)
        .join(' · '),
      to: '/heron/production',
      level: 'error'
    });
  });
  failingSources.value.forEach(source => {
    items.push({
      key: `source-${source.sourceId}`,
      badge: '来源失败',
      title: source.name,
      detail: `连续失败 ${source.failureCount} 次${source.errorCode ? ' · ' + source.errorCode : ''}${
        source.lastAttemptAt ? ' · 最近 ' + utcText(source.lastAttemptAt) : ''
      }`,
      to: '/heron/newsSource',
      level: 'warning'
    });
  });
  return items;
});

/** 单个接口失败不影响其余区块：首页是只读看板，不该因为一处 500 就整页空白。 */
const loadDashboard = async () => {
  const [topics, works, running, failed, sources, auto] = await Promise.allSettled([
    listNewsCandidate({ pageNum: 1, pageSize: 1, claimed: false }),
    listNewsWork({ pageNum: 1, pageSize: 1 }),
    listProduction({ pageNum: 1, pageSize: 1, status: 'running' }),
    listProduction({ pageNum: 1, pageSize: 5, status: 'failed' }),
    listNewsSource({ pageNum: 1, pageSize: 50 }),
    getAutoStatus()
  ]);

  if (topics.status === 'fulfilled') unclaimedTopics.value = topics.value.data?.total || 0;
  if (works.status === 'fulfilled') workTotal.value = works.value.data?.total || 0;
  if (running.status === 'fulfilled') runningTasks.value = running.value.data?.total || 0;
  if (failed.status === 'fulfilled') {
    failedTasks.value = failed.value.data?.rows || [];
    failedTaskTotal.value = failed.value.data?.total || 0;
  }
  if (sources.status === 'fulfilled') {
    failingSources.value = (sources.value.data?.rows || []).filter(source => source.failureCount > 0).slice(0, 5);
  }
  if (auto.status === 'fulfilled') autoStatus.value = auto.value.data;
};

const handleResume = async () => {
  resuming.value = true;
  try {
    await resumeAuto();
    modal.msgSuccess('已恢复自动生产');
    await loadDashboard();
  } finally {
    resuming.value = false;
  }
};

type Entry = { title: string; path: string; icon?: string };
type MenuRoute = {
  path: string;
  children?: MenuRoute[];
  meta?: { hidden?: boolean; title?: string; icon?: string };
};

const joinPath = (base: string, child: string) =>
  child.startsWith('/') ? child : `${base.replace(/\/$/, '')}/${child.replace(/^\//, '')}`;

const resolvePath = (route: MenuRoute): string | undefined => {
  const child = route.children?.find(item => !item.meta?.hidden);
  if (!child) {
    return route.path;
  }
  // 外链子菜单原样返回，交给外层按 http(s) 过滤，别拼成 /parent/http://…
  return /^https?:/i.test(child.path) ? child.path : joinPath(route.path, child.path);
};

const entries = computed<Entry[]>(() =>
  (permissionStore.sidebarRouters as unknown as MenuRoute[])
    .filter(route => !route.meta?.hidden && route.meta?.title)
    .map(route => ({
      title: route.meta?.title || '',
      path: resolvePath(route) || route.path,
      icon: route.meta?.icon
    }))
    .filter(entry => entry.path && entry.path !== '/' && !/^https?:/i.test(entry.path))
);

onMounted(() => {
  void loadDashboard();
});
</script>

<style lang="scss" scoped>
.heron-home {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.home-hero,
.home-section,
.home-stats {
  border: 1px solid var(--app-surface-border);
  border-radius: var(--app-radius-base);
  background: var(--app-surface-bg);
}

.home-hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 32px;
  padding: 24px 24px 20px;
  border-top: 2px solid var(--app-accent-strong);
}

.eyebrow {
  display: block;
  color: var(--app-accent-strong);
  font-family: var(--app-font-mono);
  font-size: var(--app-font-size-2xs);
  font-weight: 600;
  letter-spacing: var(--app-tracking-eyebrow);
  text-transform: uppercase;
}

.hero-copy h1 {
  margin: 8px 0 6px;
  color: var(--app-text-title);
  font-size: var(--app-font-size-2xl);
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.hero-copy p {
  margin: 0;
  max-width: 560px;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
  line-height: 1.7;
}

.hero-meta {
  flex-shrink: 0;
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-left: 16px;
  border-left: 1px solid var(--app-surface-border);

  span {
    color: var(--app-text-muted);
    font-size: var(--app-font-size-2xs);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  strong {
    color: var(--app-text-title);
    font-size: var(--app-font-size-lg);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
}

.home-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1px;
  background: var(--app-surface-border);
  overflow: hidden;
}

.stat-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px 20px;
  background: var(--app-surface-bg);
  color: inherit;
  transition: background-color var(--app-duration-fast) var(--app-ease);

  &:hover {
    background: var(--app-accent-softer);
  }
}

.stat-label {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.stat-value {
  color: var(--app-text-title);
  font-family: var(--app-font-mono);
  font-size: var(--app-font-size-2xl);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;

  &.is-alert {
    color: var(--app-danger);
  }
}

.stat-hint {
  color: var(--app-text-faint);
  font-size: var(--app-font-size-2xs);
}

.auto-bar {
  margin: 0;
}

.home-section {
  padding: 20px 24px 24px;
}

.section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 14px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--app-surface-border);

  h2 {
    margin: 6px 0 0;
    color: var(--app-text-title);
    font-size: var(--app-font-size-lg);
    font-weight: 600;
  }
}

.section-meta {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  font-variant-numeric: tabular-nums;
}

.needs-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 1px;
  border: 1px solid var(--app-surface-border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--app-surface-border);
}

.need-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--app-surface-bg);

  &.is-error .need-badge {
    color: var(--app-danger);
    background: var(--app-danger-soft);
    border-color: transparent;
  }

  &.is-warning .need-badge {
    color: var(--app-warning);
    background: var(--app-warning-soft);
    border-color: transparent;
  }
}

.need-badge {
  flex-shrink: 0;
  padding: 2px 8px;
  border: 1px solid var(--app-surface-border);
  border-radius: 6px;
  font-size: var(--app-font-size-2xs);
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.need-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;

  strong {
    color: var(--app-text-title);
    font-size: var(--app-font-size-sm);
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.need-detail {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.need-link {
  flex-shrink: 0;
  color: var(--app-accent-strong);
  font-size: var(--app-font-size-xs);
}

.needs-empty {
  margin: 0;
  color: var(--app-text-faint);
  font-size: var(--app-font-size-sm);
}

.entry-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1px;
  background: var(--app-surface-border);
  border: 1px solid var(--app-surface-border);
  border-radius: var(--app-radius-base);
  overflow: hidden;
}

.entry-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--app-surface-bg);
  color: inherit;
  transition:
    background-color var(--app-duration-fast) var(--app-ease),
    color var(--app-duration-fast) var(--app-ease);

  &:hover {
    background: var(--app-accent-softer);

    .entry-arrow {
      transform: translateX(3px);
      color: var(--app-accent-strong);
    }
  }
}

.entry-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  border: 1px solid var(--app-surface-border);
  border-radius: 8px;
  background: var(--app-surface-sunken);
  color: var(--app-accent-strong);
  font-size: 15px;
}

.entry-monogram {
  font-family: var(--app-font-mono);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.entry-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;

  strong {
    color: var(--app-text-title);
    font-size: var(--app-font-size-sm);
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.entry-path {
  color: var(--app-text-faint);
  font-family: var(--app-font-mono);
  font-size: var(--app-font-size-2xs);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.entry-arrow {
  margin-left: auto;
  color: var(--app-text-faint);
  transition:
    transform var(--app-duration-fast) var(--app-ease),
    color var(--app-duration-fast) var(--app-ease);
}

@media (max-width: 900px) {
  .home-hero {
    flex-direction: column;
    align-items: flex-start;
    gap: 20px;
  }
}

@media (max-width: 560px) {
  .entry-grid {
    grid-template-columns: 1fr;
  }
}
</style>
