# 06 代码文件说明

本文档解释 `web/src` 下每个主要代码文件的职责。目标是让后续 AI、前端开发、后端开发或打包 Android App 时，能快速知道该从哪里读、哪里改、哪些逻辑未来要替换。

## 顶层入口

| 文件 | 作用 | 后续迁移说明 |
| --- | --- | --- |
| `src/main.tsx` | React 应用挂载入口，把 `App` 渲染到 DOM。 | Capacitor 打包时继续复用该入口，Vite 构建产物会被放入 Android WebView。 |
| `src/App.tsx` | 页面路由与跨页面编排层。当前只负责底部页面切换、全局浮层挂载和把 hooks 数据传给页面。 | 后续替换为真实路由；业务数据优先在 hooks 内接 store/service。 |
| `src/index.css` | 全局样式、设计 token、页面背景、卡片基础视觉，以及 B 款头像桌宠的呼吸、眨眼、粒子等轻动效。 | App 打包前重点检查手机宽度、安全区、底部导航遮挡和 Android WebView 字体显示。 |
| `src/vite-env.d.ts` | Vite 类型声明。 | Web 构建专属。 |
| `capacitor.config.ts` | Capacitor Android 打包配置，声明 appId、appName 和 `webDir=dist`。 | 安装 Capacitor 后用于生成和同步 Android 工程。 |
| `.env.example` | App/Ubuntu 后端环境变量样例。 | 复制为 `.env.local` 或 `.env.production`，打包 App 时必须把 API 地址改成服务器 IP/域名。 |

## components

| 文件 | 作用 | 后续迁移说明 |
| --- | --- | --- |
| `components/BottomNav.tsx` | 底部主导航，定义 `PageId`。 | Capacitor App 中继续复用；需要检查安全区和 Android 返回键配合。 |
| `components/SearchOverlay.tsx` | 首页/社区共用全局搜索浮层。搜索用户、约饭卡、帖子，并通过回调打开详情。 | 后续可改为搜索页面或 modal route。 |
| `components/ContentDetailOverlay.tsx` | 全局详情浮层：用户主页、约饭卡详情；帖子详情使用共享 `PostDetailView`。 | 后续应拆成动态详情页：用户、卡片、帖子。 |
| `components/UserAvatar.tsx` | 统一字符头像展示。 | 未来接真实头像时集中改这里。 |
| `components/pet/PetCompanion.tsx` | 全局桌宠 UI：PNG 帧播放、拖拽、贴边探头、状态面板、侧边按钮、自动小动作。 | 后续接官方素材库、换装和 AI 台词时优先保持该组件只做展示与交互编排。 |
| `components/pet/AvatarPetCompanion.tsx` | B 款 Q 版头像桌宠渲染层：默认头像、眼睛锚点、自动眨眼、呼吸浮动和投喂/喝水/摸头/思考轻动效。 | 后续接系统头像变体、用户上传头像或更完整装扮页时优先扩展这里。 |
| `components/pet/AvatarStickerLayer.tsx` | 读取 `public/assets/pet-avatar-stickers/stickers-manifest.json`，并支持 `avatarPet.stickers[].src` 中的用户上传贴纸 URL，按归一化坐标叠加透明贴纸。 | 后续贴纸编辑器只需更新 `avatarPet.stickers` 中的 `x/y/scale/rotate/src`。 |
| `components/pet/PetWardrobePage.tsx` | 全屏桌宠衣柜页：款式选择、B 款大头照头像变体、透明底头像/贴纸上传、右侧贴纸栏、拖拽贴纸到画布，以及画布内拖动/角点缩放贴纸。 | 后续更多官方头像包、贴纸分类搜索、旋转手柄、上传内容审核和付费装扮可继续放在这里。 |
| `components/pet/PublicPetBadge.tsx` | 别人主页和私聊详情中的只读公开桌宠卡片：展示形象、等级、心情，并在点击后弹出 8 秒桌宠介绍。 | 只消费公开摘要，不接投喂/拖拽/完整状态操作。 |
| `components/pet/vpetFrames.ts` | 桌宠动作名、帧序列、循环配置和 VPet 原型素材路径。 | 正式版替换为 Ueat 自有素材清单或资源 manifest。 |
| `components/post/PostDetailView.tsx` | 搜索、我的、消息通知和社区共用的帖子详情视图，包含正文、媒体、评论区、互动栏。 | 后续接真实媒体资源和动态路由来源。 |
| `components/post/PostStatsRow.tsx` | `PostDetailView` 内复用的帖子统计条。 | 可长期复用。 |
| `components/chat/ChatAvatar.tsx` | 消息模块的单聊/群聊字符头像。 | 未来接会话头像 URL 时集中改这里。 |
| `components/chat/ConversationList.tsx` | 消息首页，会话列表、通知入口、消息搜索入口、创建群聊和群聊广场。 | 已接 conversation list、public groups、notification summary；后续可拆 `CreateGroupView` 和 `GroupPlazaView`。 |
| `components/chat/ChatDetail.tsx` | 聊天详情页，按 conversationId 加载消息，支持图片/语音消息、撤回、已读、正在输入和交换约饭卡消息。 | 已接消息 API 和 WebSocket 刷新；后续可拆消息输入栏、聊天设置、消息气泡。 |
| `components/chat/MealExchangeBubble.tsx` | 聊天里的交换约饭卡系统消息。 | 后续作为 message type，由后端 request 状态驱动。 |
| `components/chat/MessageSearch.tsx` | 消息页内部搜索浮层，搜索联系人、群聊和聊天记录。 | 后续可替换为消息搜索接口或独立搜索页面。 |
| `components/chat/NotificationPanel.tsx` | 消息页通知列表弹层，展示赞藏、新增关注、评论和 @。 | 后续可对接 notification 接口，并按通知类型跳转动态详情。 |
| `components/profile/ProfileHeader.tsx` | 我的页顶部资料、头像入口、设置按钮和统计信息。 | 后续读取 profile API。 |
| `components/profile/ProfileSection.tsx` | 我的页通用内容分区和空状态。 | 可长期复用。 |
| `components/profile/PreferenceTagEditor.tsx` | 我的偏好标签选择和创建弹层。 | 后续用 tagId 和用户偏好接口替换纯文本标签。 |

