# Codex 任务提示词：Android App 与 Ubuntu 云后端

本文档给 vibe coding 使用。把对应提示词发给 Codex/AI，可以减少跑偏，尤其是避免把 App、Web、小程序、云主机、后端混在一起。

## 0. 项目当前事实

项目名称：ueat

当前目标：

- 最终展示 Android App。
- 前端继续使用 `web/` 中的 React + Vite + TypeScript。
- 使用 Capacitor 将 `web/dist` 封装为 Android APK。
- Ubuntu 云主机用于部署后端 API、数据库和 WebSocket。
- 微信小程序、Taro、React Native、Flutter 都不是本轮主路线。

本地环境：

- 开发电脑是 Windows。
- 前端代码在 `D:\U eat\web`。
- 已有 App 打包配置：`web/capacitor.config.ts`。
- 已有环境变量样例：`web/.env.example`。
- 已有 API client 边界：`web/src/services/apiClient.ts`。

云服务器：

- 系统：Ubuntu 22.04.5 LTS。
- 浮动 IP：`10.119.5.83`。
- 默认外部端口：22、80、443、3389。
- 已部署云端网页入口：`http://10.119.5.83/`。
- 已部署云端 API：`http://10.119.5.83/api`。
- 已验证 `http://10.119.5.83/api/health` 和 `http://10.119.5.83/api/meal-cards` 可访问。
- 推荐访问方式：`http://10.119.5.83/api` 经 Nginx 反向代理到 Node 后端。
- 云端 SQLite 数据库位置：`/opt/ueat/server/data/ueat-dev.sqlite`。

当前真实进度：

- `server/` 已新增，使用 TypeScript + Express。
- 云主机已部署 Node 后端，systemd 服务名为 `ueat-server`。
- Nginx 已配置：`/` 托管 `web/dist`，`/api/` 反向代理到 `127.0.0.1:3000`。
- 前端 `useMealCards` 已接入 `GET/POST /meal-cards`，保留本地 fallback。
- SQLite 已接入 Auth 基础接口和约饭卡主链路。
- 社区帖子、评论、点赞收藏、关注拉黑、举报、聊天、通知、媒体上传仍需继续数据库化和前端接入。

安全提醒：

- 不要把 root 密码、数据库密码、JWT 密钥写入 Git。
- 不要把真实密码写进提示词、代码或文档。
- `.env.local`、`.env.production` 应留在本地，不提交。

## 1. 给 Codex 的总提示词

```text
你正在协助 ueat 项目完成第二周技术原型。请严格遵守以下方向：

1. 最终展示形态是 Android App，不是微信小程序，也不是 Taro。
2. 前端继续基于 web/ 的 React + Vite + TypeScript，不要重建前端。
3. App 打包使用 Capacitor Android，webDir=dist。
4. Ubuntu 云主机 10.119.5.83 用来部署后端 API、数据库和 WebSocket。
5. 云主机默认只开放 22/80/443/3389，所以推荐使用 Nginx 将 /api 反向代理到 Node 后端 3000 端口。
6. App 内不能请求 localhost，打包时 VITE_API_BASE_URL 应指向 http://10.119.5.83/api。
7. 后端接口请求必须通过 web/src/services 或 hooks 接入，不要在页面组件里散落 fetch。
8. 每次改动后运行 npm.cmd run lint、npm.cmd run check、npm.cmd run build。
9. 不要提交真实密码、token、数据库密钥。

请先阅读 TechPrototype/Ubuntu云服务器与App后端部署说明.md、TechPrototype/Capacitor Android App打包与适配指引.md、web/docs/08-local-to-production-runbook.md，再执行任务。
```

## 2. 下一步任务提示词：搭后端骨架

用途：让 Codex 新建 `server/`，先跑通最小 API。

```text
请为 ueat 项目新增 Node.js 后端骨架，目标是先跑通 Ubuntu 云服务器部署所需的最小 API。

要求：

1. 在仓库根目录新增 server/。
2. 使用 TypeScript + Express，先不要引入复杂框架。
3. 提供以下接口：
   - GET /health
   - GET /meal-cards
   - POST /meal-cards
4. /meal-cards 可以先用内存数组或 JSON fixture，不要求接数据库。
5. 提供统一 JSON 返回格式。
6. 配置 CORS，允许本地 web 开发和未来 App 请求。
7. package.json 中提供：
   - dev
   - build
   - start
   - check
8. 新增 server/.env.example，包含 PORT、CORS_ORIGIN。
9. 不要写入真实服务器密码。
10. 完成后运行 server 的类型检查和启动验证。

部署目标：

- 本地开发时后端运行在 http://127.0.0.1:3000。
- Ubuntu 上 Node 后端也监听 3000。
- 对外访问通过 Nginx: http://10.119.5.83/api -> http://127.0.0.1:3000。
```

