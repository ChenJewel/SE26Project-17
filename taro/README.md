# Ueat Taro Client

这是 Ueat 的跨端首版客户端工程，使用 Taro 4 + React + TypeScript。

## 当前目标

- 微信小程序：已接入 `weapp` 构建。
- 网页 H5：已接入 `h5` 构建和本地开发服务。
- App：建议在产品流程稳定后接 Taro RN 或鸿蒙混合目标；当前工程先把页面、数据和交互收敛到 Taro 组件体系，避免继续绑定浏览器 DOM。

## 常用命令

```bash
npm install
npm run check
npm run dev:h5
npm run build:h5
npm run build:weapp
```

H5 开发地址默认是：

```text
http://localhost:10086/
```

微信小程序构建后，用微信开发者工具打开 `taro/`，小程序根目录为 `dist/`。本地默认使用 `touristappid`，正式调试时把 `project.config.json` 里的 `appid` 换成真实小程序 AppID。

## 迁移说明

原 `web/` 工程保留为 Web 原型。当前 Taro 工程按 `web/docs/prototype-navigation-usecases.md` 和 `web/docs/02-navigation-usecases.md` 迁移，并尽量保持原 `web/src` 的页面结构、文案、Tailwind class 和交互关系一致。

为兼容微信小程序构建，当前做了几处适配：

- 使用 `@tarojs/plugin-html` 兼容原型中的 HTML 标签。
- 使用 Tailwind/PostCSS 复用原型样式。
- 使用 `src/components/LucideShim.tsx` 替代 `lucide-react`，避免小程序端 SVG 组件不可编译。
- 将原 `window.scrollTo` 改为 `Taro.pageScrollTo`。

后续接后端时，优先把 `UeatApp.tsx` 中的集中 state 拆到 store/service，并把 `src/data` 中的 seed 数据替换为 API 调用。
