## S6 更新：反馈日志已成为调权前置数据层

2026-07-20 已补上 S6 第一版：

- S0/S1 的 canonical taxonomy 继续作为推荐事件统计的稳定语义桶，后续新 alias 或新标签也应先进入候选审核，再进入正式 taxonomy。
- 首页饭卡推荐事件统一写入 `meal_card_recommendation_events`，包含曝光、详情、跳过、邀请、接受、拒绝、举报、拉黑。
- AI 破冰 `ai_recommendation_logs` 现在可记录选择、发送、对方回复和推进约饭结果；私聊正文仍不写入跨会话长期画像。
- `recommendation:feedback` 用于离线检查 S4/S5/S6 的基础漏斗，和 `s0:baseline`、`semantic:baseline`、`semantic:candidates` 一起作为后续调权前的回归入口。
- S5 预计算新增 systemd timer，生产部署后定期执行 recommendation backfill，减少首页临时缺缓存的比例。

## S5.1 更新：缓存优先的首页语义匹配

2026-07-20 已补上 S5 第一版：

- S0/S1 的 canonical taxonomy 继续作为饭卡特征和推荐缓存的解释骨架。
- S2 的真实 embedding 版本隔离继续保留；`local-hash-embedding-v1` 不作为首页成熟向量相似度依据。
- S3/S4 的共享语义层现在可写入 `meal_card_recommendation_features` 与 `meal_card_recommendation_cache`。
- `/meal-cards` 不同步刷新画像、不同步生成 embedding、不等待推荐缓存补齐；只读取已有缓存，缺失时回退。
- `recommendation:backfill` 成为 S5/S6 前批量补齐缓存的可重复入口。

## S4 更新：首页 semanticScore 已接入

2026-07-20 已在首页饭卡匹配中复用 S0/S1/S2/S3 的共享语义层：

- 首页排序不新建独立语义系统，继续使用 `semanticSignals`、canonical taxonomy、`ai_memory_items`、`user_ai_profiles` 和 embedding model version。
- `/meal-cards` 只读取已有画像、memory item 和向量缓存，不同步等待 Qwen、Ollama 或 embedding。
- `interestScore` 第一版采用保守融合：原规则兴趣分 72%，语义分 28%，总分公式保持不变。
- `local-hash-embedding-v1` 不参与成熟向量相似度，只保留为后台兜底和对照。
- S0 baseline 与 S1 candidate 检查仍作为后续 S5/S6 调权前的回归门槛。

## S3.3 更新：Prompt 压缩与 Ollama 常驻

2026-07-20 已补充：

- AI suggestion 后台生成使用 `compact-evidence-v2` prompt，不再把完整 job input 直接交给 Qwen。
- evidence trimming 默认保留 3 条 evidence、4 条短消息、2 条 feedback hints，减少超时和泛化输出。
- systemd 配置 `AI_MODEL_KEEP_ALIVE=15m`、`AI_MODEL_TIMEOUT_MS=45000`、`AI_MODEL_NUM_PREDICT=180`、`AI_MODEL_NUM_CTX=2048`。
- 这一步只优化 S3 后台生成，不改变 S0/S1 taxonomy、不改变 S4 前的首页饭卡排序公式。

## S3.2 更新：重启回收与 HMAC 隐私哈希

2026-07-20 已补充：

- `ueat-server` 启动时会回收遗留 `pending/running` AI suggestion job，标记为 failed 并继续让客户端使用 fallback。
- 这类 job 不会在重启后重跑，因为草稿/私聊正文不落库，重跑会丢失创建时上下文。
- `privateContext` 中的草稿和消息哈希改为 `hmac-sha256-v1`，由 `AI_PRIVACY_HASH_SECRET` 加盐保护。
- 部署激活脚本会生成 `/etc/ueat/ueat-server.env`，避免把生产 secret 写进仓库。

## S3.1 更新：AI suggestion job 隐私硬化

