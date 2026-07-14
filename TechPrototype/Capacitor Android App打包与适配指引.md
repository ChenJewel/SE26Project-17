# Capacitor Android App 打包与适配指引

本文档用于约束 ueat 技术原型最终以 Android App 形态展示时的实现路线。当前目标不是小程序，也不是 Taro 跨端迁移，而是把已有 React/Vite 移动端 Web 原型通过 Capacitor 封装成可安装 APK。

## 1. 本轮 App 展示定位

最终展示形态：

- Android App 安装包：`ueat.apk`。
- App 打开后直接展示 ueat 移动端界面。
- App 请求 Ubuntu 云服务器上的后端 API。
- 评审时可使用安卓手机或 Android 模拟器现场演示。

技术路线：

- 前端：React + TypeScript + Vite。
- App 容器：Capacitor Android。
- 后端：Node.js + Express/NestJS。
- 数据库：PostgreSQL 或原型期 SQLite/mock。
- 实时通信：WebSocket/Socket.IO。
- 服务器：老师提供的 Ubuntu 云服务器。

不作为本轮主目标：

- 微信小程序。
- Taro/uni-app 多端重构。
- Flutter/React Native/Android 原生从零重写。
- iOS 打包。

## 2. 为什么选择 Capacitor

Capacitor 的核心优势是复用现有 Web 成果，把 Vite 构建产物放入 Android WebView 容器。

与 Taro/小程序路线相比：

- 不需要把 `div/button/input` 大量替换成跨端组件。
- 不需要适配小程序路由模型。
- 不需要处理小程序端 SVG 图标兼容问题。
- Tailwind、CSS 变量、React hooks、现有页面状态基本可以保留。
- 更适合 7 月 24 日前快速拿到“可安装 App”。

但 Capacitor 不是完全不用适配。它仍然需要移动端布局、网络地址、Android 权限、返回键和安全区验证。

## 3. 实施步骤

### 3.1 先稳定 Web 移动端

在 `web/` 中完成手机端体验检查：

- 375px/390px 宽度下无横向滚动。
- 底部导航不遮挡页面内容。
- 弹层、聊天页、发卡片表单在小屏可用。
- 按钮点击区域不小于 44px。
- 所有接口地址不写死 `localhost`。
- 页面刷新后仍能进入主流程。

### 3.2 安装 Capacitor

在 `web/` 目录执行：

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init ueat com.ueat.app
```

推荐 App 信息：

```text
appName: ueat
appId: com.ueat.app
webDir: dist
```

### 3.3 配置 Capacitor

建议新增或检查 `web/capacitor.config.ts`：

```ts
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.ueat.app",
  appName: "ueat",
  webDir: "dist",
  server: {
    androidScheme: "https"
  }
};

export default config;
```

### 3.4 生成 Android 工程

第一次执行：

```bash
npm run build
npx cap add android
```

以后每次前端改动后执行：

```bash
npm run build
npx cap sync android
```

### 3.5 打开 Android Studio

```bash
npx cap open android
```

在 Android Studio 中：

1. 等待 Gradle 同步完成。
2. 连接安卓手机或启动模拟器。
3. 点击 Run 验证。
4. 使用 Build APK 生成安装包。

## 4. Ubuntu 服务器职责

Ubuntu 服务器不负责 App UI 迁移，它负责运行真实后端能力：

- Node.js API 服务。
- 数据库服务。
- WebSocket 服务。
- 可选：托管 H5 静态资源作为备用演示入口。

课程云主机默认安全组通常只放行 22、80、443、3389。推荐让 Node 后端监听服务器本机 3000 端口，再用 Nginx 把外部 80/443 的 `/api` 请求反向代理到 Node 服务。

App 中不能请求：

```text
http://localhost:3000
```

因为 Android App 内部的 `localhost` 指手机本机。推荐使用：

```text
http://服务器IP/api
```

如果已经在安全组中额外放行 3000，也可以临时使用：

```text
http://服务器IP:3000
```

后续配置 HTTPS 和域名后可改为：

```text
https://api.example.com
```

## 5. App 适配重点

### 5.1 移动端布局

- 页面主体使用 `min-height: 100dvh` 或稳定容器高度。
- 底部导航预留安全区：

```css
padding-bottom: calc(10px + env(safe-area-inset-bottom));
```

- 页面内容底部增加足够 padding，避免被底部导航遮挡。
- 固定按钮和弹层不要超出屏幕宽度。

### 5.2 字体

不要依赖特殊中文字体。推荐：

```css
font-family: "PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", "Heiti SC", Arial, sans-serif;
```

规则：

- 中文 `letter-spacing: 0`。
- 不使用 `vw` 控制字号。
- 标题、正文、辅助文字使用固定字号阶梯。
- 按钮文字尽量短，防止 Android WebView 字体渲染后溢出。

### 5.3 网络请求

- API base URL 使用环境变量，例如 `VITE_API_BASE_URL`。
- App 打包前切到 Ubuntu 服务器地址，推荐 `http://浮动IP/api`。
- 如果服务器暂时只有 HTTP，需要配置 Android 明文网络访问；更推荐后续加 HTTPS。
- 请求失败必须有错误提示，避免演示时空白。

