# 08 本地跑通到 Ubuntu 云服务器与 App 部署执行手册

本文档说明 ueat 从当前 Web 原型，逐步变成可安装 Android App + Ubuntu 云服务器后端的具体步骤、结构框架和验收标准。它面向“不一定熟悉技术细节的接锅人”，用于判断每一步在做什么、做到什么程度才算完成。

## 总原则

不要直接在线上硬改功能。推荐顺序是：

1. 本地开发环境完成代码编辑、类型检查和构建。
2. 部署代码到 Ubuntu 测试环境。
3. 直接通过 `http://10.119.5.83/api` 验证真实数据写入云端 SQLite。
4. 小范围真实用户测试。
5. 打包 Android App 并连接测试环境。
6. 持续监控、备份、修 bug。

当前项目已经有完整前端交互原型，下一阶段不是重做页面，而是把本地 mock 数据逐步替换为真实后端 API 和数据库，并使用 Capacitor 将移动端 Web 产物封装为 Android APK。

## 当前云端状态

更新时间：2026-07-14

已完成：

- 云端网页：`http://10.119.5.83/`。
- 云端 API：`http://10.119.5.83/api`。
- 云端健康检查：`http://10.119.5.83/api/health`。
- 云端约饭卡接口：`http://10.119.5.83/api/meal-cards`。
- Node 后端服务：`ueat-server`。
- Node 监听：`127.0.0.1:3000`。
- Nginx：`/` 托管 `/opt/ueat/web/dist`，`/api/` 反向代理到 Node。
- 云端 SQLite：`/opt/ueat/server/data/ueat-dev.sqlite`。

当前数据库接入范围：

- Auth 基础接口。
- 约饭卡 `meal_cards` 主链路。

仍待继续数据库化：

- 社区帖子、评论。
- 点赞、收藏、关注、拉黑、举报。
- 会话、消息、通知。
- 媒体上传。
- WebSocket 实时聊天。

## 课程 Ubuntu 云主机注意事项

课程云主机默认安全组只放行：

```text
22   SSH
80   HTTP
443  HTTPS
3389 RDP
```

因此推荐使用 Nginx 监听 80/443，并反向代理到本机 Node 服务，例如：

```text
App -> http://浮动IP/api -> Nginx:80 -> Node:3000
```

除非已经在安全组中额外放行 3000，否则 App 不应直接请求 `http://浮动IP:3000`。

详细云服务器部署说明见 `TechPrototype/Ubuntu云服务器与App后端部署说明.md`。

## 本地、测试环境、正式环境的区别

| 环境 | 作用 | 谁使用 | 数据要求 | 风险 |
| --- | --- | --- | --- | --- |
| 本地开发 | 开发和调试功能 | 开发者 | 可随时清空 | 低 |
| 测试环境 | 模拟线上，给小范围人员试用 | 团队/测试用户 | 尽量稳定，可重置 | 中 |
| 正式环境 | 真实用户访问 | 所有用户 | 必须稳定和备份 | 高 |

## 推荐技术栈

为了最快做出真实 Web MVP，推荐：

| 层 | 推荐方案 | 原因 |
| --- | --- | --- |
| 前端 | 继续 React + Vite | 当前项目就是这个栈，不需要迁移 |
| 后端 | Node.js + NestJS 或 Express | 和前端同语言，开发快 |
| 数据库 | PostgreSQL | 适合关系数据、聊天、帖子、关注等 |
| ORM | Prisma | 数据表定义清楚，迁移方便 |
| 实时聊天 | Socket.IO 或原生 WebSocket | 支持实时收发消息 |
| 文件存储 | S3 兼容对象存储 / 云存储 | 后期存头像、图片、视频 |
| App 打包 | Capacitor Android | 复用当前 React/Vite 移动端前端，生成 APK |
| 部署 | Ubuntu 云服务器 + Nginx 反代 | 与课程云主机环境一致 |

如果团队后端已有固定技术栈，可以替换后端方案，但接口和数据模型应尽量保持本文档的结构。

## 建议目录结构

当前已有：

```text
web/
  src/
  docs/
```

建议新增：

```text
server/
  src/
    modules/
      auth/
      users/
      meal-cards/
      posts/
      comments/
      interactions/
      chat/
      notifications/
      reports/
    common/
    config/
  prisma/
    schema.prisma
    migrations/
  package.json
```

