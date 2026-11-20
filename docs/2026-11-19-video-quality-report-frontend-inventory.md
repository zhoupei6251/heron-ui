# 视频级质量报告：前端复用盘点与跨端字段契约

**日期**：2026-11-19
**范围**：`heron-ui`（分支 `dev`，HEAD `e81381e`）只读盘点 + 验收。不含实现。
**对应后端设计**：`heron/docs/plans/2026-11-19-data-board-story-plan.md`（story/1 设计，本轮未落地代码）

---

## 0. 一句话

质量报告要展示的 13 项内容里，**6 项后端已经返回但前端没接**（稿件、门禁、字幕时间、AI 审稿结论、待修问题、发布建议所需的审稿事实），**5 项必须后端新增字段**（叙事角度、开场钩子、每段叙事目的、画面重点、是否建议发布），**2 项现有结构根本拿不到**（关键帧/分镜预览、事实引用的逐条可读形态）。最小改动落点是**作品工作室页（`news/work/studio.vue`）加一节「内容质量报告」**，不新开导航页。

---

## 1. 工程验收（真实结果）

| 检查 | 命令 | 结果 |
|---|---|---|
| 类型检查 | `pnpm exec vue-tsc --noEmit` | **通过**，退出码 0，无输出 |
| 生产构建 | `pnpm build`（`vite build --mode production`） | **通过**，退出码 0，产物写入 `dist/`（已在 `.gitignore`） |
| Lint | `pnpm lint`（`oxlint src`） | **通过**，退出码 0，无告警 |

命令口径取自 `heron-ui/CLAUDE.md:63`（动页面/import 再 `pnpm lint` → 改公共 hooks/组件/构建再 `pnpm build`）。

**没有发现阻断构建的真实缺陷或类型错误**，本轮未改动任何前端代码（`git status` 与基线一致）。

---

## 2. 现有页面/组件覆盖盘点

### 2.1 作品工作室 —— `src/views/heron/news/work/studio.vue`（1295 行，三栏）

**这是质量报告唯一的正确落点**：它是唯一同时持有「作品 + 版本 + 门禁 + 逐段字幕 + 审片结论 + 发布状态」的页面。

现有 01–08 区块与质量报告 13 项的对应：

| studio.vue 区块 | 行号 | 覆盖的质量报告项 |
|---|---|---|
| 01 选题资料 | `:58` | 选题主题（弱：只有 candidateId / templateKey / voiceKey，**没有标题与摘要**） |
| 02 标题与口播稿 | `:70` | 开场钩子（弱：只有可编辑草稿 `draft`，**不是成片实际用的稿件**） |
| 03 版本历史 | `:95` | — |
| 04 画面预览 | `:132` | 关键帧预览（**部分**：九宫格 `contact_sheet` 一张，不是逐段关键帧） |
| ↳ 逐段审片 | `:152` | **字幕时间（完整）**：`reviewTimeline()` 从 `checks` 的 `subtitles` 闸 `measured` 取 `alignedScenes` / `sceneNStartMs` / `sceneNEndMs`，配合 `subtitles` 产物取每段文本 |
| 05 生成门禁 | `:180` | **技术质量检查结果（部分）**：`checkRows` 只取 `gate` / `passed` / `reason` / `inputLocator`，**丢掉了 `measured`**（`audioMs` / `durationMs` / `fps` / `bytes` / `blankFrames` / `checkErrors` / `cues` / `coveredMs` 等实测值全部没显示） |
| 06 人工审片 | `:195` | — |
| 07 发布核对 | `:247`（`PublishAttemptReview.vue`） | — |
| 平台回执 | `:249` | — |
| 08 发布表现 | `:294` | — |
| 右栏「质量检查」 | `:371` | 与 05 重复：同一份 `checkRows`，只画通过/未通过圆点 |

### 2.2 人工审片队列 —— `src/views/heron/review/index.vue`（399 行）

- 左表：作品 / 版本 / 时长 / 渲染状态 / 生成时间（`:23`–`:43`）
- 右面板：九宫格 + 成片双预览（`:71`）、审片表单（`:87`）
- **只做「能不能审」和「通过/驳回」，不做内容质量诊断**。这里没有门禁、没有逐段、没有稿件。

### 2.3 发布记录 —— `src/views/heron/publish/index.vue`（178 行）

