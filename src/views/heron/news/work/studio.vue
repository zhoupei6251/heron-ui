<template>
  <div class="p-2 app-container heron-work-studio-page">
    <div class="studio-bar">
      <el-button link icon="ArrowLeft" @click="goBack">返回视频作品</el-button>
      <div class="studio-bar-meta">
        <el-tag v-if="work?.currentVersion" :type="reviewTag[work.currentVersion.reviewStatus] || 'info'" size="small">
          v{{ work.currentVersion.versionNo }} ·
          {{ reviewText[work.currentVersion.reviewStatus] || work.currentVersion.reviewStatus }}
        </el-tag>
        <span class="revision-badge">修订 {{ work?.revision ?? '-' }}</span>
      </div>
    </div>

    <el-skeleton v-if="loading" :rows="8" animated />

    <el-empty v-else-if="!work" description="这个作品不存在，或你没有访问权限" />

    <template v-else>
      <h1 class="studio-title">{{ work.title }}</h1>

      <el-alert
        v-for="reason in capabilityReasons"
        :key="reason"
        class="mb-2"
        type="warning"
        :closable="false"
        :title="reason"
      />

      <el-alert
        v-if="liveTask"
        class="mb-2"
        :type="liveTask.status === 'failed' ? 'error' : liveTask.status === 'succeeded' ? 'success' : 'info'"
        :closable="false"
        show-icon
      >
        <template #title>
          {{ productionStatusText[liveTask.status] || liveTask.status }}
          <template v-if="liveTask.stage">　阶段 {{ liveTask.stage }}</template>
          <template v-if="liveTask.progress != null">　进度 {{ liveTask.progress }}%</template>
        </template>
        <div v-if="liveTask.errorReason" class="task-reason">{{ liveTask.errorReason }}</div>
        <el-button
          v-if="isProductionActive(liveTask.status)"
          v-hasPermi="['heron:production:cancel']"
          link
          type="warning"
          @click="handleCancelTask"
        >
          取消这次生成
        </el-button>
      </el-alert>

      <div class="studio-grid">
        <!-- 左栏：内容结构 -->
        <aside class="studio-col studio-col--left">
          <section class="col-block">
            <h3 class="block-title">01 选题资料</h3>
            <dl class="kv">
              <dt>候选</dt>
              <dd class="mono">{{ work.candidateId }}</dd>
              <dt>模板</dt>
              <dd class="mono">{{ draftForm.templateKey }}</dd>
              <dt>音色</dt>
              <dd class="mono">{{ draftForm.voiceKey }}</dd>
            </dl>
          </section>

          <section class="col-block">
            <h3 class="block-title">02 标题与口播稿</h3>
            <el-form ref="draftFormRef" :model="draftForm" :rules="draftRules" label-position="top" size="small">
              <el-form-item label="标题" prop="title">
                <el-input v-model="draftForm.title" maxlength="200" show-word-limit />
              </el-form-item>
              <el-form-item label="口播稿" prop="draft">
                <el-input v-model="draftForm.draft" type="textarea" :rows="10" maxlength="16000" show-word-limit />
              </el-form-item>
              <div class="row-actions">
                <el-button
                  v-hasPermi="['heron:newsWork:edit']"
                  :loading="savingDraft"
                  type="primary"
                  plain
                  size="small"
                  @click="handleSaveDraft"
                >
                  保存草稿
                </el-button>
                <span class="revision-tip">冲突会被后端拒绝</span>
              </div>
            </el-form>
          </section>

          <section class="col-block">
            <h3 class="block-title">03 版本历史</h3>
            <ul v-loading="versionLoading" class="version-list">
              <li
                v-for="row in versions"
                :key="row.id"
                :class="['version-item', { 'is-active': selected?.id === row.id }]"
                @click="selectVersion(row)"
              >
                <span class="version-no">v{{ row.versionNo }}</span>
                <span class="version-meta">
                  <el-tag :type="productionStatusTag[row.taskStatus || ''] || 'info'" size="small" effect="plain">
                    {{ productionStatusText[row.taskStatus || ''] || row.taskStatus || '-' }}
                  </el-tag>
                  <el-tag v-if="row.taskStatus === 'succeeded'" :type="reviewTag[row.reviewStatus] || 'info'"
                    size="small" effect="plain">
                    {{ reviewText[row.reviewStatus] || row.reviewStatus }}
                  </el-tag>
                </span>
                <span class="version-time">{{ timeText(row.createTime) }}</span>
              </li>
            </ul>
            <pagination
              v-show="versionTotal > 0"
              v-model:page="versionQuery.pageNum"
              v-model:limit="versionQuery.pageSize"
              :total="versionTotal"
              small
              layout="prev, pager, next"
              @pagination="loadVersions"
            />
          </section>
        </aside>

        <!-- 中栏：预览与编辑 -->
        <main class="studio-col studio-col--center">
          <section class="col-block">
            <h3 class="block-title">
              04 画面预览
              <span v-if="selected" class="block-hint">v{{ selected.versionNo }}</span>
            </h3>
            <template v-if="selected">
              <div class="preview-bar">
                <el-button size="small" :loading="previewLoading" @click="loadPreview('contact_sheet')">
                  九宫格
                </el-button>
                <el-button size="small" :loading="previewLoading" @click="loadPreview('mp4')">成片</el-button>
                <el-button size="small" link type="primary" @click="handleDownload(artifact('mp4')!)"
                  :disabled="selected.reviewStatus !== 'approved'">
                  正式下载
                </el-button>
              </div>
              <div v-if="previewUrl" class="preview-shell">
                <img v-if="previewKind === 'contact_sheet'" :src="previewUrl" alt="成片九宫格核对图" class="contact-sheet" />
                <video v-else ref="previewPlayer" :src="previewUrl" controls class="player"
                  @loadedmetadata="applyPendingSeek" @timeupdate="updatePlayhead" />
              </div>
              <p v-else class="muted">点上面的按钮加载预览。产物受登录态保护，不能直接拖进播放器。</p>
              <div v-if="reviewSegments.length" class="segment-review" aria-label="逐段审片">
                <h4>逐段审片 <span class="block-hint">点击时间定位，暂停核对画面</span></h4>
                <p v-if="subtitleLoading" class="muted" role="status">正在读取实际口播字幕…</p>
                <p v-else-if="subtitleError" class="muted" role="status">{{ subtitleError }}</p>
                <p class="muted">字幕仅展示完整落在本段内的句子；跨段句子请播放前后片段核对。</p>
                <ol class="segment-list">
                  <li v-for="segment in reviewSegments" :key="segment.id"
                    :class="{ 'is-current': previewKind === 'mp4' && playheadMs >= segment.startMs && playheadMs < segment.endMs }">
                    <div class="segment-heading">
                      <el-button size="small" :disabled="previewLoading || !artifact('mp4')?.available"
                        :aria-label="`定位${segment.label}，${timelineTime(segment.startMs)}`" @click="seekSegment(segment)">
                        {{ segment.label }} · {{ timelineTime(segment.startMs) }} — {{ timelineTime(segment.endMs) }}
                      </el-button>
                      <el-button v-if="selected.reviewStatus === 'pending' && selected.taskStatus === 'succeeded'"
                        v-hasPermi="['heron:newsWork:review']" size="small" link type="warning" @click="noteSegment(segment)">
                        标记问题
                      </el-button>
                    </div>
                    <p class="segment-text">{{ segment.text || (subtitleLoading ? '正在读取口播…' : '本段暂无可显示的完整字幕，请播放核对。') }}</p>
                  </li>
                </ol>
              </div>
              <p v-else class="muted segment-empty">此版本没有可用的实测分段时间，请用成片播放器审片。</p>
            </template>
            <p v-else class="muted">先在左边选一个版本。</p>
          </section>

          <section v-if="selected && artifact('trend')" class="col-block" aria-label="趋势判定">
            <h3 class="block-title">
              趋势判定
              <span class="block-hint">trend/1</span>
              <el-tag
                v-if="trendReport"
                :type="trendVerdictTagType(trendReport.verdict)"
                size="small"
                effect="plain"
                class="trend-tag"
              >
                {{ trendReport.label }}
              </el-tag>
            </h3>
            <p v-if="trendLoading" class="muted" role="status">正在读取 trend.json…</p>
            <p v-else-if="trendError" class="muted" role="status">{{ trendError }}</p>
            <template v-else-if="trendReport">
              <el-alert
                v-if="trendReport.insufficient"
                type="info"
                :closable="false"
                show-icon
                :title="TREND_INSUFFICIENT_NOTE"
                description="这一版期数不够，后端不做趋势判定；此处只陈述已发生的区间变化，不给方向。"
              />
              <dl class="trend-kv">
                <template v-for="row in trendRows(trendReport)" :key="row.label">
                  <dt>{{ row.label }}</dt>
                  <dd>{{ row.value }}</dd>
                </template>
              </dl>
              <div v-if="trendReport.disagreements.length" class="trend-subblock">
                <h4>交叉核对分歧</h4>
                <ul>
                  <li v-for="(item, index) in trendReport.disagreements" :key="index">{{ item }}</li>
                </ul>
              </div>
              <div v-if="trendReport.limits.length" class="trend-subblock">
                <h4>限制</h4>
                <ul>
                  <li v-for="(limit, index) in trendReport.limits" :key="index">{{ limit }}</li>
                </ul>
              </div>
              <div v-if="trendReport.speculationBoundary" class="trend-subblock">
                <h4>推测边界</h4>
                <p>{{ trendReport.speculationBoundary }}</p>
              </div>
            </template>
            <p v-else class="muted">trend.json 无法解析，产物可能损坏；这里不展示任何推断出来的内容。</p>
          </section>

          <section class="col-block">
            <h3 class="block-title">05 生成门禁</h3>
            <el-table v-if="selected" :data="checkRows" size="small" border>
              <el-table-column label="门禁" prop="gate" width="140" />
              <el-table-column label="结果" width="86" align="center">
                <template #default="{ row }">
                  <el-tag :type="row.passed ? 'success' : 'danger'" size="small">{{ row.passed ? '通过' : '未通过' }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="实测值" prop="measuredText" min-width="220" show-overflow-tooltip />
              <el-table-column label="说明与定位" prop="detail" min-width="240" show-overflow-tooltip />
            </el-table>
            <p v-else class="muted">未选版本。</p>
            <p v-if="selected?.checks && !checkRows.length" class="muted">门禁记录无法解析。</p>
          </section>

          <section v-if="selected?.taskStatus === 'succeeded'" class="col-block">
            <h3 class="block-title">06 人工审片</h3>
            <template v-if="selected.reviewStatus === 'pending'">
              <el-form ref="reviewFormRef" :model="reviewForm" :rules="reviewRules" label-width="88px" size="small">
                <el-form-item label="决议" prop="decision">
                  <el-radio-group v-model="reviewForm.decision">
                    <el-radio value="approved">通过</el-radio>
                    <el-radio value="rejected">驳回</el-radio>
                  </el-radio-group>
                </el-form-item>
                <el-form-item v-if="reviewForm.decision === 'rejected'" label="驳回理由" prop="reason">
                  <el-input v-model="reviewForm.reason" type="textarea" :rows="3" maxlength="1000" show-word-limit
                    placeholder="注明段落时间，并说明事实、口播或画面的具体问题" />
                </el-form-item>
                <el-form-item label="指纹">
                  <el-checkbox v-model="fingerprintsConfirmed">
                    我已核对九宫格与视频指纹（{{ shortSha(contactSha) }} / {{ shortSha(videoSha) }}）
                  </el-checkbox>
                </el-form-item>
                <el-form-item>
                  <el-button
                    v-hasPermi="['heron:newsWork:review']"
                    :loading="reviewing"
                    :disabled="!fingerprintsConfirmed || !contactSha || !videoSha"
                    type="primary"
                    @click="handleReview"
                  >
                    {{ reviewForm.decision === 'approved' ? '确认并发布' : '提交驳回' }}
                  </el-button>
                  <span v-if="reviewForm.decision === 'approved'" class="review-hint">
                    通过后提交发布，平台结果仍需核对
                  </span>
                </el-form-item>
              </el-form>
            </template>
            <el-descriptions v-else :column="1" border size="small">
              <el-descriptions-item label="审片结论">
                {{ reviewText[selected.reviewStatus] || selected.reviewStatus }}
              </el-descriptions-item>
              <el-descriptions-item label="审片时间">{{ timeText(selected.reviewAt) }}</el-descriptions-item>
              <el-descriptions-item label="理由">{{ selected.reviewReason || '-' }}</el-descriptions-item>
            </el-descriptions>
          </section>
          <el-alert
            v-else-if="selected?.reviewStatus === 'pending'"
            class="mb-2"
            type="error"
            :closable="false"
            show-icon
            :title="`这一版没有可审的成片（${productionStatusText[selected.taskStatus || ''] || selected.taskStatus || '-'}${selected.taskErrorCode ? '，' + selected.taskErrorCode : ''}）`"
            :description="selected.taskErrorReason || '失败原因未记录，可到生产任务页查该任务的阶段与用量。'"
          />

          <PublishAttemptReview v-if="selected" :key="selected.id" :version="selected" @updated="handlePublishUpdated" />

          <section v-if="selected?.publishSource" class="col-block">
            <h3 class="block-title">平台回执</h3>
            <el-alert
              v-if="selected.publishSource === 'sandbox'"
              class="mb-2"
              type="warning"
              :closable="false"
              show-icon
              title="沙箱发布：仅验证链路，未上抖音"
            />
            <el-alert
              v-else-if="selected.publishSource === 'douyin-cli' && !selected.publishUrl"
              class="mb-2"
              type="info"
              :closable="false"
              show-icon
              title="已提交，待补链接"
            />
            <el-descriptions :column="1" border size="small">
              <el-descriptions-item label="来源">
                <el-tag :type="selected.publishSource === 'sandbox' ? 'warning' : 'success'" size="small">
                  {{ publishSourceText[selected.publishSource] || selected.publishSource }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="作品链接">
                <a v-if="selected.publishUrl && selected.publishSource !== 'sandbox'" :href="selected.publishUrl" target="_blank" rel="noopener noreferrer">
                  {{ selected.publishUrl }}
                </a>
                <div v-else-if="selected.publishSource === 'douyin-cli'" class="publish-url-fix">
                  <el-input v-model="publishUrlInput" placeholder="粘贴抖音作品链接" clearable size="small" />
                  <el-button :loading="publishUrlSaving" :disabled="!publishUrlInput.trim()" size="small"
                    @click="savePublishUrl">
                    补链接
                  </el-button>
                </div>
                <span v-else>{{ selected.publishSource === 'sandbox' ? '沙箱没有平台作品链接' : '-' }}</span>
              </el-descriptions-item>
              <el-descriptions-item label="发布账号">{{ selected.publishAccount || '-' }}</el-descriptions-item>
              <el-descriptions-item :label="selected.publishSource === 'sandbox' ? '沙箱记录时间' : publicationState(selected) === 'legacy_submitted' ? '历史记录时间（未重新核对）' : '发布时间'">
                {{ timeText(selected.publishAt) }}
              </el-descriptions-item>
            </el-descriptions>
          </section>

          <section v-if="publicationState(selected) === 'published'" class="col-block">
            <h3 class="block-title">08 发布表现</h3>
            <div class="metric-grid">
              <el-input-number v-model="metricForm.plays" :min="0" :controls="false" placeholder="播放量" size="small" />
              <el-input-number v-model="metricForm.completion" :min="0" :max="100" :controls="false"
                placeholder="完播率 %" size="small" />
              <el-input-number v-model="metricForm.likes" :min="0" :controls="false" placeholder="点赞" size="small" />
              <el-button :loading="metricSaving" size="small" @click="saveMetric">记录表现</el-button>
            </div>
            <p v-if="latestMetric" class="muted">
              最近一次：播放 {{ latestMetric.plays ?? '-' }} · 完播 {{ metricPercent(latestMetric.completionRate) }} ·
              {{ timeText(latestMetric.fetchedAt) }}
            </p>
            <p v-else class="muted">还没有表现数据。</p>
          </section>
        <section v-if="selected" class="col-block">
            <h3 class="block-title">
              09 内容质量报告
              <span class="block-hint">v{{ selected.versionNo }}</span>
            </h3>

            <div class="report-group">
              <h4 class="report-title">内容质量审查结论</h4>
              <template v-if="reviewReport.available">
                <dl class="kv kv--wide">
                  <dt>审稿结论</dt>
                  <dd>
                    <el-tag size="small" effect="plain" :type="reviewReport.passed ? 'success' : 'danger'">
                      {{ reviewReport.result }}
                    </el-tag>
                    <span v-if="reviewReport.repairAttempts" class="muted">修了 {{ reviewReport.repairAttempts }} 轮</span>
                  </dd>
                  <dt>核心断言</dt>
                  <dd>
                    <el-tag v-if="reviewReport.coreFacts" size="small" effect="plain"
                      :type="reviewReport.coreFacts === 'supported' ? 'success' : 'danger'">
                      {{ reviewReport.coreFactsLabel }}
                    </el-tag>
                    <span v-else class="muted">未记录（旧审稿契约，自动发布会拒）</span>
                  </dd>
                  <dt>审稿版本</dt>
                  <dd class="mono">{{ reviewReport.promptVersion }}</dd>
                  <dt>审于</dt>
                  <dd>{{ timeText(reviewReport.reviewedAt) }}</dd>
                </dl>
                <ul v-if="reviewReport.issues.length" class="issue-list">
                  <li v-for="(issue, index) in reviewReport.issues" :key="index" class="issue">
                    <span :class="['issue-severity', 'is-' + (issue.severity || '').toLowerCase()]">
                      {{ issue.severity || '-' }}
                    </span>
                    <span class="issue-segment">{{ issue.segmentId || '-' }}</span>
                    <span class="issue-text">
                      {{ issue.description || '-' }}
                      <span v-if="issue.suggestion" class="issue-suggestion">建议：{{ issue.suggestion }}</span>
                    </span>
                  </li>
                </ul>
                <p v-else class="muted">没有问题条目。</p>
                <ul v-if="reviewReport.minorSuggestions.length" class="minor-list">
                  <li v-for="(item, index) in reviewReport.minorSuggestions" :key="index">{{ item }}</li>
                </ul>
              </template>
              <el-alert
                v-else
                type="warning"
                :closable="false"
                show-icon
                title="后端未提供 AI 审稿记录"
                description="这一版没有落盘的审稿结论，自动发布门禁会直接拒掉它——没有记录就无法证明审稿发生过。"
              />
            </div>

            <div class="report-group">
              <h4 class="report-title">成片级质量审稿（L3）</h4>
              <p class="muted">
                这一层只对成片本身下判断，每条都带依据与置信度。它不参与发布放行，也不改写任何一道客观闸。
              </p>
              <template v-if="qualityReport">
                <dl class="kv kv--wide">
                  <dt>审于</dt>
                  <dd>{{ timeText(qualityReport.reviewedAt) }}</dd>
                  <dt>审稿版本</dt>
                  <dd class="mono">{{ qualityReport.promptVersion || '-' }}</dd>
                  <dt>模型</dt>
                  <dd class="mono">{{ qualityReport.modelId || '-' }}</dd>
                  <dt>模式</dt>
                  <dd>{{ qualityModeText[qualityReport.mode || ''] || qualityReport.mode || '-' }}</dd>
                </dl>

                <div class="quality-counts">
                  <span class="count-label">分类计数</span>
                  <el-tag type="success" size="small" effect="plain">通过 {{ qualityCounts.pass }}</el-tag>
                  <el-tag type="warning" size="small" effect="plain">轻微问题 {{ qualityCounts.minor }}</el-tag>
                  <el-tag type="danger" size="small" effect="plain">未通过 {{ qualityCounts.fail }}</el-tag>
                  <el-tag type="info" size="small" effect="plain">证据不足 {{ qualityCounts.unknown }}</el-tag>
                </div>
                <p class="muted">
                  客观未通过 {{ qualityCounts.objectiveFail }} · 模型主观未通过 {{ qualityCounts.subjectiveFail }} ·
                  模型推测未通过 {{ qualityCounts.hypothesisFail }}。这里只有分类计数，不合成总分。
                </p>
                <p v-if="!qualitySummaryConsistent" class="quality-mismatch">
                  这份报告落库的分类计数与判据条目对不上（报告写：通过 {{ qualityReport.summary.pass }} / 轻微
                  {{ qualityReport.summary.minor }} / 未通过 {{ qualityReport.summary.fail }} / 证据不足
                  {{ qualityReport.summary.unknown }}），上面按条目显示。
                </p>

                <section v-for="group in qualityGroups" :key="group.key" class="quality-class">
                  <div class="quality-class-head">
                    <h5 class="quality-class-title">{{ group.label }}</h5>
                    <el-tag size="small" effect="plain">{{ group.items.length }} 条</el-tag>
                  </div>
                  <p class="quality-class-note">{{ group.note }}</p>
                  <ul v-if="group.items.length" class="criterion-list">
                    <li v-for="item in group.items" :key="item.id" class="criterion">
                      <div class="criterion-head">
                        <span class="criterion-name">{{ item.label }}</span>
                        <span class="criterion-id mono">{{ item.id }}</span>
                        <el-tag :type="verdictTagType(item.verdict)" size="small" effect="plain">
                          {{ verdictText[item.verdict] }}
                        </el-tag>
                        <el-tag v-if="item.verdict === 'unknown'" type="info" size="small" effect="dark">证据不足</el-tag>
                        <el-tag type="info" size="small" effect="plain">{{ classText[item.class] }}</el-tag>
                        <el-tag type="info" size="small" effect="plain">置信度 {{ confidenceText[item.confidence] }}</el-tag>
                        <el-tag type="info" size="small" effect="plain">严重度 {{ severityText[item.severity] }}</el-tag>
                        <el-tag type="info" size="small" effect="plain">
                          {{ item.repairable ? '可定向修复' : '不可定向修复' }}
                        </el-tag>
                        <el-tag type="info" size="small" effect="plain">
                          {{ item.machineVerifiable ? '机器可复核' : '需人工复核' }}
                        </el-tag>
                      </div>
                      <p class="criterion-reason">{{ item.reason || '报告没有写明理由。' }}</p>
                      <ul v-if="item.evidence.length" class="evidence-list">
                        <li v-for="(evidence, index) in item.evidence" :key="index" class="evidence">
                          <span class="evidence-locator mono">{{ evidence.locator }}</span>
                          <span class="evidence-quote">{{ evidence.quote }}</span>
                        </li>
                      </ul>
                    </li>
                  </ul>
                  <p v-else class="muted">这一类没有条目。</p>
                </section>

                <dl class="kv kv--wide quality-extra">
                  <dt>定向修复</dt>
                  <dd>
                    已尝试 {{ qualityReport.repair.attempted }} / 上限 {{ qualityReport.repair.max }} 次 ·
                    修复后重跑技术检查：{{ qualityReport.repair.rechecked ? '是' : '否' }}
                  </dd>
                  <dt>改动段落</dt>
                  <dd>
                    {{ qualityReport.repair.changedSegments.length ? qualityReport.repair.changedSegments.join('、') : '无' }}
                  </dd>
                  <dt>画面证据</dt>
                  <dd>
                    {{ qualityReport.screenshot.level || '未记录' }}
                    <span v-if="qualityReport.screenshot.frames" class="muted">
                      （{{ qualityReport.screenshot.frames }} 帧）
                    </span>
                    <span v-if="qualityReport.screenshot.extraBrowserRender" class="muted">· 额外走了浏览器重渲染</span>
                  </dd>
                  <dt>证据说明</dt>
                  <dd>{{ qualityReport.screenshot.reason || '未记录' }}</dd>
                </dl>

                <div v-if="qualityReport.notes.length" class="quality-notes">
                  <span class="count-label">报告备注</span>
                  <ul class="quality-note-list">
                    <li v-for="(note, index) in qualityReport.notes" :key="index">
                      {{ QUALITY_NOTE_LABELS[note] || note }}
                    </li>
                  </ul>
                </div>
              </template>
              <p v-else class="muted">本条未做质量审稿。</p>

              <div class="quality-frames">
                <div class="quality-frames-head">
                  <h5 class="quality-class-title">画面回看（补充评审）</h5>
                  <el-button
                    v-hasPermi="['heron:newsWork:review']"
                    size="small"
                    :loading="qualityFramesLoading"
                    @click="loadQualityFrames"
                  >
                    {{ qualityFrames.length ? '重新抽帧' : '抽取画面' }}
                  </el-button>
                </div>
                <p class="muted">
                  按字幕实测区间，每段取中点抽 1 帧、结尾 1 帧，最多 8 帧。
                  帧只在这里看，不落库、不进质量报告。
                </p>
                <div v-if="qualityFrames.length" class="quality-frame-grid">
                  <figure v-for="frame in qualityFrames" :key="frame.seq" class="quality-frame">
                    <img :src="frame.dataUrl" :alt="frame.label" loading="lazy" />
                    <figcaption>{{ frame.label }} · {{ (frame.atMs / 1000).toFixed(1) }}s</figcaption>
                  </figure>
                </div>
              </div>
            </div>

            <div class="report-group">
              <h4 class="report-title">核心结论与事实引用</h4>
              <template v-if="scriptReport.available">
                <dl class="kv kv--wide">
                  <dt>标题</dt>
                  <dd>{{ scriptReport.title }}</dd>
                  <dt>结尾</dt>
                  <dd>{{ scriptReport.closing }}</dd>
                  <dt>出处</dt>
                  <dd class="mono">{{ scriptReport.source }}</dd>
                  <dt>出处名</dt>
                  <dd>{{ scriptReport.sourceName }}</dd>
                </dl>
                <el-table :data="scriptReport.scenes" size="small" border>
                  <el-table-column label="段落" prop="label" width="76" />
                  <el-table-column label="时长" width="78" align="center">
                    <template #default="{ row }">{{ row.durationS ? `${row.durationS} 秒` : '-' }}</template>
                  </el-table-column>
                  <el-table-column label="口播" min-width="220">
                    <template #default="{ row }">
                      <span class="script-lead">{{ row.lead }}</span>
                      <span class="script-body">{{ row.body }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column label="引用事实" min-width="140">
                    <template #default="{ row }">
                      <span v-for="ref in row.facts" :key="ref" class="fact-ref mono">{{ ref }}</span>
                      <span v-if="!row.facts.length" class="muted">无</span>
                    </template>
                  </el-table-column>
                  <el-table-column label="画面" min-width="120">
                    <template #default="{ row }">
                      <template v-if="row.sceneType">
                        <el-tag size="small" effect="plain">{{ row.sceneType }}</el-tag>
                        <span v-if="row.visualLayout" class="visual-note mono">{{ row.visualLayout }}</span>
                      </template>
                      <span v-else class="muted">本稿没有画面字段</span>
                    </template>
                  </el-table-column>
                </el-table>
                <p class="muted">事实引用目前是稿件里的占位符路径；「这句话引用了哪个数的多少」后端未提供该字段。</p>
              </template>
              <el-alert
                v-else
                type="info"
                :closable="false"
                show-icon
                title="后端未提供稿件正文"
                description="这一版没有落盘的稿件正文，无法展示核心结论与事实引用。"
              />
            </div>

            <div class="report-group">
              <h4 class="report-title">技术质量检查结果</h4>
              <ul v-if="checkRows.length" class="gate-list">
                <li v-for="row in checkRows" :key="row.gate" class="gate-row">
                  <span class="gate-name mono">{{ row.gate }}</span>
                  <el-tag :type="row.passed ? 'success' : 'danger'" size="small" effect="plain">
                    {{ row.passed ? '通过' : '未通过' }}
                  </el-tag>
                  <span class="gate-measured mono">{{ row.measuredText || '无实测值' }}</span>
                </li>
              </ul>
              <p v-else class="muted">这一版没有可解析的门禁记录。</p>
              <p class="muted">门禁明细表见上方「05 生成门禁」。</p>
            </div>

            <div class="report-group">
              <h4 class="report-title">字幕时间轴</h4>
              <el-table v-if="reviewSegments.length" :data="reviewSegments" size="small" border>
                <el-table-column label="段落" prop="label" width="76" />
                <el-table-column label="起止" width="160">
                  <template #default="{ row }">{{ timelineTime(row.startMs) }} — {{ timelineTime(row.endMs) }}</template>
                </el-table-column>
                <el-table-column label="口播字幕" min-width="240">
                  <template #default="{ row }">{{ row.text || '本段没有完整落在段内的字幕' }}</template>
                </el-table-column>
              </el-table>
              <p v-else class="muted">这一版没有实测分段时间，后端未记录字幕与分镜的对齐结果。</p>
            </div>

            <div class="report-group">
              <h4 class="report-title">尚未接入的报告项</h4>
              <p class="muted">下面这些报告项后端本轮没有返回字段，这里只标注缺口，不填任何假内容。</p>
              <el-table :data="PENDING_REPORT_FIELDS" size="small" border>
                <el-table-column label="报告项" prop="label" width="230" />
                <el-table-column label="状态" width="150">
                  <template #default>
                    <el-tag type="info" size="small" effect="plain">后端未提供该字段</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="说明" prop="note" min-width="260" />
              </el-table>
            </div>
          </section>
        </main>

        <!-- 右栏：创作设置 -->
        <aside class="studio-col studio-col--right">
          <section class="col-block">
            <h3 class="block-title">创作设置</h3>
            <el-form label-position="top" size="small">
              <el-form-item label="模板">
                <el-select v-model="draftForm.templateKey" class="w-full" placeholder="选择版式">
                  <el-option
                    v-for="item in templates"
                    :key="item.key"
                    :label="`${item.name}${item.visualMode === '3d' ? '·3D' : ''}（${item.key}）`"
                    :value="item.key"
                    :disabled="!item.locked"
                  >
                    <span>{{ item.name }}{{ item.visualMode === '3d' ? '·3D' : '' }}</span>
                    <span class="option-hint">{{ item.key }}</span>
                  </el-option>
                </el-select>
                <p class="form-tip">
                  换模板只影响下一次生成；已产出的版本保留当时冻结的模板与资产指纹。
                </p>
              </el-form-item>

              <el-form-item label="音色">
                <el-input :model-value="draftForm.voiceKey" disabled />
                <p class="form-tip">音色由模板的资产锁固定，换音色要改模板并重新生成 LOCK。</p>
              </el-form-item>

              <el-form-item v-if="selectedTemplate" label="当前模板能力">
                <div class="capability">
                  <div class="cap-row">
                    <span class="cap-label">视觉模式</span>
                    <span class="cap-value mono">{{ selectedTemplate.visualMode === '3d' ? '3D（空间数据）' : '2D' }}</span>
                  </div>
                  <div class="cap-row">
                    <span class="cap-label">画幅</span>
                    <span class="cap-value mono">{{ selectedTemplate.aspectRatio || '-' }}</span>
                  </div>
                  <div class="cap-row">
                    <span class="cap-label">推荐时长</span>
                    <span class="cap-value mono">
                      {{ selectedTemplate.minDuration ?? '-' }}–{{ selectedTemplate.maxDuration ?? '-' }} 秒
                    </span>
                  </div>
                  <div class="cap-row">
                    <span class="cap-label">支持场景</span>
                    <span class="cap-value">
                      <el-tag
                        v-for="scene in selectedTemplate.supportedSceneTypes || []"
                        :key="scene"
                        size="small"
                        effect="plain"
                        :type="scene === 'image' ? 'success' : 'info'"
                      >
                        {{ scene }}
                      </el-tag>
                      <span v-if="!(selectedTemplate.supportedSceneTypes || []).length" class="muted">未声明</span>
                    </span>
                  </div>
                </div>
              </el-form-item>
            </el-form>
          </section>

          <section class="col-block">
            <h3 class="block-title">质量检查</h3>
            <ul class="check-list">
              <li v-for="row in checkRows" :key="row.gate" :class="['check-row', row.passed ? 'is-pass' : 'is-fail']">
                <span class="check-dot" />
                <span class="check-gate">{{ row.gate }}</span>
              </li>
              <li v-if="!checkRows.length" class="muted">未选版本或没有门禁记录。</li>
            </ul>
          </section>

          <section class="col-block">
            <h3 class="block-title">生成</h3>
            <el-button
              v-hasPermi="['heron:newsWork:generate']"
              :loading="generating"
              :disabled="Boolean(work.activeTaskId)"
              type="primary"
              class="w-full"
              @click="handleGenerate"
            >
              发起生成
            </el-button>
            <p class="form-tip">{{ work.activeTaskId ? '已有在途任务，等它结束再发起。' : '会排队执行真实渲染。' }}</p>
          </section>
        </aside>
      </div>
    </template>
  </div>
</template>

<script setup name="HeronNewsWorkStudio" lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { NewsDraftForm, NewsReviewForm, NewsVideoVersion, NewsWork } from '@/api/heron/newsWork/types';
import type { ProductionCapabilities, ProductionFile, ProductionTask } from '@/api/heron/production/types';
import type { VideoTemplate } from '@/api/heron/template/types';
import {
  fetchNewsPreview,
  fetchQualityFrames,
  generateNewsVideo,
  getNewsWork,
  getNewsVersion,
  listNewsVersions,
  confirmNewsVersion,
  backfillNewsPublishUrl,
  saveNewsDraft
} from '@/api/heron/newsWork';
import type { NewsQualityFrame } from '@/api/heron/newsWork/types';
import { getProduction, getProductionCapabilities, cancelProduction } from '@/api/heron/production';
import { listNewsMetrics, saveNewsMetric } from '@/api/heron/metrics';
import type { NewsMetric } from '@/api/heron/metrics';
import { listVideoTemplate } from '@/api/heron/template';
import modal from '@/plugins/modal';
import { download } from '@/utils/request';
import { utcText } from '../../heron-time';
import { isProductionActive, productionStatusTag, productionStatusText } from '../../production/task-state';
import { reviewTimeline, timelineTime } from './review-timeline';
import type { ReviewSegment } from './review-timeline';
import {
  PENDING_REPORT_FIELDS,
  QUALITY_CLASS_META,
  QUALITY_NOTE_LABELS,
  measuredText,
  parseEditorialReview,
  parseQualityGates,
  parseQualityReport,
  parseScriptReport,
  qualitySummary,
  sortQualityCriteria,
  summaryConsistent
} from './quality-report';
import type {
  QualityConfidence,
  QualityCriterionClass,
  QualityReport,
  QualitySeverity,
  QualityVerdict
} from './quality-report';
import { TREND_INSUFFICIENT_NOTE, parseTrendReport, trendRows, trendVerdictTagType } from './trend-report';
import type { TrendReport } from './trend-report';
import PublishAttemptReview from '../PublishAttemptReview.vue';
import { confirmationMessage, publicationState, publishSourceText } from '../publish-state';

const reviewText: Record<string, string> = { pending: '待审片', approved: '已通过', rejected: '已驳回' };
const reviewTag: Record<string, 'info' | 'success' | 'danger'> = {
  pending: 'info',
  approved: 'success',
  rejected: 'danger'
};
/** 核心断言的证据状态：核得住 / 核不了 / 没依据。只有第一种能自动发布。 */
const coreFactsText: Record<string, string> = {
  supported: '有据',
  unverifiable: '核不了',
  unsupported: '无据'
};

/** 判定结果的中文说法。unknown 是「证据不足」，不等于通过。 */
const verdictText: Record<QualityVerdict, string> = {
  pass: '通过',
  minor: '轻微问题',
  fail: '未通过',
  unknown: '证据不足'
};
/** 三类结论的简称标签；页面按 class 分区展示，每个条目仍标出自己的类。 */
const classText: Record<QualityCriterionClass, string> = {
  objective: '客观',
  subjective: '模型主观',
  hypothesis: '模型推测'
};
const confidenceText: Record<QualityConfidence, string> = { high: '高', medium: '中', low: '低' };
const severityText: Record<QualitySeverity, string> = { none: '无', minor: '轻微', major: '严重', blocker: '阻断' };
/** 审稿模式：final 是成片终审，draft / sample 是人工发起的补充评审。 */
const qualityModeText: Record<string, string> = { final: '成片终审', draft: '草稿', sample: '抽样' };

const route = useRoute();
const router = useRouter();

const loading = ref(true);
const draftFormRef = ref<ElFormInstance>();
const reviewFormRef = ref<ElFormInstance>();

const work = ref<NewsWork>();
const templates = ref<VideoTemplate[]>([]);
// 模板与音色由模板目录的 LOCK.json 锁定；服务端在认领时已经选定，这两个常量只在服务端没给值时兜底
const LOCKED_TEMPLATE_KEY = 'news-9x16';
const LOCKED_VOICE_KEY = 'zh-CN-XiaoxiaoNeural';
const draftForm = ref<NewsDraftForm>({
  expectedRevision: 0,
  title: '',
  draft: '',
  templateKey: LOCKED_TEMPLATE_KEY,
  voiceKey: LOCKED_VOICE_KEY
});
const savingDraft = ref(false);
const generating = ref(false);
const versionLoading = ref(false);
const versions = ref<NewsVideoVersion[]>([]);
const versionTotal = ref(0);
const versionQuery = ref<PageQuery>({ pageNum: 1, pageSize: 20 });
let versionsRequest = 0;
let versionRequest = 0;
const selected = ref<NewsVideoVersion>();
const reviewing = ref(false);
const fingerprintsConfirmed = ref(false);
const reviewForm = ref<NewsReviewForm>({ decision: 'approved', contactSha256: '', videoSha256: '', reason: '' });
const metricForm = ref<{ plays?: number; completion?: number; likes?: number }>({});
const latestMetric = ref<NewsMetric>();
const metricSaving = ref(false);

/** 右栏展示当前选中模板的能力：用户在选模板时就该看到它装不装得下这条内容。 */
const selectedTemplate = computed(() =>
  templates.value.find(item => item.key === draftForm.value.templateKey)
);

const metricPercent = (rate?: number) => (rate === null || rate === undefined ? '-' : `${Math.round(rate * 100)}%`);

const loadMetrics = async (versionId?: string) => {
  latestMetric.value = undefined;
  if (!versionId) return;
  try {
    const res = await listNewsMetrics(versionId);
    latestMetric.value = res.data?.[0];
  } catch {
    // 读不到表现不影响审片，静默留空
  }
};

const saveMetric = async () => {
  if (!selected.value) return;
  metricSaving.value = true;
  try {
    await saveNewsMetric({
      versionId: selected.value.id,
      platform: 'douyin',
      plays: metricForm.value.plays,
      completionRate: metricForm.value.completion === undefined ? undefined : metricForm.value.completion / 100,
      likes: metricForm.value.likes
    });
    modal.msgSuccess('表现已记录');
    await loadMetrics(selected.value.id);
  } finally {
    metricSaving.value = false;
  }
};

const publishUrlInput = ref('');
const publishUrlSaving = ref(false);

const savePublishUrl = async () => {
  const url = publishUrlInput.value.trim();
  if (!work.value || !selected.value || !url) return;
  publishUrlSaving.value = true;
  try {
    const res = await backfillNewsPublishUrl(work.value.id, selected.value.id, url);
    modal.msgSuccess('作品链接已补上');
    publishUrlInput.value = '';
    await handlePublishUpdated(res.data);
  } finally {
    publishUrlSaving.value = false;
  }
};

const previewUrl = ref('');
const previewKind = ref('');
const previewLoading = ref(false);
const previewPlayer = ref<HTMLVideoElement>();
const playheadMs = ref(0);
const subtitleText = ref('');
const subtitleLoading = ref(false);
const subtitleError = ref('');
const reviewSegments = computed(() => reviewTimeline(selected.value?.checks, subtitleText.value));
const trendReport = ref<TrendReport | null>(null);
const trendLoading = ref(false);
const trendError = ref('');
let previewRequest = 0;
let subtitleRequest = 0;
let trendRequest = 0;
let pendingSeekMs: number | undefined;
const capabilities = ref<ProductionCapabilities>();

// shortcut: 生成受理键在打开作品时生成一次，重试复用同一个键；需要跨会话恢复时改由后端下发。
const newRequestKey = () => crypto.randomUUID?.() ?? `ui-${Date.now()}-${Math.random().toString(36).slice(2)}`;
let requestKey = newRequestKey();

const draftRules: Record<string, any> = {
  title: [
    { required: true, message: '标题不能为空', trigger: 'blur' },
    { max: 200, message: '标题不能超过 200 字', trigger: 'blur' }
  ],
  draft: [
    { required: true, message: '口播稿不能为空', trigger: 'blur' },
    { max: 16000, message: '口播稿过长', trigger: 'blur' }
  ],
  templateKey: [{ required: true, pattern: /^[a-zA-Z0-9_-]{1,80}$/, message: '模板标识不合法', trigger: 'blur' }],
  voiceKey: [{ required: true, pattern: /^[a-zA-Z0-9_-]{1,80}$/, message: '音色标识不合法', trigger: 'blur' }]
};
const reviewRules: Record<string, any> = {
  decision: [{ required: true, message: '请选择决议', trigger: 'change' }],
  reason: [{ required: true, message: '驳回必须写明理由', trigger: 'blur' }]
};

const contactSha = computed(() => artifact('contact_sheet')?.sha256 || '');
const videoSha = computed(() => artifact('mp4')?.sha256 || '');

const checkRows = computed(() =>
  parseQualityGates(selected.value?.checks).map(gate => ({
    gate: gate.gate,
    passed: gate.passed,
    measured: gate.measured,
    measuredText: measuredText(gate.measured),
    detail: [gate.reason, gate.inputLocator].filter(Boolean).join(' · ')
  }))
);

/**
 * AI 审稿结论与待修问题。后端 editorialReview 就是这份 JSON 的字符串形式，
 * 解析不出来就当没有记录，不拿别处的结论顶替。
 */
const reviewReport = computed(() => {
  const review = parseEditorialReview(selected.value?.editorialReview);
  return {
    available: Boolean(review),
    result: review?.result ?? '-',
    passed: review?.result === 'PASS',
    coreFacts: review?.coreFacts ?? '',
    coreFactsLabel: review?.coreFacts ? (coreFactsText[review.coreFacts] ?? review.coreFacts) : '',
    promptVersion: review?.promptVersion ?? '-',
    reviewedAt: review?.reviewedAt ?? '',
    repairAttempts: review?.repairAttempts ?? 0,
    issues: review?.issues ?? [],
    minorSuggestions: review?.minorSuggestions ?? []
  };
});

/** 成片实际用的稿件：标题、结尾、出处、逐段口播与引用的事实占位符。 */
const scriptReport = computed(() => {
  const report = parseScriptReport(selected.value?.script);
  return {
    available: Boolean(report),
    title: report?.title ?? '-',
    closing: report?.closing ?? '-',
    source: report?.sourceUrl ?? report?.sourceKey ?? '-',
    sourceName: report?.sourceName ?? '-',
    scenes: report?.scenes ?? [],
    facts: report?.facts ?? []
  };
});

/**
 * 成片级质量审稿报告（L3）。后端 quality_report 就是这份 JSON 的字符串形式，
 * 解析不出来就当没做过审稿——它不是闸，缺失不阻塞任何流程。
 */
const qualityReport = computed<QualityReport | null>(() => parseQualityReport(selected.value?.qualityReport));

/**
 * 补充评审抽帧：只在人点了按钮之后才跑。
 * 自动抽会让每条片都多一次 ffmpeg，抽出来的帧也没人看。
 */
const qualityFrames = ref<NewsQualityFrame[]>([]);
const qualityFramesLoading = ref(false);

/** 分类计数按判据条目重算，保证页面上看到的数字和看到的条目永远对得上。 */
const qualityCounts = computed(() => qualitySummary(qualityReport.value?.criteria ?? []));

/** 报告落库的计数与条目对不上时为 false：这条记录异常，页面要如实标出来。 */
const qualitySummaryConsistent = computed(() => {
  const report = qualityReport.value;
  return report ? summaryConsistent(report) : true;
});

/**
 * 三类结论各占一区，互不混排：客观的、主观的、推测的不能放进同一个列表排序，
 * 否则读者分不清哪些是算出来的、哪些是模型说的。
 */
const qualityGroups = computed(() =>
  QUALITY_CLASS_META.map(meta => ({
    key: meta.key,
    label: meta.label,
    note: meta.note,
    items: sortQualityCriteria((qualityReport.value?.criteria ?? []).filter(item => item.class === meta.key))
  }))
);

/** 判定结果的标签色：通过绿、轻微黄、未通过红、证据不足灰蓝。 */
const verdictTagType = (verdict: QualityVerdict): 'success' | 'warning' | 'danger' | 'info' => {
  if (verdict === 'pass') return 'success';
  if (verdict === 'minor') return 'warning';
  if (verdict === 'fail') return 'danger';
  return 'info';
};

const capabilityReasons = computed(() => {
  const news = capabilities.value?.news;
  if (!news || news.available || !news.reasons?.length) return [];
  return [`新闻生成当前不可用：${news.reasons.join('；')}`];
});

const timeText = utcText;
const shortSha = (value?: string) => (value ? value.slice(0, 12) + '…' : '缺产物');

function artifact(kind: string) {
  return selected.value?.artifacts?.find(file => file.kind === kind);
}

const goBack = () => {
  router.push('/heron/work');
};

const reloadWork = async (workId: string) => {
  const res = await getNewsWork(workId);
  work.value = res.data;
  draftForm.value = {
    expectedRevision: res.data.revision,
    title: res.data.title,
    draft: res.data.draft || '',
    templateKey: res.data.templateKey || LOCKED_TEMPLATE_KEY,
    voiceKey: res.data.voiceKey || LOCKED_VOICE_KEY
  };
};

/**
 * 生成是分钟级的真渲染，页面不能停在「已受理」。静默盯任务详情而不是重读工作台，
 * 是为了不覆盖操作员正在输入的草稿；到终态才整页刷新一次。
 */
let watchTimer: number | undefined;
const liveTask = ref<ProductionTask>();

const stopWatch = () => {
  if (watchTimer !== undefined) {
    window.clearTimeout(watchTimer);
    watchTimer = undefined;
  }
};

const watchTask = async (taskId: string) => {
  try {
    const res = await getProduction(taskId);
    liveTask.value = res.data;
    if (isProductionActive(res.data.status)) {
      // shortcut: 后台标签页会被浏览器降频到约 1 次/分钟；要秒级恢复就照 production/index.vue 补 visibilitychange。
      watchTimer = window.setTimeout(() => void watchTask(taskId), 2000);
      return;
    }
    await Promise.all([reloadWork(res.data.bizId), loadVersions()]);
  } catch {
    stopWatch();
  }
};

const loadVersions = async () => {
  if (!work.value) return;
  const workId = work.value.id;
  const request = ++versionsRequest;
  versionLoading.value = true;
  try {
    const res = await listNewsVersions(workId, versionQuery.value);
    if (request !== versionsRequest || work.value?.id !== workId) return;
    versions.value = res.data?.rows || [];
    versionTotal.value = res.data?.total || 0;
  } finally {
    if (request === versionsRequest) versionLoading.value = false;
  }
};

/**
 * 列表接口不下发稿件正文与冻结快照（一条正文几百 KB），单版本详情才带。
 * 质量报告要读稿件，所以选版本时补一次详情，把两个接口的返回对齐到同一份数据。
 */
const loadVersionDetail = async (versionId: string, request: number) => {
  const workId = work.value?.id;
  if (!workId) return;
  try {
    const res = await getNewsVersion(workId, versionId);
    if (request !== versionRequest || selected.value?.id !== versionId) return;
    selected.value = { ...selected.value, ...res.data };
  } catch {
    // 详情读不到就保留列表里的字段，质量报告据此标注缺失，不伪造内容。
  }
};

const selectVersion = (row?: NewsVideoVersion, loaded?: NewsVideoVersion) => {
  const request = ++versionRequest;
  releasePreview();
  releaseTrend();
  fingerprintsConfirmed.value = false;
  reviewForm.value = { decision: 'approved', contactSha256: '', videoSha256: '', reason: '' };
  selected.value = !row ? undefined : loaded ? { ...row, ...loaded } : row;
  qualityFrames.value = [];
  qualityFramesLoading.value = false;
  void loadReviewSubtitles();
  void loadMetrics(row?.id);
  void loadTrend();
  if (row && !loaded) void loadVersionDetail(row.id, request);
};

const selectRequestedVersion = async () => {
  const workId = work.value?.id;
  const versionId = String(route.query.versionId || '');
  if (!workId || !versionId) return;
  const request = ++versionRequest;
  try {
    const result = await getNewsVersion(workId, versionId);
    if (request === versionRequest && work.value?.id === workId) selectVersion(result.data, result.data);
  } catch {
    if (request === versionRequest) modal.msgWarning('指定版本读取失败，请从版本历史选择。');
  }
};

const handlePublishUpdated = async (row: NewsVideoVersion) => {
  if (work.value?.id !== row.workId) return;
  if (selected.value?.id === row.id) selectVersion(row, row);
  try {
    const [, refreshed] = await Promise.all([loadVersions(), getNewsWork(row.workId)]);
    if (work.value?.id === row.workId) work.value = refreshed.data;
  } catch {
    modal.msgWarning('当前版本状态已更新，作品列表暂时刷新失败。');
  }
};

const releasePreview = () => {
  previewRequest++;
  previewLoading.value = false;
  pendingSeekMs = undefined;
  playheadMs.value = 0;
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
    previewUrl.value = '';
  }
  previewKind.value = '';
};

/**
 * 补充评审抽帧：按字幕实测区间从成片抽帧。
 * 帧只在这里看，不写回报告——报告一次写入、不可覆盖。
 */
const loadQualityFrames = async () => {
  const version = selected.value;
  const workId = work.value?.id;
  if (!version || !workId || qualityFramesLoading.value) return;
  qualityFramesLoading.value = true;
  try {
    const res = await fetchQualityFrames(String(workId), String(version.id));
    qualityFrames.value = res.data ?? [];
  } catch {
    qualityFrames.value = [];
    modal.msgWarning('抽取画面失败，请确认该版本成片仍在。');
  } finally {
    qualityFramesLoading.value = false;
  }
};

const loadReviewSubtitles = async () => {
  const request = ++subtitleRequest;
  subtitleText.value = '';
  subtitleError.value = '';
  subtitleLoading.value = false;
  const version = selected.value;
  const workId = work.value?.id;
  if (!version || !workId || !reviewSegments.value.length) return;
  const file = version.artifacts?.find(item => item.kind === 'subtitles' && item.available);
  if (!file) {
    subtitleError.value = '此版本没有可读取的口播字幕，仍可按实测时间定位。';
    return;
  }
  subtitleLoading.value = true;
  try {
    const blob = await fetchNewsPreview(workId, version.id, file.artifactId);
    const text = await blob.text();
    if (request === subtitleRequest) subtitleText.value = text;
  } catch {
    if (request === subtitleRequest) subtitleError.value = '字幕读取失败，请播放核对口播；实测时间仍可定位。';
  } finally {
    if (request === subtitleRequest) subtitleLoading.value = false;
  }
};

const releaseTrend = () => {
  trendRequest++;
  trendReport.value = null;
  trendLoading.value = false;
  trendError.value = '';
};

/**
 * trend 产物是 JSON 快照，和字幕一样走预览通道读 blob 再解析；
 * 读不到或解析不了都只说明这条产物异常，不从别处补一份判定。
 */
const loadTrend = async () => {
  const request = ++trendRequest;
  trendReport.value = null;
  trendLoading.value = false;
  trendError.value = '';
  const version = selected.value;
  const workId = work.value?.id;
  if (!version || !workId) return;
  const file = version.artifacts?.find(item => item.kind === 'trend');
  if (!file) return;
  if (!file.available) {
    trendError.value = '趋势判定产物标记为不可用，无法读取 trend.json。';
    return;
  }
  trendLoading.value = true;
  try {
    const blob = await fetchNewsPreview(workId, version.id, file.artifactId);
    const raw = await blob.text();
    if (request !== trendRequest) return;
    const report = parseTrendReport(raw);
    if (report) trendReport.value = report;
    else trendError.value = '趋势判定解析失败：trend.json 不是 trend/1 契约或已损坏。';
  } catch {
    if (request === trendRequest) trendError.value = '趋势判定读取失败，可再选一次该版本重试。';
  } finally {
    if (request === trendRequest) trendLoading.value = false;
  }
};

const updatePlayhead = () => {
  playheadMs.value = Math.round((previewPlayer.value?.currentTime || 0) * 1000);
};

const applyPendingSeek = () => {
  const player = previewPlayer.value;
  if (pendingSeekMs === undefined || !player || player.readyState < 1) return;
  player.pause();
  player.currentTime = Math.min(pendingSeekMs / 1000, Math.max(0, player.duration - 0.05));
  pendingSeekMs = undefined;
  updatePlayhead();
};

const seekSegment = async (segment: ReviewSegment) => {
  const versionId = selected.value?.id;
  if (!previewUrl.value || previewKind.value !== 'mp4') await loadPreview('mp4');
  if (!versionId || selected.value?.id !== versionId || previewKind.value !== 'mp4' || !previewUrl.value) return;
  pendingSeekMs = segment.startMs;
  await nextTick();
  applyPendingSeek();
};

const noteSegment = (segment: ReviewSegment) => {
  const marker = `[${segment.label} ${timelineTime(segment.startMs)}—${timelineTime(segment.endMs)}] `;
  reviewForm.value.decision = 'rejected';
  if (!reviewForm.value.reason?.includes(marker)) {
    reviewForm.value.reason = [reviewForm.value.reason, marker].filter(Boolean).join('\n').slice(0, 1000);
  }
};

const handleSaveDraft = () => {
  draftFormRef.value?.validate(async (valid: boolean) => {
    if (!valid || !work.value) return;
    savingDraft.value = true;
    try {
      await saveNewsDraft(work.value.id, draftForm.value);
      modal.msgSuccess('草稿已保存');
      await reloadWork(work.value.id);
    } finally {
      savingDraft.value = false;
    }
  });
};

const handleGenerate = async () => {
  if (!work.value) return;
  // 换了模板就得先把草稿存下去，否则这次生成用的还是服务端记录的旧模板
  if (draftForm.value.templateKey !== work.value.templateKey) {
    await handleSaveDraft();
    if (draftForm.value.templateKey !== work.value?.templateKey) return;
  }
  try {
    await modal.confirm('发起生成会排队执行真实渲染，能力未放行时后端会直接拒绝。确定现在发起？');
  } catch {
    return;
  }
  generating.value = true;
  try {
    const res = await generateNewsVideo(work.value.id, {
      requestKey,
      expectedRevision: draftForm.value.expectedRevision
    });
    modal.msgSuccess(`已受理，任务 ${res.data.id}`);
    requestKey = newRequestKey();
    await reloadWork(work.value.id);
    await loadVersions();
    void watchTask(res.data.id);
  } finally {
    generating.value = false;
  }
};

const handleCancelTask = async () => {
  if (!liveTask.value) return;
  try {
    await modal.confirm('确定取消这次生成？执行中的渲染会先收到停止信号，确认进程退出后才显示已取消。');
  } catch {
    return;
  }
  await cancelProduction(liveTask.value.id);
  modal.msgSuccess('已提交取消');
};

const handlePreview = async (file: ProductionFile) => {
  if (!work.value || !selected.value) return;
  releasePreview();
  const request = previewRequest;
  previewLoading.value = true;
  try {
    const blob = await fetchNewsPreview(work.value.id, selected.value.id, file.artifactId);
    if (request !== previewRequest) return;
    previewKind.value = file.kind;
    previewUrl.value = URL.createObjectURL(blob);
  } finally {
    if (request === previewRequest) previewLoading.value = false;
  }
};

const loadPreview = async (kind: string) => {
  const file = artifact(kind);
  if (!file) {
    modal.msgError(kind === 'mp4' ? '这一版没有视频产物' : '这一版没有九宫格产物');
    return;
  }
  await handlePreview(file);
};

const handleDownload = (file?: ProductionFile) => {
  if (!work.value || !selected.value) return;
  const video = file ?? artifact('mp4');
  if (!video) {
    modal.msgError('该版本没有视频产物');
    return;
  }
  void download(
    `/heron/newsWork/${work.value.id}/versions/${selected.value.id}/download`,
    { artifactId: video.artifactId, videoSha256: video.sha256 },
    `${video.sha256.slice(0, 8)}.mp4`
  );
};

const handleReview = () => {
  reviewFormRef.value?.validate(async (valid: boolean) => {
    if (!valid || !work.value || !selected.value) return;
    reviewing.value = true;
    const version = selected.value;
    const workId = work.value.id;
    try {
      const res = await confirmNewsVersion(workId, version.id, {
        ...reviewForm.value,
        contactSha256: contactSha.value,
        videoSha256: videoSha.value
      });
      const message = `v${res.data.versionNo} · ${confirmationMessage(res.data)}`;
      if (['started', 'unknown'].includes(publicationState(res.data))) modal.msgWarning(message);
      else modal.msgSuccess(message);
      await handlePublishUpdated(res.data);
    } catch {
      try {
        const current = await getNewsVersion(workId, version.id);
        await handlePublishUpdated(current.data);
      } catch {
        modal.msgWarning('暂时无法刷新发布状态，请先到平台核对；系统不会自动重试上传。');
      }
    } finally {
      reviewing.value = false;
    }
  });
};

const loadCapabilities = async () => {
  try {
    const res = await getProductionCapabilities();
    capabilities.value = res.data;
  } catch {
    // 能力信息失败不阻塞工作室，请求层已提示
  }
};

const loadTemplates = async () => {
  try {
    const res = await listVideoTemplate();
    templates.value = res.data || [];
  } catch {
    // 模板目录读不到时右栏退化成只读文本框，不影响已有流程
  }
};

const load = async () => {
  stopWatch();
  releasePreview();
  releaseTrend();
  liveTask.value = undefined;
  requestKey = newRequestKey();
  selected.value = undefined;
  versionsRequest++;
  versionRequest++;
  subtitleRequest++;
  subtitleText.value = '';
  versions.value = [];
  versionTotal.value = 0;
  versionQuery.value.pageNum = 1;
  const workId = String(route.query.workId || '');
  if (!workId) {
    work.value = undefined;
    loading.value = false;
    return;
  }
  loading.value = true;
  try {
    await reloadWork(workId);
    await loadVersions();
    if (route.query.versionId) await selectRequestedVersion();
    else selectVersion(versions.value.find(row => row.id === work.value?.currentVersionId) || versions.value[0]);
    if (work.value?.activeTask) {
      void watchTask(work.value.activeTask.id);
    }
  } catch {
    work.value = undefined;
  } finally {
    loading.value = false;
  }
};

onBeforeUnmount(() => {
  subtitleRequest++;
  releaseTrend();
  stopWatch();
  releasePreview();
});
onMounted(() => {
  void loadCapabilities();
  void loadTemplates();
  void load();
});
watch(() => route.query.workId, load);
watch(() => route.query.versionId, () => { if (!loading.value) void selectRequestedVersion(); });
</script>

<style lang="scss" scoped>
.heron-work-studio-page {
  max-width: 1560px;
}

.studio-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--app-surface-border);
}

