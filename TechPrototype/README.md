# TechPrototype 技术原型目录

本目录用于提交第二周技术原型迭代成果。当前先放入技术方案、架构视图与 UML 草案，后续可继续补充技术原型代码、测试记录、迭代评估报告和最终 Word/PPT 版本。

## 当前文件

- `技术方案.md`：覆盖架构风格、语言框架工具、编程规范、核心算法和技术亮点。
- `UML与架构视图草案.md`：包含用例模型、分析模型、设计模型、逻辑视图、开发视图、进程视图、部署视图和数据视图草案。
- `Capacitor Android App打包与适配指引.md`：说明最终 Android App 展示路线、打包步骤、Ubuntu 后端接入和适配风险。
- `Ubuntu云服务器与App后端部署说明.md`：根据课程 Ubuntu 云主机手册整理服务器创建、端口、安全组、Nginx 反代和 App 联调步骤。
- `Codex任务提示词-App与云后端.md`：给 vibe coding 使用的 Codex/AI 提示词模板，约束 App、前端、后端、云服务器的任务边界。

## 与第一周界面原型的关系

- 第一周界面原型主要参考 `web/` 与 `web/docs/`。
- 技术原型优先复用现有 React/Vite 原型中的页面流程、hooks 状态边界、类型定义和 mock 数据。
- 本轮最终展示形态调整为 Android App：优先完善 `web/` 移动端体验，再通过 Capacitor 封装 APK。
- 后续接真实后端时，优先替换 `web/src/hooks` 内部实现，再逐步引入 API service、持久化数据库和实时消息能力。
- 页面配色、毛玻璃材质、弹窗抽屉与动效实现应先参考 `web/docs/10-ui-design-reference.md`，原始 Word、PDF 和 11 张配图保存在 `web/docs/ui-reference/xiaohongshu-five-notes/`。