- 单表 8 列（`:16`–`:76`）：作品 / 发布状态 / 版本 / 来源 / 账号 / 尝试登记时间 / 平台发布时间 / 作品链接
- 纯发布事实，**没有质量信息**，也不该加。

### 2.4 版本管理 —— `studio.vue` 的 03 区块

版本切换在 `studio.vue:650` 的 `selectVersion()`。切换时已重新拉取 metrics 与字幕（`:656`–`:657`），**但没有重新拉版本详情**——版本详情只在 `route.query.versionId` 变化时走 `getNewsVersion`（`:660`）。这意味着：如果新增的字段只在版本详情里有，切换版本时不会自动刷新。

### 2.5 总编辑决策 —— `src/views/heron/editorial/index.vue`（582 行）

**已有一份「内容质量报告」的雏形，只是不是视频级的**：

- 「线内编辑的选择」区块（`:108`–`:123`）：**叙事角度 `selection.storyAngle`** —— 有！
- 「AI 审稿」区块（`:134`–`:169`）：结论 / 核心断言 / 审稿版本 / 审于 / **issues 列表（severity + segmentId + description）**
- 「决策」区块（`:72`）：选题意图 / 判断理由

**关键事实**：`EditorialRun.reviewJson`（`src/api/heron/editorial/types.ts:28`）就是 `HeronVideoVersion.editorialReview` 的同一份字节（后端 `EditorialRunService.java:99`：`row.setReviewJson(version.getEditorialReview())`）。所以 AI 审稿结论**后端早就落库了**，只是视频级页面没读。

### 2.6 决策中心 —— `src/views/heron/decision/index.vue`（569 行）

独立核验（`verificationVerdict` / `verificationConflicts` / 人工放行理由），是**机会级**的，与视频无关。

### 2.7 表现分析 —— `src/views/heron/analytics/index.vue`（245 行）

按模板 / 生产线 / **叙事角度** / 来源四个维度聚合播放表现。注意：后端 `angle` 维度取的是 `input_snapshot.editorial.storyAngle`（`HeronNewsMetricMapper.xml` 第 48 行附近），**说明 storyAngle 已经落在冻结快照里**，只是不在视频级 API 上直接暴露。

### 2.8 原型工坊 —— `src/views/heron/proto/index.vue`（1052 行）

有一节「流水线校验」（`:335`–`:354`），展示结构 / 页面数 / 配色 / 字体 / 语义名 / 分组 / 引擎提交。这是**原型线**的技术质量证据展示，可作为「视频线质量报告怎么排版」的参照，但两线不共享数据，不能复用组件以外的逻辑。

---

## 3. API 层盘点

### 3.1 新闻作品与版本 —— `src/api/heron/newsWork/index.ts`

| 函数 | 方法 | 路径 | 参数 | 返回 |
|---|---|---|---|---|
| `listNewsWork` | GET | `/heron/newsWork/list` | `NewsWorkQuery`（title, candidateId + 分页） | `PageResult<NewsWork>` |
| `getNewsWork` | GET | `/heron/newsWork/{workId}` | workId | `NewsWork`（含 `currentVersion` / `activeTask`） |
| `saveNewsDraft` | PUT | `/heron/newsWork/{workId}/draft` | `NewsDraftForm` | `NewsWork` |
| `generateNewsVideo` | POST | `/heron/newsWork/{workId}/generate` | `NewsGenerateForm` | `ProductionReceipt` |
| `listNewsVersions` | GET | `/heron/newsWork/{workId}/versions` | PageQuery | `PageResult<NewsVideoVersion>` |
| `listReviewQueue` | GET | `/heron/newsWork/review/queue` | PageQuery | `PageResult<NewsVideoVersion>` |
| `listPublishedVersions` | GET | `/heron/newsWork/published` | PageQuery | `PageResult<NewsVideoVersion>` |
| `getNewsVersion` | GET | `/heron/newsWork/{workId}/versions/{versionId}` | workId, versionId | `NewsVideoVersion` |
| `confirmNewsVersion` | POST | `.../versions/{versionId}/confirm` | `NewsReviewForm` | `NewsVideoVersion`（timeout 300s） |
| `backfillNewsPublishUrl` | POST | `.../versions/{versionId}/publish-url` | `{workUrl}` | `NewsVideoVersion` |
| `resolveNewsPublishAttempt` | POST | `.../publish-attempts/{attemptId}/resolve` | `NewsPublishResolution` | `NewsVideoVersion` |
| `fetchNewsPreview` | GET | `.../preview/{artifactId}` | artifactId | `Blob`（登录态保护） |

