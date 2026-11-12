<template>
  <div class="error-page">
    <div class="error-panel">
      <span class="error-code">401</span>
      <span class="eyebrow">Unauthorized</span>
      <h1>没有访问权限</h1>
      <p>当前账号无权访问这个页面。如果你认为这是配置问题，请联系管理员调整角色权限。</p>
      <div class="error-actions">
        <router-link to="/" class="error-primary">返回工作台</router-link>
        <button type="button" class="error-secondary" @click="back">返回上一页</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

function back() {
  if (route.query.noGoBack) {
    router.push({ path: '/' });
  } else {
    router.go(-1);
  }
}
</script>

<style lang="scss" scoped>
.error-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 70vh;
  padding: 24px;
}

.error-panel {
  width: min(520px, 100%);
  padding: 40px 36px;
  border: 1px solid var(--app-surface-border);
  border-top: 2px solid var(--app-warning);
  border-radius: var(--app-radius-base);
  background: var(--app-surface-bg);
}

.error-code {
  display: block;
  color: var(--app-warning);
  font-family: var(--app-font-mono);
  font-size: 64px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  letter-spacing: -0.03em;
}

.eyebrow {
  display: block;
  margin-top: 12px;
  color: var(--app-text-faint);
  font-family: var(--app-font-mono);
  font-size: var(--app-font-size-2xs);
  font-weight: 600;
  letter-spacing: var(--app-tracking-eyebrow);
  text-transform: uppercase;
}

h1 {
  margin: 8px 0 10px;
  color: var(--app-text-title);
  font-size: var(--app-font-size-xl);
  font-weight: 600;
  letter-spacing: -0.01em;
}

p {
  margin: 0;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
  line-height: 1.8;
}

.error-actions {
  display: flex;
  gap: 10px;
  margin-top: 28px;
}

.error-primary,
.error-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  padding: 0 18px;
  border-radius: 8px;
  font-size: var(--app-font-size-sm);
  font-weight: 500;
  cursor: pointer;
  transition:
    background-color var(--app-duration-fast) var(--app-ease),
    border-color var(--app-duration-fast) var(--app-ease);
}

.error-primary {
  border: 1px solid var(--app-accent-strong);
  background: var(--app-accent-strong);
  color: var(--app-text-on-accent);

  &:hover {
    background: var(--heron-ink-500);
    border-color: var(--heron-ink-500);
  }
}

.error-secondary {
  border: 1px solid var(--app-surface-border);
  background: var(--app-surface-bg);
  color: var(--app-text-body);

  &:hover {
    border-color: var(--app-accent-border);
    background: var(--app-accent-soft);
    color: var(--app-accent-strong);
  }
}
</style>
