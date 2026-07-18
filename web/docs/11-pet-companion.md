# 桌宠功能说明

本文档同步 `web/src/components/pet`、`web/src/hooks/usePetCompanion.ts`、`web/src/services/petApi.ts` 与后端 `/users/me/pet` 的当前实现，说明 Ueat 桌宠的入口、状态、交互、素材来源和后续限制。

## 功能定位

桌宠是 Ueat 的轻量陪伴与活跃度反馈系统。它不是独立游戏，而是全局悬浮在主应用页面上的互动角色：

- 用户投喂、喝水、发约饭卡、发帖、评论、点赞、收藏、转发、聊天、加入群聊等行为会奖励经验、饱食、心情和亲密度。
- 桌宠通过 PNG 帧动画和台词反馈用户行为，也会根据所在页面说不同话。
- 当前使用 VPet 项目的部分 PNG 帧作为课程原型素材；正式上线或商用前应替换为 Ueat 自有或完整授权素材。

## 当前入口

- 登录并完成资料后，`App.tsx` 全局挂载桌宠。
- “我的”页仍保留桌宠管家入口，用于重新显示、投喂和查看基础状态。
- 桌宠默认使用最小尺寸 `sm`，位置和状态会保存在本地，并在登录账号下同步到云端。

## 交互规则

### 小人本体

- 拖动小人本体可以移动桌宠。
- 轻触小人本体触发摸头动作与随机摸头台词，不打开状态面板。
- 长按或拖动时触发捏/拎起动作；松开后根据拖动方向触发下落反馈。
- 如果拖动松手时手指/指针基本触碰到屏幕左右边缘，才触发收边探头。
- 从收边探头状态触碰或拖动小人时，判定更宽松：会先把桌宠恢复到桌面内，避免用户想拎回来却再次收边。
- 桌宠位置会在窗口尺寸变化时夹回可见区域，避免桌面端位置带到手机端后跑出屏幕。

### 收边探头

- 收边后桌宠会保留较明显的探头可点击面积。
- 刚收边后的“点我 / 拖我”提示只显示几秒，之后只保留小人探头，减少视觉打扰。
- 收边状态会隐藏侧边快捷按钮和摸头反馈，但保留点击小人身体打开面板、拖拽小人回到桌面的能力。

### 状态条与面板

- 小人底部的 `Lv / 心情` 状态条用于打开或关闭状态面板。
- 面板支持拖动标题栏移动位置，避免固定遮挡当前页面内容。
- 面板打开后，桌宠本体和状态条层级高于面板；如果两者重叠，优先显示桌宠。
- 面板包含经验、饱食、心情、亲密度、尺寸切换、喝水、思考、睡觉、爬墙、停止爬墙、说话表情、移动预览和“回到桌面”按钮。

### 侧边快捷按钮

- 侧边快捷按钮包含投喂、衣柜预留入口、收起为小球和显隐开关。
- 桌宠在屏幕左半边时，快捷按钮在桌宠左侧；桌宠在屏幕右半边时，快捷按钮在桌宠右侧，减少遮挡中间内容。
- 点击显隐开关后，三个快捷按钮隐藏；隐藏状态只保留一个小眼睛按钮在桌宠正下方，用于恢复显示。

### 小球形态

- 点击 `-` 后，桌宠收缩为浅黄色圆形小球。
- 点击小球可恢复正常桌宠。
- 小球也可以拖动。

## 动作与台词

当前动作注册在 `web/src/components/pet/vpetFrames.ts`，桌宠 UI 通过 `FramePlayer` 播放 PNG 帧。

已接入的主要动作：

- 基础：`idle`、`sleep`、`levelUp`
- 投喂/喝水：`eatNormal`、`eatHappy`、`drink`
- 互动：`touchHead`、`think`、`pinch`、`raise`
- 说话：`saySelf`、`saySerious`、`sayShy`
- 收边：`sideHideLeft`、`sideHideRight`
- 移动预览：`walkLeft/right`、`crawlLeft/right`、`fallLeft/right`、`climbTopLeft/right`
- 爬墙：`climb`、`climbLeft`、`climbRight`

随机台词：

- 摸头、思考、普通说话和活动奖励都会从多条文案中随机选择。
- 页面感知台词按首页、社区、发卡、聊天、我的、设置等页面触发不同表达和动作。
- 聊天页停留较久时会出现轻量冒泡。

## 自动行为