2026-07-20 已补充：

- `ai_suggestion_jobs.input_json` 不再落库当前草稿或私聊正文，只保留 message refs、hash、长度/数量、evidenceSignals、reason 和 policy。
- 后台 query embedding 和 Qwen 生成仍可用本次内存中的草稿/消息快照，但不会把私聊内容写入长期画像、memory item 或 embedding job。
- 后台增强 evidence 按 job 创建时的 `lastMessageId` 做快照截断，减少异步队列延迟带来的上下文漂移。
- 进入 S4/S5 前，AI 破冰与首页饭卡匹配仍共用 `semanticSignals`、canonical taxonomy、真实 embedding provider 和 pgvector，不拆两套语义系统。

## S2.2 更新：持久化 embedding job 表已完成

2026-07-20 已新增 `ai_embedding_jobs`，此前文档中“暂未新增持久化 job 表”的描述已被本节覆盖。

当前状态：
- `ai_embedding_jobs` 已进入 Postgres / SQLite 初始化。
- `aiMemory.ts` 会为需要 `ollama:bge-m3` 的公开画像 memory item 写入持久化作业。
- `embedding:backfill` 现在是 job-backed worker：先补齐 pending 作业，再 claim `ai_memory_item` 作业处理。
- 作业支持 `pending / running / succeeded / failed`、重试次数、延迟重试、worker lock、running 超时回收和状态统计。
- Ollama 临时失败时可以写入 `local-hash-embedding-v1` 兜底，但对应作业不会成功关闭，会继续等待目标模型补齐。

后续 S4/S5 可复用同一张表：
- `meal_card`：饭卡发布后异步生成饭卡语义特征和向量。
- `semantic_mapping`：动态 alias / taxonomy 候选审核后异步补语义特征。

仍然不变：
- `/meal-cards` 不同步等待 embedding 或大模型。
- 首页缺失缓存/向量时仍回退当前规则算法。
- 私聊不写入跨会话长期画像。

## S3 更新：后台 query embedding evidence 已接入

2026-07-20 已完成 AI 破冰侧 S3 第一版：

- `buildConversationEvidence` 默认仍不实时请求 embedding，保障同步接口速度。
- AI suggestion 后台 job 会在 Qwen 生成前重新构建 evidence，并允许 `ollama:bge-m3` query embedding。
- 增强后的 evidence 写回 `ai_suggestion_jobs.input_json`，用于轮询、日志和后续评估。
- 私聊只作为当前会话 query，不进入 `ai_memory_items` 或长期画像。
- fallback 仍固定 4 条，模型或 embedding 失败不会让按钮不可用。

当前仍未完成：
- 首页饭卡匹配的 `semanticScore` 尚未接入。
- 饭卡特征缓存和推荐缓存尚未建立。

# 16 S0/S1 Shared Semantic Baseline Status

本文记录进入 S2 真实 embedding provider 前后，U eat 在 S0/S1 阶段已经完成的共享语义基础能力、S2 验证结果、验收命令和仍需守住的边界。

## 当前定位

当前主能力已经从单纯 `canonical taxonomy + alias + dimension + confidence + method` 进入 S2：标准兴趣层仍是解释和规则兜底的骨架，真实 embedding provider 只作为共享语义层的后台增强能力接入。

`local-hash-embedding-v1` 仍然保留，但只作为兜底和基线对照，不作为成熟主 embedding。不得把 Qwen 聊天模型当作 embedding 模型，也不得在 `/meal-cards`、发饭卡、发消息等主链路同步等待 embedding 或大模型。

## S0 现状验收

新增命令：

```powershell
cd server
npm.cmd run s0:baseline
```

覆盖内容：

- AI 破冰 25 个固定场景。
- 首页饭卡匹配 15 个固定场景、45 张候选饭卡。
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
- `s0:baseline` 遇到 expected evidence 或 expected top card 未命中时会直接失败。
- hash fallback probe 仍用于证明 hash embedding 不能承担成熟语义匹配。

