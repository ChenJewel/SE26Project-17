# 07 真实 Web MVP 后端与接入计划

本文档是从当前交互原型走向“真实可用 Web 版本”的执行计划。每次新增真实功能、接口、数据字段或迁移步骤后，都需要同步更新本文档。

## 当前目标

先完成真实可用的 Web 版本，之后迁移小程序/App。

真实 Web MVP 的标准：

- 用户可以用邮箱注册和登录。
- 用户、约饭卡、帖子、评论、关注、拉黑、举报、聊天消息都保存到数据库。
- 页面刷新后数据仍然存在。
- 多个用户可以看到彼此发布的约饭卡和帖子。
- 聊天是实时的。
- 举报进入审核流程，后期由管理员人工审核和机器审核决定是否通过。

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
| `matchScore` | 匹配度，正式版可由推荐服务计算 |
| `reason` | 推荐理由 |
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

## 前端替换 mock 的顺序

1. 增加注册/登录页面和本地认证状态。已完成原型：`pages/Auth.tsx`、`hooks/useAuthState.ts`、`types/auth.ts`。
2. 接入真实 Auth API，替换本地认证状态。下一步。
3. 首页约饭卡从 `data/meal.ts` 替换为 `GET /meal-cards`。
4. 发卡片从本地 state 替换为 `POST /meal-cards`。
5. 社区帖子从 `data/community.ts` 替换为 `GET /posts`。
6. 发帖、编辑、删除接 `POST/PATCH/DELETE /posts`。
7. 评论、点赞、收藏接对应接口。
8. 我的页从当前登录用户和用户内容接口加载。
9. 消息列表和聊天记录接 conversations/messages。
10. 实时聊天接 WebSocket。
11. 通知接 `GET /notifications`。
12. 举报进入 `reports` 表，后续接管理员后台。

## 当前原型需要继续保留的价值

- 页面和交互流程已经基本完整。
- docs 中的 usecase 图可以作为后端接口和路由设计依据。
- `types/`、`hooks/`、`components/` 已经形成初步模块边界。
- 后端接入时优先替换 hooks 内部，不要直接把接口请求散落到每个组件中。

## 本轮更新记录

- 2026-07-11：根据产品规则新增真实 Web MVP 后端计划。确认邮箱注册、约饭卡字段、帖子可编辑删除、约饭卡所有人可见、实时聊天、关注/拉黑/举报规则，以及先完成真实 Web 版本的方向。
- 2026-07-11：新增注册/登录页面原型、本地认证 hook、当前用户类型。未登录时进入 Auth 页面，登录/注册后进入主应用；我的页和设置页可退出登录。
