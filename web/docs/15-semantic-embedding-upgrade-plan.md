# 15 语义归一与真实 Embedding 升级计划

本文记录 U eat 后续“AI 破冰 + 首页饭卡匹配”共用的语义能力升级方案。目标是解决用户自定义标签表达不一致的问题，例如：

```text
日本菜 / 日式食物 / 日本料理 / 日料 / 居酒屋 / 拉面
```

这些表达在产品语义上很接近，但当前首页匹配算法主要依赖字符串重合，容易误判为不匹配。AI 破冰模块已经有 `ai_memory_items`、`user_ai_profiles`、规则 taxonomy、`embedding_json`、pgvector 可选召回等基础设施，但当前 embedding provider 仍是 `local-hash-embedding-v1`，不是大模型语义 embedding。

## 当前状态

云端当前状态：

```text
Ollama: enabled
聊天模型: qwen3:1.7b
AI_PROVIDER=ollama
AI_EMBEDDING_ENABLED=true
AI_EMBEDDING_MODEL=local-hash-embedding-v1
AI_PGVECTOR_ENABLED=true
```

当前 AI 破冰已经做到：

- 公开偏好标签、公开饭卡、公开帖子、公开评论进入 `ai_memory_items`。
- 规则 taxonomy 会把部分表达归一为 canonical tags。
- `user_ai_profiles.profile_json` 保存维度化画像摘要、证据样本和置信度。
- `ai_memory_items.embedding_json` 保存 64 维 hash embedding。
- pgvector 可用时，`ai_memory_items.embedding_vector vector(64)` 支持 HNSW cosine 检索。

当前首页饭卡匹配还没有复用这套语义能力，仍主要在 `server/src/modules/recommendation.ts` 里做规则打分、Jaccard 和文本包含。

## 关键判断

### Qwen 聊天模型不等于 embedding 模型

当前 `qwen3:1.7b` 适合：

- 生成破冰话术。
- 根据证据生成自然语言理由。
- 低频后台做标签归一建议或画像摘要。

它不适合作为向量检索 embedding 模型。embedding 应使用专门的 embedding 模型或商业 embedding API。

### 标准兴趣层不能删除，但可以轻量化

不要把第一步理解成“人工穷举所有用户可能写出的标签”。真正不能删除的是一层稳定的标准兴趣层，也就是 canonical taxonomy。

原因：
- 用户自由 tag 很短，纯 embedding 容易受噪声、错别字、口语缩写影响。
- 匹配算法需要知道信号属于食物、地点、时间、预算、社交风格还是约饭意图，才能给不同权重。
- AI 破冰需要可解释理由，例如“你们都提到日料/安静小店”，不能只说“向量相似”。
- 反馈学习需要稳定特征，否则“日本菜”“日式食物”“和食”会被拆成多个统计桶。

因此第一步应改成：

```text
少量核心标准类目
+ 规则别名命中
+ embedding 找相近标准类
+ 必要时大模型异步给归类建议
+ 保存 raw_text、canonical_tag、confidence、method
```

也就是说，第一步不是删掉，而是从“大量手写词库”升级为“标准类目 + 自动语义归并”。

### 本地 hash embedding 只能做兜底

当前 `local-hash-embedding-v1` 的价值是：
- 不依赖外部模型。
- 速度快。
- 可以在 embedding 服务异常时保留最低限度的字符相似召回。

但它不是成熟语义 embedding。它更接近字符 n-gram 相似度，不能稳定理解“日本菜/日料/和食/日式食物”这类同义或近义关系。

推荐定位：

```text
主 embedding: ollama:bge-m3 或 qwen3-embedding
兜底 embedding: local-hash-embedding-v1
兜底推荐: canonical tags + 当前规则排序 + 模板 fallback
```

旧 hash 向量和新语义向量不能混用。线上查询必须按 `embedding_model` 或模型版本隔离。

### 可以一步到位换真实 embedding

可以直接把 `local-hash-embedding-v1` 替换为真实语义 embedding，但要满足几个条件：

1. 不在核心同步接口里实时生成大批量 embedding。
2. 旧 hash 向量和新模型向量不能混用。
3. pgvector 列维度必须和新 embedding 维度一致。
4. 所有旧 `ai_memory_items` 要后台重算。
5. 首页饭卡匹配读取已有向量和画像，缺失时降级到当前规则。

### 先不用训练模型

校内后续使用想做完善版，并不等于第一阶段就要训练模型。更稳的顺序是：

