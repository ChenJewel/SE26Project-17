# 07 App 技术原型后端与接入计划

本文档是从当前交互原型走向“可演示 Android App 技术原型”的后端与接入计划。每次新增真实功能、接口、数据字段或迁移步骤后，都需要同步更新本文档。

## 当前目标

本轮先完成可安装 Android App 演示版本：前端继续使用 React/Vite，使用 Capacitor 封装为 APK；后端部署到 Ubuntu 云服务器，提供 API、数据库和实时聊天能力。

App 技术原型的标准：

- 用户可以用邮箱注册和登录。
- 用户、约饭卡、帖子、评论、关注、拉黑、举报、聊天消息都保存到数据库。
- 页面刷新后数据仍然存在。
- 多个用户可以看到彼此发布的约饭卡和帖子。
- 聊天是实时的。
- 举报进入审核流程，后期由管理员人工审核和机器审核决定是否通过。
- Android App 中不能依赖 `localhost`，接口必须指向 Ubuntu 服务器 IP 或域名。

## 当前实现进度

更新时间：2026-07-15

已完成：

- 云端网页已部署：`http://10.119.5.83/`。
- 云端 API 已部署：`http://10.119.5.83/api`。
- Nginx 已负责 `/` 静态网页托管和 `/api/` 后端反向代理。
- Node 后端通过 systemd 服务 `ueat-server` 运行，监听 `127.0.0.1:3000`。
- 云端 PostgreSQL 已作为运行数据库，`DATABASE_URL=postgresql:///ueat?host=/var/run/postgresql`。
- `GET /health`、约饭卡、社区帖子、评论、互动、关注、聊天、通知等主链路已在云端跑通。
- 前端 `useMealCards` 已优先从 API 读取约饭卡，发布时调用 `POST /meal-cards`，API 失败时保留本地 fallback。

已接入数据库：

- Auth 基础接口：注册、登录、当前用户、邮箱验证原型。
- 约饭卡主链路：列表、发布、查看、编辑、删除。
- 社区帖子：列表、发布、编辑、删除、转发计数、多图/视频 URL。
- 评论：发布、回复、编辑、删除、点赞、收藏，并补充作者/admin 权限校验。
- 关注、拉黑、举报、通知、个人主页资料。
- 聊天会话和消息：私聊、公开群聊、群聊广场、图片/语音消息、撤回、已读、正在输入。

仍待生产化：

- JWT 或正式 Cookie session，目前仍使用开发版 `x-user-id` / `Authorization: Bearer <userId>`。
- 媒体上传已支持本地 uploads JSON base64 原型，正式对象存储仍待替换。
- 管理后台页面和自动化端到端测试。

## 已确定产品规则

### 注册与认证

- 用户使用邮箱注册/登录。
- 后期通过邮箱后缀进行校园认证。
- 邮箱后缀会映射到学校，例如 `@school.edu` 对应某个学校。
- 邮箱认证状态应保存到用户资料中。

### 约饭卡

正式约饭卡字段应包含：

| 字段 | 说明 |
| --- | --- |
| `id` | 约饭卡 ID |
| `userId` | 发布人 ID，正式版必填 |
| `nickname` | 展示昵称 |
| `avatarUrl` / `avatarText` | 头像资源或原型字符头像 |
| `verified` | 是否校园认证 |
| `text` | 约饭文案 |
| `time` | 约饭时间 |
| `place` | 地点 |
| `people` | 人数偏好 |
| `tags` | 标签 |
| `matchScore` | 匹配度，应由服务端根据当前用户、场景和行为实时计算 |
| `reason` | 推荐理由，应对应主要加分因子，具体算法见 `11-matching-recommendation-algorithm.md` |
| `createdAt` | 创建时间 |
| `updatedAt` | 更新时间 |
| `status` | `active` / `closed` / `deleted` |

可见规则：

- MVP 阶段所有人都能看到约饭卡。
- 当前原型中的可见范围控件可保留为未来扩展，但真实 MVP 不依赖它。

### 帖子

- 用户可以发布帖子。
- 用户可以编辑自己发布的帖子。
- 用户可以删除自己发布的帖子。
- 帖子支持文字、照片、视频类型。
- 帖子支持评论、点赞、收藏、举报。

### 聊天

- 聊天需要实时。
- 建议使用 WebSocket 或托管实时服务。
- “想一起吃”之后进入聊天，交换约饭卡应作为真实消息类型保存。

### 关注、拉黑、举报

- 关注：用户点击即可关注/取消关注。
- 拉黑：用户点击即可拉黑/取消拉黑。
- 举报：用户点击举报后生成举报记录。
- 举报是否通过，由管理员人工审核和机器审核决定。

## 建议数据库表

| 表 | 作用 |
| --- | --- |
| `users` | 用户账号和资料 |
| `school_domains` | 邮箱后缀与学校映射 |
| `meal_cards` | 约饭卡 |
| `posts` | 社区帖子 |
| `post_media` | 帖子图片/视频资源 |
| `comments` | 评论 |
| `likes` | 点赞记录 |
| `favorites` | 收藏记录 |
| `follows` | 关注关系 |
| `blocks` | 拉黑关系 |
| `reports` | 举报记录 |
| `conversations` | 聊天会话 |
| `conversation_members` | 会话成员 |
| `messages` | 聊天消息 |
| `notifications` | 通知 |

## 核心接口清单