- 自然衰减：桌宠会按离线和在线时间轻微消耗饱食；饱食偏低时心情下降，长期太饿会轻微降低亲密。
- 自动休息：饱食过低时，桌宠会退出爬墙并进入睡觉/趴下状态；投喂后恢复到进食反馈。
- 自动小动作：如果用户约 5 分钟没有与桌宠互动，且桌宠处于空闲、未收边、未爬墙、未睡觉、未被拖拽状态，系统每 1–2 分钟轻量检查一次，低概率触发 `walk/fall/crawl/top` 预览动作和随机“怎么这么久不理我”类台词。
- 自动小动作只持续约 3.2 秒，然后回到 `idle`；触发一次后至少再冷却约 5 分钟，避免持续打扰用户。

## 活跃度投喂

当前通过 `web/src/lib/petActivity.ts` 分发桌宠活跃事件，通过 `web/src/hooks/usePetCompanion.ts` 统一计算奖励和每日上限。

| 行为 | 事件名 | 说明 |
| --- | --- | --- |
| 手动投喂 | `manual_feed` | 点击餐具按钮 |
| 手动喝水 | `manual_drink` | 点击状态面板喝水按钮 |
| 发布约饭卡片 | `meal_card` | 成功发卡片后奖励 |
| 交换/约饭邀请 | `exchange` | 发起约饭邀请后奖励 |
| 发布帖子 | `post` | 成功发社区帖子后奖励 |
| 评论 | `comment` | 成功发表评论后奖励 |
| 点赞 | `like` | 点赞奖励 |
| 收藏 | `favorite` | 收藏奖励 |
| 转发 | `share` | 转发帖子后奖励 |
| 私聊消息 | `message` | 发送文本、图片或语音消息后奖励 |
| 群聊广场 | `group` | 创建或加入公开群聊后奖励 |

每种行为有每日奖励上限，避免无限刷经验。

## 状态与存储

桌宠状态类型定义在 `web/src/hooks/usePetCompanion.ts` 的 `PetCompanionState`，包含：

- 是否显示、是否收缩
- 等级、经验、饱食、心情、亲密
- 尺寸：`sm` / `md` / `lg`
- 屏幕位置
- 当前动作
- 爬墙状态：`wallMode`
- 收边状态：`edgeHidden`
- 最近台词和发言时间
- 衰减时间、页面上下文发言时间
- 当日各类奖励次数

本地 key：

```text
ueat-pet-companion-v2:<userId 或 guest>
```

云端同步：

```text
GET /users/me/pet
PATCH /users/me/pet
```

云端表：

```text
user_pet_states
```

当前云端以 JSON 状态整体保存，同一个账号共享一只桌宠，不按设备分别计算。前端保留本地 fallback：云端暂时不可用时仍可本地互动，之后继续尝试同步。

## 当前素材来源

第一版桌宠临时使用 VPet 项目的部分内置动画资源，仅用于非商业课程原型验证。

来源：

```text
https://github.com/LorisYounger/VPet
```

本项目复制的 PNG 帧资源位于：

```text
web/public/assets/vpet-prototype/frames/
```

资源说明文件：

```text
web/public/assets/vpet-prototype/NOTICE.md
```

注意：

- VPet 代码许可证和内置图片/动画素材要求不完全相同。
- 当前资源仅用于学校课程原型展示，不作为商业素材包分发。
- 正式上线或商业发布前，应替换为 Ueat 自有素材或确认完整授权。

## 实现文件索引

- `web/src/components/pet/PetCompanion.tsx`：桌宠 UI、拖拽、面板、侧边按钮、收边探头、自动小动作。
- `web/src/components/pet/vpetFrames.ts`：动作名、帧序列、循环配置。
- `web/src/hooks/usePetCompanion.ts`：桌宠状态、奖励规则、自然衰减、本地存储、云同步。
- `web/src/lib/petActivity.ts`：跨页面活跃事件分发。
- `web/src/services/petApi.ts`：账号级桌宠状态读写 API。
- `web/src/App.tsx`：全局挂载桌宠并接入发卡、发帖、评论、点赞等奖励事件。
- `web/src/pages/Profile.tsx`：我的页桌宠管家入口。
- `web/src/components/chat/ChatDetail.tsx`：消息发送奖励。
- `web/src/components/chat/ConversationList.tsx`：群聊广场奖励。
- `server/src/modules/users.ts`：`/users/me/pet` 云同步接口。
- `server/src/data/postgres.ts`：`user_pet_states` 表和读写方法。

## 后续方向

- 替换为 Ueat 官方素材库，并设计发型、服装、配饰、手持物等可组合资源。
- 将衣柜按钮接入正式换装系统。
- 云同步目前是 JSON 整体覆盖，未来可做字段级合并或版本冲突处理。
- 未来接入 AI 时，建议让 AI 只输出 `line`、`suggestedReplies`、`emotion`、`action` 等结构化结果，由前端映射到固定动画，避免让模型直接控制任意 UI 行为。
