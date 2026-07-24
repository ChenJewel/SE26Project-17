## 2026-07-20 S6 更新：破冰建议结果回流

AI 破冰侧已补齐 S6 第一版结果日志：

- `ai_recommendation_logs` 保留原有曝光、选择、发送字段，并新增 `recipient_replied_at`、`advanced_to_meal_at`、`outcome_json`。
- 用户发送 AI 建议后，如果对方在同一会话回复，会标记 recipient reply；如果后续发起或接受约饭，会标记 advanced-to-meal。
- outcome 只保存时间点、`exchangeRequestId`、`targetCardId` 等结构化结果，不保存私聊正文，不写入跨会话长期画像。
- `GET /chat/admin/ai-suggestions/status` 会返回最近 24 小时回复和推进约饭数量。
- `npm.cmd run recommendation:feedback -- <days>` 会同时汇总 AI 破冰漏斗，用于后续判断话术是否真的推动互动。

## 2026-07-20 S3.4 更新：生成质量闸门与严格格式解析

S3.3 后继续补齐生成质量问题：

- Ollama prompt 升级为 `compact-evidence-v3.1-fast-quality-gated`：要求模型输出可 `JSON.parse` 的字符串数组。
- 模型一次生成 5 个候选，后端通过质量/安全闸门挑选最多 4 个，降低“只生成 2 条”或个别候选被过滤后不够用的概率。
- `parseAiSuggestionProviderText` 只接受 JSON 数组，或 `{ suggestions/items/candidates: [...] }` 这类 JSON 对象；非 JSON 的编号列表不再被宽松解析，避免把解释文字误当建议。
- `finalizeAiSuggestions` 对模型候选启用更严格质量规则：过滤过短、过长、非中文、未完成句、泛泛句、元话术、弱根据推断、联系方式、过度亲密、敏感推断等。
- fallback 仍保留宽松安全兜底：模型失败、格式错误、候选不足或全被过滤时，UI 仍得到 4 条可用建议。
- 新增 `npm.cmd run ai-suggestions:quality`，用于离线验证解析、质量过滤、去重和固定 4 条输出。
- 云端回归后默认改为 `AI_MODEL_TIMEOUT_MS=60000`、`AI_MODEL_NUM_PREDICT=220`，在 CPU-only Qwen 上减少截断和超时；同步接口仍不等待模型。

## 2026-07-20 S3.3 更新：Prompt 压缩与模型常驻

S3.2 之后继续优化 Qwen 生成链路：

- 后台 Ollama 生成不再把完整 `job.input` 整包塞进 prompt，改用 `compact-evidence-v2`。
- compact context 只保留：`mode`、短草稿、最多 3 条 evidence、双方最多 3 个公开 top labels、最近 4 条短消息、最多 2 条 feedback hints 和简短 policy。
- evidence trimming 通过 `AI_PROMPT_MAX_EVIDENCE_SIGNALS` 控制，默认 3；消息上下文通过 `AI_PROMPT_MAX_MESSAGES` 控制，默认 4。
- Ollama 生成参数改为可配置：S3.3 初始为 `AI_MODEL_TIMEOUT_MS=45000`、`AI_MODEL_NUM_PREDICT=180`；S3.4 云端回归后调整为 `AI_MODEL_TIMEOUT_MS=60000`、`AI_MODEL_NUM_PREDICT=220`。
- 同步接口仍只返回 fallback / pending，不等待模型；模型失败或超时仍返回 4 条 fallback。

## 2026-07-20 S3.2 更新：重启回收与私聊 HMAC

S3.1 之后继续补齐两个上线隐患：

- 服务启动时会把遗留的 `pending/running` AI suggestion job 标记为 `failed`，轮询仍返回 4 条 fallback；不会在缺失草稿原文的情况下尝试重跑。
- `privateContext.draftHash` 和 `privateContext.messageTextHash` 已从裸 SHA 改为 `hmac-sha256-v1`。
- 生产环境通过 `/etc/ueat/ueat-server.env` 提供 `AI_PRIVACY_HASH_SECRET`；部署激活脚本会在缺失时自动生成随机 secret。
- HMAC 只用于不可逆排查/去重，不写入私聊原文，不进入长期画像或 embedding job。

## 2026-07-20 S3.1 更新：私聊上下文落库收紧

S3 后台真实语义召回已补充隐私与快照约束：

- `ai_suggestion_jobs.input_json` 不再保存当前草稿原文或最近私聊正文。
- 落库内容只保留 `messageRefs`、`privateContext.draftHash`、`privateContext.messageTextHash`、长度/数量、evidence 和策略字段，便于排查与离线评估但不还原私聊文本。
- 后台 worker 生成 Qwen prompt 时仍可使用本次请求内存中的草稿，以及创建 job 时 `lastMessageId` 之前的消息快照。
- 如果后台增强失败，仍使用创建 job 时已有的 canonical/cached evidence 和 4 条 fallback，不阻塞聊天主链路。