```text
先用成熟开源 embedding 模型
-> 建标准兴趣层和归并表
-> 建离线评测集
-> 根据真实曝光/点击/邀请/接受反馈调权重
-> 数据足够后再训练轻量 reranker 或排序模型
```

第一阶段不训练的原因：
- 当前真实用户反馈量不足，训练集容易很小且偏。
- 推荐系统先缺的是稳定特征、日志、评估集和可解释链路。
- 直接训练会让问题变成黑盒，难以判断是数据问题、召回问题还是生成问题。

后续需要训练的条件：
- 校内真实 tag 和饭卡语料已经积累到足够规模。
- 有曝光、点击、发起邀请、接受、拒绝、举报、拉黑等反馈日志。
- 有一套人工评估集，可以判断“改模型后是否真的变好”。
- 规则 + embedding + rerank 已经遇到明显瓶颈。

## 推荐模型

### 首选：bge-m3

推荐先试：

```text
bge-m3
```

原因：

- 多语言能力较好，适合中文和中英文混合。
- 适合检索、相似度、语义匹配。
- 模型体积相对可控，适合当前 CPU-only 云服务器先做后台任务。
- 对“日本菜 / 日料 / 居酒屋 / 日式食物”这类语义近似比 hash embedding 更可靠。

### 备选：qwen3-embedding

如果希望 Qwen 体系统一，可以试：

```text
qwen3-embedding
qwen3-embedding:0.6b
qwen3-embedding:4b
```

实际选型要看 Ollama 支持的具体 tag、下载体积、返回维度和 CPU 延迟。4B/8B 级别更适合离线批处理，不建议进入实时请求。

### 当前不建议

不建议把 `qwen3:1.7b` 聊天模型当作 embedding 模型使用。即使可以让它输出 JSON 标签或摘要，也不等于稳定的向量空间。

## 数据库迁移注意事项

当前 pgvector 列是：

```sql
embedding_vector vector(64)
```

这是为 `local-hash-embedding-v1` 的 64 维向量准备的。真实 embedding 模型通常不是 64 维。迁移时不能直接把新向量塞进去。

推荐迁移策略：

```text
1. 新增 embedding_model_version 配置，例如 semantic-embedding-v1。
2. 读取 Ollama /api/embed 的实际返回维度。
3. 若维度不是 64：
   - 删除或重建旧 HNSW 索引。
   - 调整 embedding_vector 类型到新维度。
   - 或新增独立列 embedding_vector_v2。
4. 清空旧模型对应的 vector 写入状态。
5. 后台 backfill ai_memory_items。
6. 查询时只使用当前模型版本的向量。
7. 保留 embedding_json 作为短期 fallback。
```

如果不想立刻改 pgvector 维度，可以先只写 `embedding_json`，用应用层 cosine 做小规模验证。但这只能作为短期过渡。

## 推荐实现路线

### M0：模型与维度验证

目标：确认模型能跑、维度是多少、延迟是否能接受。

步骤：

```text
1. 云端 ollama pull bge-m3。
2. 调用 /api/embed 测试 10-20 条中文饭卡/标签。
3. 记录向量维度、单条耗时、批量耗时、内存占用。
4. 用 20-50 组人工样例验证相似度：
   - 日本菜 ≈ 日料 ≈ 日本料理 ≈ 居酒屋
   - 清淡 ≈ 不辣 ≈ 少油
   - 社恐友好 ≈ 慢热 ≈ 不尬聊
   - 二食堂 ≈ 二餐 ≈ 第二食堂
```

验收标准：

- 相似表达 cosine 明显高于无关表达。
- 单批后台生成不会拖垮 `ueat-server`。
- Ollama 服务异常时业务接口不受影响。

### M1：抽共享语义模块

目标：让 AI 破冰和首页匹配共用同一套语义归一、embedding 和相似度工具。

建议新增：

```text
server/src/modules/semanticSignals.ts
```

职责：

- taxonomy 配置。
- `extractCanonicalTags(text)`。
- `buildCanonicalTags({ text, rawTags })`。
- `createEmbedding(text)` provider 抽象。
- `cosineSimilarity(left, right)`。
- `labelForTag(tag)`。
- embedding 模型版本和维度检查。

改造：

- `aiMemory.ts` 不再私有持有 taxonomy 和 hash embedding。
- `recommendation.ts` 后续可以直接使用 canonical tags 和向量相似度。

### M2：替换 AI 破冰 embedding provider

目标：先让 AI 破冰的公开画像召回获得真实语义能力。

新增环境变量建议：

