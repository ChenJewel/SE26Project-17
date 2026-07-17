# 11 约饭匹配与推荐算法设计

更新时间：2026-07-17

本文是 ueat 约饭匹配算法的长期设计文档。后续实现、论文/开源项目复现、接口字段和评审汇报，均优先以本文为准。

## 1. 设计目标

ueat 的推荐不是普通内容流，也不是传统相亲匹配。它同时具有三种属性：

- 找搭子：必须考虑双方是否都愿意一起吃饭，不能只优化单向点击。
- 内容平台：约饭卡、社区帖子、用户主页会形成兴趣内容流，推荐需要从曝光、点击、停留、评论、收藏、聊天等行为中学习。
- 即时场景：饭点、地点、人数、当前可用时间比长期兴趣更重要，推荐结果必须能解释、能快速刷新、能避免打扰。

算法目标：

1. 首页约饭卡返回稳定的 `matchScore` 和 `reason`。
2. 推荐排序能兼顾个性化、即时可约、安全可信和多样性。
3. “想一起吃”尽量推荐双方都可能接受的人，而不是只推荐当前用户可能点击的人。
4. 冷启动阶段可用规则算法上线，数据积累后平滑升级到混合推荐、双塔召回或学习排序。
5. 算法结果必须可解释，便于产品调试、用户理解和课程评审展示。

## 2. 借鉴对象

### 2.1 找搭子与双向匹配

找搭子、交友、招聘、人岗匹配等场景属于 reciprocal recommendation。核心思想是双方都要满意：

```text
pairScore(userA, userB) =
  interest(A -> B) * acceptance(B -> A)
```

迁移到 ueat：

- `interest(A -> B)`：我是否喜欢对方的约饭卡、标签、地点、主页状态。
- `acceptance(B -> A)`：对方是否可能接受我的邀请，是否偏好类似的人、饭点和地点。
- 双方都有明显负反馈时直接过滤或强降权。

### 2.2 抖音式内容分发

短视频内容流的关键不是静态标签，而是连续行为反馈：

- 曝光但立即滑走：弱负反馈。
- 点开详情、停留、查看主页：弱正反馈。
- 收藏、评论、关注、发起邀请：强正反馈。
- 拒绝、拉黑、举报：强负反馈。

迁移到 ueat：

- 首页划卡是推荐系统的曝光和跳过信号。
- 帖子、评论、群聊广场能补充用户兴趣画像。
- 新用户先用显式偏好和场景规则，老用户逐渐用行为反馈修正排序。

### 2.3 小红书式内容种草

小红书更接近“搜索 + 社区 + 兴趣内容”的混合推荐。ueat 可以借鉴：

- 标签和文本对兴趣建模很重要。
- 收藏、评论、关注关系比单纯浏览更稳定。
- 图片/视频提升内容质量和点击率，但不能替代真实匹配。
- 搜索词、社区互动、主页偏好可以反哺首页约饭推荐。

## 3. 开源项目参考

这些项目不建议直接塞进当前 Node 服务，但适合复现、对照和后期训练离线模型。

| 项目 | 可借鉴点 | ueat 使用阶段 |
| --- | --- | --- |
| `recommenders-team/recommenders` | 工业推荐系统样例集合，覆盖 ALS、BPR、LightFM、Wide&Deep、SASRec、评估指标和实验流程 | 算法调研、离线评估脚手架 |
| `RUCAIBox/RecBole` | 学术推荐算法框架，适合对比 LightGCN、SASRec、BPR 等模型 | 数据量足够后的模型实验 |
| `tensorflow/recommenders` | 双塔召回、候选生成、排序模型 | 中后期向量召回和深度模型 |
| `lyst/lightfm` | 混合推荐，能同时使用用户行为和内容特征，适合冷启动 | 第一版离线学习模型 |
| `benfred/implicit` | ALS/BPR/Logistic MF，适合隐式反馈 | 行为日志积累后做召回 |
| `PreferredAI/cornac` | 多模态和上下文推荐实验 | 后期把帖子图文、地点、用户关系纳入模型 |

当前实现仍应先保持 TypeScript 规则算法，因为它最容易解释、上线和调试。

## 4. 总体架构

推荐链路分为五层：

```text
数据层 -> 候选召回 -> 硬过滤 -> 精排打分 -> 多样性重排与解释
```

### 4.1 数据层

已有数据：

