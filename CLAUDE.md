# heron-ui 前端（plus-ui 6.0.0）

> 项目级指令，覆盖 `~/.claude/CLAUDE.md` 中冲突的默认习惯；全局的 L1–L4 自检（能配置/能复用/一条命令解决就不写代码）仍然有效。

## 这是什么

plus-ui 6.0.0 基线：Vue 3 + TypeScript + Element Plus + Vite 8 + UnoCSS + Pinia，包管理 pnpm，格式 oxfmt、lint oxlint。
标题已是 `Heron 后台管理系统`，业务页尚不存在；后端在 `../heron`（业务模块 `ruoyi-heron`，开发代理前缀 `/dev-api`）。
业务规格见 `../heron/docs/plans/2026-10-29-heron-business-spec.md`。

## 写代码前必读（不得凭记忆）

1. Read `.codex/skills/frontend-crud-coding/SKILL.md`
2. 再读 `.codex/skills/frontend-crud-coding/references/frontend.md`；不确定任务边界或需要标准用例时读 `references/examples.md`

`.claude/agents/*.md` 是分场景子代理定义：`frontend-crud-page`、`frontend-crud-coding`、`frontend-api-types`、`frontend-page-enhancement`。

## 取样顺序（冲突时从高到低）

1. 目标目录最近似的页面 / API / types 真实实现
2. 项目公共 hooks、组件、工具、样式
3. `gen/*.ftl` 生成模板（`index.vue.ftl` / `index-tree.vue.ftl` / `api.ts.ftl` / `types.ts.ftl`）—— 是骨架，不是最终答案
4. 通用 Vue 3 / Element Plus 习惯

## 不可妥协的约定

- `<script setup name="Xxx" lang="ts">`；UTF-8、LF、2 空格缩进
- 新增业务页三件套：`src/api/<module>/<business>/index.ts` + `types.ts` + `src/views/<module>/<business>/index.vue`，路由与后端 `@RequestMapping` 一一对应
- 请求走 `@/utils/request`；下载 `import { download as requestDownload } from '@/utils/request'`；`AxiosPromise` 来自 `@/utils/api-types`（**不要从 axios 引**），`PageResult` 来自 `@/api/types`
- 页面壳：`p-2 app-container <module>-<business>-page`，配 `search-panel` / `table-panel` / `toolbar-shell` / `data-table` / `right-toolbar` / `pagination`
- 状态与交互用现成 hooks（`src/hooks/`）：`useLoading`、`useFormDialog`、`useDialogState`、`useSearchToggle`、`useSearchReset`、`useTableSelection`、`useDateRangeQuery`、`useTreeTableExpand`；查询/表单状态用 `reactive<PageData<Form, Query>>({ form, queryParams, rules })`
- 权限指令 `v-hasPermi`；同文件已用 `v-has-permi` 就保持原样，不为统一写法重排无关代码
- 公共组件优先：`DictTag`、`ImageUpload`、`FileUpload`、`Editor`、`TreePanel`、`RightToolbar`、`Pagination`；不为单页需求改全局组件样式
- 复杂页面增量修改，不删现有的日期范围 `params`、导入导出、树筛选、列显隐、状态切换能力
- 类型能收窄就收窄，不把页面逻辑写成 `any`；类型放 `types.ts`，不塞进页面

## 视觉（未拍板，别当既定事实）

- 不用靛紫 / 靛蓝；旧决策的品牌主色是青 `#1b6c80`，「生产轨道」（九步在轨、五道闸画在进入格之前）是 heron 的签名元素
- 要落地就得改成 Element Plus 的 primary 色阶与 UnoCSS 主题，不是只改一个 CSS 变量；用户确认后再动

## 设计工具（画前端时按序用）

管理后台属于**应用界面**，不是「页面」。按应用界面路线走：安静边框、小标签、重复面板是正常的；渐变、发光、彩色图标块、彩虹图表、编造的漂亮数字不是。

| 阶段 | 工具 | 怎么用 |
|---|---|---|
| 定体系（色板 / 字体 / 间距 / token / 组件规范） | ui-ux-pro-max | `Skill: ui-ux-pro-max`；查 `data/stacks/vue.csv`、`data/web-interface.csv`、`data/ux-guidelines.csv`；要成套 token 用 `search.py "<query>" --design-system -p "Heron"` |
| 写完自检（自动） | impeccable | `Skill: impeccable`；Edit/Write 后 hook 自动回灌反 slop 发现，不用记得调 |
| 评审 / 收尾 / 边界 | impeccable | `/impeccable critique`（设计打分排序）、`/impeccable audit`（可访问性 / 性能 / 主题 / 响应式，P0–P3）、`/impeccable polish`（收尾）、`/impeccable harden`（错误 / 溢出 / 空态） |
| 需要发散视觉方向时 | taste-skill | `Skill: taste-skill:design-taste-frontend`；只走 `references/app-screens.md` 那条线，不要套落地页那套 |

heron 专属约束（覆盖这些工具的通用建议）：

- **不用靛紫 / 靛蓝**：impeccable 的 `ai-color-palette` 规则会直接命中这类渐变；确认配色时按青 `#1b6c80` 走，别被工具的默认建议带偏
- 主色落地要改 Element Plus primary 色阶 + UnoCSS 主题，不是一个 CSS 变量
- 「生产轨道」（九步在轨、五道闸画在进入格之前）是签名元素，优先复用已有图形语言，别另造一套
- 主题方案未拍板前，设计工具只用来出方案和查规范，**不落色**；用户确认后再改
- 工具的通用最佳实践 < 本文件「不可妥协的约定」与「取样顺序」；工具建议与项目现有模式冲突时，跟项目走

## 验证

- `pnpm exec vue-tsc --noEmit` → 动页面/import 再 `pnpm lint` → 改公共 hooks/组件/构建再 `pnpm build`
- 起开发服务：`pnpm dev`
