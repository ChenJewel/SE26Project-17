# 06 代码文件说明

本文档解释 `web/src` 下每个主要代码文件的职责。目标是让后续 AI、前端开发、后端开发或迁移小程序/App 时，能快速知道该从哪里读、哪里改、哪些逻辑未来要替换。

## 顶层入口

| 文件 | 作用 | 后续迁移说明 |
| --- | --- | --- |
| `src/main.tsx` | React 应用挂载入口，把 `App` 渲染到 DOM。 | Taro/小程序工程会有自己的入口，保留启动思路即可。 |
| `src/App.tsx` | 页面路由与跨页面编排层。当前只负责底部页面切换、全局浮层挂载和把 hooks 数据传给页面。 | 后续替换为真实路由；业务数据优先在 hooks 内接 store/service。 |
| `src/index.css` | 全局样式、设计 token、页面背景、卡片基础视觉。 | 迁移小程序时需要重写大部分 CSS，但可保留色彩和设计 token。 |
| `src/vite-env.d.ts` | Vite 类型声明。 | Web 构建专属。 |

## components

| 文件 | 作用 | 后续迁移说明 |
| --- | --- | --- |
| `components/BottomNav.tsx` | 底部主导航，定义 `PageId`。 | 小程序/Taro 可映射为 tabBar。 |
| `components/SearchOverlay.tsx` | 首页/社区共用全局搜索浮层。搜索用户、约饭卡、帖子，并通过回调打开详情。 | 后续可改为搜索页面或 modal route。 |
| `components/ContentDetailOverlay.tsx` | 全局详情浮层：用户主页、约饭卡详情；帖子详情使用共享 `PostDetailView`。 | 后续应拆成动态详情页：用户、卡片、帖子。 |
| `components/UserAvatar.tsx` | 统一字符头像展示。 | 未来接真实头像时集中改这里。 |
| `components/post/PostDetailView.tsx` | 搜索、我的、消息通知和社区共用的帖子详情视图，包含正文、媒体、评论区、互动栏。 | 后续接真实媒体资源和动态路由来源。 |
| `components/post/PostStatsRow.tsx` | `PostDetailView` 内复用的帖子统计条。 | 可长期复用。 |
| `components/chat/ChatAvatar.tsx` | 消息模块的单聊/群聊字符头像。 | 未来接会话头像 URL 时集中改这里。 |
| `components/chat/ConversationList.tsx` | 消息首页，会话列表、通知入口、消息搜索入口、右上角菜单。 | 后续对接 conversation list 和 notification summary 接口。 |
| `components/chat/ChatDetail.tsx` | 聊天详情页，展示 mock 消息流、输入栏和交换约饭卡消息。 | 后续按 conversationId 拉取消息，并接实时消息。 |
| `components/chat/MealExchangeBubble.tsx` | 聊天里的交换约饭卡系统消息。 | 后续作为 message type，由后端 request 状态驱动。 |
| `components/chat/MessageSearch.tsx` | 消息页内部搜索浮层，搜索联系人、群聊和聊天记录。 | 后续可替换为消息搜索接口或独立搜索页面。 |
| `components/chat/NotificationPanel.tsx` | 消息页通知列表弹层，展示赞藏、新增关注、评论和 @。 | 后续可对接 notification 接口，并按通知类型跳转动态详情。 |
| `components/profile/ProfileHeader.tsx` | 我的页顶部资料、头像入口、设置按钮和统计信息。 | 后续读取 profile API。 |
| `components/profile/ProfileSection.tsx` | 我的页通用内容分区和空状态。 | 可长期复用。 |
| `components/profile/PreferenceTagEditor.tsx` | 我的偏好标签选择和创建弹层。 | 后续用 tagId 和用户偏好接口替换纯文本标签。 |

## pages