- `users.preference_tags`
- `meal_cards.tags/time/place/people/text/match_score/reason`
- `posts/topic/text/place/likes/favorites/comments/shares`
- `follows`
- `blocks`
- `reports`
- `messages`
- `exchange_requests`

建议新增：

- `recommendation_events`：记录曝光、点击、跳过、邀请、接受、拒绝、停留等行为。
- `user_preference_stats`：定期聚合用户近期偏好，避免每次请求都重算全量行为。
- `meal_card_quality_stats`：聚合约饭卡质量、曝光、点击、邀请和被拒绝率。

### 4.2 候选召回

第一版不需要复杂向量库，候选来源可以是：

1. 活跃约饭卡：`status = active`。
2. 同校、同地点、同饭点或近饭点的约饭卡。
3. 标签与用户偏好、近期互动话题重合的约饭卡。
4. 关注对象或二度关系发布的约饭卡。
5. 少量新卡片探索位，避免新内容永远没曝光。

后期可扩展为多路召回：

- 标签倒排召回。
- 地点/时间召回。
- 协同过滤召回。
- 双塔向量召回。
- 关注关系召回。
- 热门和新鲜内容召回。

### 4.3 硬过滤

这些条件不进入排序：

- 自己发布的卡片，除非是“我的卡片”页面。
- `status != active`。
- 当前用户拉黑对方，或对方拉黑当前用户。
- 目标用户或卡片存在高风险审核状态。
- 当前用户已经对同一目标频繁拒绝或举报。
- 对方设置不可被搜索/不可被推荐时。

### 4.4 精排打分

长期公式：

```text
finalScore =
  reciprocalScore * 0.25 +
  sceneScore      * 0.22 +
  interestScore   * 0.20 +
  behaviorScore   * 0.13 +
  trustScore      * 0.08 +
  qualityScore    * 0.07 +
  freshnessScore  * 0.03 +
  explorationScore* 0.02 -
  penalty
```

当前 TypeScript 规则版可先实现这些分项。

## 5. 分项设计

### 5.1 双向匹配 `reciprocalScore`

目标：估计双方都愿意开始约饭/聊天的概率。

输入：

- 当前用户偏好标签、近期互动标签、最近发布的约饭卡。
- 目标用户约饭卡标签、主页偏好、历史接受/拒绝行为。
- 双方是否互关、是否有聊天、是否接受过彼此或类似邀请。

MVP 规则：

```text
reciprocalScore =
  min(myInterestToCard, targetLikelyAcceptMe) * 0.75 +
  mutualFollowBonus * 0.15 +
  priorConversationBonus * 0.10
```

说明：

- `min()` 可以避免只满足一方。
- 没有足够数据时，`targetLikelyAcceptMe` 使用目标卡片标签与我的卡片/偏好重合度估计。
- 如果用户没有发布过卡片，则用主页偏好和近期社区互动估计。

### 5.2 场景匹配 `sceneScore`

约饭是强场景产品，场景权重要高。

组成：

- `timeScore`：饭点相近、当天可约、未来时间不过期。
- `placeScore`：同食堂、同校区、附近地点、自定义地点文本相似。
- `peopleScore`：1 对 1、2-3 人、都可以之间的兼容度。
- `availabilityScore`：用户最近在线、近期发卡、近期回复。

示例：

```text
sceneScore =
  timeScore * 0.35 +
  placeScore * 0.35 +
  peopleScore * 0.20 +
  availabilityScore * 0.10
```

### 5.3 兴趣匹配 `interestScore`

兴趣来自四类：

- 显式偏好：`users.preference_tags`。
- 约饭卡标签：`meal_cards.tags`。
- 文本关键词：卡片文案、帖子标题正文、用户 bio。
- 社区互动：点赞、收藏、评论、关注的话题和地点。

第一版实现：

```text
interestScore =
  tagOverlapScore * 0.50 +
  textOverlapScore * 0.20 +
  profileOverlapScore * 0.20 +
  communityTopicScore * 0.10
```

标签重合建议使用加权 Jaccard：

```text
weightedJaccard(A, B) = sum(min(weightA, weightB)) / sum(max(weightA, weightB))
```

当前没有权重时退化为普通 Jaccard。

### 5.4 行为反馈 `behaviorScore`

建议事件权重：

