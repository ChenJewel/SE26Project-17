# 03 状态与数据模型

## 当前状态总览

当前 `App.tsx` 只保留页面编排和少量导航状态，主要业务 state 已拆到 `src/hooks`：

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
| `pet` | 全局桌宠状态、动作、奖励和云同步 | `user_pet_states` 或后续独立 pet service |
| `autoOpenRequestId` | 想一起吃后自动进聊天详情 | deep link 参数 |
| `chatListResetSignal` | 底部消息导航强制回列表 | 导航到消息首页 |

## Hooks 状态模块

| 文件 | 管理内容 | 后续替换方向 |
| --- | --- | --- |
| `hooks/useMealCards.ts` | 约饭卡、标签池、最近发布卡片 ID、本地持久化发布卡片 | `/meal-cards`、标签接口或 meal-card store |
| `hooks/useCommunityState.ts` | 社区帖子、评论、互动状态 | posts/comments/interactions service |
| `hooks/useGlobalDetail.ts` | 搜索开关、全局详情目标、关注用户、个人偏好标签 | 路由参数、用户偏好接口、关注关系接口 |
| `hooks/useExchangeRequests.ts` | 交换约饭卡请求、聊天自动打开、消息列表重置信号 | exchange request API、conversation deep link |
| `hooks/usePetCompanion.ts` | 桌宠状态、奖励、自然衰减、本地存储、账号级云同步 | 当前已接 `/users/me/pet`，后续可拆独立 pet service |

## 本地数据模块

当前原型把可替换的 mock/config 数据逐步集中到 `src/data`，页面组件优先读取这些模块，而不是在页面里硬编码大段数据。

| 文件 | 数据内容 | 未来替换方向 |
| --- | --- | --- |
| `data/meal.ts` | 首页约饭卡、默认标签池 | 约饭卡列表接口、标签接口 |
| `data/community.ts` | 社区帖子、评论、互动初始数据 | 帖子接口、评论接口、互动接口 |
| `data/chat.ts` | 会话列表、聊天记录、最近搜索、初始会话查找 | 会话接口、消息接口、消息搜索接口 |
| `data/settings.ts` | 设置分组、设置项详情、设置项类型 | 本地平台配置、远程配置、账号设置接口 |

迁移时建议先保留这些文件作为 fixture，对照接口字段逐步替换。等接口稳定后，再把 mock 移到 `fixtures/` 或测试目录。

## 主要类型

### MealCard

定义位置：`web/src/types/meal.ts`

核心字段：

- `id`
- `userId`，目前可选，正式版应必填
- `nickname`
- `avatarText`
- `text`
- `time`
- `place`
- `people`
- `tags`
- `matchScore`
- `reason`
- `createdAt`，当前本地发布时生成，正式版由后端生成

后续建议：

- 当前仍有昵称匹配的原型逻辑，正式版必须改为 `userId`。
- 当前发布约饭卡会写入 `userId`，首页展示全站 `cards`，我的页按当前用户 `userId` 过滤自己的卡片。
- 当前用 `localStorage` 保存前端原型发布结果，刷新后仍能看到；正式版应替换为 `POST /meal-cards` 和 `GET /meal-cards`。
- 时间字段改为标准时间戳或开始/结束时间。
- 地点字段拆成 `placeId`、`placeName`、`campus`。
- 头像改为资源 ID 或 URL。

### CommunityPost

定义位置：`web/src/data/community.ts`

核心字段：

- `id`
- `authorId`，目前可选，正式版应必填
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

- 当前仍有作者昵称匹配的原型逻辑，正式版必须改为 `authorId`。
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
- `userId`，目前可选，正式版应必填
- `avatar`
- `source`
- `verified`

后续建议：

- 当前已在类型中预留 `userId`，但原型仍主要使用 `name`。
- 关注关系不应依赖昵称。
- 通知列表应由后端返回 actor、target 和 action。

### AppNotification

定义位置：`web/src/types/notification.ts`

作用：正式通知模型草案，用来替换当前从帖子、评论、关注用户本地拼装通知列表的做法。

核心字段：

- `id`
- `type`
- `actorUserId`
- `targetType`
- `targetId`
- `createdAt`
- `readAt`

后续建议：

- 消息页的赞藏、新增关注、评论和 @ 都应读取 notification 接口。
- UI 只根据 `targetType` 和 `targetId` 跳转，不再从本地帖子/评论推导通知。

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

### Conversation / ChatItem

定义位置：`web/src/data/chat.ts`

作用：原型期描述消息列表会话和聊天详情内容。

后续建议：

- `Conversation.name` 应替换为 `conversationId`、`peerUserId` 或 `groupId`。
- `ChatItem` 应扩展为 message schema，区分文本、系统卡片、通话、图片、约饭卡交换等消息类型。
- `findInitialConversation` 只是原型按昵称打开聊天；正式应由 deep link 参数定位会话。

### PetCompanionState

定义位置：`web/src/hooks/usePetCompanion.ts`

作用：记录同一账号下全局桌宠的等级、状态、动画、位置和奖励次数。

核心字段：

- `visible`
- `collapsed`
- `level`
- `xp`
- `hunger`
- `mood`
- `affinity`
- `size`：`sm` / `md` / `lg`，当前默认 `sm`
- `position`
- `currentAction`
- `wallMode`
- `edgeHidden`
- `lastLine`
- `lastSpokenAt`
- `lastDecayedAt`
- `lastContextPage`
- `lastContextSpokenAt`
- `daily`

存储与同步：

- 本地 key 为 `ueat-pet-companion-v2:<userId 或 guest>`。
- 登录账号通过 `GET /users/me/pet` 和 `PATCH /users/me/pet` 同步到后端 `user_pet_states` 表。
- 当前以 JSON 整体保存，多个设备同时操作时仍是最后一次保存覆盖；后续可增加版本号或字段级合并。

### SettingDetailContent

定义位置：`web/src/data/settings.ts`

作用：配置设置页首页列表和二级详情。

后续建议：

- 与平台能力有关的设置项可以按端过滤；本轮 Android App 展示版优先关注状态栏、返回键、网络权限和图片上传入口。
- 设置项点击后如果需要真实业务动作，应增加 `action` 或 `route` 字段，而不是在 UI 文案里隐含行为。

## 当前风险点

- 昵称匹配问题已在类型层预留 `userId/authorId`，并在相关代码写 TODO；正式版仍必须完成替换。
- 搜索详情和社区详情已合并到共享 `components/post/PostDetailView.tsx`；后续只需迁移成动态路由页面。
- App 层 state 已拆到 hooks；后续接后端时继续把 hooks 内部替换成 service/store。
- CSS 视觉媒体不是实际资源，已在 `data/community.ts` 和 `Community.tsx` 标注，后续接真实媒体时会改动较大。
- 已新增 `types/notification.ts` 作为正式通知模型草案；当前通知 UI 仍由本地数据拼装。
- `data/chat.ts` 和 `data/settings.ts` 目前仍是原型 mock/config，不代表最终接口结构。
- 桌宠状态已支持账号级 JSON 云同步，但尚未做字段级冲突合并。
