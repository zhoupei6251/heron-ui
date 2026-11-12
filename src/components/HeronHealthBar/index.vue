<template>
  <div v-if="visible && health" class="health-bar" :class="{ 'is-stale': stale }">
    <span class="health-dot" />
    <strong class="health-state">{{ stale ? '采集可能已中断' : '采集正常' }}</strong>
    <span class="health-item">
      上次成功 {{ relative }}<template v-if="health.lastSuccessSource">（{{ health.lastSuccessSource }}）</template>
    </span>
    <span class="health-sep" />
    <span class="health-item">今日候选 <b>{{ health.todayCandidates }}</b></span>
    <span class="health-item">任务 <b>{{ health.todayTasks }}</b></span>
    <span class="health-item" :class="{ 'is-bad': health.todayFailed > 0 }">失败 <b>{{ health.todayFailed }}</b></span>
    <span class="health-sep" />
    <span class="health-item">本月 <b>{{ health.monthTasks }}</b> 条</span>
    <span class="health-item">token {{ short(health.monthInputTokens) }} 入 / {{ short(health.monthOutputTokens) }} 出</span>
    <template v-if="autoStatus?.enabled">
      <span class="health-sep" />
      <span class="health-item" :class="{ 'is-bad': autoStatus.paused }">
        自动产出 <b>{{ autoStatus.paused ? '已暂停' : '运行中' }}</b>
      </span>
      <button type="button" class="health-action" :disabled="autoBusy" @click="toggleAuto">
        {{ autoStatus.paused ? '恢复' : '暂停' }}
      </button>
    </template>
    <span v-if="stale && health.lastErrorReason" class="health-error" :title="health.lastErrorReason">
      {{ health.lastErrorSource }}：{{ health.lastErrorReason }}
    </span>
  </div>
</template>

<script setup name="HeronHealthBar" lang="ts">
import { getHeronHealth } from '@/api/heron/health';
import type { HeronHealth } from '@/api/heron/health/types';
import { getAutoStatus, pauseAuto, resumeAuto } from '@/api/heron/auto';
import type { AutoStatus } from '@/api/heron/auto';

const POLL_MS = 60_000;
// 超过这个时长没有成功采集就认为线断了：日更三条的节奏下，6 小时足够暴露问题
const STALE_HOURS = 6;

const health = ref<HeronHealth>();
const autoStatus = ref<AutoStatus>();
const autoBusy = ref(false);
const visible = ref(true);
let timer: number | undefined;

const load = async () => {
  try {
    const res = await getHeronHealth();
    health.value = res.data;
    visible.value = true;
  } catch {
    // 无生产查询权限或后端不可用时整条隐藏：状态条不该变成第二个错误提示
    visible.value = false;
    return;
  }
  try {
    autoStatus.value = (await getAutoStatus()).data;
  } catch {
    autoStatus.value = undefined;
  }
};

const toggleAuto = async () => {
  if (!autoStatus.value || autoBusy.value) {
    return;
  }
  autoBusy.value = true;
  try {
    if (autoStatus.value.paused) {
      await resumeAuto();
    } else {
      await pauseAuto();
    }
    await load();
  } finally {
    autoBusy.value = false;
  }
};

onMounted(() => {
  void load();
  timer = window.setInterval(() => void load(), POLL_MS);
});

onBeforeUnmount(() => {
  if (timer) {
    window.clearInterval(timer);
  }
});

// 服务端写的是 UTC 墙钟（Clock.systemUTC），naive 字符串必须补 Z 再按本地时区算差值
const parseTime = (value?: string) => {
  if (!value) {
    return 0;
  }
  const naive = value.slice(0, 19).replace(' ', 'T');
  return new Date(naive.endsWith('Z') || naive.includes('+') ? naive : `${naive}Z`).getTime();
};

const stale = computed(() => {
  const at = parseTime(health.value?.lastSuccessAt);
  return !at || Date.now() - at > STALE_HOURS * 3600_000;
});

const relative = computed(() => {
  const at = parseTime(health.value?.lastSuccessAt);
  if (!at) {
    return '从未成功';
  }
  const minutes = Math.floor((Date.now() - at) / 60_000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
});

const short = (value: number) => (value >= 10000 ? `${(value / 10000).toFixed(1)} 万` : String(value));
</script>

<style lang="scss" scoped>
.health-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 0 14px;
  height: 32px;
  border-top: 1px solid var(--app-surface-border);
  background: var(--app-surface-bg);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-2xs);
  font-variant-numeric: tabular-nums;
}

.health-dot {
  width: 6px;
  height: 6px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--app-success);
}

.health-state {
  color: var(--app-text-title);
  font-size: var(--app-font-size-xs);
  font-weight: 600;
}

.health-item b {
  color: var(--app-text-body);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.health-item.is-bad b {
  color: var(--app-danger);
}

.health-sep {
  width: 1px;
  height: 12px;
  background: var(--app-surface-border);
}

.health-error {
  max-width: 420px;
  overflow: hidden;
  color: var(--app-warning);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.health-action {
  padding: 2px 8px;
  border: 1px solid var(--app-surface-border);
  border-radius: 4px;
  background: var(--app-surface-bg);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-2xs);
  cursor: pointer;
  transition:
    border-color var(--app-duration-fast) var(--app-ease),
    color var(--app-duration-fast) var(--app-ease);

  &:hover:not(:disabled) {
    border-color: var(--app-accent-strong);
    color: var(--app-accent-strong);
  }

  &:disabled {
    cursor: default;
    opacity: 0.6;
  }
}

.is-stale {
  border-top-color: var(--app-warning);

  .health-dot {
    background: var(--app-warning);
  }
}

@media (max-width: 900px) {
  .health-bar {
    height: auto;
    padding: 6px 12px;
  }
}
</style>