## pages

| 文件 | 作用 | 后续迁移说明 |
| --- | --- | --- |
| `pages/Home.tsx` | 首页约饭卡流。包含多选标签、左右划卡、动态浮卡、想一起吃入口。 | Capacitor 中可继续使用 Web 手势；需要在安卓真机或模拟器上验证滑动灵敏度。 |
| `pages/Auth.tsx` | 注册/登录页面原型。支持邮箱、密码、昵称、校园邮箱后缀提示。 | 后续接 Auth API、邮箱验证码和真实 session。 |
| `pages/CreateCard.tsx` | 创建约饭卡。包含表单、标签选择/创建、头像选择、可见范围、草稿反馈、卡片预览和发布。 | Capacitor 中可复用 DOM/input；重点验证软键盘弹出、底部按钮遮挡和接口提交。 |
| `pages/Community.tsx` | 社区页。包含频道、瀑布流、发帖入口和社区状态；帖子详情已改用共享 `PostDetailView`。 | 后续建议继续拆 `PostCard`、`PostComposer`。 |
| `pages/Chat.tsx` | 消息页编排层。只负责列表/详情切换、自动打开聊天和底部消息导航重置。 | 后续用 route 参数替换 `autoOpenRequestId/listResetSignal`。 |
| `pages/Profile.tsx` | 我的页编排层。顶部、分区和偏好编辑器已拆到 `components/profile`。 | 后续继续拆 AvatarEditor、MiniPost，并用 userId/profile API 替换昵称匹配。 |
| `pages/Settings.tsx` | 设置页和设置项二级详情。页面负责本地/云端设置同步、二次确认弹层、清理缓存、退出登录和注销账号入口。 | 后续可路由化为 `/settings/:section`，并为 rows 增加 action/route 字段。 |

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
| `types/auth.ts` | 当前用户、认证表单和认证模式类型。 | 后续与 Auth API response 对齐。 |