.studio-bar-meta {
  display: flex;
  align-items: center;
  gap: 10px;
}

.revision-badge {
  color: var(--app-text-faint);
  font-family: var(--app-font-mono);
  font-size: var(--app-font-size-2xs);
  font-variant-numeric: tabular-nums;
}

.studio-title {
  margin: 16px 0 8px;
  color: var(--app-text-title);
  font-size: var(--app-font-size-xl);
  font-weight: 600;
  line-height: 1.4;
}

/* 三栏：左结构 / 中预览 / 右设置。中间给最多空间，因为它放视频。 */
.studio-grid {
  display: grid;
  grid-template-columns: minmax(260px, 1fr) minmax(420px, 1.7fr) minmax(240px, 0.9fr);
  gap: 12px;
  align-items: start;
}

.studio-col {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.col-block {
  padding: 14px 16px;
  border: 1px solid var(--app-surface-border);
  border-radius: var(--app-radius-base);
  background: var(--app-surface-bg);
}

.block-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0 0 10px;
  color: var(--app-text-title);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
  letter-spacing: 0.02em;
}

.block-hint {
  color: var(--app-text-faint);
  font-family: var(--app-font-mono);
  font-size: var(--app-font-size-2xs);
  font-weight: 400;
}

.kv {
  display: grid;
  grid-template-columns: 64px 1fr;
  gap: 6px 10px;
  margin: 0;
  font-size: var(--app-font-size-xs);

  dt {
    color: var(--app-text-faint);
  }

  dd {
    margin: 0;
    color: var(--app-text-body);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.mono {
  font-family: var(--app-font-mono);
  font-size: var(--app-font-size-2xs);
}

/* 质量报告里的键值对标签更长、内容要能换行，不能沿用 64px 单行省略。 */
.kv.kv--wide {
  grid-template-columns: 84px 1fr;

  dd {
    white-space: normal;
    overflow-wrap: anywhere;
  }
}

.report-group {
  margin-top: 14px;

  &:first-of-type {
    margin-top: 0;
  }
}

.report-title {
  margin: 0 0 8px;
  color: var(--app-text-title);
  font-size: var(--app-font-size-xs);
  font-weight: 600;
}

.issue-list {
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--app-surface-border);
}

.issue {
  display: grid;
  grid-template-columns: 62px 92px 1fr;
  gap: 8px;
  padding: 7px 0;
  border-bottom: 1px solid var(--app-surface-border);
  font-size: var(--app-font-size-xs);
  line-height: 1.6;
}

.issue-severity {
  font-family: var(--app-font-mono);
  font-size: var(--app-font-size-2xs);
  letter-spacing: 0.04em;
  color: var(--app-text-faint);

  &.is-blocker,
  &.is-major {
    color: var(--app-danger);
  }

  &.is-minor {
    color: var(--app-warning);
  }
}

.issue-segment {
  font-family: var(--app-font-mono);
  color: var(--app-text-faint);
  word-break: break-all;
}

.issue-text {
  color: var(--app-text-body);
}

.issue-suggestion {
  display: block;
  color: var(--app-text-faint);
}

.minor-list {
  margin: 8px 0 0;
  padding-left: 18px;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: 1.7;
}

.gate-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.gate-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  font-size: var(--app-font-size-xs);
}

