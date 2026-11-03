# Heron 前端项目指令

以下路径相对本仓库根目录；单独打开前端仓库时也按此入口读取。

## 编码前读取

1. [CLAUDE.md](CLAUDE.md)：项目定位、页面约定、视觉边界、设计工具（ui-ux-pro-max / impeccable / taste-skill 各自什么时候用）与验证命令。
2. [前端编码 Skill](.codex/skills/frontend-crud-coding/SKILL.md) 和 [前端 reference](.codex/skills/frontend-crud-coding/references/frontend.md)。
3. 需要场景细化或委派时读取 [前端角色入口](.claude/agents/frontend-crud-coding.md)，再按其路由读取适用角色，不展开全部角色。
4. 涉及后端时同时读取 [后端入口](../heron/AGENTS.md)；业务需求查阅 [业务规格](../heron/docs/plans/2026-10-29-heron-business-spec.md)。

Qoder 可直接读取以上指导材料；只有会话已列出的 Skill 和 Agent 才能按原生名称调用，文件存在不代表同名能力已注册。不要复制 Claude/Codex 的平台配置、权限或 Hooks。

## 实施与验证

- 以目标目录真实页面、API、types 和公共 hooks 为先，生成模板只作骨架；具体规则与命令沿用上述源文件，不另建一套规范。
- 保留若依基座和已有交互；不为单页需求修改全局组件样式。主题方案尚未拍板，不因初始化顺便改色。
- 保留已有未提交工作；提交、推送、发布、服务重启和后端数据变更分别确认授权范围。
- 按影响范围执行类型检查、lint、构建；改 UI 时启动开发服务，用真实浏览器验证主路径与边界，不能验证时明确说明。
- 仅改指令时检查引用路径、内容和 diff，不运行应用构建。
