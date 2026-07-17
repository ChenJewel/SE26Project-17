# ueat 原型文档目录

这组文档基于当前 Web 原型和 `prototype-navigation-usecases.md` 整理。当前代码仍是 React/Vite 原型，页面跳转和数据多为本地 state；第二周技术原型展示目标为 Android App，推荐通过 Capacitor 将移动端 Web 产物封装为 APK。

## 阅读顺序

1. [01-product-scope.md](./01-product-scope.md)：产品范围、核心用户动作和当前原型边界。
2. [02-navigation-usecases.md](./02-navigation-usecases.md)：按页面整理跳转、浮层、返回关系。
3. [03-state-and-data-model.md](./03-state-and-data-model.md)：当前本地 state、mock 数据和未来接口模型。
4. [04-interaction-spec.md](./04-interaction-spec.md)：首页划卡、搜索、社区、聊天、我的、设置的交互说明。
5. [05-future-multiplatform-notes.md](./05-future-multiplatform-notes.md)：Android App 打包路线、Capacitor 适配注意事项和后续多端说明。
6. [06-code-file-guide.md](./06-code-file-guide.md)：当前代码文件职责和后续模块化建议。
7. [07-real-web-mvp-backend-plan.md](./07-real-web-mvp-backend-plan.md)：真实 Web MVP 的数据库、接口和前端替换 mock 顺序。
8. [08-local-to-production-runbook.md](./08-local-to-production-runbook.md)：从本地跑通到测试环境、正式线上部署的具体执行步骤。
9. [09-postgresql-realtime-profile-migration.md](./09-postgresql-realtime-profile-migration.md)：PostgreSQL 迁移、实时社区同步和个人主页读写说明。
10. [10-ui-design-reference.md](./10-ui-design-reference.md)：移动端 UI 视觉参考、配色、材质和组件风格。
11. [11-matching-recommendation-algorithm.md](./11-matching-recommendation-algorithm.md)：约饭匹配与推荐算法设计，是后续 `matchScore`、`reason`、行为日志和模型演进的权威文档。

## 当前权威图表

- [prototype-navigation-usecases.md](./prototype-navigation-usecases.md) 是当前页面跳转与 use case 图的源文档。
- 其他编号文档从该 use case 图展开，便于给设计、前端、后端或其他 AI 分模块阅读。

## 文档维护原则

- 新增页面时，先更新 `prototype-navigation-usecases.md` 的 Mermaid 图。
- 新增交互时，同步更新 `04-interaction-spec.md`。
- 新增数据字段时，同步更新 `03-state-and-data-model.md`。
- 涉及 App 打包、Capacitor、Android 适配或后续多端限制时，同步更新 `05-future-multiplatform-notes.md`。
- 新增、删除或大幅移动代码文件时，同步更新 `06-code-file-guide.md`。
- 涉及真实 Web、后端、数据库、接口、登录注册或实时聊天时，同步更新 `07-real-web-mvp-backend-plan.md`。
- 涉及本地开发、测试环境、正式部署、环境变量、上线检查时，同步更新 `08-local-to-production-runbook.md`。
- 涉及约饭匹配、推荐排序、行为日志、冷启动、模型实验或开源推荐系统复现时，同步更新 `11-matching-recommendation-algorithm.md`。

## 最新补充

- [09-postgresql-realtime-profile-migration.md](./09-postgresql-realtime-profile-migration.md)：PostgreSQL 迁移、实时社区同步和个人主页读写说明。
- [11-matching-recommendation-algorithm.md](./11-matching-recommendation-algorithm.md)：新增长期匹配推荐算法方案，覆盖找搭子双向匹配、抖音/小红书式内容分发、开源项目参考、行为日志、评估指标和分阶段实现路线。