.gate-name {
  width: 120px;
  flex-shrink: 0;
  color: var(--app-text-title);
}

.gate-measured {
  color: var(--app-text-muted);
}

.script-lead {
  display: block;
  color: var(--app-text-title);
}

.script-body {
  display: block;
  color: var(--app-text-body);
}

.fact-ref {
  display: block;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-2xs);
}

.visual-note {
  margin-left: 6px;
  color: var(--app-text-faint);
  font-size: var(--app-font-size-2xs);
}

/* 成片级质量审稿：三类结论分区展示，证据片段原样保留换行。 */
.quality-counts {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin: 10px 0 0;
}

.count-label {
  color: var(--app-text-faint);
  font-size: var(--app-font-size-2xs);
}

.quality-mismatch {
  margin: 8px 0 0;
  color: var(--app-warning);
  font-size: var(--app-font-size-xs);
  line-height: 1.7;
}

.quality-class {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--app-surface-border);
}

.quality-class-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.quality-class-title {
  margin: 0;
  color: var(--app-text-title);
  font-size: var(--app-font-size-xs);
  font-weight: 600;
}

.quality-class-note {
  margin: 4px 0 0;
  color: var(--app-text-faint);
  font-size: var(--app-font-size-2xs);
  line-height: 1.7;
}

