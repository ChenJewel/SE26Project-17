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

### 可以一步到位换真实 embedding

可以直接把 `local-hash-embedding-v1` 替换为真实语义 embedding，但要满足几个条件：

1. 不在核心同步接口里实时生成大批量 embedding。
2. 旧 hash 向量和新模型向量不能混用。
3. pgvector 列维度必须和新 embedding 维度一致。
4. 所有旧 `ai_memory_items` 要后台重算。
5. 首页饭卡匹配读取已有向量和画像，缺失时降级到当前规则。

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
