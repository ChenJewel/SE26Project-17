# 17 语义标签治理与自动更新路线

本文回答两个问题：

1. S0/S1 要做到接近成熟版本，进入 S2 前应该按什么步骤做。
2. 上线后如果出现新标签、新别名、新语义，怎样自动发现、审核、上线和回滚。

核心原则：标准兴趣层不能删除，自动化只负责发现候选和降低维护成本；真正用于强匹配的 `canonical tag` 仍然必须可解释、可评估、可回滚。

## 当前结论

上线后可以新增语义标签，也可以自动发现新 alias。推荐做成：

```text
静态 taxonomy
+ 数据库动态 mapping overlay
+ 异步候选挖掘
+ 人工或半自动审核
+ baseline 验收
+ 版本发布和回滚
```

不要做成：

```text
用户随便写一个 tag
-> 立刻变成强匹配标签
-> 直接影响首页排序和 AI 破冰证据
```

这样容易把错别字、玩笑、隐私内容、短期热梗和恶意文本写进长期画像。

## S0/S1 到位步骤

### Step 1：冻结可重复基线

已完成基础脚本：

```powershell
cd server
npm.cmd run s0:baseline
npm.cmd run semantic:baseline
```

进入 S2 前继续补强：

- S0 样例从当前核心场景扩到 30-50 组。
- 每组样例固定 expected canonical tags、expected top card、expected reason 关键词。
- 保留 `local-hash-embedding-v1` probe，专门证明 hash 只是 fallback。
- 每次语义改动后都跑同一份样例，避免修一处坏一处。

### Step 2：补齐标准兴趣层覆盖

当前 S1 已有 8 个维度：

```text
food / scene / time / social / intent / topic / budget / location
```

成熟前建议最低线：

| 维度 | 最低成熟线 | 重点补齐 |
| --- | ---: | --- |
| food | 20-30 | 校园高频菜系、口味、饮品、小吃 |
| scene | 12-18 | 安静、热闹、拍照、久坐、快吃、散步、外卖 |
| time | 10-15 | 早餐、午餐、晚餐、夜宵、课后、周末、考试后 |
| social | 10-15 | 慢热、低压力、话多、倾听、边界感、幽默 |
| intent | 10-15 | 直接约、探店、临时、计划、定时定点、认识朋友 |
| topic | 10-20 | 学习、实习、运动、电影、音乐、游戏、旅行 |
| budget | 6-10 | 平价、AA、优惠、请客、中等预算 |
| location | 12-20 | 食堂、校内、宿舍、图书馆、校门、商圈、地铁 |

这不是要求一次人工穷举所有词，而是要求每个维度有稳定骨架。新词先进入 alias/mapping 候选，不直接扩成大量 canonical tag。

### Step 3：明确 custom tag 的位置

未知自由 tag 保留为 `custom:*`，但默认不参与强匹配。

允许用途：

- 展示用户原始表达。
- 作为候选 alias 挖掘输入。
- 作为 AI 破冰当前会话的轻量语境。
- 作为后续人工审核样本。

不允许用途：

- 直接提高首页饭卡强匹配分。
- 直接写入跨会话长期画像的高置信偏好。
- 直接作为训练标签。
- 直接进入大模型 prompt 让模型猜性格。

### Step 4：把动态 mapping 设计好，但先不接真实 embedding

进入 S2 前可以先设计表结构，不需要训练模型，也不需要真实 embedding。

推荐表名：

```text
semantic_tag_mappings
```

建议字段：

| 字段 | 说明 |
| --- | --- |
| `id` | 主键 |
| `raw_text` | 用户原始 tag 或短语 |
| `normalized_text` | 归一化后的文本 |
| `canonical_tag` | 目标标准标签 |
| `dimension` | food/scene/time/social/intent/topic/budget/location |
| `confidence` | 0-1 置信度 |
| `method` | rule/embedding/model/manual |
| `status` | pending/active/rejected/archived |
| `source` | profile_tag/meal_card/post/comment/admin |
| `source_count` | 出现次数 |
| `sample_json` | 少量公开样本引用，不存私聊全文 |
| `taxonomy_version` | taxonomy 版本 |
| `embedding_model` | 产生建议时使用的 embedding 模型，可为空 |
| `reviewed_by` | 审核人 |
| `reviewed_at` | 审核时间 |
| `created_at` | 创建时间 |
| `updated_at` | 更新时间 |

上线初期可以只做 CLI 或后台脚本导入导出，后续再做 admin UI。

### Step 5：共享语义层读取方式

`server/src/modules/semanticSignals.ts` 保持静态 taxonomy 作为基础。

后续新增一个动态 overlay：

```text
static taxonomy
-> active semantic_tag_mappings
-> in-memory cache
-> semanticSignals normalize/extract
```

运行时规则：

- 静态 taxonomy 永远可用。
- 动态 mapping 只读取 `status = active`。
- cache 每 5-10 分钟刷新，或 admin 发布后主动刷新。
- DB 读取失败时继续使用静态 taxonomy。
- 所有输出都带 `method` 和 `confidence`，方便解释和回滚。

## 自动更新流程

### 1. 候选来源

允许用于长期语义治理的来源：