/* 补充评审抽帧：给人看的画面证据，和报告分区呈现，不混进判据列表。 */
.quality-frames {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--app-surface-border);
}

.quality-frames-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.quality-frame-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
  gap: 10px;
  margin-top: 8px;
}

.quality-frame {
  margin: 0;
}

.quality-frame img {
  display: block;
  width: 100%;
  border: 1px solid var(--app-surface-border);
  border-radius: var(--app-radius-sm, 4px);
}

.quality-frame figcaption {
  margin-top: 4px;
  color: var(--app-text-faint);
  font-size: var(--app-font-size-2xs);
}

.criterion-list {
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}

.criterion {
  padding: 8px 0;
  border-bottom: 1px solid var(--app-surface-border);
}

.criterion-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.criterion-name {
  color: var(--app-text-title);
  font-size: var(--app-font-size-xs);
  font-weight: 600;
}

.criterion-id {
  color: var(--app-text-faint);
}

.criterion-reason {
  margin: 6px 0 0;
  color: var(--app-text-body);
  font-size: var(--app-font-size-xs);
  line-height: 1.7;
}

.evidence-list {
  margin: 6px 0 0;
  padding: 0;
  list-style: none;
}

.evidence {
  margin-bottom: 4px;
  padding: 6px 8px;
  border-left: 2px solid var(--app-accent-border);
  background: var(--app-accent-softer);
}