### Auth

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`
- `POST /auth/send-email-code`
- `POST /auth/verify-email`

### Users

- `GET /users/:userId`
- `PATCH /users/me`
- `GET /users/:userId/meal-cards`
- `GET /users/:userId/posts`
- `POST /users/:userId/follow`
- `DELETE /users/:userId/follow`
- `POST /users/:userId/block`
- `DELETE /users/:userId/block`

### Meal Cards

- `GET /meal-cards`
- `POST /meal-cards`
- `GET /meal-cards/:cardId`
- `PATCH /meal-cards/:cardId`
- `DELETE /meal-cards/:cardId`
- `POST /meal-cards/:cardId/invite`

推荐匹配说明：

- `GET /meal-cards` 后续应默认支持个性化重排，用当前用户偏好、约饭场景、双向接受概率、行为反馈和安全过滤生成 `matchScore/reason`。
- 第一版不引入独立机器学习服务，优先在 TypeScript 后端实现可解释规则排序。
- 新增或调整推荐行为日志、模型训练或离线评估时，同步更新 `11-matching-recommendation-algorithm.md`。

### Posts

- `GET /posts`
- `POST /posts`
- `GET /posts/:postId`
- `PATCH /posts/:postId`
- `DELETE /posts/:postId`
- `POST /posts/:postId/like`
- `DELETE /posts/:postId/like`
- `POST /posts/:postId/favorite`
- `DELETE /posts/:postId/favorite`

### Comments

- `GET /posts/:postId/comments`
- `POST /posts/:postId/comments`
- `PATCH /comments/:commentId`
- `DELETE /comments/:commentId`

### Reports

- `POST /reports`
- `GET /admin/reports`
- `PATCH /admin/reports/:reportId`

### Chat

- `GET /conversations`
- `GET /conversations/:conversationId/messages`
- `POST /conversations`
- `POST /messages`
- WebSocket: `message:new`
- WebSocket: `message:read`
- WebSocket: `exchange-request:updated`

### Notifications

- `GET /notifications`
- `PATCH /notifications/:notificationId/read`
- `PATCH /notifications/read-all`

## App 前端替换 mock 的顺序

1. 增加注册/登录页面和本地认证状态。已完成原型：`pages/Auth.tsx`、`hooks/useAuthState.ts`、`types/auth.ts`。
2. Auth API 已有后端基础接口，但前端登录态仍需要进一步替换为真实 API/session。
3. 首页约饭卡从 `data/meal.ts` 替换为 `GET /meal-cards`。已完成基础接入。
4. 发卡片从本地 state 替换为 `POST /meal-cards`。已完成基础接入，并保留 fallback。
5. 社区帖子从 `data/community.ts` 替换为 `GET /posts`。已完成基础接入。
6. 发帖、编辑、删除接 `POST/PATCH/DELETE /posts`。已完成，并补充作者/admin 权限。
7. 评论、回复、点赞、收藏接对应接口。已完成基础接入，并补充评论作者/admin 编辑删除权限。
8. 我的页从当前登录用户和用户内容接口加载。已完成基础接入。
9. 消息列表和聊天记录接 conversations/messages。已完成基础接入。
10. 实时聊天接 WebSocket。已完成基础事件同步，保留 30 秒轮询兜底。
11. 通知接 `GET /notifications`。已完成红点和通知面板基础接入。
12. 举报进入 `reports` 表，后续接管理员后台。
13. 使用 Capacitor 打包 Android APK，并在真机或模拟器中验证 API 请求。

## 当前原型需要继续保留的价值

- 页面和交互流程已经基本完整。
- docs 中的 usecase 图可以作为后端接口和路由设计依据。
- `types/`、`hooks/`、`components/` 已经形成初步模块边界。
- 后端接入时优先替换 hooks 内部，不要直接把接口请求散落到每个组件中。
- Capacitor 路线可以最大化复用当前 Web 前端，避免本轮重做 Taro/小程序或原生 App。

## 本轮更新记录

- 2026-07-11：根据产品规则新增真实 Web MVP 后端计划。确认邮箱注册、约饭卡字段、帖子可编辑删除、约饭卡所有人可见、实时聊天、关注/拉黑/举报规则，以及先完成真实 Web 版本的方向。
- 2026-07-11：新增注册/登录页面原型、本地认证 hook、当前用户类型。未登录时进入 Auth 页面，登录/注册后进入主应用；我的页和设置页可退出登录。
- 2026-07-12：约饭卡发布原型升级为真实前端发布流。发布时写入当前用户 `userId`、昵称、头像、认证状态和 `createdAt`；首页展示全站卡片，“我的”只展示当前用户发布的约饭卡；原型先用 `localStorage` 持久化，后端接入时替换为 `POST /meal-cards` 与 `GET /meal-cards`。
- 2026-07-14：展示目标调整为 Android App。技术路线为 React/Vite 移动端前端 + Capacitor Android APK + Ubuntu 云服务器后端；Taro/小程序不作为本轮主要交付。
- 2026-07-14：新增 `server/` TypeScript + Express 后端，云端部署到 `10.119.5.83`；Nginx 已配置 `/` 托管网页、`/api/` 反代后端；云端 SQLite 位于 `/opt/ueat/server/data/ueat-dev.sqlite`；Auth 基础接口和约饭卡主链路已接 SQLite；社区、互动、聊天、通知和媒体仍待继续真实化。
- 2026-07-15：云端运行数据库切换为 PostgreSQL；社区、评论、点赞收藏、关注、通知、聊天、群聊广场、多图/视频 URL、图片/语音消息、撤回、已读、正在输入等主链路已接入云端 API 与 WebSocket。评论编辑/删除已补充作者/admin 权限校验；聊天默认标题和消息通知文案已中文化。
