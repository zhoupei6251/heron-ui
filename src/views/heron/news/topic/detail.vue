<template>
  <div class="p-2 app-container heron-topic-detail-page">
    <el-card shadow="hover" class="detail-panel">
      <div class="detail-bar">
        <el-button link icon="ArrowLeft" @click="goBack">返回选题雷达</el-button>
        <div class="detail-actions">
          <el-button
            v-hasPermi="['heron:newsCandidate:claim']"
            type="primary"
            :loading="claiming"
            :disabled="!detail || Boolean(detail.claimedAt)"
            @click="handleClaim"
          >
            {{ detail?.claimedAt ? '已认领' : '认领并开始创作' }}
          </el-button>
        </div>
      </div>

      <el-skeleton v-if="loading" :rows="6" animated />

      <el-empty v-else-if="!detail" description="这条选题不存在，或已被清理" />

      <template v-else>
        <header class="detail-head">
          <h1 class="detail-title">{{ detail.title }}</h1>
          <div class="detail-tags">
            <el-tag v-if="detail.claimedAt" size="small" type="success" effect="plain">已认领</el-tag>
            <el-tag v-if="detail.publishedAt" size="small" type="info" effect="plain">已发布</el-tag>
            <el-tag size="small" effect="plain" :type="hasBody ? 'success' : 'info'">
              {{ hasBody ? '有正文来源' : '仅热榜标题' }}
            </el-tag>
          </div>
        </header>

        <section class="detail-section">
          <h2 class="section-title">事实摘要</h2>
          <p class="detail-summary">{{ plainText(detail.summary) || '（无摘要）' }}</p>
        </section>

        <section class="detail-section">
          <h2 class="section-title">时间线</h2>
          <dl class="detail-metrics">
            <div class="metric">
              <dt>首次出现</dt>
              <dd class="num">{{ timeText(detail.firstSeenAt) }}</dd>
            </div>
            <div class="metric">
              <dt>最新出现</dt>
              <dd class="num">{{ timeText(detail.lastSeenAt) }}</dd>
            </div>
            <div class="metric">
              <dt>命中来源</dt>
              <dd class="num">{{ detail.hitCount ?? '-' }}</dd>
            </div>
            <div class="metric">
              <dt>热度</dt>
              <dd class="num">{{ detail.heatScore ?? '-' }}</dd>
            </div>
            <div class="metric">
              <dt>最佳排名</dt>
              <dd class="num">{{ detail.bestRank == null ? '-' : '#' + detail.bestRank }}</dd>
            </div>
          </dl>
        </section>

        <section class="detail-section">
          <h2 class="section-title">来源证据 <span class="section-count">{{ evidenceItems.length }} 条</span></h2>
          <el-table :data="evidenceItems" border class="data-table">
            <el-table-column label="来源" width="140">
              <template #default="{ row }">{{ row.manual ? '手工录入' : row.sourceId || '-' }}</template>
            </el-table-column>
            <el-table-column label="原文链接" min-width="260" show-overflow-tooltip>
              <template #default="{ row }">
                <a v-if="row.sourceUrl" :href="row.sourceUrl" target="_blank" rel="noopener noreferrer">
                  {{ row.sourceUrl }}
                </a>
                <span v-else class="muted">无链接（热榜来源只给标题）</span>
              </template>
            </el-table-column>
            <el-table-column label="抓取时间" width="170" align="center">
              <template #default="{ row }">{{ timeText(row.fetchedAt) }}</template>
            </el-table-column>
            <el-table-column label="内容指纹" width="180">
              <template #default="{ row }">
                <span class="sha-text">{{ row.contentSha256 ? row.contentSha256.slice(0, 16) + '…' : '-' }}</span>
              </template>
            </el-table-column>
          </el-table>
          <el-alert
            v-if="evidenceTruncated"
            class="mt-2"
            type="warning"
            :closable="false"
            title="证据条目过多，已丢弃中间条目以保留首条与最新一条"
          />
        </section>
      </template>
    </el-card>
  </div>
</template>

<script setup name="HeronTopicDetail" lang="ts">
import type { NewsCandidate } from '@/api/heron/newsCandidate/types';
import { claimNewsCandidate, getNewsCandidate } from '@/api/heron/newsCandidate';
import modal from '@/plugins/modal';
import { utcText } from '../../heron-time';
import { plainText } from '../../heron-text';