.evidence-locator {
  display: block;
  color: var(--app-text-faint);
  font-size: var(--app-font-size-2xs);
}

.evidence-quote {
  display: block;
  margin-top: 2px;
  color: var(--app-text-body);
  font-size: var(--app-font-size-xs);
  line-height: 1.7;
  /* 证据是原文片段，换行要原样留着，不能压成一行 */
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.quality-extra {
  margin-top: 14px;
}

.quality-notes {
  margin-top: 12px;
}

.quality-note-list {
  margin: 6px 0 0;
  padding-left: 18px;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: 1.8;
}

.row-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.revision-tip {
  color: var(--app-text-faint);
  font-size: var(--app-font-size-2xs);
}

.version-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 1px;
  max-height: 320px;
  overflow: auto;
}

.version-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color var(--app-duration-fast) var(--app-ease);

  &:hover {
    background: var(--app-accent-softer);
  }

  &.is-active {
    border-color: var(--app-accent-border);
    background: var(--app-accent-soft);
  }
}

.version-no {
  color: var(--app-text-title);
  font-family: var(--app-font-mono);
  font-size: var(--app-font-size-xs);
  font-weight: 600;
}

.version-meta {
  display: flex;
  gap: 4px;
}

.version-time {
  color: var(--app-text-faint);
  font-family: var(--app-font-mono);
  font-size: var(--app-font-size-2xs);
}

