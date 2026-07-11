# 03 状态与数据模型

## 当前状态总览

当前 `App.tsx` 是原型总控层，集中保存跨页面数据：

| State | 作用 | 后续建议 |
| --- | --- | --- |
| `currentPage` | 底部导航与页面切换 | 替换为平台路由 |
| `cards` | 首页约饭卡列表 | `/meal-cards` 接口或 store |
| `tagOptions` | 全局标签池 | 标签服务或配置接口 |
| `posts` | 社区帖子列表 | `/posts` 接口 |
| `comments` | 社区评论列表 | `/posts/:id/comments` 接口 |
| `interactions` | 点赞、收藏、评论、举报等互动 | 用户互动 store |
| `publishedCardId` | 当前用户最近发布的约饭卡 | 用户卡片记录 |
| `activeChatName` | 当前聊天对象昵称 | `conversationId` 或 `userId` |
| `searchOpen` | 全局搜索浮层开关 | modal route 或页面状态 |
| `detailTarget` | 全局详情浮层目标 | 动态详情路由 |
| `profileTags` | 我的偏好标签 | 用户偏好接口 |
| `followedUsers` | 当前用户新关注的用户摘要 | 关注关系接口和通知接口 |
| `exchangeRequests` | 交换约饭卡请求 | 后端 request/message 模型 |
| `autoOpenRequestId` | 想一起吃后自动进聊天详情 | deep link 参数 |
| `chatListResetSignal` | 底部消息导航强制回列表 | 导航到消息首页 |

## 主要类型

### MealCard

定义位置：`web/src/pages/CreateCard.tsx`

核心字段：

- `id`
- `nickname`
- `avatarText`
- `text`
- `time`
- `place`
- `people`
- `tags`
- `matchScore`
- `reason`

后续建议：

- 增加 `userId`，避免用昵称匹配用户。
- 时间字段改为标准时间戳或开始/结束时间。
- 地点字段拆成 `placeId`、`placeName`、`campus`。
- 头像改为资源 ID 或 URL。

### CommunityPost

定义位置：`web/src/data/community.ts`

核心字段：

- `id`
- `title`
- `text`
- `author`
- `avatar`
- `channel`
- `topic`
- `mediaType`
- `mediaSource`
- `place`
- `likes`
- `favorites`
- `comments`
- `imageTone`

后续建议：

- 增加 `authorId`。
- 点赞/收藏/评论数改为 number。
- `imageTone` 只是原型占位，应替换为真实 `mediaAssets`。
- 视频/照片统一走媒体资源模型。

### DetailTarget

定义位置：`web/src/types/navigation.ts`

作用：标记全局详情浮层要展示的目标。

当前类型：

- `user`
- `card`
- `post`

后续建议：

- 使用动态路由参数替代。
- 所有详情页统一按 ID 加载数据。

### UserSummary

定义位置：`web/src/types/user.ts`

作用：原型期用于关注用户、通知列表、用户主页跳转的轻量用户摘要。

核心字段：

- `name`
- `avatar`
- `source`
- `verified`

后续建议：

- 增加并优先使用 `userId`。
- 关注关系不应依赖昵称。
- 通知列表应由后端返回 actor、target 和 action。

### MealExchangeRequest

定义位置：`web/src/types/exchange.ts`

作用：记录“想一起吃”后交换约饭卡的状态。

当前状态：

- `pending`
- `rejected`
- `accepted`

后续建议：

- 由后端生成 request。
- 绑定 `conversationId`、`senderUserId`、`receiverUserId`。
- 双方通过消息系统或实时事件同步状态。

## 当前风险点

- 多处用昵称匹配用户，正式版必须改成 ID。
- 搜索详情和社区详情有重复展示逻辑，后续应合并。
- App 层 state 已经偏多，后续需要拆 store/service。
- CSS 视觉媒体不是实际资源，后续接真实媒体时会改动较大。
- 通知列表目前由本地数据拼装，正式实现需要独立 notification 数据模型。
