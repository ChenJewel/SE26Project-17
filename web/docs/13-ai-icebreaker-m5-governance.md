# 13 AI 破冰助手 M5 治理与隐患清单

本文是 `12-ai-icebreaker-assistant.md` 的 M5 补充文档，用于后续 Codex 对话直接读取。当前 M5 不是完整运营后台，而是先落地基础治理：安全过滤、可观测状态、可回滚策略和风险清单。

## M5 已实现基础版

2026-07-18 已落地：

- 新增 `server/src/modules/aiSuggestionSafety.ts`，统一清洗和过滤 AI provider 输出。
- 过滤范围包括：联系方式引导、过度亲密、情绪施压、替用户承诺、敏感推断、不安全见面场景、直接提到 AI/算法/画像等。
- AI provider 返回结果、缓存结果、job 轮询结果、WebSocket ready 广播都会经过同一套安全整理。
- 模型返回少于 4 条时继续用本地 fallback 补齐；模型返回不安全内容时丢弃并用 fallback 补齐。
- 新增管理员接口 `GET /chat/admin/ai-suggestions/status`。
- 管理员接口返回 provider、模型、开关状态、队列长度、并发限制、超时、缓存 TTL、最近 24 小时 job 状态、平均完成耗时、曝光/点击/发送统计、memory/vectorized 数量。
- 管理员接口复用现有 `role === "admin"` 权限模型，普通用户不可访问。

## 当前仍未完成

- 还没有正式前端运营面板，目前只有后端 admin status API。
- 还没有离线评测集和自动评分脚本。
- 还没有 A/B 灰度分流，只能通过环境变量切换 provider。
- 还没有对方是否回复、是否成功约饭的链路归因。
- 还没有成本面板；本地 Ollama 没有 token 账单，但需要后续补 CPU、队列等待、失败率监控。

## 下一步 M5.2

```text
1. 增加离线评测 fixtures：opener/reply/advance 各 20-50 条场景。
2. 增加 eval 脚本：检查是否固定 4 条、是否触发安全词、是否过长、是否包含敏感推断。
3. 给 admin status API 做一个设置页内的隐藏管理面板。
4. 增加 AI_PROVIDER 灰度策略：按用户 hash 选择 template/ollama/api。
5. 把 job 失败率、平均耗时、缓存命中率写入运维文档和验收标准。
```

## 当前算法问题与隐患

这套 AI 破冰算法现在已经有工程闭环，但还不是成熟商业级。主要问题如下：

1. 本地小模型质量不稳定。
   `qwen3:1.7b` 在 4C16G CPU-only 上能跑，但表达有小模型痕迹，可能生成过短、泛泛、模板味重的句子。fallback 能保证可用性，但不能保证每条都高情商。

2. 本地模型延迟不适合高并发同步生成。
   首次请求已异步化，接口可快速返回 fallback。但后台 Qwen job 仍可能需要十几秒，100 并发时只能排队，不能承诺实时生成。压测核心接口时应使用 `AI_PROVIDER=template` 或 `disabled`。

3. 规则 taxonomy 仍然粗糙。
   现在只覆盖部分饮食、场景和聊天风格。标签写法差异可以靠规则 + embedding 缓解，但 `local-hash-embedding-v1` 不是语义大模型 embedding，召回质量有限。成熟版建议替换为真正 embedding 模型，或用商业 embedding API。

4. 画像证据有偏差风险。
   公开帖子、评论、饭卡只能代表用户某段时间的表达，不等于真实性格。产品文案应坚持“共同话题/兴趣线索”，避免说“系统判断你的性格”。

5. 私聊边界需要持续守住。
   当前实现是私聊只用于本次 query，不写入跨会话 profile。后续做反馈学习时，不能为了提升效果把私聊全文沉淀进画像。

6. 安全过滤是规则级，不是完整安全模型。
   M5 已加关键词/正则过滤，但它可能漏掉隐晦表达，也可能误伤正常句子。商业级需要“规则 + 模型审核 + 人工评测集”三层。

7. 推荐理由可能过度自信。
   当前 reason 来自公开 evidenceSignals，若召回质量不高，理由可能显得牵强。UI 上应保持“因为公开内容里出现过相关线索”这种轻表述，不要展示强判断。

8. Prompt 和中文文案需要专门打磨。
   当前工程链路先跑通，中文语气还需要人工样例和评测集迭代。终端中部分历史中文字符串显示为编码噪声，线上构建能跑，但后续应逐步整理源文件编码和文案资产。

9. 反馈学习仍然很浅。
   M4 已记录曝光、选择、发送，但还没记录改写幅度、对方回复、是否转化为约饭。现在的 `feedbackHints` 只是轻提示，不是真正排序模型。

10. 运维回滚仍依赖环境变量和 systemd。
    可以快速切到 `AI_PROVIDER=template/disabled`，但还没有后台一键切换。后续需要把 provider 状态、失败率和降级操作可视化。

## M3.5 画像匹配增强

2026-07-19 追加一版画像匹配增强，用来解决“AI 好像没有分析用户画像”的体验问题。

需要说明：之前并不是完全没有画像，而是画像太轻、太隐形。旧版主要做了：