.preview-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.preview-shell {
  margin-top: 4px;
}

.segment-review {
  margin-top: 16px;

  h4 {
    margin: 0 0 8px;
    font-size: var(--app-font-size-sm);
  }
}

.segment-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;

  li {
    padding: 10px;
    border: 1px solid var(--app-surface-border);
    border-radius: var(--app-radius-base);
  }

  .is-current {
    border-color: var(--el-color-primary);
    background: var(--app-accent-softer);
  }
}

.segment-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.segment-text {
  margin: 8px 0 0;
  color: var(--app-text-body);
  font-size: var(--app-font-size-xs);
  line-height: 1.7;
  overflow-wrap: anywhere;
}

.segment-empty {
  margin-top: 12px;
}

.contact-sheet {
  width: 100%;
  border: 1px solid var(--app-surface-border);
  border-radius: 8px;
}

.player {
  width: 100%;
  max-height: 480px;
  background: #000;
  border-radius: 8px;
}

.muted {
  margin: 0;
  color: var(--app-text-faint);
  font-size: var(--app-font-size-xs);
  line-height: 1.7;
}

.form-tip {
  margin: 4px 0 0;
  color: var(--app-text-faint);
  font-size: var(--app-font-size-2xs);
  line-height: 1.6;
}

.option-hint {
  float: right;
  color: var(--app-text-faint);
  font-family: var(--app-font-mono);
  font-size: var(--app-font-size-2xs);
}