| 文件 | 作用 | 后续迁移说明 |
| --- | --- | --- |
| `pages/Home.tsx` | 首页约饭卡流。包含多选标签、左右划卡、动态浮卡、想一起吃入口。 | 滑卡手势是 Web pointer event，迁移小程序要重写手势层。 |
| `pages/CreateCard.tsx` | 创建约饭卡。包含表单、标签选择/创建、头像选择、可见范围、草稿反馈、卡片预览和发布。 | 表单模型可复用，DOM/input 组件要按目标平台替换；草稿和可见范围应接接口。 |
| `pages/Community.tsx` | 社区页。包含频道、瀑布流、发帖入口和社区状态；帖子详情已改用共享 `PostDetailView`。 | 后续建议继续拆 `PostCard`、`PostComposer`。 |
| `pages/Chat.tsx` | 消息页编排层。只负责列表/详情切换、自动打开聊天和底部消息导航重置。 | 后续用 route 参数替换 `autoOpenRequestId/listResetSignal`。 |
| `pages/Profile.tsx` | 我的页编排层。顶部、分区和偏好编辑器已拆到 `components/profile`。 | 后续继续拆 AvatarEditor、MiniPost，并用 userId/profile API 替换昵称匹配。 |
| `pages/Settings.tsx` | 设置页和设置项二级详情。页面负责列表/详情切换、设置项操作面板，设置项配置来自 `data/settings.ts`。 | 后续可路由化为 `/settings/:section`，并为 rows 增加 action/route 字段。 |

## data

| 文件 | 作用 | 后续迁移说明 |
| --- | --- | --- |
| `data/meal.ts` | 首页约饭卡和默认标签 mock 数据。 | 接后端后替换成 fixture 或删除。 |
| `data/community.ts` | 社区帖子、评论、互动初始数据和社区相关类型。 | 类型可保留，mock 数据后续可移到测试/fixture。 |
| `data/chat.ts` | 消息页会话、聊天记录、最近搜索和初始会话查找函数。 | 可替换为会话列表接口、消息接口和消息搜索接口。 |
| `data/settings.ts` | 设置页分组、设置项详情和设置项类型。 | 可替换为平台配置、远程配置或按端差异化配置。 |

## types

| 文件 | 作用 | 后续迁移说明 |
| --- | --- | --- |
| `types/meal.ts` | `MealCard` 约饭卡核心模型。 | 后续应补 userId、标准时间、地点 ID、头像媒体资源。 |
| `types/exchange.ts` | `MealExchangeRequest` 交换约饭卡请求模型。 | 后续对接后端 request/message 模型。 |
| `types/navigation.ts` | `DetailTarget` 全局详情目标。 | 后续应替换为动态路由参数。 |
| `types/user.ts` | `UserSummary` 轻量用户摘要。 | 后续应使用稳定 userId，避免昵称匹配。 |
| `types/notification.ts` | 正式通知模型草案。 | 用于替换当前消息页本地拼装通知列表。 |

## hooks

| 文件 | 作用 | 后续迁移说明 |
| --- | --- | --- |
| `hooks/useMealCards.ts` | 约饭卡和标签池原型 store。 | 内部替换为 meal-card API 或 store。 |
| `hooks/useCommunityState.ts` | 社区帖子、评论、互动原型 store。 | 内部替换为 posts/comments/interactions service。 |
| `hooks/useGlobalDetail.ts` | 搜索、详情浮层、关注关系、个人偏好。 | 详情目标改动态路由，关注和偏好改接口。 |
| `hooks/useExchangeRequests.ts` | 交换约饭卡请求和聊天 deep-link 意图。 | 替换为 exchange request API 和 conversation route 参数。 |

## lib

| 文件 | 作用 | 后续迁移说明 |
| --- | --- | --- |
| `lib/collections.ts` | 通用集合工具，目前有 `uniqueTrimmed`。 | 可长期复用。 |
| `lib/exchange.ts` | 创建交换约饭卡请求的原型业务规则。 | 后续替换为 `createExchangeRequest` API 调用。 |

## docs

| 文件 | 作用 |
| --- | --- |
| `docs/00-docs-index.md` | 文档目录。 |
| `docs/01-product-scope.md` | 产品范围和原型边界。 |
| `docs/02-navigation-usecases.md` | 页面跳转拆解。 |
| `docs/03-state-and-data-model.md` | 状态和数据模型说明。 |
| `docs/04-interaction-spec.md` | 交互规格说明。 |
| `docs/05-future-multiplatform-notes.md` | 多端迁移注意事项。 |
| `docs/06-code-file-guide.md` | 当前代码文件职责说明。 |
| `docs/prototype-navigation-usecases.md` | 总 use case Mermaid 图和迁移跳转规则。 |

## 当前建议的下一步模块化

如果继续整理代码，优先级建议如下：

1. 继续拆 `Community.tsx` 为 `PostCard`、`PostComposer`。
2. 继续把 `Profile.tsx` 内的 `AvatarEditor`、`MiniPost` 外拆。
3. 把 hooks 内部替换为 service/store/API，保留页面 props 契约。
4. 把昵称匹配全部替换为 `userId/authorId/conversationId`。
5. 给 `PostDetailView` 接真实图片/视频资源模型。