## 2026-07-20 S2.2 更新：公开画像 embedding 作业持久化

AI 破冰相关的公开画像 embedding 已接入 `ai_embedding_jobs`：

- 公开 preference tags、饭卡、帖子、评论进入 `ai_memory_items` 后，会异步排 `target_type = ai_memory_item` 作业。
- 作业 worker 写入目标模型 `ollama:bge-m3` 的 `embedding_json` 和 `embedding_vector_v2`；Ollama 失败时可以写 hash fallback，但作业继续重试目标模型。
- `buildConversationEvidence` 仍只消费已有公开 evidence、canonical tags 和已缓存向量，不在发消息或打开聊天详情时同步等待 embedding。
- AI provider 超时或失败时仍必须返回 4 条 fallback suggestions。
- 私聊内容只作为当前会话 query / 接话上下文，不写入长期画像或 embedding job。

## 2026-07-20 S3 更新：后台真实语义召回

AI 破冰已接入 S3 的第一版真实语义召回：

- `buildConversationEvidence` 支持显式 `allowRealtimeQueryEmbedding` 选项。
- 同步接口仍只读 canonical evidence 和已缓存向量，立即返回 fallback / pending，不等待 Ollama embedding。
- 后台 `ai_suggestion_jobs` worker 在调用 Qwen 生成前，会重新读取 conversation、最近消息和公开画像，开启实时 query embedding 召回。
- 后台增强 evidence 会写回 `ai_suggestion_jobs.input_json`，记录 `evidenceRecallMode=background-realtime-query-embedding-v1`。
- query embedding 只用于当前会话接话；私聊内容不写入 `ai_memory_items`，也不进入长期画像。
- Qwen prompt context 增加 `evidencePolicy`，要求话术基于 evidence，不猜性格，不暴露算法或 AI。
- Ollama embedding 失败时，只降级到 canonical / cached vector evidence，不影响 4 条 fallback。

# 12 AI 破冰与推进助手方案

本文记录 U eat “AI 破冰与推进助手”的产品设定、数据边界、算法路线、模型选择和分阶段落地方案。当前阶段只用于方案协商和后续实现依据。

## 目标定位

U eat 的 AI 键盘不是通用恋爱键盘，也不是只根据上一句话生成“高情商回复”。它应该服务于 U eat 的核心场景：

```text
饭卡邀约 -> 进入聊天 -> 找到共同点 -> 自然开场 -> 聊天接话 -> 适时推进到一起吃饭
```

产品目标：

- 聊天详情页始终有键盘入口。
- 饭卡邀请创建的新聊天自动提示一次。
- 第一版接真实大模型，但先用规则和向量找证据，再让模型生成。
- 推荐结果展示一句轻量理由，例如“因为你们都提到日料/安静小店”。
- 风格固定为 4 类，不提供复杂配置。
- 公开内容和饭卡可用于画像；私聊只用于当前会话接话，不沉淀到跨会话画像。
- 设置页提供“AI 破冰助手”总开关。

## 不是简单标签匹配

用户自填标签天然不统一，不能使用精确字符串匹配。

示例：

```text
日料 / 寿司 / 拉面 / 居酒屋 / 清淡点 / 想吃鱼生
```

这些不应该被当成互不相干的标签，而应该进入语义归一和向量匹配：

```json
{
  "raw": ["日料", "寿司", "拉面", "居酒屋", "清淡点", "想吃鱼生"],
  "canonical": ["japanese_food", "quiet_dining", "seafood"],
  "display": ["日料", "安静一点的饭局", "海鲜/鱼生"],
  "confidence": 0.86
}
```

同理，用户表达的聊天风格也需要语义抽取：

```text
我不太会主动聊天，但熟了以后话很多
```

内部可以抽成：

```json
{
  "socialStyle": ["slow_warmup", "low_initiation", "talkative_after_familiar"],
  "openerPreference": ["gentle_question", "low_pressure_invite"]
}
```

产品文案上不建议说“性格推算”，更建议叫：

```text
饭搭子线索 / 聊天偏好 / 兴趣画像 / 共同话题
```

## 推荐模式

键盘弹层建议固定三个模式。

### 开场

适合还没有真正开始聊天，尤其是“想一起吃”发送饭卡后。

依据：

- 当前饭卡：食物、地点、时间、人数、备注。
- 双方公开偏好标签。
- 双方公开饭卡历史。
- 对方公开帖子、评论、点赞、收藏。
- 双方共同话题和互补话题。

输出四类：

```text
自然型：看到你也挺喜欢日料的，要不我们先从口味对一下？
轻松型：我先坦白，我对拉面没有抵抗力，你是哪一派？
真诚型：我有点慢热，但这顿饭想认真找个能聊得舒服的人。
邀约型：如果你今晚方便，我们可以找个安静点的日料店，边吃边聊。
```