interface EvidenceItem {
  sourceId?: string | number;
  sourceUrl?: string;
  manual?: boolean;
  fetchedAt?: string;
  contentSha256?: string;
}

const route = useRoute();
const router = useRouter();
const detail = ref<NewsCandidate>();
const claiming = ref(false);
const loading = ref(true);

const timeText = utcText;

const evidenceItems = computed<EvidenceItem[]>(() => {
  if (!detail.value?.evidence) return [];
  try {
    const items: unknown = (JSON.parse(detail.value.evidence) as { items?: unknown }).items;
    return Array.isArray(items) ? (items as EvidenceItem[]) : [];
  } catch {
    return [];
  }
});

const evidenceTruncated = computed(() => {
  try {
    return Boolean((JSON.parse(detail.value?.evidence || '{}') as { evidenceTruncated?: boolean }).evidenceTruncated);
  } catch {
    return false;
  }
});

const hasBody = computed(() => evidenceItems.value.some(item => Boolean(item.sourceUrl)));

const goBack = () => {
  router.push('/heron/topic');
};

const load = async () => {
  const candidateId = String(route.query.candidateId || '');
  if (!candidateId) {
    detail.value = undefined;
    loading.value = false;
    return;
  }
  loading.value = true;
  try {
    const res = await getNewsCandidate(candidateId);
    detail.value = res.data;
  } finally {
    loading.value = false;
  }
};

const handleClaim = async () => {
  if (!detail.value) return;
  claiming.value = true;
  try {
    const res = await claimNewsCandidate(detail.value.candidateId);
    modal.msgSuccess('已认领，可在视频作品里继续编辑');
    if (res.data?.workId) {
      router.push({ path: '/heron/work-studio', query: { workId: res.data.workId } });
    } else {
      await load();
    }
  } finally {
    claiming.value = false;
  }
};

watch(() => route.query.candidateId, load, { immediate: true });
</script>

<style lang="scss" scoped>
.detail-panel {
  border: 1px solid var(--app-surface-border);
  max-width: 1200px;
}

.detail-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--app-surface-border);
}

.detail-head {
  padding: 20px 0 4px;
}

.detail-title {
  margin: 0 0 10px;
  color: var(--app-text-title);
  font-size: var(--app-font-size-2xl);
  font-weight: 600;
  line-height: 1.35;
  letter-spacing: -0.01em;
}

.detail-tags {
  display: flex;
  gap: 6px;
}

.detail-section {
  margin-top: 24px;
}

.section-title {
  margin: 0 0 10px;
  color: var(--app-text-title);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
  letter-spacing: 0.02em;
}

.section-count {
  margin-left: 6px;
  color: var(--app-text-faint);
  font-family: var(--app-font-mono);
  font-size: var(--app-font-size-2xs);
  font-weight: 400;
}

.detail-summary {
  margin: 0;
  padding: 14px 16px;
  border-left: 2px solid var(--app-accent-border);
  background: var(--app-surface-sunken);
  color: var(--app-text-body);
  font-size: var(--app-font-size-sm);
  line-height: 1.9;
  white-space: pre-wrap;
}

.detail-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 1px;
  margin: 0;
  padding: 0;
  border: 1px solid var(--app-surface-border);
  border-radius: 8px;
  background: var(--app-surface-border);
  overflow: hidden;
}

.metric {
  padding: 10px 14px;
  background: var(--app-surface-sunken);

  dt {
    color: var(--app-text-faint);
    font-size: var(--app-font-size-2xs);
    letter-spacing: 0.04em;
  }

  dd {
    margin: 3px 0 0;
  }
}

.num {
  color: var(--app-text-title);
  font-family: var(--app-font-mono);
  font-size: var(--app-font-size-sm);
  font-variant-numeric: tabular-nums;
}

.sha-text {
  font-family: var(--app-font-mono);
  font-size: var(--app-font-size-2xs);
  color: var(--app-text-muted);
}

.muted {
  color: var(--app-text-faint);
  font-size: var(--app-font-size-xs);
}

.detail-actions {
  display: flex;
  gap: 8px;
}
</style>