| 行为 | 权重 | 说明 |
| --- | ---: | --- |
| 曝光 | 0 | 只记录，不直接加分 |
| 快速滑走 | -1 | 弱负反馈 |
| 停留超过阈值 | +1 | 弱正反馈 |
| 点开详情 | +2 | 明确兴趣 |
| 打开用户主页 | +2 | 对人感兴趣 |
| 关注 | +5 | 强正反馈 |
| 想一起吃 | +8 | 极强正反馈 |
| 接受邀请 | +10 | 成功匹配 |
| 拒绝邀请 | -6 | 强负反馈 |
| 拉黑/举报 | -100 | 过滤或强惩罚 |

实现注意：

- 行为应有时间衰减，最近 7 天权重最高。
- 同一个目标重复曝光只计一次或降权，避免刷分。
- 负反馈比正反馈更要谨慎保留。

### 5.5 可信度 `trustScore`

组成：

- 校园认证。
- 资料完整度。
- 是否有头像或媒体。
- 最近登录/发言/发卡。
- 是否被举报、被拉黑、被大量拒绝。

可信度不能替代兴趣，但必须影响安全排序。

### 5.6 内容质量 `qualityScore`

约饭卡质量影响点击和回复：

- 文案长度适中。
- 标签不少于 2 个且不过度堆叠。
- 时间、地点、人数完整。
- 有图片/视频可加少量分，但不能让照片质量压倒匹配质量。
- 重复发布、广告式文案、过短文案降权。

### 5.7 新鲜度与探索

新鲜度：

- 新卡片适度加分。
- 即将过期或明显过期的卡片降权。
- 已多次曝光但未互动的卡片降权。

探索：

- 约 5%-15% 位置给低曝光新卡片或相邻兴趣卡片。
- 不连续推荐同一作者、同一地点、同一标签。
- 保证推荐列表里有一定地点/标签多样性。

## 6. 可解释理由

推荐理由不能直接暴露内部敏感信号，例如“对方经常接受你这种人”。应输出用户友好的理由。

理由优先级：

1. 饭点和地点高度匹配。
2. 标签或口味重合。
3. 人数和相处节奏一致。
4. 关注关系或近期互动。
5. 新鲜卡片或同校活跃用户。

示例：

- `饭点和地点都接近，适合今天直接约。`
- `你们都选了清淡、二食堂和安静聊天。`
- `对方最近也在找 1 对 1 饭搭子。`
- `同校活跃用户，卡片信息完整。`

## 7. 数据库与接口建议

### 7.1 新增行为表

```sql
CREATE TABLE recommendation_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  target_user_id TEXT,
  event_type TEXT NOT NULL,
  value INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TEXT NOT NULL
);
```

事件类型：

```text
meal_card_impression
meal_card_skip
meal_card_detail_open
meal_card_invite
meal_card_invite_accept
meal_card_invite_reject
user_profile_open
post_like
post_favorite
post_comment
follow
block
report
```

### 7.2 API

短期可复用：

```text
GET /meal-cards
```

建议支持参数：

```text
GET /meal-cards?personalized=1&limit=30
```

返回仍使用现有 `MealCard`，但 `matchScore/reason` 由服务端实时计算覆盖。

新增事件接口：

```text
POST /recommendation-events
```

请求：

```json
{
  "targetType": "meal-card",
  "targetId": "card_xxx",
  "eventType": "meal_card_detail_open",
  "metadata": {
    "source": "home",
    "durationMs": 4200
  }
}
```

## 8. 实现阶段

### 阶段 A：可解释规则排序

目标：不引入新服务，不改前端大结构。

要做：

1. 后端新增 `scoreMealCardForUser(currentUser, card, context)`。
2. `GET /meal-cards` 根据当前用户动态排序。
3. 过滤自己、拉黑、已删除、高风险卡片。
4. 生成中文 `reason`。
5. 保留 `createdAt` 作为同分排序兜底。

验收标准：

- 不同用户看到的首页顺序不同。
- 偏好标签变化后，推荐顺序会变化。
- 可解释理由能对应实际分项。
- 老数据没有行为日志时仍可正常推荐。

### 阶段 B：行为日志

目标：让算法开始“越用越准”。

要做：

1. 新增 `recommendation_events`。
2. 首页记录曝光、跳过、详情、邀请。
3. 邀请接受/拒绝写入事件。
4. 社区点赞、收藏、评论、关注也写入事件。
5. 定期聚合用户近期兴趣。