### 接话

适合已经有聊天内容。

依据：

- 当前会话最近 5-12 条消息。
- 当前草稿。
- 双方轻量画像。

私聊历史只用于当前会话本次推荐，不写入跨会话画像。

输出四类：

```text
共情型 / 幽默型 / 追问型 / 推进型
```

### 推进

适合已经聊起来，但还没有落到时间、地点、口味或人数。

依据：

- 聊天内容。
- 饭卡时间地点。
- 双方口味和社交偏好。

输出方向：

```text
确认时间 / 确认地点 / 确认口味 / 低压力邀约
```

## 成熟版算法链路

推荐链路不要让大模型直接阅读全部数据后随意生成。更稳的方式是“算法找依据，大模型说人话”。

```text
1. 收集可用用户行为文本
2. 抽取结构化画像
3. 生成 embedding 并写入向量索引
4. 点键盘时召回双方共同信号
5. 对候选信号排序
6. 让大模型基于证据生成 4 条候选
7. 安全过滤和语气约束
8. 记录用户选择、改写、发送、对方回复等反馈
```

推荐内部结构：

```json
{
  "mode": "opener",
  "signals": [
    {
      "type": "shared_food_interest",
      "evidence": ["A 饭卡：想吃日料", "B 收藏：拉面店帖子"],
      "score": 0.91
    },
    {
      "type": "social_style_match",
      "evidence": ["A 偏好：轻松聊天", "B 表达：慢热"],
      "score": 0.77
    }
  ],
  "suggestions": [
    {
      "style": "natural",
      "text": "看到你也挺喜欢日料的，要不我们先从口味对一下？",
      "reason": "你们都对日料/拉面相关内容有兴趣"
    }
  ]
}
```

## 数据边界

可用于跨会话画像：

- 用户公开偏好标签。
- 用户发布的公开饭卡。
- 用户发布的公开帖子。
- 用户公开评论。
- 用户对公开内容的点赞、收藏、关注关系。
- 用户主动选择和发送过的 AI 推荐类型。

只用于当前会话推荐：

- 当前私聊消息。
- 当前输入草稿。
- 当前会话里的饭卡交换上下文。

不建议用于画像：

- 私聊内容的长期沉淀。
- 敏感身份、外貌、家庭、经济、健康等推断。
- 被用户删除或设为不可见的内容。

设置页需要提供：

```text
AI 破冰助手：开/关
允许使用我的公开内容优化破冰推荐：开/关
```

## 数据库草案

后续可新增以下表或等价结构。

```text
user_ai_profiles
- user_id
- profile_json
- profile_embedding
- updated_at

ai_memory_items
- id
- user_id
- source_type: tag/post/comment/favorite/meal_card
- source_id
- text
- embedding
- metadata
- visibility
- created_at

ai_recommendation_logs
- id
- conversation_id
- requester_id
- target_user_id
- meal_card_id
- mode: opener/reply/advance
- context_json
- suggestions_json
- selected_index
- sent_message_id
- created_at

ai_suggestion_jobs
- id
- conversation_id
- requester_id
- target_user_id
- mode: opener/reply/advance/profile/embedding
- status: pending/running/succeeded/failed/cancelled
- provider: disabled/template/ollama/api
- input_json
- result_json
- error_message
- created_at
- started_at
- finished_at

ai_suggestion_cache
- cache_key
- mode
- provider
- context_hash
- suggestions_json
- expires_at
- created_at
```

云端服务器可以安装 PostgreSQL 扩展，因此正式向量检索优先使用 `pgvector`。如果部署窗口暂时不适合改数据库扩展，可以先把 embedding JSON 存库，使用应用层 cosine similarity 做过渡，但这只适合作为短期方案。

建议扩展：

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

建议索引方向：

```text
ai_memory_items.embedding 使用 vector 类型。
按 user_id、source_type、visibility 建普通索引。
按 embedding 建 HNSW 或 IVFFlat 向量索引，具体取决于 pgvector 版本和数据量。
```

## 模型与费用选择

“接真实大模型”通常意味着开发者或服务供应商需要支付 API 调用费用。用户不直接付 API 账单，除非产品后续设计会员或额度系统。

可选路线：

### 路线 A：商业 API

优点：

- 效果好。
- 延迟稳定。
- 运维成本低。
- 适合成熟版快速上线。

缺点：

- 有持续 token 成本。
- 数据会离开自有服务器，需要处理隐私和合规。
- 免费额度通常不适合生产长期依赖。

参考：

- OpenAI API pricing: https://platform.openai.com/docs/pricing
- Gemini API pricing: https://ai.google.dev/gemini-api/docs/pricing
- DeepSeek API pricing: https://api-docs.deepseek.com/quick_start/pricing/

当前公开资料显示，Gemini API 有免费层，但免费层内容可能用于改进产品；付费层通常提供更高限额，并声明内容不用于改进产品。生产环境要优先看付费层和数据政策。