如果暂时不想拆成 monorepo，也可以先建 `api/` 或 `backend/`。关键是前端和后端职责分开。

## 阶段 0：确认技术架构

目标：在写真实后端前，先确定技术路线。

要确认：

- 前端继续使用当前 `web/`。
- 后端使用什么框架。
- 数据库使用 PostgreSQL。
- 云端 SQLite 如何自动建表/迁移，且部署时不得覆盖 `/opt/ueat/server/data/ueat-dev.sqlite`。
- 线上数据库放哪里。
- 登录态使用 Cookie session 还是 JWT。
- 实时聊天使用 Socket.IO 还是 WebSocket。
- 图片/视频上传放哪里。

验收标准：

- 团队知道前端、后端、数据库分别在哪里。
- 团队知道本地开发和线上部署的区别。
- `07-real-web-mvp-backend-plan.md` 和本文档保持一致。

## 阶段 1：搭后端骨架

目标：后端项目能启动，能连数据库，能返回基础接口。

要做：

- 新建 `server/`。
- 配置环境变量 `.env`。
- 配置数据库连接，当前原型以云端 `/opt/ueat/server/data/ueat-dev.sqlite` 为真实数据源。
- 配置 Prisma 或 ORM。
- 增加健康检查接口。
- 增加统一错误处理。
- 配置 CORS，允许前端本地访问。

最小接口：

```text
GET /health
```

验收标准：

- 本地运行前端和后端。
- 浏览器访问前端正常。
- 前端可以请求 `GET /health`。
- 部署到云端后，后端可以连接云端数据库。

当前状态：已完成。云端 `http://10.119.5.83/api/health` 可返回成功。

## 阶段 2：注册登录真实化

目标：用户真的可以注册、登录、退出，刷新后仍保持登录状态。

要做：

- 建 `users` 表。
- 建 `school_domains` 表或配置。
- 实现邮箱注册。
- 实现邮箱登录。
- 实现退出登录。
- 实现 `GET /auth/me`。
- 前端把 `hooks/useAuthState.ts` 从本地 state 替换为真实 Auth API。

接口：

```text
POST /auth/register
POST /auth/login
POST /auth/logout
GET /auth/me
```

验收标准：

- 新用户可以用邮箱注册。
- 老用户可以登录。
- 登录后进入主应用。
- 刷新页面后仍然登录。
- 退出登录后回到注册/登录页。
- 邮箱后缀能标记校园认证状态。

当前状态：后端 Auth 基础接口已接 SQLite；前端登录态仍需要进一步替换为真实 API/session，临时身份边界仍需生产化。

## 阶段 3：约饭卡真实化

目标：首页约饭卡来自数据库，用户发布的约饭卡能被其他用户看到。

要做：

- 建 `meal_cards` 表。
- 实现约饭卡列表。
- 实现发布约饭卡。
- 实现编辑/删除约饭卡。
- 前端替换 `hooks/useMealCards.ts` 内部逻辑。

接口：

```text
GET /meal-cards
POST /meal-cards
GET /meal-cards/:cardId
PATCH /meal-cards/:cardId
DELETE /meal-cards/:cardId
```

验收标准：

- 首页不再依赖 `data/meal.ts`。
- 发卡片后写入数据库。
- 刷新后新卡片仍存在。
- 另一个用户登录后也能看到公开约饭卡。

当前状态：基础完成。`GET/POST /meal-cards` 已接 SQLite，前端 `useMealCards` 已接入 API 并保留 fallback。

## 阶段 4：社区帖子真实化

目标：社区帖子、详情、评论来自数据库。

要做：

- 建 `posts` 表。
- 建 `comments` 表。
- 建 `post_media` 表或媒体字段。
- 实现发布帖子。
- 实现编辑/删除自己的帖子。
- 实现帖子列表和详情。
- 实现评论发布和删除。
- 前端替换 `hooks/useCommunityState.ts` 的帖子和评论部分。

接口：

```text
GET /posts
POST /posts
GET /posts/:postId
PATCH /posts/:postId
DELETE /posts/:postId
GET /posts/:postId/comments
POST /posts/:postId/comments
DELETE /comments/:commentId
```