### 3.2 生产任务 —— `src/api/heron/production/index.ts`

| 函数 | 路径 | 返回 |
|---|---|---|
| `listProduction` | GET `/heron/production/list` | `PageResult<ProductionTask>` |
| `getProduction` | GET `/heron/production/{taskId}` | `ProductionTask` |
| `cancelProduction` | POST `/heron/production/{taskId}/cancel` | `ProductionTask` |
| `getProductionCapabilities` | GET `/heron/production/capabilities` | `ProductionCapabilities` |

`ProductionTask.steps[].evidence[]` 是 `ProductionFile[]`，即**每个渲染阶段的证据产物**（`src/api/heron/production/types.ts:20`–`:28`）。

### 3.3 表现数据 —— `src/api/heron/metrics/index.ts`

- `listNewsMetrics(versionId)` → GET `/heron/metrics/{versionId}` → `NewsMetric[]`（plays / completionRate / likes / comments / shares / fetchedAt）
- `saveNewsMetric(data)` → POST `/heron/metrics`
- `getMetricBreakdown(dimension)` → GET `/heron/metrics/breakdown?dimension=` → `MetricBreakdown[]`

### 3.4 总编辑 / 决策 / 研究 —— `src/api/heron/{editorial,decision,research}/index.ts`

- `listEditorialRuns` → GET `/heron/editorial/runs` → `PageResult<EditorialRun>`（含 `poolJson` / `selectionJson` / `reviewJson`）
- `listDecision` / `getDecision` / `promoteDecision` / `acceptDecision` / `rejectDecision` → `/heron/decision/*`
- `listResearch` / `getResearch` / `addResearch` / `rerunResearch` / `cancelResearch` → `/heron/research/*`（`reportJson` / `evidenceJson` 结构化报告）

---

## 4. 字段清单：已有 / 需新增 / 拿不到

**判定依据是后端 VO 与前端 types 的对照**，不是页面观感。

后端 `NewsVideoVersionVo`（`heron/ruoyi-modules/ruoyi-heron/src/main/java/org/dromara/heron/domain/vo/NewsVideoVersionVo.java`）实际字段：

```
versionId / workId / ownerId / versionNo / taskId
inputSnapshot(:19) / script(:20) / checks(:21) / editorialReview(:23)
durationMs / reviewStatus / reviewBy / reviewAt / reviewReason
reviewContactSha / reviewVideoSha
publishSource / publishUrl / publishAccount / publishAt / publishBy / publishVideoSha
cleanupStartedAt / cleanedAt / createTime
taskStatus / taskErrorCode / taskErrorReason
artifacts[] / publishAttempt / workTitle
```

前端 `NewsVideoVersion`（`src/api/heron/newsWork/types.ts:43`–`:72`）**缺三个字段**：`inputSnapshot`、`editorialReview`，以及 `script` 虽有但全站无人读。

### 4.1 已有 —— 后端已返回，前端只是没接（6 项）