```text
AI_EMBEDDING_PROVIDER=ollama|hash|disabled
OLLAMA_EMBEDDING_MODEL=bge-m3
AI_EMBEDDING_MODEL=ollama:bge-m3
AI_EMBEDDING_BATCH_SIZE=16
AI_EMBEDDING_BACKFILL_LIMIT=500
```

处理方式：

- 用户发饭卡、发帖、评论、改资料后只触发后台画像刷新。
- 画像刷新时批量调用 Ollama embedding。
- 写入 `ai_memory_items.embedding_json` 和 pgvector。
- 写入失败时保留 canonical tags，不影响聊天或饭卡主链路。

### M3：首页饭卡匹配复用语义能力

目标：让饭卡匹配识别自定义标签的语义相似，而不是只看字符串。

推荐新增 `semanticScore`：

```text
semanticScore =
  canonicalTagOverlap       * 0.45 +
  cardTextVectorSimilarity  * 0.30 +
  authorProfileSimilarity   * 0.20 +
  semanticConfidence        * 0.05
```

并入现有算法的方式：

```text
interestScore =
  oldRuleInterestScore * 0.55 +
  semanticScore        * 0.45
```

或者在总分里增加独立因子：

```text
score =
  reciprocalScore * 0.22 +
  sceneScore      * 0.20 +
  interestScore   * 0.15 +
  semanticScore   * 0.18 +
  behaviorScore   * 0.12 +
  trustScore      * 0.06 +
  qualityScore    * 0.04 +
  freshnessScore  * 0.02 +
  explorationScore* 0.01 -
  penalty
```

第一版更推荐前一种：把语义分并入 `interestScore`，减少总公式震荡。

### M4：后台匹配预计算

目标：允许更大模型慢慢算，但不拖首页。

可新增：

```text
meal_card_recommendation_features
meal_card_recommendation_cache
```

或先用 JSON 缓存：

```text
user_id
card_id
semantic_score
feature_json
model_version
updated_at
```

后台任务做：

- 新饭卡发布后生成饭卡 embedding。
- 用户画像变化后刷新该用户候选偏好。
- 定时预计算 active 饭卡候选集。
- 首页只读缓存 + 当前规则重排。

## 为什么后台慢可以，但首页不能慢

可以慢的任务：

- 公开内容 embedding。
- 用户画像刷新。
- 饭卡语义特征生成。
- 历史内容 backfill。
- 用户-饭卡候选预计算。

不应该慢的接口：

- `GET /meal-cards`
- `POST /meal-cards`
- 聊天消息发送
- 登录注册
- 帖子/评论主链路

首页用户打开时，应该读取已有向量/缓存。没有向量时降级到规则匹配，而不是等待 embedding 模型。

## 共享异步语义管线

AI 破冰和首页饭卡匹配应该共用同一套异步语义管线，而不是各自维护一份标签归一和 embedding 逻辑。

### 写入侧

用户产生公开内容后，主链路只负责写业务数据和投递后台任务：

```text
用户编辑偏好 tag / 发布饭卡 / 发帖 / 评论
-> 业务接口立即返回成功
-> 写入或标记 ai_memory_items 待刷新
-> 后台 worker 执行语义归一
-> 后台 worker 生成真实 embedding
-> 写入 canonical tags、embedding_json、embedding_vector、user_ai_profiles
-> 必要时刷新饭卡匹配缓存
```

这些动作不能阻塞：
- `POST /meal-cards`
- `GET /meal-cards`
- 发送聊天消息
- 发布帖子/评论
- 设置页保存资料

### 读取侧：AI 破冰

AI 破冰需要快速给用户可用结果：

```text
用户点聊天键盘
-> 读取双方已有画像和当前会话上下文
-> 用规则 + pgvector 召回证据
-> 立即返回 fallback 4 条和轻理由
-> 后台异步调用 Qwen 生成更自然版本
-> 完成后通过轮询/WebSocket 替换建议
```

如果 embedding 缺失或模型异常：

```text
真实 embedding 不可用
-> 回退 local-hash-embedding-v1 或规则 taxonomy
-> 仍返回模板 fallback
```

### 读取侧：首页饭卡匹配

饭卡匹配不是“发了饭卡后几秒内必须完成”的实时生成任务，适合后台预计算：

```text
饭卡发布或用户画像变化
-> 后台生成饭卡语义特征
-> 后台计算候选用户/候选饭卡语义相似度
-> 写入 meal_card_recommendation_cache
-> 首页打开时读取缓存 + 当前规则重排
-> 缓存缺失时降级当前启发式排序
```