- 用户公开偏好 tag。
- 公开饭卡标题、描述、标签、地点。
- 公开帖子。
- 公开评论。
- 管理员手动补充。
- S0/S1 人工评估样例。

禁止用于长期语义治理的来源：

- 私聊全文。
- 当前会话临时接话内容。
- 被举报、屏蔽、拉黑链路中的敏感样本。
- 未经过安全过滤的模型自由生成内容。

私聊只能用于当前会话接话，不写入跨会话长期画像。

### 2. 异步候选挖掘

所有候选挖掘都放后台任务，不阻塞：

- `GET /meal-cards`
- `POST /meal-cards`
- 发聊天消息
- 发帖子
- 发评论
- 保存资料

建议任务：

```text
semantic-candidate-mining
```

处理逻辑：

```text
读取最近公开内容
-> 抽取 raw tags 和短文本短语
-> normalizeRawToken
-> 跳过已知 active/rejected mapping
-> 聚合 source_count 和样本
-> 写入 pending candidates
```

### 3. 候选评分

S1 阶段只使用规则和统计：

- 与现有 alias 完全一致：高置信，可直接建议 active。
- 频繁出现但未知：pending，等待审核。
- 只出现 1 次且很长或很怪：低优先级 pending。
- 命中敏感词、攻击性文本、隐私文本：rejected 或不入库。

S2 之后增加真实 embedding：

- 用 bge-m3 或 qwen3-embedding 计算候选与 canonical label/alias 的相似度。
- 高相似、无冲突、来源足够多：建议 active。
- 多个 canonical 接近：保持 pending，人工判断。
- embedding 服务失败：不影响业务，只跳过本轮候选评分。

大模型只做低频后台建议：

- 输出候选归类建议和理由。
- 不自动改线上强匹配。
- 不进入 `/meal-cards` 或发消息同步链路。

### 4. 审核和发布

第一版可以做 CLI：

```powershell
cd server
npm.cmd run semantic:candidates
npm.cmd run semantic:promote -- <mapping-id>
npm.cmd run semantic:reject -- <mapping-id>
```

发布前必须跑：

```powershell
cd server
npm.cmd run semantic:baseline
npm.cmd run s0:baseline
npm.cmd run check
cd ../web
npm.cmd run check
```

审核动作：

- `promote`：pending -> active。
- `reject`：pending -> rejected。
- `archive`：active -> archived，用于下线。
- `rollback`：按 taxonomy_version 或 mapping batch 回滚。

### 5. 版本和回滚

每次发布动态 mapping 都生成版本：

```text
taxonomy_version = s1-canonical-taxonomy-v1
mapping_version = semantic-mapping-2026-07-20-001
```

日志中记录：

- AI 破冰 evidence 使用的 taxonomy/mapping version。
- 首页推荐 reason 使用的 taxonomy/mapping version。
- 反馈日志使用的 taxonomy/mapping version。

如果线上指标异常：

```text
禁用最近 mapping_version
-> 刷新 semanticSignals cache
-> 首页和 AI 破冰自动回到上一版本
```

## 自动更新的成熟分级

### Level 0：当前静态版本

- 静态 taxonomy。
- S0/S1 baseline。
- `custom:*` 保留但不强匹配。

适合进入 S2 前的稳定基础。

### Level 1：人工导入动态 alias

- 新增 `semantic_tag_mappings`。
- admin/CLI 手动新增 active alias。
- baseline 通过后发布。

这是上线初期最稳的自动化前置版本。

### Level 2：自动发现，人工审核

- 后台任务从公开内容挖掘候选。
- 系统按频次、规则、S2 embedding 相似度排序。
- 人工审核后 active。

推荐 U eat 第一阶段上线后采用 Level 2。

### Level 3：高置信自动发布，人工抽检

只允许非常保守的场景：

- 已有 canonical tag 的明显别名。
- 多来源高频出现。
- embedding 与目标 canonical 高相似，且与第二名拉开差距。
- baseline 全部通过。
- 可按 batch 一键回滚。

不建议在冷启动期直接启用。

## 与 AI 破冰和首页匹配的关系

AI 破冰：

- 使用共享 canonical tags 和 active mappings。
- evidence 必须展示来源和可解释标签。
- 大模型只基于 evidence 生成话术。
- 模型失败仍返回 4 条 fallback。

首页饭卡匹配：

- 使用共享 canonical tags 和 active mappings。
- `custom:*` 默认不进强匹配。
- 缺失 embedding 或 mapping cache 时回退当前规则。
- 首页打开时不等待 embedding、模型或候选挖掘。

## 进入 S2 前的完成定义

可以进入 S2 的标准：

- S0 样例覆盖 30-50 组，核心 expected 全部通过。
- S1 taxonomy 覆盖 8 个维度，每个维度达到最低成熟线。
- `custom:*` 策略明确并有 baseline 验证。
- AI 破冰和首页匹配都调用同一个 `semanticSignals`。
- `local-hash-embedding-v1` 只作为 fallback 和对照。
- 自动更新路线已有表结构、状态机、审核、发布、回滚方案。
- 文档明确私聊不进入长期画像。

仍然不做：

- 不训练模型。
- 不把 Qwen 聊天模型当 embedding。
- 不让主链路同步等待 embedding 或大模型。
- 不让未知 custom tag 直接强匹配。
- 不让模型自由决定用户长期画像。