| # | 质量报告项 | 数据来源 | 后端位置 | 前端现状 |
|---|---|---|---|---|
| 1 | **核心结论** | `NewsVideoVersion.script` → JSON 的 `title` / `scenes[].lead` / `scenes[].body` / `closing` | VO `:20`，落库 `NewsProductionDomain.java:192` | `types.ts:49` 已声明 `script?: string`，但**全站零处读取**（grep `.script` 无命中）。后端 `listVersionView` 在**列表**接口把 script 置 null（`NewsWorkServiceImpl.java:429`），只有 `getNewsVersion` / `getNewsWork` 的 `currentVersion` 才有 |
| 2 | **事实引用** | `script` 里的 `{{facts.*}}` 占位符（数据看板线）；`script.source_url` / `body_sha256`（解说线） | `DatasetScriptAuthor.java:98`–`:102`、`NewsModelScriptAuthor.java:81`–`:83` | 同上，script 没被读。数据看板线的 `dataset` 产物（`DATA_KINDS` 第 7 类）落库了但前端无入口 |
| 3 | **字幕时间** | `checks` → `subtitles` 闸 `measured`：`alignedScenes` / `sceneNStartMs` / `sceneNEndMs` / `closingStartMs` / `closingEndMs` / `cues` / `coveredMs` / `audioMs` | `NewsProductionPipeline.java:467`–`:476` | **已完整使用**：`review-timeline.ts:15`–`:52` |
| 4 | **技术质量检查结果（实测值）** | `checks` 各闸 `measured`：`audioMs`/`voiceBytes`、`durationMs`/`fps`/`videoStreams`/`audioStreams`、`bytes`/`exitCode`、`blankFrames`/`checkErrors`/`checkWarnings`、`aigcTag`、`badgeAssertion`/`motionSamples`、`fontMatched`/`manifestMatched`/`templateMatched`、`dataSha`/`rows`/`points` | `NewsProductionPipeline.java:590`–`:604`（`gateJson` 统一落 `measured`） | **只取了一半**：`studio.vue:562`–`:575` 的 `checkRows` 丢掉 `measured`，只留 `gate`/`passed`/`reason`/`inputLocator` |
| 5 | **内容质量审查结论** | `NewsVideoVersion.editorialReview` → `result`/`coreFacts`/`issues[]`/`minorSuggestions[]`/`repairAttempts`/`promptVersion`/`reviewedAt` | VO `:23`，落库 `NewsProductionDomain.java:194`；`EditorialReviewer.java:47` 定义 Verdict | **前端完全没这个字段**。同一份字节在总编辑页以 `reviewJson` 展示（`editorial/index.vue:134`–`:169`，前端类型 `editorial/types.ts:42`–`:58`）。`editorialReview` 在**列表接口也不置 null**（后端只 null 了 `inputSnapshot` 与 `script`） |
| 6 | **待修问题** | 同上 `editorialReview.issues[]`：`severity` / `segmentId` / `description` / `suggestion`；外加 `minorSuggestions[]` | `EditorialReviewer.java:38`（Issue record） | 同上，总编辑页已展示 issues 列表，视频级没有 |

### 4.2 必须后端新增字段（5 项）

| # | 质量报告项 | 现在为什么拿不到 | 需要后端给什么 |
|---|---|---|---|
| 7 | **叙事角度（story）** | 冻结快照 `inputSnapshot.selection.storyAngle` 里有（`NewsProductionDomain.java:85`），但 `listVersionView` 把 `inputSnapshot` 置 null（`NewsWorkServiceImpl.java:428`），且前端未声明该字段 | **按 story/1 设计，`inputSnapshot` 的 `story` 节点**（`narrative` / `oneLine` / `tension` / `claims[]` / `payoff` / `stakes` / `assumptions` / `basis`）。后端设计文档已明确落在 `heron_video_version.input_snapshot → story`，**不新增表、不新增列**。前端需要：**单版本详情能拿到未置 null 的 `inputSnapshot`**，或后端在 VO 上加一个 `story` 字段直接给 |
| 8 | **开场钩子** | `script.scenes[0].lead` 是事实上的第一段开场，但「钩子类型」（数字反差 / 疑问悬念 / 利益相关 / 时间紧迫 / 反常识）**在 `DatasetTitleAuthor.parse()` 里被丢弃**（后端设计文档 §1 已取证） | 标题的 `kind` 随 story 一起下发（story/1 §8.1 已列此改动项）。前端要一个枚举 + 中文标签 |
| 9 | **每段叙事目的** | `script.scenes[]` 有 `lead`/`body`/`duration_s`，但**没有「这段为什么存在」**。story/1 §9.2 定了位置映射：`scenes[0]`→`tension`、`scenes[1..n-2]`→`claims[]` 顺序、`closing`→`payoff` | story 的 `claims[].text` + 一段到一段的映射（下标即可，前端可自算，不需要后端给映射字段） |
| 10 | **画面重点** | 数据看板线的画面重点由 `DatasetVisualFocus.forScene()` **在渲染期算出来，不落库**（`NewsProductionPipeline.java:897`–`:899` 只把它塞进渲染变量）。解说线有 `scenes[].visual`（`NewsScriptContract.java:31`，v2 场景类型才允许），数据看板线没有 | 要么 story 侧补「这段该看什么」，要么后端把 `DatasetVisualFocus.Focus`（mode/refs/labels）落到 script 或产物里 |
| 11 | **是否建议发布** | 现在是**三段分离的判定**，没有一个统一字段：① 人工审片 `reviewStatus`（approved/rejected）② AI 审稿 `editorialReview.result`（PASS/FAIL）③ 后端自动发布闸 `checkEditorialPass()`（`NewsWorkServiceImpl.java:517`–`:524`，只认落盘 PASS + `coreFacts=supported`） | 一个**显式的布尔 + 理由**字段，例如 `publishRecommendation: { recommend: boolean, reason: string, blockers: string[] }`。理由必须能回答「哪条闸 + 哪段输入 + 为什么拒」，这与项目既有约定一致 |

