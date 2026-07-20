# 16 S0/S1 Shared Semantic Baseline Status

本文记录进入 S2 真实 embedding provider 之前，U eat 在 S0/S1 阶段已经完成的共享语义基础能力、验收命令和仍需守住的边界。

## 当前定位

当前主能力不是大模型 embedding，而是共享的 `canonical taxonomy + alias + dimension + confidence + method` 标准兴趣层。

`local-hash-embedding-v1` 仍然保留，但只作为兜底和基线对照，不作为成熟主 embedding。S2 之前不得把 Qwen 聊天模型当作 embedding 模型，也不得在 `/meal-cards`、发饭卡、发消息等主链路同步等待 embedding 或大模型。

## S0 现状验收

新增命令：

```powershell
cd server
npm.cmd run s0:baseline
```

覆盖内容：

- AI 破冰 12 个固定场景。
- 首页饭卡匹配 5 个固定场景、15 张候选饭卡。
- 记录 AI 破冰 `evidenceSignals`、`reason`、固定 4 条 fallback `suggestions`。
- 记录首页饭卡 `rank`、`matchScore`、`reason`、`canonicalTags`。
- 默认输出摘要；需要完整 canonical 明细时运行：

```powershell
cd server
npm.cmd run s0:baseline -- --full
```

当前 S0 基线要求：

- AI 破冰所有场景都有 4 条 fallback。
- AI 破冰 expected evidence tags 全部命中。
- 首页核心场景 expected top card 全部命中。
- hash fallback probe 仍用于证明 hash embedding 不能承担成熟语义匹配。

## S1 标准兴趣层

新增共享模块：

```text
server/src/modules/semanticSignals.ts
```

当前 taxonomy 规模：

```text
total canonical tags: 75
food: 16
scene: 10
time: 9
social: 9
intent: 8
topic: 8
budget: 5
location: 10
```

能力边界：

- 每个 canonical tag 有 `label`、`dimension`、`aliases`。
- 归一结果包含 `canonicalTag`、`label`、`dimension`、`confidence`、`method`。
- 未知自由 tag 会保留为 `custom:*`。
- 首页强匹配默认不使用 `custom:*`。
- 只有显式 `{ includeCustom: true }` 时才返回 custom tag。
- 已加入基础否定词规则，例如 `不辣/不吃辣/少辣` 不再误命中 `spicy_food`，`不吵` 不会被 quiet 场景的否定规则误杀。

## S1 验收

新增命令：

```powershell
cd server
npm.cmd run semantic:baseline
```

该命令检查：

- 8 个维度是否齐全。
- 各维度 canonical tag 数量是否达到最低成熟线。
- custom tag 是否可保留。
- custom tag 是否默认不进入强匹配。
- 显式 include custom 时是否可读到 `custom:*`。
- 语义样例集是否全部命中 expected canonical tags。

当前语义样例集覆盖：

- 食物：日料、韩餐、火锅、重口、清淡、饮品、面饭、海鲜、西餐、烧烤、粤菜、家常、素食、清真、快餐、小吃。
- 场景：安静、热闹、拍照、快速吃饭、久坐聊天、自习后吃饭、外卖、一对一、小组、散步。
- 时间：早餐、午饭、晚饭、夜宵、下课后、周末、今天、明天、考完。
- 社交：慢聊、低压力、闲聊、话多、倾听、幽默、内向友好、外向活跃、边界感。
- 意图：直接约饭、探店、计划、临时随缘、对口味、定地点、定时间、认识新朋友。
- 话题：学习、健身、电影演出、游戏二次元、音乐、旅行、宠物、实习求职。
- 预算：平价、中等预算、请客庆祝、AA、优惠券。
- 地点：食堂、校内、附近、宿舍区、图书馆、校门口、商场、地铁、校外、线上。

## 接入现状

AI 破冰：

- `aiMemory.ts` 复用共享 semantic layer。
- 用户公开标签、公开饭卡、公开帖子、公开评论进入画像。
- 私聊内容只作为当前 query，不写入跨会话长期画像。
- fallback 保持固定 4 条可用建议。

首页饭卡匹配：

- `recommendation.ts` 复用共享 canonical normalization。
- 第一阶段只强化当前规则算法的同义归一和文本抽取。
- 未接真实 embedding。
- 未新增同步模型调用。
- 缺失语义信号时仍回退当前规则算法。

## 进入 S2 前的门槛

进入 S2 前必须满足：

```powershell
cd server && npm.cmd run semantic:baseline
cd server && npm.cmd run s0:baseline
cd server && npm.cmd run check
cd web && npm.cmd run check
```

S2 才允许开始验证：

- `AI_EMBEDDING_PROVIDER=ollama|hash|disabled`
- `OLLAMA_EMBEDDING_MODEL=bge-m3` 或专用 qwen embedding 模型
- 真实 embedding 维度、耗时、内存
- 新旧 embedding model version 隔离
- 新 pgvector 列或安全迁移方案
- 后台 backfill，不阻塞主链路

当前阶段仍然不做：

- 不训练排序模型。
- 不把 Qwen 聊天模型当 embedding。
- 不让 `/meal-cards` 同步等待 embedding 或大模型。
- 不把私聊长期写入用户画像。

## S1.2 上线前补强

进入 S2 前，S0/S1 还可以继续做成熟，但范围仍然限制在共享语义层和可重复验收，不进入训练或真实 embedding。

建议补强顺序：

1. 把 S0 样例从当前核心场景扩到 30-50 组，覆盖日料/日本菜/日式食物/居酒屋、清淡/少油/不辣、慢热/低压力、食堂别名、夜宵、探店、预算、地点、话题等。
2. 把每组样例固定为 expected canonical tags、expected top card、reason 关键词和 AI 破冰 fallback 数量。
3. 把 S1 taxonomy 按 `food/scene/time/social/intent/topic/budget/location` 补到最低成熟线，优先补校园高频表达，不追求人工穷举。
4. 保持 `custom:*` 只作为保留和候选输入，默认不进入首页强匹配。
5. 设计动态 mapping overlay，但先不让它自动影响线上排序；先用 CLI/admin 审核。
6. 每次语义调整后运行 `semantic:baseline`、`s0:baseline`、server check 和 web check。

上线后新增标签和别名的治理方式见：

- [17-semantic-taxonomy-governance-and-auto-update.md](./17-semantic-taxonomy-governance-and-auto-update.md)