.capability {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.cap-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  font-size: var(--app-font-size-xs);
}

.cap-label {
  color: var(--app-text-faint);
  flex-shrink: 0;
}

.cap-value {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: flex-end;
  color: var(--app-text-body);
}

.check-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.check-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--app-font-size-xs);
}

.check-dot {
  width: 6px;
  height: 6px;
  flex-shrink: 0;
  border-radius: 50%;
}

.is-pass .check-dot {
  background: var(--app-success);
}

.is-fail .check-dot {
  background: var(--app-danger);
}

.is-pass .check-gate {
  color: var(--app-text-muted);
}

.is-fail .check-gate {
  color: var(--app-danger);
  font-weight: 600;
}

.task-reason {
  margin-top: 4px;
  white-space: pre-wrap;
  word-break: break-all;
}

.review-hint {
  margin-left: 12px;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.metric-grid {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;

  .el-input-number {
    width: 120px;
  }
}

.publish-url-fix {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 520px;
}

.trend-tag {
  margin-left: 8px;
  vertical-align: middle;
}

.trend-kv {
  display: grid;
  grid-template-columns: 132px minmax(0, 1fr);
  gap: 6px 12px;
  margin: 10px 0 0;

  dt {
    color: var(--app-text-muted);
    font-size: var(--app-font-size-xs);
  }

  dd {
    margin: 0;
    color: var(--app-text-body);
    font-size: var(--app-font-size-xs);
    font-variant-numeric: tabular-nums;
  }
}

.trend-subblock {
  margin-top: 10px;

  h4 {
    margin: 0 0 4px;
    color: var(--app-text-muted);
    font-size: var(--app-font-size-xs);
    font-weight: 600;
  }

  ul {
    margin: 0;
    padding-left: 18px;
  }

  li,
  p {
    margin: 0 0 2px;
    color: var(--app-text-body);
    font-size: var(--app-font-size-xs);
    line-height: 1.7;
  }
}

@media (max-width: 1180px) {
  .studio-grid {
    grid-template-columns: 1fr;
  }
}
</style>