## 3. 下一步任务提示词：配置 Nginx

用途：让 Codex 给出你在云主机上执行的命令和配置，不要让它直接猜端口。

```text
请根据 ueat 项目的 Ubuntu 云主机环境，生成 Nginx 反向代理配置和执行步骤。

已知条件：

- 云主机 Ubuntu 22.04.5 LTS。
- 浮动 IP 是 10.119.5.83。
- 已能通过 http://10.119.5.83 访问云端网页。
- 已能通过 http://10.119.5.83/api/health 访问云端后端健康检查。
- 课程安全组默认开放 22、80、443、3389。
- Node 后端计划监听 127.0.0.1:3000。

目标：

- http://10.119.5.83/api/health 能代理到 http://127.0.0.1:3000/health。
- /socket.io/ 可以代理 WebSocket。

请输出：

1. /etc/nginx/sites-available/ueat 的完整配置。
2. 启用该配置的命令。
3. nginx -t 和 systemctl reload nginx 的检查命令。
4. curl 测试命令。
5. 如果失败，如何看日志。

不要要求开放 3000 端口，除非作为临时备选方案。
```

## 4. 下一步任务提示词：前端接后端约饭卡

用途：后端 `/meal-cards` 跑通后，让 Codex 把前端从本地 state 接到 API。

```text
请将 web 前端的约饭卡数据从本地 mock state 逐步接入后端 API。

已有基础：

- web/src/config/runtime.ts 管理 VITE_API_BASE_URL。
- web/src/services/apiClient.ts 是统一 API client。
- web/src/services/mealCardsApi.ts 已定义 fetchMealCards 和 createMealCard。
- web/src/hooks/useMealCards.ts 目前仍用本地 state/localStorage。

目标：

1. 修改 useMealCards，使其优先从 GET /meal-cards 加载数据。
2. 发布约饭卡时调用 POST /meal-cards。
3. API 失败时保留本地 fallback，不要让页面白屏。
4. 页面组件 Home/CreateCard/Profile 不直接 fetch。
5. 保留 tagOptions、publishedCardId 的现有对外契约。
6. 运行 npm.cmd run lint、npm.cmd run check、npm.cmd run build。

注意：

- 不要把 API 地址写死在 hook 或页面里。
- App 打包后 API 地址会通过 VITE_API_BASE_URL 指向 http://10.119.5.83/api。
```

## 5. 下一步任务提示词：Capacitor 打包

用途：前端主流程稳定后，让 Codex 帮你接入实际打包依赖。

```text
请为 web 工程正式接入 Capacitor Android 打包。

已有基础：

- web/capacitor.config.ts 已存在，appId=com.ueat.app，webDir=dist。
- web/package.json 已有 app:build-web、app:sync-android、app:open-android 脚本。
- web/.env.example 已包含 VITE_API_BASE_URL、VITE_WS_URL、VITE_APP_TARGET。

目标：

1. 安装 @capacitor/core、@capacitor/cli、@capacitor/android。
2. 生成 Android 工程。
3. 确认 npm.cmd run build 通过。
4. 执行 npx cap sync android。
5. 给出 Android Studio 打开和 Build APK 步骤。

环境：

- 本地是 Windows。
- 不要重建前端。
- 不要迁移 Taro。
- 如果需要访问外网安装依赖，请先说明需要网络。
```

## 6. 后续任务提示词：社区帖子和评论入库

用途：把社区页从本地 mock 逐步接入云端数据库。

```text
请继续 ueat 项目后端和前端接入工作。当前已完成：云端网页 http://10.119.5.83/、云端 API http://10.119.5.83/api、SQLite 数据库 /opt/ueat/server/data/ueat-dev.sqlite、Auth 基础接口和约饭卡 GET/POST 接入。

本轮目标：社区帖子和评论真实入库。

要求：
1. 后端 SQLite 增加 posts、comments 表。
2. 实现并验证：
   - GET /posts
   - POST /posts
   - GET /posts/:postId
   - PATCH /posts/:postId
   - DELETE /posts/:postId
   - GET /posts/:postId/comments
   - POST /posts/:postId/comments
   - PATCH /comments/:commentId
   - DELETE /comments/:commentId
3. 保持统一 JSON 返回格式。
4. 前端只允许通过 web/src/services 和 hooks 调 API，不要在页面组件里直接 fetch。
5. 修改 useCommunityState，使帖子和评论优先从 API 加载，API 失败时保留本地 fallback。
6. 云端重新部署后验证：
   - http://10.119.5.83/api/posts
   - 发帖后刷新仍存在
   - 评论后刷新仍存在
7. 运行：
   - server: npm.cmd run check、npm.cmd run build
   - web: npm.cmd run lint、npm.cmd run check、npm.cmd run build
```