验收标准：

- 能从数据库看到完整推荐行为链路。
- 相同标签下，用户经常互动的地点/饭点优先。
- 多次跳过的作者、地点或标签会降权。

### 阶段 C：混合推荐

目标：引入离线训练但不破坏线上规则兜底。

推荐优先尝试 LightFM：

- 用户特征：偏好标签、学校、常去地点、互动话题。
- 物品特征：卡片标签、地点、时间、人数、作者活跃度。
- 交互：点击详情、邀请、接受、拒绝。

产物：

- 每日或每小时训练用户/卡片向量。
- Node 后端读取预计算推荐结果。
- 规则层继续做安全过滤、场景加权和解释生成。

### 阶段 D：双塔召回与学习排序

数据足够后再做：

- 用户塔：偏好、历史行为、社区兴趣、最近饭点。
- 卡片塔：标签、文本、地点、时间、作者特征。
- 排序模型：使用点击、邀请、接受作为 label。
- 双向模型：同时预测 A 喜欢 B 和 B 接受 A。

## 9. 评估指标

离线指标：

- Precision@K
- Recall@K
- NDCG@K
- MAP@K
- Coverage
- Diversity
- 新卡片曝光率

业务指标：

- 首页卡片详情打开率。
- “想一起吃”点击率。
- 邀请接受率。
- 发起聊天后的回复率。
- 用户拉黑/举报率。
- 新用户首日成功互动率。
- 新卡片首次曝光时间。

安全指标：

- 被举报用户曝光占比。
- 被拉黑后再次曝光率，应为 0。
- 重复打扰率。
- 性别、学校、活跃度等敏感或半敏感维度的曝光偏差，后期需要审计。

## 10. 当前代码映射

现有可直接复用的边界：

- `server/src/modules/mealCards.ts`：`GET /meal-cards` 是第一版个性化排序入口。
- `server/src/data/postgres.ts`：已有 `users.preference_tags`、`meal_cards`、`blocks`、`reports`、`follows`、`exchange_requests`。
- `web/src/hooks/useMealCards.ts`：前端已集中读取约饭卡，不需要页面散落 fetch。
- `web/src/hooks/useGlobalDetail.ts`：已读取和保存我的偏好标签。
- `web/src/pages/Home.tsx`：已有标签筛选、划卡、详情和邀请入口。
- `web/src/pages/CreateCard.tsx`：发布时已有卡片标签、时间、地点、人数和媒体字段。

第一版建议改动范围：

```text
server/src/modules/mealCards.ts
server/src/data/postgres.ts
server/src/modules/recommendation.ts   # 新增
server/src/types.ts                    # 如需新增事件类型
web/src/services/mealCardsApi.ts       # 如需增加 query 参数
```

## 11. 不建议现在做的事

- 不要一开始引入大型 Python 服务，部署和调试成本太高。
- 不要直接把用户隐私文本传给外部模型做在线推荐。
- 不要用黑盒分数替代可解释理由。
- 不要只按 `matchScore` 静态字段排序。
- 不要为了点击率牺牲拉黑、举报和安全过滤。
- 不要让图片/视频质量压倒饭点、地点、双向意愿。

## 12. 最终推荐策略

ueat 应采用“规则可解释 + 行为学习 + 双向匹配”的混合架构：

```text
第一版：TypeScript 规则排序，立即提升体验
第二版：行为日志和聚合画像，形成数据闭环
第三版：LightFM/implicit 离线混合推荐，解决冷启动和隐式反馈
第四版：双塔召回 + 学习排序 + 双向接受率预测
```

这条路线能同时满足课程评审、短期上线和后期算法演进：前期有明确公式和理由，后期有数据和模型空间，不需要推翻现有产品结构。

## 13. 参考资料

- GitHub: `recommenders-team/recommenders`
- GitHub: `RUCAIBox/RecBole`
- GitHub: `tensorflow/recommenders`
- GitHub: `lyst/lightfm`
- GitHub: `benfred/implicit`
- GitHub: `PreferredAI/cornac`
- TikTok 官方推荐机制说明：`How TikTok recommends content`
- Google Research: `Wide & Deep Learning for Recommender Systems`
- Google Research: `Deep Neural Networks for YouTube Recommendations`
- Reciprocal recommendation 方向论文：people-to-people matching、online dating、job recommendation、reciprocal embedding