### 4.3 现有结构根本拿不到（2 项）

| # | 质量报告项 | 现状 | 结论 |
|---|---|---|---|
| 12 | **关键帧 / 分镜预览** | 产物只有 `mp4` / `contact_sheet`（九宫格一张）/ `script` / `subtitles` / `checks` / `asset_manifest`，数据看板线多一个 `dataset`（`NewsProductionDomain.java:33`–`:39`）。**没有逐段关键帧产物** | 要么接受「九宫格 + 逐段时间轴」作为分镜预览的近似（前端已有这两样，可直接拼），要么后端新增产物种类。**建议先用近似**：九宫格是 9 帧，与 3–6 段不是一一对应，会误导 |
| 13 | **事实引用的逐条可读形态** | `{{facts.*}}` 是占位符路径（如 `facts.last.value`），**不是**「这句话引用了金价收盘价 2412.3 美元」这种可读形态。`dataset` 产物里有真实值，但**要前端自己解析并回填占位符** | 后端在 story 的 `claims[].evidenceRefs` 之外，再给一份**已解析的引用值**（`{ref, path, label, value}`）最省事。否则前端要实现一遍占位符解析 |

---

## 5. 最小改动建议

**落点：作品工作室页 `src/views/heron/news/work/studio.vue`，中栏加一节「09 内容质量报告」。** 不新开导航页，不新开路由。

理由：这是唯一同时持有版本详情、门禁、逐段字幕、审片结论与发布状态的页面；质量报告是「一条视频的全景」，跨作品列表（审片队列、发布记录）天然不适合承载它。

### 5.1 复用哪些现成组件

| 用途 | 复用 |
|---|---|
| 区块外壳 | `studio.vue` 已有的 `section.col-block` + `h3.block-title`（`:987`–`:993`） |
| 键值对 | `dl.kv`（`:996`–`:1014`）——决策/审片类字段用这个，和「06 人工审片」的 `el-descriptions` 二选一 |
| 表格 | `el-table size="small" border`——「05 生成门禁」已经在用同一套（`:181`） |
| 逐段列表 | `ol.segment-list` + `li.is-current` 高亮（`:1117`–`:1135`）——「每段叙事目的」直接复用，还能和 `playheadMs` 联动高亮 |
| 门禁结论 | `checkRows` 的 `passed` → `el-tag type="success"\|"danger"`（`:185`） |
| 标签色 | `studio.vue:429`–`:434` 的 `reviewText` / `reviewTag` 映射表 |

### 5.2 建议的三段式结构

```
09 内容质量报告
  ├─ 09.1 策划与叙事（dl.kv）
  │    叙事类型 / 一句话故事 / 张力 / 落点 / 叙事角度 / 选题主题
  ├─ 09.2 逐段对照（ol.segment-list，与播放头联动）
  │    每段：时间区间 + 叙事目的（claim）+ 口播正文 + 引用的事实 + 画面重点
  └─ 09.3 质量结论（el-table）
         技术闸实测值（把 checkRows 的 measured 显示出来）
         AI 审稿结论 + issues（severity/segmentId/description/suggestion）
         发布建议（recommend + reason）
```

### 5.3 前端这一轮要做的（等后端字段到位后）

1. `src/api/heron/newsWork/types.ts` 的 `NewsVideoVersion` 补三个字段：
   - `editorialReview?: string`（**后端已有，纯前端漏声明**）
   - `inputSnapshot?: string`（**后端已有，列表接口置 null，详情接口有**）
   - `story?: string` 或 `story?: StoryRecord`（**等后端决定落点**）
2. 把 `studio.vue:562` 的 `checkRows` 扩展出 `measured`，在 05 区块的表格加一列「实测值」。
3. 新增 `story` 的 TS 类型定义（按 story/1 §4.2 字段表）。