### 路线 B：本地开源模型

可以在云服务器部署开源模型，例如通过 Ollama 或 vLLM 跑 Qwen、Llama 等模型。

参考：

- Qwen3 on Ollama: https://ollama.com/library/qwen3
- Llama 3.1 on Ollama: https://ollama.com/library/llama3.1

优点：

- 没有按 token 付费。
- 数据不离开自有服务器。
- 适合隐私敏感场景和后续成本控制。

缺点：

- 不是“免费”，只是从 API 成本转成服务器成本。
- 需要 GPU 或较高内存 CPU，普通小云服务器可能很慢。
- 模型效果、中文语气、稳定 JSON 输出、安全过滤都需要额外调试。
- 需要自己维护模型服务、监控、重启、限流。

对于 U eat 当前云服务器，如果没有 GPU，建议只把本地模型作为实验或 fallback；成熟生产更适合先用商业 API。

### 路线 C：混合方案

推荐采用混合方案：

```text
规则和向量召回：自有服务器完成
画像抽取：低频任务，可用便宜模型或本地模型
最终话术生成：商业 API
失败 fallback：本地模板或小模型
```

这样可以控制成本，也保留较好的生成质量。

## 云服务器本地模型部署记录

当前已在交大云服务器 `10.119.5.83` 上部署 Ollama 和 Qwen 本地模型。这里的“本地模型”指运行在云服务器本机，不是开发者个人电脑。

服务器检查结果：

```text
OS: Ubuntu 22.04.5 LTS
CPU: 4 cores, Intel Xeon Skylake
Memory: 15Gi
GPU: 未检测到 NVIDIA GPU
Swap: 0
Root disk: 47G total, 35G available after installation
```

已安装：

```text
Ollama: 0.32.1
Service: ollama active/enabled
Listen: 127.0.0.1:11434
Model: qwen3:1.7b
Model size: 1.4GB
Model storage: /usr/share/ollama/.ollama
```

安装命令：

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull qwen3:1.7b
```

测试命令示例：

```bash
curl http://127.0.0.1:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3:1.7b",
    "stream": false,
    "think": false,
    "prompt": "你是U eat校园饭搭子App的AI破冰助手。请根据场景生成4条自然、不油腻、不冒犯的中文开场白，每条不超过35字。场景：我发了一张饭卡，今晚7点想在校门口吃日料，对方喜欢安静的小店和拉面。只输出JSON数组。",
    "options": {
      "temperature": 0.7,
      "num_predict": 220
    }
  }'