## 7. 后续任务提示词：点赞、收藏、关注、拉黑、举报入库

用途：把用户互动关系从本地 state 迁到数据库。

```text
请继续 ueat 项目真实数据接入。当前 Auth、约饭卡已接 SQLite，社区帖子和评论应已接入或作为本轮前置条件。

本轮目标：互动关系入库。

要求：
1. 后端 SQLite 增加 likes、favorites、follows、blocks、reports 表。
2. 实现并验证：
   - POST /posts/:postId/like
   - DELETE /posts/:postId/like
   - POST /posts/:postId/favorite
   - DELETE /posts/:postId/favorite
   - POST /users/:userId/follow
   - DELETE /users/:userId/follow
   - POST /users/:userId/block
   - DELETE /users/:userId/block
   - POST /reports
   - GET /admin/reports
   - PATCH /admin/reports/:reportId
3. 前端替换当前本地点赞、收藏、关注、拉黑、举报逻辑。
4. 刷新页面后互动状态必须保持。
5. 不要把用户关系继续依赖 nickname 匹配，优先使用 userId/authorId。
6. 云端部署后用 http://10.119.5.83/api 验证接口。
7. 运行 server 和 web 的 lint/check/build。
```

## 8. 后续任务提示词：聊天消息入库

用途：让消息页会话和消息不再依赖本地 mock。

```text
请继续 ueat 项目聊天模块真实化。当前云端 API、SQLite、约饭卡主链路已可用。

本轮目标：聊天会话和消息入库，但可以先不做实时 WebSocket。

要求：
1. 后端 SQLite 增加 conversations、conversation_members、messages、meal_exchange_requests 表。
2. 实现并验证：
   - GET /conversations
   - POST /conversations
   - GET /conversations/:conversationId/messages
   - POST /messages
   - POST /meal-cards/:cardId/invite
3. “想一起吃”应创建或复用会话，并写入一条 meal-card-exchange 类型消息。
4. 前端 Chat 页通过 services/hooks 加载会话和消息。
5. 刷新后会话和消息仍存在。
6. 暂时可以轮询或手动刷新，不要求本轮完成 WebSocket。
7. 云端部署后验证 http://10.119.5.83/api/conversations。
8. 运行 server 和 web 的 lint/check/build。
```

## 9. 后续任务提示词：实时聊天 WebSocket

用途：在消息已入库后增加实时同步。

```text
请为 ueat 云端后端增加实时聊天能力。

前置条件：
- conversations/messages 已经入库。
- Nginx 已配置 /socket.io/ 代理到 Node 后端。

目标：
1. 后端接入 Socket.IO 或原生 WebSocket，优先 Socket.IO。
2. 支持事件：
   - message:new
   - message:read
   - exchange-request:updated
3. POST /messages 写库后向会话成员广播 message:new。
4. 前端 Chat 页连接 VITE_WS_URL，收到消息后更新列表和详情。
5. App 打包后不能使用 localhost，WebSocket 地址应为 ws://10.119.5.83。
6. 云端验证 /socket.io/ 能经 Nginx 代理。
7. 运行 server 和 web 的 lint/check/build。
```

## 10. 后续任务提示词：通知入库和前端接入

用途：把消息页通知入口从本地拼装改为数据库通知。

```text
请继续 ueat 项目通知模块真实化。

目标：
1. 后端 SQLite 增加 notifications 表。
2. 在以下行为发生时生成通知：
   - 新关注
   - 帖子评论
   - 点赞/收藏
   - 新消息
   - 约饭卡交换请求状态变化
3. 实现并验证：
   - GET /notifications
   - PATCH /notifications/:notificationId/read
   - PATCH /notifications/read-all
4. 前端 NotificationPanel 改为从 API 读取通知。
5. 点击通知能根据 targetType/targetId 打开对应用户、帖子、评论区、会话或约饭卡。
6. 刷新后已读状态保持。
7. 运行 server 和 web 的 lint/check/build。
```

