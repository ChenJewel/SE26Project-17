# 05 App 打包与后续多端说明

当前项目是 React + Vite Web 原型。第二周技术原型展示目标调整为 Android App，因此本轮不再把 Taro/小程序作为主路线，而是优先使用 Capacitor 将移动端 Web 构建产物封装为可安装 APK。

## 本轮推荐实施节奏

1. 继续在 Web 原型中完成主要页面和交互。
2. 将 Web 页面按手机尺寸检查并修复布局、底部导航、弹层、表单和聊天页问题。
3. 在 `web/` 中接入 Capacitor，生成 Android 工程。
4. 使用 Vite 构建 `web/dist`，再同步到 Android 工程。
5. 在 Android Studio 中生成 APK，用安卓手机或模拟器演示。
6. Ubuntu 云服务器部署后端 API、数据库和 WebSocket 服务，App 通过服务器 IP 或域名访问接口。

## 可复用部分

- 产品流程。
- 页面结构。
- 数据类型。
- 文案。
- 标签、约饭卡、帖子、交换请求等业务概念。
- React 组件和 hooks。
- Tailwind class、CSS 变量和大部分 Web 样式。
- `hooks/*` 的 store/service 边界：接后端时保留函数语义，优先重写内部实现。

## App 打包时需要适配的部分

- 375px/390px 手机尺寸布局。
- 底部导航和安全区，避免遮挡页面内容。
- Android WebView 中的字体、行高和按钮文字溢出。
- API 地址不能使用 `localhost`，必须指向 Ubuntu 服务器 IP 或域名。
- Android 返回键行为：弹层、聊天详情、设置二级页应先返回上一级。
- HTTP 明文请求可能被 Android 拦截，建议后续配置 HTTPS。
- 图片/视频真实媒体能力。
- 当前 CSS 渐变媒体占位。正式 App 应替换为真实图片、视频组件和资源加载状态。

## Capacitor 方向建议

如果选择 Capacitor：

- 保留 `web/` 作为 App 前端主工程。
- 构建命令仍使用 `npm run build` 生成 `dist`。
- Capacitor 的 `webDir` 指向 `dist`。
- 每次前端改动后执行 `npx cap sync android`。
- 使用 Android Studio 运行和打包 APK。
- 使用环境变量管理后端 API 地址。

## Taro/小程序说明

Taro、uni-app、小程序和鸿蒙端不作为本轮展示目标。如果后续课程或产品要求多端发布，可以再单独规划。届时可复用：

- 数据模型。
- 接口协议。
- 页面流程。
- 交互文档。
- 设计规范。

但不要在本轮把主要精力投入 Taro/小程序适配。

## 后端/接口建议

后续至少需要这些接口或服务：

- 用户与认证。
- 用户主页与偏好标签。
- 约饭卡发布、列表、详情、筛选。
- 社区帖子发布、列表、详情。
- 评论、点赞、收藏、举报。
- 独立通知模型：赞藏、新增关注、评论和 @ 不应由前端临时拼装。
- 搜索。
- 聊天会话。
- 交换约饭卡请求。
- 媒体上传与资源访问。

## 当前原型中特别要动态化的地方

- 用昵称匹配用户改为 `userId/authorId/conversationId`。类型层已预留字段，但原型逻辑还没完全替换。
- 搜索详情和社区详情合并。相关 TODO 已写在 `ContentDetailOverlay.tsx` 和 `Community.tsx` 文件头。
- 交换卡片请求从本地 state 改为后端消息。当前逻辑集中在 `hooks/useExchangeRequests.ts` 和 `components/chat/MealExchangeBubble.tsx`。
- 图片/视频从 CSS 占位改为真实媒体资源。当前 TODO 已写在 `data/community.ts` 和 `Community.tsx`。
- 通知列表改为独立 notification 接口。模型草案见 `types/notification.ts`。
- 设置页可根据后端用户配置和系统能力动态展示。