### 5.4 Android 返回键

Capacitor App 默认返回键可能直接退出应用。后续可按页面状态处理：

- 有弹层：先关闭弹层。
- 在聊天详情：返回消息列表。
- 在二级设置：返回设置首页。
- 在首页：二次确认退出或保持默认退出。

### 5.5 状态栏与安全区

如果状态栏颜色影响观感，可后续加入：

- `@capacitor/status-bar`
- `@capacitor/splash-screen`

本轮不是必须，但要在测试机上确认顶部不遮挡内容。

### 5.6 原生能力

本轮可先不接原生能力。后续如需要：

- 图片上传：`@capacitor/camera` 或文件选择插件。
- 定位：`@capacitor/geolocation`。
- 推送：Firebase 或厂商推送。
- 本地存储：`@capacitor/preferences`。

## 6. 验证清单

打包前：

- [ ] `npm run check` 通过。
- [ ] `npm run build` 通过。
- [ ] `web/dist` 能正常打开。
- [ ] 手机尺寸无横向滚动。
- [ ] 底部导航不遮挡内容。
- [ ] 登录/首页/发卡片/社区/消息/我的主流程可跑通。
- [ ] API 地址不是 `localhost`。

打包后：

- [ ] Android Studio 可以运行 App。
- [ ] 真机或模拟器能打开首页。
- [ ] App 能访问 Ubuntu 后端接口。
- [ ] Android 返回键行为不破坏主流程。
- [ ] 聊天、弹层、表单在小屏正常。
- [ ] 如果现场网络不稳定，有录屏或本地 mock 备用方案。

## 7. 评审表述

可以在 PPT 或汇报中这样描述：

> 本轮技术原型最终以 Android App 形式展示。我们复用第一周 React/Vite Web 原型成果，通过 Capacitor 将移动端 Web 前端封装为可安装 APK；后端部署在 Ubuntu 云服务器上，并通过 Nginx 将 `/api` 和实时通信请求代理到 Node 服务，提供用户、约饭卡、社区、聊天和推荐算法相关接口。该方案避免了从零开发原生 App 的高成本，同时能够真实验证 App 端业务流程、后端接口和核心算法。

## 8. 风险与缓解

| 风险 | 表现 | 缓解 |
| --- | --- | --- |
| HTTP 被 Android 拦截 | App 无法请求服务器 | 优先配置 HTTPS；原型期配置明文网络访问 |
| API 地址写成 localhost | 手机访问失败 | 使用环境变量切换服务器 IP |
| 安全组未放行 3000 | 直连 `服务器IP:3000` 超时 | 默认走 Nginx 80/443 反代 `/api` |
| 小屏布局溢出 | 按钮、弹层、底部导航错位 | 375px/390px 真机尺寸逐页检查 |
| 返回键直接退出 | 演示流程中断 | 增加 Capacitor 返回键处理 |
| 云服务器网络不稳定 | 现场加载失败 | 准备录屏和本地 mock 备用 |
| Android Studio/Gradle 问题 | APK 打不出来 | 提前完成打包，不把打包留到最后一天 |

## 9. 与 Taro 路线的关系

Taro/小程序不作为本轮展示路线。仓库中已有的 Taro 或跨端实验工程可以保留为历史探索，但本轮技术原型文档、PPT 和演示应统一指向：

```text
React/Vite 移动端 Web -> Capacitor Android -> APK 展示 -> Ubuntu 后端
```