## 11. 后续任务提示词：媒体上传

用途：替换帖子和头像里的 CSS 占位/字符头像。

```text
请为 ueat 增加原型可用的媒体上传能力。

目标：
1. 后端新增 media_assets 表。
2. 先使用服务器本地目录 /opt/ueat/server/uploads 存储图片，后续可迁移到对象存储。
3. 实现：
   - POST /media/upload
   - GET /media/:mediaId
4. 支持头像、帖子图片的基础上传。
5. 前端增加上传中、上传失败、加载失败状态。
6. 不要提交真实用户上传文件到 Git。
7. Nginx 如需暴露 /media/，同步配置。
8. 运行 server 和 web 的 lint/check/build。
```

## 12. 后续任务提示词：认证安全和生产化

用途：把演示级 `x-user-id` 临时身份替换为正式认证。

```text
请把 ueat 当前演示级认证升级为更接近生产的方案。

当前问题：
- 后端暂时使用 x-user-id 或 Bearer userId 作为临时身份。
- 密码哈希仍是原型级。

目标：
1. 使用 bcrypt 或 argon2 存储密码哈希。
2. 使用 JWT 或 Cookie session 管理登录态，二选一并说明理由。
3. 实现认证中间件，保护需要登录的接口。
4. 前端 useAuthState 接入真实登录、注册、退出、GET /auth/me。
5. 刷新页面后可以恢复登录状态。
6. 不把 JWT_SECRET、SESSION_SECRET 写入 Git。
7. 更新 .env.example，只写变量名和示例占位值。
8. 云端部署后验证注册、登录、退出和发布约饭卡。
9. 运行 server 和 web 的 lint/check/build。
```

## 13. 后续任务提示词：Android APK 打包联调

用途：云端 Web/API 可用后打包 Android 展示版本。

```text
请基于当前已部署的云端网页和 API，为 ueat 打包 Android APK。

已知：
- 云端网页：http://10.119.5.83/
- 云端 API：http://10.119.5.83/api
- WebSocket 地址：ws://10.119.5.83
- 前端在 web/，Capacitor 配置在 web/capacitor.config.ts。

目标：
1. 确认 web/.env.production 使用：
   VITE_API_BASE_URL=http://10.119.5.83/api
   VITE_WS_URL=ws://10.119.5.83
   VITE_APP_TARGET=capacitor
2. 执行 npm.cmd run build。
3. 执行 npx cap sync android。
4. 使用 Android Studio 打开 android 工程。
5. 给出 Build APK 和真机/模拟器验证步骤。
6. 验证 App 内不请求 localhost。
7. 验证 App 首页约饭卡来自云端 API。
```

## 14. 后续任务提示词：上线检查和备份

用途：演示前做稳定性检查。

```text
请为 ueat 当前云端演示环境做上线前检查和备份方案。

目标：
1. 检查云端服务：
   - systemctl status ueat-server
   - nginx -t
   - curl http://127.0.0.1:3000/health
   - curl http://127.0.0.1/api/health
   - curl http://10.119.5.83/api/health
2. 检查网页：
   - http://10.119.5.83/
   - 静态资源 /assets 是否正常
3. 检查数据库：
   - /opt/ueat/server/data/ueat-dev.sqlite 是否存在
   - 给出备份命令和恢复命令
4. 检查日志：
   - journalctl -u ueat-server
   - /var/log/nginx/error.log
5. 输出演示当天故障排查清单。
6. 不要输出或记录任何真实密码。
```

## 15. 给 AI 的禁止事项

不要做：

- 不要把 `web/` 改成 Taro。
- 不要新建 Flutter/React Native/Android 原生项目来替代当前前端。
- 不要把 API 请求散落到页面 JSX 中。
- 不要把 `10.119.5.83` 写死到组件里。
- 不要提交 `.env.production` 或真实密码。
- 不要默认要求开放所有端口。
- 不要跳过 `lint/check/build`。

## 16. 当前最推荐的执行顺序

1. 社区帖子和评论入库，并替换 `useCommunityState`。
2. 点赞、收藏、关注、拉黑、举报入库。
3. 会话和消息入库。
4. 增加 WebSocket 实时聊天。
5. 通知入库并接前端。
6. 媒体上传。
7. 认证安全升级，替换临时 `x-user-id`。
8. Android APK 打包联调。
9. 演示前云端备份和检查。