```text
公开标签/饭卡/帖子/评论 -> canonical tags -> topTags -> evidenceSignals -> 推荐理由
```

问题在于：

- `user_ai_profiles` 里只有 topTags 和 sourceCounts，缺少维度化画像摘要。
- 推荐上下文只给模型 `evidenceSignals/evidenceReason`，没有明确告诉模型“当前用户/对方分别是什么公开兴趣结构”。
- 排序主要看共同 tag，没有充分利用“当前草稿命中对方公开内容”和“互补型搭话机会”。
- pgvector 召回只按数据库距离返回，缺少应用层二次阈值复核，理由可能牵强。

本次增强：

- 画像版本升级为 `m3-profile-match-v2`，旧版 profile 会自动刷新。
- `user_ai_profiles.profile_json` 新增：
  - `dimensions`：按 `food/scene/time/social/intent/topic` 分组。
  - `evidenceSamples`：保留少量公开证据摘要，方便解释和后续调试。
  - `confidence`：基于公开内容数量、来源类型、标签丰富度估算置信度。
- 数据源加权：
  - `profile_tag`: 3
  - `meal_card`: 2.2
  - `post`: 1.5
  - `comment`: 1
- 扩展语义标签：
  - 韩餐/烤肉、西餐/简餐、海鲜、夜宵、早餐。
  - 低压力相处、探索新店、偏好计划、轻松闲聊、学习/自习。
- 匹配信号拆成 4 类：
  - `shared`：双方公开内容中都出现的共同点。
  - `query`：当前草稿/最近聊天命中对方公开内容。
  - `complementary`：互补型机会，例如“主动约饭 + 对方偏安静/低压力”。
  - `target`：没有共同点时，优先使用对方公开高权重兴趣作为开场。
- pgvector 召回结果会再用本地 cosine 分数复核，避免召回太弱的证据直接进入理由。
- `profileSummaries` 会进入 AI job 的 `input_json`，让 Qwen 生成时能看到双方公开画像摘要。
- 如果用户公开画像为空，系统不会假装推断性格；会回退到“公开画像线索还不多，先根据当前话题给稳妥开场”。

增强后的链路：

```text
公开内容 -> memory items -> weighted tags + embedding
-> user_ai_profiles.dimensions/confidence/evidenceSamples
-> shared/query/complementary/target 信号排序
-> profileSummaries + evidenceSignals 进入模型上下文
-> 生成 4 条建议
-> M5 safety filter
-> fallback 补齐
```

这仍然不是完整商业级匹配算法。真正成熟版还需要：

- 使用真实 embedding 模型替代 `local-hash-embedding-v1`。
- 增加离线评测集，衡量“相关性、自然度、边界感、转化率”。
- 引入反馈排序模型，学习用户真正选择和发送的风格。
- 使用更多结构化饭卡字段，例如时间、地点、人数、预算、距离。
- 在 UI 上只展示轻量理由，不展示“性格推断”。

## M5.3 真实 Embedding 治理补充

2026-07-20 追加：AI 破冰和首页饭卡匹配应共用语义能力，但要把“聊天生成模型”和“embedding 模型”分开治理。

当前判断：

- `qwen3:1.7b` 是聊天生成模型，可继续用于异步话术生成。
- `local-hash-embedding-v1` 不是语义大模型 embedding，只能做过渡。
- 成熟语义召回应单独部署 embedding 模型，优先验证 `bge-m3`，再视资源测试 `qwen3-embedding`。

治理要求：

1. 模型版本隔离。
   `embedding_model` 必须写清楚，例如 `local-hash-embedding-v1`、`ollama:bge-m3`。不同模型生成的向量不能混排。

2. 维度迁移受控。
   当前 pgvector 列是 `vector(64)`。真实 embedding 维度需要以 `/api/embed` 实际返回为准，迁移时应重建索引或新增新列，避免线上启动失败。

3. 后台生成，不阻塞主链路。
   `GET /meal-cards`、聊天消息发送、帖子评论等核心接口不能同步等待大模型 embedding。缺失向量时必须回退到规则 taxonomy 和当前启发式排序。

4. 评测先行。
   至少用“日料/日本菜/居酒屋/日本料理”“清淡/不辣/轻食”“社恐友好/慢热/不尬聊”等样例验证同组相似度高于跨组相似度，再切线上流量。

5. 隐私边界不变。
   私聊内容只可作为当前会话 query，不写入跨会话画像，也不进入长期 embedding memory。

详细迁移方案见 [15-semantic-embedding-upgrade-plan.md](./15-semantic-embedding-upgrade-plan.md)。

## 线上验收点

```text
web check: cd web && npm.cmd run check
server check: cd server && npm.cmd run check
deploy: powershell.exe -ExecutionPolicy Bypass -File .\deploy-cloud.ps1
restart: ssh root@10.119.5.83 "systemctl restart ueat-server && systemctl is-active ueat-server"
health: http://10.119.5.83/api/health
admin status: GET http://10.119.5.83/api/chat/admin/ai-suggestions/status
```

管理员接口需要 `x-user-id` 对应 `role = admin` 的用户。