```

测试结果：

```text
elapsed_seconds: 9.12
done_reason: stop
```

注意事项：

- Qwen3 在 Ollama 中支持 thinking。用于产品接口时应传入顶层参数 `"think": false`，否则 CPU-only 环境可能把 token 花在思考字段里，导致 `response` 为空或很慢。
- 当前模型只监听 `127.0.0.1`，适合由 U eat server 后端在同机调用，不应直接暴露公网。
- 4C16G CPU-only 可以支撑低并发实验和 fallback，但不适合多人高并发实时生成。
- `qwen3:1.7b` 速度可接受，质量有小模型痕迹；如果要提升质量，可继续试 `qwen3:4b` 量化版，但需要接受更高延迟。
- 后续接入业务时必须设置超时、并发限制、缓存和模板 fallback，避免模型慢时阻塞聊天体验。

## 异步、开关与性能策略

U eat 有性能要求：

```text
数据量不少于 10k。
100 并发场景下，核心接口响应时间 < 3s。
客户端支持 App 和 Web 浏览器，并适配不同分辨率/尺寸。
```

CPU-only 本地大模型不能进入核心同步链路。当前 `qwen3:1.7b` 单次生成实测约 9 秒，4B/7B 会更慢。如果把模型生成计入 100 并发同步响应，无法满足 `<3s`。

因此 AI 推荐必须同时支持：

```text
异步生成
缓存命中快返回
预生成
模板 fallback
模型 provider 开关
后台 worker 限流
```

Provider 建议：

```text
AI_PROVIDER=disabled   # 压测/故障时完全关闭 AI
AI_PROVIDER=template   # 只返回规则模板，不调用模型
AI_PROVIDER=ollama     # 调用云服务器本地 Qwen
AI_PROVIDER=api        # 未来调用商业 API
```

相关开关：

```text
AI_ICEBREAKER_ENABLED=true/false
AI_PROFILE_ENABLED=true/false
AI_EMBEDDING_ENABLED=true/false
AI_ASYNC_JOBS_ENABLED=true/false
```

### 用户界面表现

缓存命中或 template 模式：

```text
用户点击键盘 -> 直接显示 4 条推荐。
```

Ollama 无缓存时：

```text
用户点击键盘
-> 前端先显示模板 fallback 和“正在生成更贴合你们的版本...”
-> 后台 job 调用 Qwen
-> 生成完成后通过轮询或 WebSocket 替换推荐内容
```

接口返回建议：

```json
{
  "status": "ready",
  "suggestions": []
}
```

或：

```json
{
  "status": "pending",
  "jobId": "ai_job_xxx",
  "fallbackSuggestions": []
}
```

### 画像与向量任务

用户画像和 embedding 不应在用户发饭卡、发帖、评论、收藏时同步执行。正确链路是：

```text
用户操作成功返回
-> 写入 ai_memory_items 待处理
-> 后台 worker 抽取结构化画像
-> 后台 worker 生成 embedding
-> 更新 user_ai_profiles
```

用户点键盘时只做快速召回：

```text
读取当前饭卡/会话
读取双方已有 profile
用 pgvector 检索共同信号
规则排序证据
返回缓存/模板 fallback
后台异步生成更自然话术
```

压测策略：

```text
核心业务压测：AI_PROVIDER=disabled 或 template。
AI 能力压测：单独测试 job 提交、缓存命中、无缓存生成耗时和队列吞吐。
验收口径：AI job 提交接口 <3s；无缓存模型生成异步完成，不阻塞核心业务接口。
```

## 推荐实现顺序

第一阶段：方案级成熟，工程上稳。

```text
1. 增加设置项：AI 破冰助手开关。
2. 新增 AI provider 抽象：支持 mock/local/openai/gemini/deepseek/ollama。
3. 新增 opener/reply/advance 三种推荐模式。
4. 新增 AI job 队列、缓存和超时降级。
5. 先用规则召回饭卡、公开标签、公开帖子评论证据。
6. 接 Ollama qwen3:1.7b 作为本地模型 provider。
7. 保留当前模板算法作为失败 fallback。
```

第二阶段：语义能力。

```text
1. 安装并启用 pgvector。
2. 建立 ai_memory_items。
3. 增加 embedding worker。
4. 对标签、饭卡、帖子、评论做语义归一。
5. 点键盘时用向量召回共同话题。
```

第三阶段：反馈学习。

```text
1. 记录推荐曝光、点击、改写、发送、对方回复。
2. 按用户偏好调整四类风格排序。
3. 对低回复率话术降权。
4. 对成功约饭链路的话术和信号加权。
```

## M1 已实现基线

2026-07-18 已落地第一版工程基线，目标是“真实模型可接入，但不阻塞聊天主流程”。

后端：
- `server/src/modules/aiSuggestions.ts`：新增 AI provider 包装、Ollama 调用、超时、模板兜底、缓存 key、内存 job worker 和 WebSocket 完成通知。
- `server/src/modules/chat.ts`：保留 `POST /chat/conversations/:conversationId/reply-suggestions`，新增 `POST /chat/conversations/:conversationId/ai-suggestions` 和 `GET /chat/ai-suggestion-jobs/:jobId`。
- `server/src/data/postgres.ts`：新增 `ai_suggestion_jobs` 和 `ai_suggestion_cache` 两张表，以及对应 store 方法。
- `server/src/types.ts`：新增 AI suggestion job/cache 类型。

前端：
- `web/src/components/chat/ChatDetail.tsx`：键盘入口先展示 fallback 建议；当后端返回 `pending` 时显示轻提示，并通过轮询和 `chat.ai.suggestions.ready` 实时事件替换为模型结果。
- `web/src/services/chatApi.ts`：扩展 reply suggestion 返回类型，并新增 job 查询。
- `web/src/pages/Settings.tsx` 和 `web/src/types/settings.ts`：新增“AI 破冰助手”设置开关，后端读取 `settings.aiIcebreaker` 控制是否调用模型。

当前环境变量：
```text
AI_PROVIDER=template   # 默认，稳定返回本地模板，不调用模型
AI_PROVIDER=disabled   # 压测或故障时关闭 AI provider
AI_PROVIDER=ollama     # 调用同机 Ollama/Qwen
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_CHAT_MODEL=qwen3:1.7b
AI_MODEL_TIMEOUT_MS=30000
AI_MAX_CONCURRENT_JOBS=1
AI_SUGGESTION_CACHE_TTL_MS=600000
```

M1 还没有实现画像、pgvector、公开内容证据召回和推荐理由生成；这些进入 M2/M3。当前推荐理由只显示轻量状态提示，避免先做不可靠的“性格推断”。

## M2 已实现基线与后续交接说明

本节给后续 Codex 对话直接读取使用，尽量避免依赖前文上下文。

### 当前产品边界

- 聊天详情页底部输入框内始终保留键盘图标入口。
- 点击键盘后展示 4 条“破冰/接话/推进”建议。
- 饭卡邀请创建的新聊天，可以由页面进入逻辑触发一次桌宠语音提醒。
- 桌宠的 AI 相关边界非常窄：只允许在进入聊天详情页时发一条提示语音，例如“如果不知道怎么回，可以点右下角键盘看看推荐”。桌宠不提供 AI 聊天、不打开 AI 对话、不拥有 AI 开关、不承载破冰推荐结果。
- 设置页只保留一个“AI 破冰助手”总开关。该开关控制键盘推荐是否调用 AI provider；关闭后仍可展示本地模板 fallback，避免按钮完全失效。

### M1 已落地

M1 目标是让真实模型可以接入，但不阻塞聊天主流程。

已实现：
- `AI_PROVIDER=disabled/template/ollama`。
- `AI_PROVIDER=ollama` 时调用云服务器本机 Ollama/Qwen。
- `POST /chat/conversations/:conversationId/reply-suggestions` 保持兼容。
- 新增 `POST /chat/conversations/:conversationId/ai-suggestions`。
- 新增 `GET /chat/ai-suggestion-jobs/:jobId`。
- 新增 `ai_suggestion_jobs` 和 `ai_suggestion_cache`。
- 前端先显示 fallback；如果返回 `pending + jobId`，再用轮询和 WebSocket 事件替换成模型结果。
- systemd 已配置 Ollama 相关变量。

M1 关键环境变量：
```text
AI_PROVIDER=disabled   # 关闭模型调用，适合压测或故障切换
AI_PROVIDER=template   # 只走本地模板，响应稳定
AI_PROVIDER=ollama     # 调用云服务器本机 Ollama/Qwen
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_CHAT_MODEL=qwen3:1.7b
AI_MODEL_TIMEOUT_MS=30000
AI_MAX_CONCURRENT_JOBS=1
AI_SUGGESTION_CACHE_TTL_MS=600000
```

### M2 已落地

M2 目标是“先找证据，再让模型说人话”，而不是让大模型凭空推断性格。

已实现：
- 新增 `ai_memory_items`：保存可用于画像的公开内容线索。
- 新增 `user_ai_profiles`：保存轻量用户兴趣画像。
- 新增 `server/src/modules/aiMemory.ts`：负责公开内容索引、语义归一、画像刷新和聊天证据召回。
- 可进入画像的数据：公开偏好标签、公开饭卡、公开帖子、公开评论。
- 不进入跨会话画像的数据：私聊内容、当前输入草稿、当前会话历史。它们只用于本次接话，不沉淀到 `user_ai_profiles`。
- 饭卡、帖子、评论创建/编辑/删除后，会异步触发用户画像刷新；用户原操作不等待该刷新完成。
- 点键盘时会懒刷新双方画像，并召回共同线索，写入 `ai_suggestion_jobs.input_json.evidenceSignals`。
- 前端展示轻理由，例如“因为公开内容里出现过日料/安静小店相关线索。”

M2 目前使用规则词表做语义归一，例如：
```text
日料/寿司/刺身/拉面 -> japanese_food
火锅/串串/冒菜 -> hotpot
安静/舒服/不吵 -> quiet_dining
慢热/轻松/低压力 -> gentle_chat
```

这样可以先解决“标签每个人写得不一样”的问题。后续 M3 再把规则词表升级为 embedding + pgvector 召回。

M2 新增环境变量：
```text
AI_PROFILE_ENABLED=true/false   # 是否刷新和使用用户 AI 画像，默认启用
AI_RECALL_ENABLED=true/false    # 是否在推荐时召回公开证据，默认启用
AI_PROFILE_REFRESH_MS=600000    # 单用户画像懒刷新间隔
```

### 为什么必须异步

云服务器目前是 CPU-only 级别，Qwen 本地模型一次生成可能需要数秒。若把模型生成放进同步请求，100 并发时很容易超过 `<3s` 响应要求。

当前方案：
```text
用户点键盘
-> 后端立即生成本地模板 fallback
-> 如果 AI_PROVIDER=ollama，创建 ai_suggestion_jobs
-> 接口快速返回 pending + fallbackSuggestions + jobId
-> 后台 worker 限流调用 Qwen
-> 结果写入 job/cache
-> 前端通过 WebSocket 或轮询替换结果
```

用户界面看到的是：
```text
先出现 4 条可直接使用的建议
同时显示“AI 正在补充更贴合语境的版本”
模型完成后，建议自动刷新
模型失败或超时，则继续使用 fallback
```

### 如何关闭 AI 以满足压测

有三层关闭方式：

1. 用户级关闭：
```text
设置页 -> AI 破冰助手 -> 关闭
```
后端读取 `settings.aiIcebreaker === false`，不调用模型。

2. 服务级关闭：
```text
AI_PROVIDER=disabled
```
完全关闭 provider，适合故障切换。

3. 压测保守模式：
```text
AI_PROVIDER=template
AI_PROFILE_ENABLED=false
AI_RECALL_ENABLED=false
```
只测试核心业务接口，不让本地模型和画像刷新影响结果。

建议压测口径：
```text
核心业务压测：AI_PROVIDER=disabled 或 template。
AI 能力专项压测：单独测 job 提交、缓存命中、无缓存生成耗时、worker 队列吞吐。
验收标准：点键盘提交接口 <3s；模型无缓存生成可以异步慢慢完成，但不得阻塞核心聊天/饭卡/帖子接口。
```

### 必跑检查和部署

每次改动后必须运行：
```powershell
cd web
npm.cmd run check