验收标准：

- 社区列表来自数据库。
- 用户发布帖子后刷新仍存在。
- 用户可以编辑和删除自己的帖子。
- 帖子详情统一使用 `PostDetailView`。
- 评论可以真实保存。

当前状态：下一步优先做。

## 阶段 5：点赞、收藏、关注、拉黑、举报真实化

目标：用户之间的互动关系进入数据库，不再是本地状态。

要做：

- 建 `likes` 表。
- 建 `favorites` 表。
- 建 `follows` 表。
- 建 `blocks` 表。
- 建 `reports` 表。
- 前端替换当前本地点赞/收藏/关注/举报逻辑。

接口：

```text
POST /posts/:postId/like
DELETE /posts/:postId/like
POST /posts/:postId/favorite
DELETE /posts/:postId/favorite
POST /users/:userId/follow
DELETE /users/:userId/follow
POST /users/:userId/block
DELETE /users/:userId/block
POST /reports
```

验收标准：

- 点赞、收藏刷新后仍存在。
- 关注用户会出现在我的关注列表。
- 拉黑后对方不能继续发起约饭或聊天。
- 举报会生成审核记录。

## 阶段 6：实时聊天

目标：两个用户可以实时收发消息。

要做：

- 建 `conversations` 表。
- 建 `conversation_members` 表。
- 建 `messages` 表。
- 后端增加 WebSocket/Socket.IO 服务。
- 前端消息页接真实会话和消息。
- “想一起吃”生成交换约饭卡消息。

接口和事件：

```text
GET /conversations
GET /conversations/:conversationId/messages
POST /conversations
POST /messages

WS message:new
WS message:read
WS exchange-request:updated
```

验收标准：

- 用户 A 给用户 B 发消息，用户 B 不刷新也能收到。
- 消息刷新后仍存在。
- “想一起吃”进入聊天并生成卡片交换消息。
- 拒绝/聊聊看状态双方同步。

## 阶段 7：通知

目标：消息页通知入口来自真实通知数据。

要做：

- 建 `notifications` 表。
- 点赞、收藏、评论、关注、交换卡片时生成通知。
- 前端替换 `NotificationPanel` 本地拼装逻辑。

接口：

```text
GET /notifications
PATCH /notifications/:notificationId/read
PATCH /notifications/read-all
```

验收标准：

- 新关注、评论、点赞收藏有真实通知。
- 通知数量和列表刷新后仍正确。
- 点击通知能进入对应用户主页、帖子详情或评论区。

## 阶段 8：媒体上传

目标：头像、帖子图片、视频都变成真实资源。

要做：

- 接对象存储或云存储。
- 实现上传接口。
- 建 `post_media` 或通用 `media_assets` 表。
- 前端替换 CSS 占位视觉。

接口：

```text
POST /media/upload
GET /media/:mediaId
```

验收标准：

- 用户可以上传头像。
- 发帖可以上传图片或视频。
- 帖子详情加载真实媒体。
- 有上传失败、加载中、加载失败状态。

## 阶段 9：Ubuntu 测试环境部署

目标：团队和少量测试用户可以通过 Android App 或备用 H5 地址访问云服务器后端。

要做：

- 按课程手册创建 Ubuntu 云主机。
- 绑定浮动 IP。
- 确认安全组至少放行 22、80、443。
- 安装 Node.js、Nginx、PostgreSQL。
- 准备测试数据库。
- 配置测试环境变量。
- 部署后端测试服务。
- 配置 Nginx 反向代理 `/api` 和 WebSocket。
- 配置 CORS、Cookie、HTTPS 或 HTTP 明文调试策略。
- 初始化数据库迁移。

验收标准：

- `curl http://浮动IP/api/health` 可以返回成功。
- 可以注册登录。
- 可以发布约饭卡和帖子。
- 数据写入测试数据库。
- 基础错误能在日志里看到。

当前状态：基础部署已完成。云端网页、API、SQLite 均已可用；后续继续部署新增模块。

## 阶段 9.5：Android App 打包联调

目标：生成 Android APK，并确认 App 可以访问 Ubuntu 后端。

要做：

- 在 `web/.env.production` 中设置：

