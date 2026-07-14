# 09 PostgreSQL、实时社区与个人主页读写迁移说明

更新时间：2026-07-14

## 本次结论

后端正式从云端 SQLite 切换为云端 PostgreSQL。

SQLite 只作为一次性历史数据迁移来源保留，不再作为运行数据库。服务启动后，注册、登录、约饭卡、帖子、评论、点赞、收藏、关注、通知、聊天、约饭邀请、个人主页资料都读写 PostgreSQL。

## 云端数据库

当前云服务器：`10.119.5.83`

PostgreSQL 数据库：

```text
database: ueat
role: root
connection: postgresql:///ueat?host=/var/run/postgresql
```

说明：

- 使用 PostgreSQL 本机 Unix socket。
- systemd 服务以 `root` 用户运行，对应 PostgreSQL `root` 角色。
- 不在代码仓库里写数据库密码。
- `DATABASE_URL` 由 systemd 注入：`postgresql:///ueat?host=/var/run/postgresql`。

## 部署脚本变化

相关文件：

```text
server/deploy/setup-postgres.sh
server/deploy/install-ubuntu.sh
server/deploy/ueat-server.service
deploy-cloud.ps1
```

部署时会自动执行：

1. 安装 `postgresql` 和 `postgresql-contrib`。
2. 启动并启用 PostgreSQL 服务。
3. 创建 PostgreSQL `root` 登录角色。
4. 创建 `ueat` 数据库。
5. 运行旧 SQLite 到 PostgreSQL 的一次性迁移脚本。
6. 使用 PostgreSQL 启动 Node API 服务。

## 一次性迁移

迁移脚本：`server/src/tools/migrateSqliteToPostgres.ts`

迁移来源默认是：`/opt/ueat/server/data/ueat-dev.sqlite`

迁移目标是 `DATABASE_URL` 指向的 PostgreSQL。

已覆盖表：

```text
users
meal_cards
posts
comments
likes
favorites
follows
blocks
reports
notifications
conversations
conversation_members
messages
message_reads
exchange_requests
```

迁移使用主键冲突跳过，所以重复部署不会重复插入同一批历史数据。

## 实时同步变化

WebSocket 入口：`ws://10.119.5.83/ws?token=<userId>`

已推送事件：

```text
chat.message.created
chat.exchange.created
chat.exchange.updated
community.post.created
community.post.updated
community.post.deleted
community.comment.created
community.comment.deleted
notification.created
```

前端现在会：

- 登录后自动连接 WebSocket。
- 收到聊天事件后刷新会话和聊天详情。
- 收到社区事件后刷新帖子和评论。
- 收到 `notification.created` 后刷新通知和红点。
- 保留 30 秒 HTTP 轮询兜底。

## 个人主页读写

新增/完善接口：

```text
GET /users/me/profile
PATCH /users/me
GET /users/:userId/following
GET /users/:userId/followers
```

`GET /users/me/profile` 返回：

```text
user
cards
posts
followedUsers
followers
```

前端已接入：

- 我的偏好标签从云端读取。
- 保存偏好标签会 PATCH 到云端。
- 头像字符选择会 PATCH 到云端。
- 关注列表从云端读取。
- 关注别人会写入云端 follows 表，并给对方推送新增关注通知。

## 后续仍需继续

- JWT 或 Session 替代当前开发版 `token=userId`。
- 图片/视频上传与对象存储。
- 管理后台页面。
- PostgreSQL 备份策略。
- WebSocket 在线状态、正在输入、已读回执。
- 自动化端到端测试。
