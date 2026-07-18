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