cd server
npm.cmd run check
```

需要部署时运行：
```powershell
powershell.exe -ExecutionPolicy Bypass -File .\deploy-cloud.ps1
ssh root@10.119.5.83 "systemctl restart ueat-server && systemctl is-active ueat-server"
```

健康检查：
```text
http://10.119.5.83/api/health
```

如果改了 systemd 环境变量，还要确认：
```bash
ssh root@10.119.5.83 "systemctl show ueat-server -p Environment --value"
```

### M3 已实现：embedding + pgvector 可选召回

M3 目标是把 M2 的规则词表召回升级为“规则 + 向量”的混合召回，同时保持可关闭、可降级、不卡主链路。

已实现：
- `ai_memory_items` 增加 `embedding_json`、`embedding_model`、`embedded_at`。
- 服务启动时尝试 `CREATE EXTENSION IF NOT EXISTS vector`。
- pgvector 可用时，为 `ai_memory_items` 增加 `embedding_vector vector(64)` 和 HNSW cosine 索引。
- pgvector 不可用时，不阻止服务启动；继续使用 `embedding_json` 做应用层 cosine fallback。
- 当前 embedding provider 是 `local-hash-embedding-v1`，不调用大模型，不产生额外推理延迟。
- 画像刷新时为公开内容生成 embedding。
- 点键盘时，把当前草稿/最近私聊消息作为本次 query，只用于当前推荐召回，不写入跨会话画像。
- 召回结果继续进入 `evidenceSignals/evidenceReason`，由模型基于公开证据生成话题。

M3 新增环境变量：
```text
AI_EMBEDDING_ENABLED=true/false       # 是否生成和使用 embedding，默认启用
AI_EMBEDDING_MODEL=local-hash-embedding-v1
AI_PGVECTOR_ENABLED=true/false        # 是否尝试 pgvector 列和索引，默认启用
```

2026-07-18 追加状态：
- 云服务器已从源码编译安装 pgvector。
- 安装路径来自 PostgreSQL 14 的 `pg_config`，扩展控制文件位于 `/usr/share/postgresql/14/extension/vector.control`。
- 服务启动会自动创建 `vector` 扩展、`embedding_vector vector(64)` 列和 HNSW 索引。
- 已有 `embedding_json` 会限量回填到 `embedding_vector`，后续新 memory 写入时同步写 JSON 和 vector。

M3 降级链路：
```text
pgvector 可用 -> 用 embedding_vector 做数据库向量排序
pgvector 不可用 -> 用 embedding_json 在应用层做 cosine fallback
AI_EMBEDDING_ENABLED=false -> 回到 M2 规则词表召回
AI_RECALL_ENABLED=false -> 不召回画像证据，只保留模板/模型生成
AI_PROVIDER=disabled/template -> 不调用本地模型，适合压测
```

### M3.1 计划：替换为真实 embedding 模型

当前 `local-hash-embedding-v1` 只适合作为工程占位和字符相似 fallback，不是成熟语义 embedding。下一步应把 embedding provider 从 hash 向量升级为专用 embedding 模型，而不是复用 `qwen3:1.7b` 聊天模型。

2026-07-20 S2 更新：该计划的 provider 和存储基础已落地。

- 云服务器已验证 `bge-m3:latest`，返回 1024 维；冷启动 3 条约 4.86s，热调用 3 条约 0.69s。
- 新增 `AI_EMBEDDING_PROVIDER=ollama|hash|disabled`、`OLLAMA_EMBEDDING_MODEL=bge-m3`、`AI_EMBEDDING_VECTOR_DIMENSIONS=1024`。
- `embedding_vector vector(64)` 继续只服务 `local-hash-embedding-v1` fallback；`embedding_vector_v2 vector(1024)` 服务 `ollama:bge-m3`。
- `aiMemory.ts` 在 `ollama` 模式下后台生成 embedding，不阻塞发饭卡、发帖、评论、发消息或打开首页。
- AI 破冰仍保留 fallback 4 条建议；真实 embedding 缺失时回到 canonical evidence / 规则召回。

当前决策：

```text
聊天生成继续使用 OLLAMA_CHAT_MODEL=qwen3:1.7b。
语义向量单独部署 embedding 模型，优先验证 bge-m3。
首页饭卡匹配后续复用同一套 canonical tags + embedding。
```

注意事项：

- `embedding_vector vector(64)` 是为旧 hash embedding 准备的；真实 embedding 维度通常不是 64，迁移时必须重建或新增 vector 列。
- 旧模型向量和新模型向量不能混用，查询时必须按 `embedding_model` / 模型版本隔离。
- 用户发饭卡、发帖、评论时不应同步等待 embedding；画像刷新和 backfill 走后台任务。
- 详细实施路线见 [15-semantic-embedding-upgrade-plan.md](./15-semantic-embedding-upgrade-plan.md)。

### M4 已实现基础闭环：反馈学习

M4 目标是让系统知道哪些建议真的有用，而不是只看生成质量。

已实现：
- 新增 `ai_recommendation_logs`。
- 每次推荐接口返回时记录一次曝光，并返回 `recommendationLogId`。
- 前端用户点击某条推荐时，上报 `selectedIndex` 和 `selectedText`。
- 前端用户直接发送该推荐文本时，上报 `sentMessageId`。
- 后端生成下一次 AI context 时读取最近反馈，把用户选过/发过的话术作为 `feedbackHints`。
- 反馈只记录推荐文本和消息 id，不把私聊全文写入跨会话画像。
- AI provider 返回不足 4 条时，后端会用本地 fallback 补齐；返回超过 4 条时截断，保证 UI 始终展示固定 4 条。

M4 后续增强：
- 记录推荐曝光、点击、改写、发送、对方是否回复。
- 记录用户选择了哪一类风格，但不把配置暴露得太复杂。
- 对低回复率话术降权。
- 对成功约饭链路中的信号和话术加权。
- 仍然不把私聊内容沉淀到跨会话画像。

已新增/后续可扩展：
```text
ai_recommendation_logs
ai_suggestion_feedback
```

### M5 计划：运营治理、评测和安全

M5 目标是让 AI 破冰助手可以长期运行、可观测、可回滚。

计划：
- 管理员可查看 AI provider 状态、队列长度、错误率、平均完成时间。
- 增加离线评测集：不同聊天阶段、不同饭卡、不同标签噪声下的推荐质量。
- 增加安全过滤：避免冒犯、过度亲密、替用户承诺、敏感推断。
- 增加 A/B 开关：template、ollama、api provider、不同 prompt 版本可灰度。
- 增加成本/性能面板：本地模型 CPU 占用、job 延迟、缓存命中率。
- 增加一键降级：线上异常时切到 `AI_PROVIDER=template` 或 `disabled`。

M1-M5 总结：
```text
M1：异步 AI provider + fallback + 设置开关。
M2：公开内容画像 + 规则语义归一 + 轻理由。
M3：embedding + pgvector 可选向量召回 + JSON fallback。
M4：反馈学习和话术权重。
M5：治理、评测、安全、灰度和运维面板。
```

### M6+ 计划：与首页匹配共用成熟语义层

当前 M1-M5 已经完成“能用、可降级、可观测”的 AI 破冰基线，但语义能力仍是轻量版。下一阶段不应只在 AI 破冰内部继续堆规则，而应和首页饭卡匹配共用一套语义基础设施。

后续阶段建议：

```text
M6：轻量标准兴趣体系 v1
  -> 保留 canonical tag 层，不删除第一步
  -> 用少量核心类目 + alias + confidence 管理自由 tag