## hooks

| 文件 | 作用 | 后续迁移说明 |
| --- | --- | --- |
| `hooks/useMealCards.ts` | 约饭卡和标签池原型 store。 | 内部替换为 meal-card API 或 store。 |
| `hooks/useAuthState.ts` | 本地注册/登录原型 store，模拟当前用户和校园邮箱识别。 | 内部替换为 `/auth/*` API、token/session、邮箱验证码。 |
| `hooks/useCommunityState.ts` | 社区帖子、评论、互动状态编排。 | 已接 posts/comments/interactions service 和 WebSocket 社区事件；继续保持页面不直接 fetch。 |
| `hooks/useGlobalDetail.ts` | 搜索、详情浮层、关注关系、个人偏好。 | 详情目标改动态路由，关注和偏好改接口。 |
| `hooks/useExchangeRequests.ts` | 交换约饭卡请求和聊天 deep-link 意图。 | 替换为 exchange request API 和 conversation route 参数。 |
| `hooks/usePetCompanion.ts` | 桌宠状态、奖励规则、自然衰减、本地持久化和账号级云同步。 | 已接 `/users/me/pet`，后续可拆独立 pet service 并增加冲突合并。 |

## config

| 文件 | 作用 | 后续迁移说明 |
| --- | --- | --- |
| `config/runtime.ts` | 统一读取 `VITE_API_BASE_URL`、`VITE_WS_URL` 和 `VITE_APP_TARGET`。 | App 打包时避免在页面或 hooks 中散落 `localhost`，并区分 Web/Capacitor 目标。 |

## services

| 文件 | 作用 | 后续迁移说明 |
| --- | --- | --- |
| `services/apiClient.ts` | 统一 REST 请求封装，处理 base URL、JSON body、错误状态和 cookie/session。 | hooks 接真实后端时优先调用这里，不要在页面组件里直接 `fetch`。 |
| `services/mealCardsApi.ts` | 约饭卡接口边界，先定义 `GET /meal-cards` 和 `POST /meal-cards`。 | `useMealCards` 从本地 state 切换到后端时优先接这里。 |
| `services/communityApi.ts` | 社区帖子、评论、点赞、收藏、转发接口边界。 | 已被 `useCommunityState` 调用，后续新增举报/媒体策略时优先扩展这里。 |
| `services/chatApi.ts` | 会话、群聊、消息、已读、正在输入、撤回和交换约饭卡接口边界。 | 已被聊天 hooks/components 调用，后续可继续收敛消息搜索和群管理接口。 |
| `services/petApi.ts` | 账号级桌宠状态 `GET/PATCH /users/me/pet` 读写边界，以及公开桌宠摘要 `GET /users/:userId/pet-public`。 | 保持组件不直接 fetch；未来接 AI 或换装状态时继续扩展 service。 |

## lib

| 文件 | 作用 | 后续迁移说明 |
| --- | --- | --- |
| `lib/collections.ts` | 通用集合工具，目前有 `uniqueTrimmed`。 | 可长期复用。 |
| `lib/exchange.ts` | 创建交换约饭卡请求的原型业务规则。 | 后续替换为 `createExchangeRequest` API 调用。 |
| `lib/platform.ts` | Web/Capacitor 共用平台辅助函数，目前封装滚动到顶部。 | 后续可继续加入 Android 返回键、状态栏、安全区相关 adapter。 |
| `lib/petActivity.ts` | 跨页面桌宠活跃事件分发，包含投喂、喝水、发卡、发帖、评论、点赞、收藏、转发、消息和群聊奖励事件。 | 后续如果奖励规则服务端化，可保留为前端事件桥。 |

## docs