这样可以允许 embedding/rerank 较慢，同时保证首页接口在 100 并发和 10k 数据量下仍以缓存、索引和分页为主，不把模型推理放进同步请求。

### 标准归并结果建议结构

后续建议新增归并表或 JSON 字段，保存原始表达和标准标签的关系：

```text
ai_semantic_aliases 或 semantic_tag_mappings
- id
- raw_text
- normalized_text
- canonical_tag
- dimension: food/scene/time/social/intent/topic/budget/location
- confidence
- method: rule/embedding/model/manual
- embedding_model
- reviewed_at
- created_at
- updated_at
```

饭卡、用户画像、AI 破冰证据都只消费 `canonical_tag + confidence + evidence`，避免每个模块重新理解一遍用户原始 tag。

## 对 AI 破冰和首页匹配的关系

共用能力：

- taxonomy。
- canonical tags。
- embedding provider。
- pgvector 检索。
- 用户公开画像。
- 语义证据样本。

不同目标：

| 模块 | 目标 |
| --- | --- |
| AI 破冰 | 找共同话题和开场证据，再让模型生成自然话术。 |
| 首页饭卡匹配 | 对饭卡候选排序，提升约饭邀请和接受概率。 |

所以 embedding 可以共用，但排序公式、理由文案和安全边界要分开。

## 同时完善匹配和破冰的执行计划

本路线用于后续 Codex 对话直接接着做。原则是先做共享语义基础设施，再分别接入 AI 破冰和首页匹配。

### S0：现状验收与基线样例

目标：确认当前实现和质量基线，避免后面改动没有对照。

步骤：
1. 固定 30-50 组人工样例，覆盖日料、火锅、清淡、安静、夜宵、食堂、预算、慢热、探店等。
2. 记录当前 `local-hash-embedding-v1` 在这些样例上的相似度。
3. 记录当前 AI 破冰返回的 `evidenceSignals`、理由和 4 条建议。
4. 记录当前首页饭卡匹配的 `matchScore`、reason 和排序结果。

验收：
- 有一份可重复运行的样例集。
- 能明确看出当前算法在哪些同义 tag 上失败。

### S1：轻量标准兴趣体系 v1

目标：不做庞大手写词库，但建立稳定的 canonical tag 层。

步骤：
1. 从现有 taxonomy 抽出 `food/scene/time/social/intent/topic/budget/location` 维度。
2. 每个维度先保留核心 30-50 个 canonical tag。
3. 给每个 canonical tag 配 5-20 个高频 alias。
4. 给归并结果增加 `confidence` 和 `method`。
5. 明确“未知但可保留”的自定义 tag 处理方式：保留 `custom:*`，但不作为强匹配依据。

验收：
- “日本菜/日式食物/日料/寿司/拉面/居酒屋”能归到可解释的日料相关标准类。
- “不辣/少油/清淡”能归到轻食或低刺激偏好。
- “慢热/不尴尬/低压力”能归到社交风格，而不是食物偏好。

### S2：真实 embedding provider

目标：把主 embedding 从 hash 升级为真实语义模型。

步骤：
1. 在云服务器验证 `bge-m3` 或 `qwen3-embedding` 是否可通过 Ollama 或独立服务运行。
2. 记录向量维度、单条耗时、批量耗时、内存占用。
3. 新增 `AI_EMBEDDING_PROVIDER=ollama|hash|disabled`。
4. 新增 `OLLAMA_EMBEDDING_MODEL=bge-m3` 或等价配置。
5. 新增模型版本隔离，避免新旧向量混查。
6. 根据真实维度新增 `embedding_vector_v2` 或迁移 `embedding_vector`。
7. 后台 backfill `ai_memory_items`。

验收：
- 样例集中同义表达组内相似度明显高于跨组。
- Ollama embedding 服务异常时，业务接口不失败。
- pgvector 查询只使用同一个 embedding 模型版本。

### S3：AI 破冰接入真实语义召回

目标：先让破冰话题获得更可靠的证据，而不是让大模型自由发挥。

步骤：
1. `aiMemory.ts` 改为使用共享 `semanticSignals`。
2. `buildConversationEvidence` 同时召回 canonical shared、semantic query、semantic shared content。
3. evidence 中保留来源：偏好 tag、饭卡、帖子、评论、当前会话 query。
4. prompt 中要求 Qwen 只能基于 evidence 生成，不输出性格判断。
5. fallback 继续保留规则模板。