M7：真实 embedding provider
  -> 主 embedding 从 local-hash-embedding-v1 升级到 bge-m3 或 qwen3-embedding
  -> hash embedding 只作为模型异常时的兜底

M8：共享 semanticSignals 模块
  -> AI 破冰和首页匹配共用 taxonomy、canonical tags、embedding、pgvector 查询

M9：AI 破冰接入真实语义召回
  -> 大模型只基于 evidence 生成话术，不直接猜性格

M10：首页饭卡匹配接入 semanticScore
  -> 让“日本菜/日料/居酒屋”等不同写法可以提升匹配

M11：后台预计算与缓存
  -> 饭卡发布、画像变化后异步刷新语义特征和匹配缓存

M12：反馈评估与轻量学习排序
  -> 先做日志和离线评估，数据足够后再训练 reranker 或排序模型
```

详细计划见 [15-semantic-embedding-upgrade-plan.md](./15-semantic-embedding-upgrade-plan.md)。该文档是后续同时完善 AI 破冰和首页饭卡匹配时的主路线图。

## 当前共识

目前协商后的默认方案：

```text
聊天详情页始终显示键盘入口。
饭卡邀请创建的新聊天自动提示一次。
第一期接真实大模型，但不让模型直接乱猜；先由规则/向量找证据。
推荐结果展示轻理由。
风格固定四类。
公开内容和饭卡可用于画像。
私聊只用于当前会话接话。
设置页提供 AI 破冰助手开关。
AI 生成走异步任务、缓存和 fallback，压测或故障时可切换 disabled/template。
云端 PostgreSQL 可安装 pgvector，成熟画像与语义召回优先走 pgvector。
```