### 5.4 一个必须先解决的前端细节

`studio.vue:650` 的 `selectVersion()` **不重新拉版本详情**，只换 `selected` 引用。如果 `story` / `inputSnapshot` 只在 `getNewsVersion`（单版本详情）里给，切换版本时数据不会更新。

两个选项：
- 后端在 `listNewsVersions` 里给 `story`（推荐：列表接口已有 `checks`，加一个 `story` 的体量可接受）
- 前端在 `selectVersion()` 里补一次 `getNewsVersion` 调用（多一次请求，但不影响现有交互）

**建议后端在 `listNewsVersions` 与 `getNewsVersion` 两个接口都给同一份 `story`**，前端就不用改切换逻辑。

---

## 6. 给后端的字段契约清单

> 用途：后端同事本轮新增/调整字段时，直接照这份清单对接，避免前端再猜。

### 6.1 后端已有、前端本轮补声明即可（不需要后端改）

| 字段 | 载体 | 备注 |
|---|---|---|
| `editorialReview` | `NewsVideoVersionVo`（`:23`） | 列表接口已带（后端只 null 了 `inputSnapshot` 与 `script`）。前端补 TS 声明 |
| `script` | `NewsVideoVersionVo`（`:20`） | **列表接口被置 null**（`NewsWorkServiceImpl.java:429`）。前端要展示稿件，需要后端在 `listNewsVersions` 里保留，或前端改用 `getNewsVersion` |
| `inputSnapshot` | `NewsVideoVersionVo`（`:19`） | 列表接口被置 null（`:428`）。单版本详情有 |
| `checks[].measured` | `checks` JSON 内 | 完整数据已在，只是前端 `checkRows` 没读 |

### 6.2 需要后端新增/调整（前端等这些）

| 字段 | 类型建议 | 放在哪 | 前端拿它做什么 |
|---|---|---|---|
| `story` | 结构化对象（字段见 story/1 §4.2：`schemaVersion`/`narrative`/`oneLine`/`protagonist`/`tension`/`claims[]`/`payoff`/`stakes`/`assumptions`/`basis`） | `NewsVideoVersionVo` 新增字段，或 `inputSnapshot.story` | 09.1 策划与叙事、09.2 每段叙事目的、标题钩子类型 |
| `story.titleKind` | 枚举（`numeric_contrast` / `question` / `interest` / `time_urgent` / `counter_intuitive`） | 同 `story` 内 | 09.1 开场钩子 |
| `story.claims[].evidence` | `{ ref, path, label, value }[]` | 同 `story` 内 | 09.2 事实引用的可读形态 |
| `publishRecommendation` | `{ recommend: boolean, reason: string, blockers: string[] }` | `NewsVideoVersionVo` 新增字段 | 09.3 发布建议 |
| 分镜预览 | 要么新增产物种类，要么明确「九宫格 + 时间轴」为近似口径 | 产物 / 契约 | 09.2 分镜预览 |

### 6.3 前端能自己算、不用后端给的

- **每段叙事目的 ↔ story.claims 的映射**：按 story/1 §9.2 的位置约定（`scenes[0]`→tension，`scenes[1..n-2]`→claims 顺序，`closing`→payoff），前端按下标算，不需要后端给映射字段。
- **字幕时间**：现有 `checks.subtitles.measured` + `subtitles` 产物已够，前端已实现（`review-timeline.ts`）。

---

## 7. 未验证项

- **没有在浏览器里跑起来看效果**。本轮是只读盘点 + 构建验收，未启动 dev server，也未做页面交互验证。
- **没有连真实后端验证返回体**。字段判定依据是后端 VO 源码与前端 types 源码对照，不是运行时抓包。`script` / `inputSnapshot` 在列表接口被置 null 这条，依据是 `NewsWorkServiceImpl.java:428`–`:429`。
- story/1 是后端设计文档，**代码尚未落地**（grep `story/1` / `EditorialStory` / `storyNode` 在后端源码无命中）。§4.2 里 story 相关的字段形状取自该设计文档，不是已实现的事实。
- `EditorialRun.reviewJson` 与 `HeronVideoVersion.editorialReview` 是同一份字节，依据是 `EditorialRunService.java:99`；未做运行时比对。