验收：
- 没有共同聊天记录时，也能基于双方公开 tag/饭卡生成开场。
- 有相似但不同写法的 tag 时，理由能显示轻量解释。
- 模型超时或失败时，仍返回 4 条 fallback。

### S4：首页饭卡匹配接入 semanticScore

目标：让首页匹配识别同义偏好，但不推翻当前稳定排序。

步骤：
1. `recommendation.ts` 读取当前用户画像、作者画像、饭卡 canonical tags、饭卡 embedding。
2. 新增 `semanticScore`。
3. 第一版把 `semanticScore` 并入 `interestScore`，不要大改总公式。
4. 缺少 embedding 时回退旧 `interestScore`。
5. `reason` 增加语义归一后的解释，例如“你们都提到日料相关偏好”。

验收：
- “日本菜/日料/居酒屋”等不同写法能提升排序。
- 没有向量的饭卡仍能正常显示。
- `/meal-cards` 不等待模型实时生成。

### S5：饭卡推荐后台预计算

目标：支持 10k+ 数据和 100 并发，不让首页同步算重活。

步骤：
1. 新增推荐特征缓存表。
2. 饭卡发布后异步生成饭卡 embedding 和 semantic features。
3. 用户画像更新后异步刷新该用户相关候选。
4. 首页读取缓存，再用当前实时因素做轻量重排：新鲜度、拉黑、举报、是否自己、近期曝光。
5. 缓存缺失时走当前规则算法。

验收：
- 10k active 饭卡下首页不需要全量 Node 内存排序。
- 缓存更新失败不会影响发布饭卡和浏览首页。
- 能解释某张卡靠前的主要分项。

### S6：反馈日志和离线评估

目标：开始用真实校内行为校准权重，而不是凭感觉调参。

步骤：
1. 记录首页曝光、点击详情、滑过/跳过、想一起吃、接受、拒绝、拉黑、举报。
2. 记录 AI 破冰曝光、选择、发送、对方是否回复、是否推进到约饭。
3. 建离线评估脚本，对比旧算法和新算法的排序变化。
4. 做基础指标：邀请率、接受率、私聊开启率、举报率、拉黑率、重复曝光未互动率。

验收：
- 每次算法改动能回答“指标是否变好”。
- 能识别低质量话术和低质量匹配信号。

### S7：rerank 与轻量学习排序

目标：在召回稳定后，再考虑训练或学习排序。

步骤：
1. 先用规则 rerank，把向量召回的候选证据压到最有用的 3-5 条。
2. 数据足够后训练轻量排序模型或 reranker。
3. 训练目标优先使用真实行为：点击、邀请、接受、回复、举报负反馈。
4. 保留安全过滤、拉黑过滤、举报过滤和规则兜底。

验收：
- 模型排序优于规则基线。
- 出现异常时可以回滚到规则 + embedding。
- 不使用私聊长期画像训练用户偏好。

## 当前优先级

当前最建议做：

```text
P0: 部署 bge-m3，验证 /api/embed、维度、延迟和样例相似度。
P1: 抽 shared semanticSignals 模块。
P2: AI 破冰从 local-hash-embedding-v1 切到 ollama:bge-m3。
P3: backfill ai_memory_items。
P4: 首页匹配接入 canonical tags + semanticScore。
P5: 建立曝光/邀请/接受/拒绝日志，后续用真实行为调权重。
```

不建议现在做：

- 直接让 Qwen 聊天模型在 `/meal-cards` 请求里分析所有候选。
- 一开始就训练排序模型。
- 不区分模型版本地混用 hash embedding 和真实 embedding。
- 把私聊全文写进跨会话用户画像。

## 验收样例

至少准备这些人工样例：

```text
日本菜 / 日式食物 / 日本料理 / 日料 / 居酒屋 / 寿司 / 拉面
清淡 / 不辣 / 少油 / 健康餐 / 轻食
社恐友好 / 慢热 / 不尬聊 / 安静一点 / 低压力
二食堂 / 二餐 / 第二食堂 / 食堂二楼
夜宵 / 宵夜 / 下课后吃 / 晚上十点
探店 / 新店 / 种草 / 打卡 / 没去过
```

每组内部相似度应该明显高于跨组相似度。上线前不要只看模型能返回向量，还要看这些样例是否真的排得对。

## 文档关联

- `12-ai-icebreaker-assistant.md`：AI 破冰当前画像、embedding 和反馈链路。
- `13-ai-icebreaker-m5-governance.md`：AI 安全、治理、隐患和运维验收。
- `14-home-meal-card-matching-algorithm.md`：首页饭卡匹配当前公式和迁移方式。