## S1 标准兴趣层

新增共享模块：

```text
server/src/modules/semanticSignals.ts
```

当前 taxonomy 规模：

```text
total canonical tags: 90
food: 20
scene: 12
time: 10
social: 10
intent: 10
topic: 10
budget: 6
location: 12
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
- 各维度 canonical tag 数量是否达到 S1.2 成熟线。
- 每个 canonical tag 是否至少有 4 个 alias。
- 否定词和宽泛 alias 是否误命中，例如 `不辣` 不命中 `spicy_food`、`不吵` 不命中 `lively_group`、`教学楼下` 不命中 `dorm_area`。
- custom tag 是否可保留。
- custom tag 是否默认不进入强匹配。
- 显式 include custom 时是否可读到 `custom:*`。
- 语义样例集是否全部命中 expected canonical tags。

当前语义样例集覆盖：

- 食物：日料、韩餐、火锅、重口、清淡、饮品、面饭、海鲜、西餐、烧烤、粤菜、家常、素食、清真、快餐、小吃、泰餐/东南亚、饺子馄饨、早餐主食、高蛋白健身餐。
- 场景：安静、热闹、拍照、快速吃饭、久坐聊天、自习后吃饭、外卖、一对一、小组、散步、单人友好、少排队。
- 时间：早餐、午饭、晚饭、夜宵、下课后、周末、今天、明天、考完、课间空档。
- 社交：慢聊、低压力、闲聊、话多、倾听、幽默、内向友好、外向活跃、边界感、新朋友友好。
- 意图：直接约饭、探店、计划、临时随缘、对口味、定地点、定时间、认识新朋友、拼单分着尝、饭后顺带活动。
- 话题：学习、健身、电影演出、游戏二次元、音乐、旅行、宠物、实习求职、校园生活、摄影。
- 预算：平价、中等预算、请客庆祝、AA、优惠券、贵一点也行。
- 地点：食堂、校内、附近、宿舍区、图书馆、校门口、商场、地铁、校外、线上、教学楼附近、操场/体育馆附近。

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
cd server && npm.cmd run semantic:candidates
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

## S2 当前完成状态

2026-07-20 已完成真实 embedding provider 的第一版成熟接入：

- 云服务器已验证 `bge-m3:latest`，不是 `qwen3:1.7b` 聊天模型。
- 实测返回 1024 维；3 条中文样例冷启动约 4856.8ms，热调用约 698.8ms / 687.7ms。
- 模型加载后整机内存 used 约 1.7GiB，available 约 13GiB，当前 4 vCPU / 15GiB 机器可承载后台 embedding。
- 新增 `server/src/modules/embeddingProvider.ts`，统一 provider、模型版本、维度校验、超时和 hash fallback。
- `aiMemory.ts` 在 `ollama` provider 下不在画像刷新主流程同步生成 embedding，只写 canonical tags 和公开证据，再投递后台队列。
- Postgres 保留 `embedding_vector vector(64)` 给 `local-hash-embedding-v1`，新增 `embedding_vector_v2 vector(1024)` 给 `ollama:bge-m3`。
- `embedding_model` 用于新旧模型版本隔离，pgvector 查询不会混查 hash 与真实 embedding。
- 新增 `npm.cmd run embedding:check` 和 `npm.cmd run embedding:backfill -- 100`。
- S2.1 新增 `npm.cmd run embedding:quality`，用固定正负样例检查真实 embedding 语义质量。
- S2.1 新增 `ueat-embedding-backfill.timer`，部署后每 30 分钟补齐缺失或旧模型 memory embedding。
- `embedding:backfill` 现在输出 `targetUpdated`、`fallbackUpdated`、`skipped`、`failed` 和 `elapsedMs`，便于发现 Ollama 降级或失败。

S2 后仍未做、需要进入 S3/S4 的部分：

- AI 破冰尚未把真实 query embedding 放入前台同步召回；当前仍优先使用 canonical evidence 和已缓存的同模型 memory 向量。
- 首页饭卡匹配尚未并入 `semanticScore`，仍保持当前规则算法和共享 canonical normalization。
- 饭卡推荐特征表/缓存表还未建立，属于 S5。
- 暂未新增持久化 `ai_embedding_jobs` 表；当前靠进程内队列 + 定时 backfill 兜底，后续数据量上来后再升级为持久化 job 队列。

当前阶段仍然不做：

- 不训练排序模型。
- 不把 Qwen 聊天模型当 embedding。
- 不让 `/meal-cards` 同步等待 embedding 或大模型。
- 不把私聊长期写入用户画像。

## S1.2 上线前补强

进入 S2 前，S0/S1 还可以继续做成熟，但范围仍然限制在共享语义层和可重复验收，不进入训练或真实 embedding。

建议补强顺序：

1. 把 S0 样例从当前核心场景继续扩到 30-50 组；当前已扩到 AI 破冰 25 组、首页匹配 15 组，覆盖日料/日本菜/日式食物/居酒屋、清淡/少油/不辣、慢热/低压力、食堂别名、夜宵、探店、预算、地点、话题等。
2. 把每组样例固定为 expected canonical tags、expected top card、reason 关键词和 AI 破冰 fallback 数量。
3. 把 S1 taxonomy 按 `food/scene/time/social/intent/topic/budget/location` 补到最低成熟线，优先补校园高频表达，不追求人工穷举。
4. 保持 `custom:*` 只作为保留和候选输入，默认不进入首页强匹配。
5. 设计动态 mapping overlay，但先不让它自动影响线上排序；先用 CLI/admin 审核。
6. 每次语义调整后运行 `semantic:baseline`、`s0:baseline`、server check 和 web check。

当前 S1.2 已完成：

- taxonomy 从 75 个 canonical tags 扩到 90 个。
- `semantic:baseline` 的数量门槛提升到 S1.2 成熟线。
- S0 fixture 扩到 25 个 AI 破冰场景和 15 个首页饭卡匹配场景。
- 收窄 `楼下` 这类过宽 location alias，避免 `教学楼下` 被误判为 `宿舍区`。

## S1.3 动态 mapping 准备态

S1.3 已完成“准备态”，但还没有让动态 mapping 自动影响线上排序。

新增能力：

- `semantic_tag_mappings` 表结构已加入 Postgres 和 SQLite 初始化。
- `semanticSignals` 支持显式传入 active mapping overlay；默认不传时仍只使用静态 taxonomy。
- 新增候选挖掘脚本：

```powershell
cd server
npm.cmd run semantic:candidates
```

该脚本目前只从公开 fixture 挖掘 pending 候选，检查：

- expected 候选 alias 是否全部产出。
- 私聊/private_chat 是否没有进入候选。
- 所有候选是否保持 `pending`，不自动 active。

当前仍然不做：

- 不从私聊挖长期语义。
- 不让 pending 候选进入首页强匹配。
- 不让模型自动发布 active mapping。
- 不接真实 embedding。

上线后新增标签和别名的治理方式见：

- [17-semantic-taxonomy-governance-and-auto-update.md](./17-semantic-taxonomy-governance-and-auto-update.md)
## 2026-07-20 S3.4 补充：AI 破冰质量验收

进入 S4/S5 前，AI 破冰侧新增一条独立质量检查：

```bash
cd server && npm.cmd run ai-suggestions:quality
```

该脚本验证：

- provider JSON 数组和 JSON 对象格式能被解析。
- 非 JSON 编号列表不会被误解析为正式模型结果。
- 泛泛句、联系方式、过短/过长/不完整句会被过滤。
- 模型结果不足时仍由 fallback 补齐到固定 4 条。
- 重复候选会被归一去重。