```text
VITE_API_BASE_URL=http://浮动IP/api
VITE_WS_URL=ws://浮动IP
VITE_APP_TARGET=capacitor
```

- 执行前端构建。
- 使用 Capacitor 同步 Android 工程。
- 在 Android Studio 中运行或打 APK。
- 在真机/模拟器中验证接口。

验收标准：

- App 可以打开首页。
- App 不再依赖 `localhost`。
- App 能访问 `GET /health` 或约饭卡接口。
- 底部导航、聊天输入栏、发卡片按钮在真机不被遮挡。

## 阶段 10：正式上线

目标：面向真实用户开放。

要做：

- 准备正式数据库。
- 配置正式域名。
- 配置 HTTPS。
- 配置环境变量和密钥。
- 配置数据库备份。
- 配置日志和错误监控。
- 配置基本限流和安全策略。
- 准备隐私政策、用户协议、举报处理说明。

验收标准：

- 正式网址可访问。
- 注册登录稳定。
- 数据不会因重启丢失。
- 有备份和恢复方案。
- 有错误日志和监控。
- 举报数据可以被管理员查看或导出处理。

## 环境变量建议

前端：

```text
VITE_API_BASE_URL=
VITE_WS_URL=
```

后端：

```text
DATABASE_URL=
JWT_SECRET=
SESSION_SECRET=
CORS_ORIGIN=
MEDIA_BUCKET=
MEDIA_ACCESS_KEY=
MEDIA_SECRET_KEY=
AI_PROVIDER=disabled
AI_ICEBREAKER_ENABLED=false
AI_PROFILE_ENABLED=false
AI_EMBEDDING_ENABLED=false
AI_ASYNC_JOBS_ENABLED=false
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_CHAT_MODEL=qwen3:1.7b
```

## 云端本地 AI 模型运维

当前交大云服务器可运行 CPU-only Ollama，本地模型只监听 `127.0.0.1:11434`，由 U eat 后端同机调用，不直接暴露公网。

安装与拉模型：

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull qwen3:1.7b
```

检查命令：

```bash
systemctl is-active ollama
systemctl is-enabled ollama
ollama --version
ollama list
ss -ltnp | grep 11434
```

测试生成：

```bash
curl http://127.0.0.1:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3:1.7b",
    "stream": false,
    "think": false,
    "prompt": "请生成一句自然的校园饭搭子开场白。",
    "options": { "temperature": 0.7, "num_predict": 80 }
  }'
```

性能注意：

- Qwen 本地模型在 4C16G 无 GPU 环境下只能作为实验、fallback 或低并发能力。
- 业务接口不要同步等待模型生成；AI 推荐应走异步 job、缓存、预生成和模板 fallback。
- 性能压测时使用 `AI_PROVIDER=disabled` 或 `AI_PROVIDER=template`，避免模型占用 CPU 影响 100 并发 `<3s` 验收。
- 如果启用 Qwen3，要在 Ollama 请求里传顶层 `"think": false`。

## 上线前检查清单

- 注册/登录/退出正常。
- 刷新后登录态正常。
- 首页约饭卡来自数据库。
- 发约饭卡后刷新仍存在。
- 社区帖子来自数据库。
- 发帖、编辑、删除正常。
- 评论、点赞、收藏正常。
- 关注、拉黑、举报正常。
- 聊天实时收发正常。
- 通知列表正常。
- 图片/视频上传正常。
- 生产环境没有暴露密钥。
- 数据库有备份。
- 日志和错误监控可用。
- AI provider 开关符合当前环境；压测环境应关闭模型或切到 template。
- 如果启用本地模型，`ollama` 服务、模型列表和 127.0.0.1 监听状态正常。

## 现在下一步最应该做什么

建议继续按链路推进，不要同时做所有功能：

1. 社区帖子和评论入库，并替换 `useCommunityState`。
2. 点赞、收藏、关注、拉黑、举报入库。
3. 会话和消息入库。
4. 增加 WebSocket 实时聊天。
5. 通知入库并接前端。
6. 媒体上传。
7. 认证安全升级，替换临时 `x-user-id`。
8. Android APK 打包联调。
9. 演示前云端备份和检查。

真实 Web/App 的正确节奏是：一条链路一条链路跑通，每跑通一条就替换前端对应 mock。
