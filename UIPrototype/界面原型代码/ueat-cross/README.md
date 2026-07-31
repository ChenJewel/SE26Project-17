# Ueat Cross Client

这是 Ueat 的跨端首版客户端工程，使用 Taro 4 + React + TypeScript，从 `web/` 原型迁移而来。

## 覆盖目标

- 微信小程序：使用 Taro `weapp` 构建。
- 网页 H5：使用 Taro `h5` 构建，页面结构、文案、字号和 Tailwind class 尽量沿用原 Web 原型。
- App 初版：先复用同一份 H5 产物作为移动 App WebView/容器输入，后续需要原生能力时再接 Capacitor、Taro RN 或原生壳。

## 常用命令

```bash
npm install
npm run check
npm run dev:h5
npm run build:h5
npm run build:weapp
npm run build:app
```

H5 开发地址默认是：

```text
http://localhost:10087/
```

微信小程序构建后，用微信开发者工具打开 `ueat-cross/`，小程序根目录为 `dist/`。本地默认使用 `touristappid`，正式调试时把 `project.config.json` 里的 `appid` 换成真实小程序 AppID。

## 迁移原则

本工程按 `web/docs/prototype-navigation-usecases.md`、`web/docs/02-navigation-usecases.md` 和 `web/docs/04-interaction-spec.md` 迁移。保留原型中的核心页面：

- 首页约饭卡、多选标签、滑卡和“想一起吃”
- 发卡片、头像字符选择、标签选择和发布回首页
- 社区帖子、发布、评论、点赞、收藏和媒体沉浸视图
- 消息列表、聊天详情、交换约饭卡请求
- 我的、偏好标签、头像浮层、内容详情
- 设置页和二级设置详情
- 全局搜索与用户/卡片/帖子详情浮层

为兼容微信小程序构建，当前做了几处技术适配：

- 使用 `@tarojs/plugin-html` 承接原型中的 HTML 标签写法，减少结构改动。
- 使用 Tailwind/PostCSS 复用原型样式，尽量保持字号、间距和结构不变。
- 小程序端用 `src/components/LucideShim.tsx` 替代 `lucide-react`，避免 SVG 图标组件阻塞编译。
- 将原 `window.scrollTo` 改为 `Taro.pageScrollTo`。

## 后续接入点

当前还是本地 mock state。后续接后端时，优先把 `src/UeatApp.tsx` 中的集中 state 拆到 store/service，并把 `src/data` 中的 seed 数据替换为 API 调用。App 端如果需要登录、定位、推送、图片上传等原生能力，建议先确定容器方案，再给这些能力增加 platform adapter。
