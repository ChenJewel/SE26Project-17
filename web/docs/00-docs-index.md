# ueat 原型文档目录

这组文档基于当前 Web 原型和 `prototype-navigation-usecases.md` 整理。当前代码仍是 React/Vite 原型，页面跳转和数据多为本地 state；后续迁移到 Taro、小程序、App 或鸿蒙时，以这些文档作为交互和数据拆分参考。

## 阅读顺序

1. [01-product-scope.md](./01-product-scope.md)：产品范围、核心用户动作和当前原型边界。
2. [02-navigation-usecases.md](./02-navigation-usecases.md)：按页面整理跳转、浮层、返回关系。
3. [03-state-and-data-model.md](./03-state-and-data-model.md)：当前本地 state、mock 数据和未来接口模型。
4. [04-interaction-spec.md](./04-interaction-spec.md)：首页划卡、搜索、社区、聊天、我的、设置的交互说明。
5. [05-future-multiplatform-notes.md](./05-future-multiplatform-notes.md)：后续 Taro/小程序/App/鸿蒙迁移注意事项。

## 当前权威图表

- [prototype-navigation-usecases.md](./prototype-navigation-usecases.md) 是当前页面跳转与 use case 图的源文档。
- 其他编号文档从该 use case 图展开，便于给设计、前端、后端或其他 AI 分模块阅读。

## 文档维护原则

- 新增页面时，先更新 `prototype-navigation-usecases.md` 的 Mermaid 图。
- 新增交互时，同步更新 `04-interaction-spec.md`。
- 新增数据字段时，同步更新 `03-state-and-data-model.md`。
- 涉及后续多端迁移限制时，同步更新 `05-future-multiplatform-notes.md`。