| 文件 | 作用 |
| --- | --- |
| `docs/00-docs-index.md` | 文档目录。 |
| `docs/01-product-scope.md` | 产品范围和原型边界。 |
| `docs/02-navigation-usecases.md` | 页面跳转拆解。 |
| `docs/03-state-and-data-model.md` | 状态和数据模型说明。 |
| `docs/04-interaction-spec.md` | 交互规格说明。 |
| `docs/05-future-multiplatform-notes.md` | Android App 打包路线、Capacitor 适配注意事项和后续多端说明。 |
| `docs/06-code-file-guide.md` | 当前代码文件职责说明。 |
| `docs/07-real-web-mvp-backend-plan.md` | 真实 Web MVP 后端、数据库、接口、前端替换 mock 计划。 |
| `docs/08-local-to-production-runbook.md` | 本地、云端和 App 部署执行手册。 |
| `docs/09-postgresql-realtime-profile-migration.md` | PostgreSQL、实时社区与个人主页读写迁移说明。 |
| `docs/10-android-github-release.md` | Android GitHub Release 打包说明。 |
| `docs/11-pet-companion.md` | 桌宠功能、交互规则、状态、云同步、素材来源和后续扩展说明。 |
| `docs/18-pet-avatar-tag-sticker-design.md` | Q 版头像桌宠的兴趣贴纸、槽位、数据结构、隐私边界和一期实现说明。 |
| `docs/prototype-navigation-usecases.md` | 总 use case Mermaid 图和迁移跳转规则。 |

## 当前建议的下一步模块化

当前不建议重写整个社区页或聊天页。社区、聊天和通知主链路刚完成云端 API/WebSocket 接入，短期应优先做小范围稳定修复；组件化只在不改变 props 契约和数据流的前提下逐步拆。

如果继续整理代码，优先级建议如下：

1. 先拆 `Community.tsx` 内的 `PostCard`、`PostComposer`、`MediaPicker/EditPostSheet`，只做搬家，不改业务。
2. 再拆 `ConversationList.tsx` 内的 `CreateGroupView`、`GroupPlazaView`，保持群聊创建和加入接口不变。
3. 再拆 `ChatDetail.tsx` 内的 `MessageBubble`、`ChatInputBar`、`ChatSettingsView`，便于后续单独测试图片/语音/撤回。
4. 继续把 hooks 内部替换为 service/store/API，保留页面 props 契约。
5. 把剩余昵称匹配替换为 `userId/authorId/conversationId`。
## 2026-07-20 pet wardrobe file update

- `components/pet/PetCompanion.tsx`: A style (`animated-vpet`) now renders `AvatarStickerLayer` over the dynamic `FramePlayer`; B style still delegates to `AvatarPetCompanion`.
- `components/pet/PetWardrobePage.tsx`: the wardrobe editor is mode-aware. It hides avatar upload/variant controls for A, keeps the sticker rail visible for both styles, and writes A stickers to `animatedPet.stickers` while writing B stickers to `avatarPet.stickers`.
- `components/pet/AvatarStickerLayer.tsx`: shared transparent sticker overlay for both A and B visual surfaces. It resolves built-in sticker IDs from the manifest and custom uploaded sticker URLs from `src`.
- `components/pet/PublicPetBadge.tsx`: public pet badges render B stickers from `avatarPet.stickers` and A stickers from `animatedPet.stickers`.
- `hooks/usePetCompanion.ts`: owns normalization/defaults for `animatedPet.stickers` and `avatarPet.stickers`; local storage and `/users/me/pet` cloud sync continue to persist the whole pet JSON.
- `services/petApi.ts` and `server/src/modules/users.ts`: public pet summaries include sanitized `animatedPet` data in addition to sanitized `avatarPet` data.

## 2026-07-20 public pet interaction file update

- `components/pet/PublicPetBadge.tsx`: supports `profile-card` and `chat-float` variants, right-side intro bubbles, public pet names, and click feedback for both A/B styles.
- `components/chat/ChatDetail.tsx`: positions the peer public pet as a floating small pet below the top navigation instead of rendering it as a rigid message-flow card.
- `pages/Profile.tsx`: `PetManagerCard` supports editing `petName`, editing `petIntro`, feeding, drinking, opening wardrobe, showing, and hiding the pet.
- `hooks/usePetCompanion.ts`, `services/petApi.ts`, and `server/src/modules/users.ts`: persist and sanitize `petName`; public summaries fall back to `<account nickname>的桌宠`.
- `index.css`: contains the public pet pat/bob keyframes used by public profile and chat interactions.
