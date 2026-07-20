# ueat 原型文档目录

这组文档基于当前 Web 原型、后端服务和 Android 打包路线整理。当前技术栈是 React/Vite 前端、Express 后端、PostgreSQL 数据库，并通过 Capacitor 封装 Android APK。

## 阅读顺序

1. [01-product-scope.md](./01-product-scope.md)：产品范围、核心用户动作和当前原型边界。
2. [02-navigation-usecases.md](./02-navigation-usecases.md)：按页面整理跳转、浮层和返回关系。
3. [03-state-and-data-model.md](./03-state-and-data-model.md)：前端状态、mock/config 数据、主要类型和桌宠状态。
4. [04-interaction-spec.md](./04-interaction-spec.md)：首页、社区、聊天、我的、设置和桌宠交互说明。
5. [05-future-multiplatform-notes.md](./05-future-multiplatform-notes.md)：Android App 打包路线、Capacitor 适配注意事项和后续多端说明。
6. [06-code-file-guide.md](./06-code-file-guide.md)：当前代码文件职责和后续模块化建议。
7. [07-real-web-mvp-backend-plan.md](./07-real-web-mvp-backend-plan.md)：真实 Web/App 技术原型的数据库、接口和前端替换 mock 顺序。
8. [08-local-to-production-runbook.md](./08-local-to-production-runbook.md)：从本地跑通到 Ubuntu 云服务器、正式部署和健康检查的执行手册。
9. [09-postgresql-realtime-profile-migration.md](./09-postgresql-realtime-profile-migration.md)：PostgreSQL、实时社区同步和个人主页读写迁移说明。
10. [10-android-github-release.md](./10-android-github-release.md)：Android GitHub Release 打包说明。
11. [11-pet-companion.md](./11-pet-companion.md)：桌宠功能、交互规则、活跃度奖励、云同步和素材来源说明。
12. [12-ai-icebreaker-assistant.md](./12-ai-icebreaker-assistant.md)：AI 破冰与推进助手的产品设定、数据边界、算法路线和模型选择。
13. [13-ai-icebreaker-m5-governance.md](./13-ai-icebreaker-m5-governance.md)：AI 破冰助手 M5 的治理、安全过滤、可观测接口和当前算法隐患清单。
14. [14-home-meal-card-matching-algorithm.md](./14-home-meal-card-matching-algorithm.md)：首页饭卡匹配算法现状、评分因子、前端筛选边界、合理性评估和后续风险。
15. [15-semantic-embedding-upgrade-plan.md](./15-semantic-embedding-upgrade-plan.md)：AI 破冰和首页匹配共用的语义归一、真实 embedding、pgvector 迁移与后台预计算计划。

## 当前权威图表

- [prototype-navigation-usecases.md](./prototype-navigation-usecases.md) 是当前页面跳转与 use case 图的源文档。
- 编号文档从 use case 图展开，便于设计、前端、后端或其他 AI 分模块阅读。

## 文档维护原则

- 新增页面时，先更新 `prototype-navigation-usecases.md` 的 Mermaid 图。
- 新增交互时，同步更新 `04-interaction-spec.md`。
- 新增状态、数据字段或本地/云端存储结构时，同步更新 `03-state-and-data-model.md`。
- 新增、删除或大幅移动代码文件时，同步更新 `06-code-file-guide.md`。
- 涉及真实 Web、后端、数据库、接口、登录注册、云同步或实时聊天时，同步更新 `07-real-web-mvp-backend-plan.md`。
- 涉及本地开发、测试环境、正式部署、环境变量、上线检查时，同步更新 `08-local-to-production-runbook.md`。
- 涉及 Android、Capacitor、App 权限、安全区、返回键或后续多端限制时，同步更新 `05-future-multiplatform-notes.md`。
- 涉及桌宠动作、状态、奖励、素材或云同步时，同步更新 `11-pet-companion.md`。

## 最近补充

- `09-postgresql-realtime-profile-migration.md`：记录云端 PostgreSQL、WebSocket 和个人主页读写迁移。
- `10-android-github-release.md`：记录 GitHub Release APK 打包方式。
- `11-pet-companion.md`：记录桌宠的当前实现和后续官方素材库/AI 媒介方向。
- `12-ai-icebreaker-assistant.md`：记录 AI 破冰键盘、饭卡开场、接话/推进、画像向量召回和模型成本路线。
- `13-ai-icebreaker-m5-governance.md`：记录 AI 破冰助手 M5 基础治理、线上验收点和算法隐患。
- `14-home-meal-card-matching-algorithm.md`：记录首页饭卡推荐排序的当前公式、数据来源、筛选逻辑和算法风险评估。
- `15-semantic-embedding-upgrade-plan.md`：记录从 `local-hash-embedding-v1` 升级到专用 embedding 模型，并迁移到首页匹配的实施路线。
