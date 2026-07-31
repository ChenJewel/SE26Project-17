# U eat

U eat 是一个面向校园场景的约饭与轻社交系统。它希望把“想找人一起吃饭/聊天”的低压力需求变成一个可信、可管理、可逐步线下发生的产品体验。

当前仓库已经不再是默认 Vite 模板，而是一个包含 Web 前端、Node.js 后端、PostgreSQL 数据库、Android APK 封装与 GitHub Release 更新检查的完整原型工程。

## 目录

- [项目定位](#项目定位)
- [当前能力](#当前能力)
- [技术架构](#技术架构)
- [仓库结构](#仓库结构)
- [本地开发](#本地开发)
- [云端部署](#云端部署)
- [Android APK 与更新检查](#android-apk-与更新检查)
- [认证、邀请码与管理员](#认证邀请码与管理员)
- [安全边界](#安全边界)
- [文档索引](#文档索引)
- [常用命令](#常用命令)

## 项目定位

U eat 不是泛社交软件，也不是恋爱匹配软件。它聚焦于大学校园中更具体、更轻量的场景：

- 通过校园邮箱认证建立基本身份边界。
- 通过约饭卡降低第一次线下交流的心理门槛。
- 通过社区帖子、评论、收藏、点赞补充校园生活内容。
- 通过聊天、约饭邀请、AI 破冰建议帮助用户自然开启对话。
- 通过举报、拉黑、管理员审核等机制保障安全和秩序。

## 当前能力

### 用户与认证

- 邮箱/密码登录。
- 白名单校园邮箱注册。
- 注册邮箱验证码。
- 忘记密码邮箱验证码重置。
- 管理员邀请码注册，邀请码支持有效期、人数上限、启用/停用。
- 账号注销，后端清理用户相关云端数据并修正计数。

### 首页约饭卡

- 发布、编辑、删除约饭卡。
- 首页只展示从当天 0:00 起仍有效的饭卡，过期饭卡保留在用户主页但从首页隐藏。
- 首页饭卡按匹配算法排序。
- 饭卡支持图片，但已取消发视频饭卡入口。
- 右滑可触发“想一起吃”确认流程，并进入消息页。

### 社区

- 图片/视频/文字帖子发布。
- 图片最多 5 张，发布前可调整顺序。
- 视频上传后生成封面，列表页优先展示封面。
- 媒体加载失败时显示明确提示，避免灰块。
- 帖子详情、评论、点赞、收藏、举报。
- 用户主页与搜索页使用统一的新帖子排版。

### 聊天与通知

- 私聊与会话列表。
- 消息发送、撤回、已读。
- 约饭邀请进入聊天。
- 通知列表与未读计数。
- WebSocket 实时同步部分用户、帖子、聊天与互动事件。

### 个人主页

- 个人资料、头像、背景图、偏好标签。
- 主页背景与首页背景风格同步。
- 已发布帖子、喜欢帖子、收藏帖子按两列瀑布流展示。
- 已发布约饭卡、评论互动、关注/粉丝列表。
- 桌宠默认隐藏，用户可自行开启。

### 桌宠与头像贴纸

- 桌宠状态云同步。
- 桌宠等级、亲密度、喂食、喝水、动作反馈。
- Q 版头像桌宠贴纸系统与素材目录。
- 贴纸槽位设计已记录在文档中。

### 管理后台

- 管理员身份由后端 `role=admin` 控制。
- 管理员面板入口位于“我的主页”和“设置”。
- 管理员可查看验证码额度。
- 管理员可创建、停用、启用邀请码。
- 管理员可处理用户举报。
- 管理员可删除他人帖子、评论、约饭卡。

### App 更新

- 服务端读取 GitHub latest release。
- APK 可通过 GitHub Release 下载。
- App 内支持自动检查更新。
- 设置页支持手动检查更新。
- 非强制更新可关闭提示；关闭后同版本不重复提醒。

## 技术架构

```text
Android APK / Web
        |
        | React + Vite + Capacitor
        v
Nginx
  ├─ /      -> web/dist
  └─ /api   -> Node.js Express
                  |
                  v
              PostgreSQL
                  |
                  ├─ users / auth / settings
                  ├─ meal_cards / recommendation cache
                  ├─ posts / comments / interactions
                  ├─ chat / notifications / reports
                  ├─ email verification / invitation codes
                  └─ pet state / AI memory / semantic features
```

主要技术：

- 前端：React 18、TypeScript、Vite、Tailwind CSS、Capacitor。
- 后端：Node.js、Express、TypeScript。
- 数据库：PostgreSQL。
- 实时通信：WebSocket。
- 媒体处理：服务端上传与转码管线。
- APK 发布：GitHub Actions + GitHub Release。

## 仓库结构

```text
.
├─ web/                    # 主前端工程：React/Vite/Capacitor
│  ├─ src/                 # 页面、组件、hooks、services、types
│  ├─ docs/                # 当前实现相关的产品/技术文档
│  ├─ public/              # 静态资源
│  ├─ android/             # Capacitor Android 工程
│  └─ scripts/             # Android keystore 等辅助脚本
├─ server/                 # 后端工程：Express/PostgreSQL/WebSocket
│  ├─ src/                 # API、模块、数据访问、工具脚本
│  ├─ deploy/              # Ubuntu/Nginx/systemd 部署文件
│  └─ scripts/             # AI/语义评估脚本
├─ docs/                   # 课程/项目背景文档
├─ TechPrototype/          # 早期技术原型资料
├─ taro/                   # 小程序方向历史/实验工程
├─ ueat-cross/             # 跨端方向历史/实验工程
├─ deploy-cloud.ps1        # 当前云服务器一键部署脚本
└─ README.md               # 当前项目总入口
```

## 本地开发

### 前置条件

- Node.js 22 或兼容版本。
- npm。
- PostgreSQL，或可访问的远程 PostgreSQL。
- 可选：Android Studio、Java 21，用于本地 Android 构建。

### 后端

```bash
cd server
npm install
copy .env.example .env
npm run dev
```

默认后端地址：

```text
http://127.0.0.1:3000
```

健康检查：

```bash
curl http://127.0.0.1:3000/health
```

### 前端

```bash
cd web
npm install
copy .env.example .env.local
npm run dev
```

默认前端地址：

```text
http://127.0.0.1:5173
```

本地前端默认请求：

```text
VITE_API_BASE_URL=http://127.0.0.1:3000
VITE_WS_URL=ws://127.0.0.1:3000
```

## 云端部署

当前仓库包含面向课程云服务器的部署脚本：

```powershell
.\deploy-cloud.ps1
```

默认部署目标：

```text
Host: 10.119.5.83
User: root
Web:  http://10.119.5.83/
API:  http://10.119.5.83/api
```

部署脚本会执行：

1. 构建 Web 前端。
2. 检查并构建 server。
3. 打包上传到 `/opt/ueat`。
4. 安装/更新服务依赖。
5. 执行数据库迁移/初始化。
6. 启动或重启 `ueat-server`。
7. 检查 Web 与 API health。

正式发布前建议补齐：

- 域名。
- HTTPS。
- 正式对象存储或 CDN。
- 更强密码哈希方案。
- 更严格的请求校验与限流。

## Android APK 与更新检查

当前 Android 方案基于 Capacitor：Web 产物封装进 APK，App 内通过 WebView 请求后端。

本地同步 Android 工程：

```bash
cd web
npm run app:sync-android
```

打开 Android Studio：

```bash
cd web
npm run app:open-android
```

GitHub Release 发版方式：

```bash
git tag v0.2.3
git push origin v0.2.3
```

服务端更新中心会读取 GitHub latest release 中的 APK：

```text
GET /api/app/version/latest?platform=android&channel=official&versionCode=1
```

注意：

- APK 不是安全边界，服务端权限校验仍然必须完整。
- 旧 APK 如果写死 IP，未来迁移 HTTPS 域名时需要过渡兼容。
- Android 签名 keystore 不得提交到 Git。

## 认证、邀请码与管理员

### 校园邮箱

注册要求使用白名单校园邮箱。当前白名单配置在：

```text
server/src/modules/campusEmail.ts
```

也可通过环境变量扩展：

```text
CAMPUS_EMAIL_DOMAINS=example.edu.cn:示例大学,school.edu:School Name
```

### 邮箱验证码

验证码用途分为：

- `register`：注册。
- `password-reset`：忘记密码重置。

验证码默认：

- 10 分钟有效。
- 60 秒发送冷却。
- 每日发送总额度默认 40。
- 统计时区默认 `Asia/Shanghai`。

### 邀请码

邀请码可由管理员创建：

- 可设置备注名称。
- 可设置可注册人数上限。
- 可设置有效天数。
- 可启用/停用。
- 完整邀请码只在创建后显示一次，列表仅显示前缀。

### 管理员

管理员账号由数据库中的 `users.role = 'admin'` 决定。前端只根据后端返回的 `role` 展示入口；真正权限由后端再次校验。

管理员能力：

- 管理邀请码。
- 查看验证码额度。
- 处理举报。
- 删除违规帖子、评论、约饭卡。

不要把管理员密码、SMTP 授权码、数据库密码写入 README、GitHub issue、聊天记录或前端代码。

## 安全边界

当前项目已做：

- 服务端 bearer token。
- 管理员接口后端鉴权。
- 校园邮箱白名单。
- 验证码冷却与每日额度。
- 邀请码 hash 存储，完整码只显示一次。
- 媒体格式转码与失败提示。

仍需生产化加强：

- 启用 HTTPS。
- 密码从 SHA-256 迁移到 bcrypt 或 Argon2。
- 增加 API schema 校验，例如 Zod。
- 增加 IP、账号、邮箱维度限流。
- 对上传文件接入对象存储与病毒/格式扫描。
- 给管理员操作增加审计日志。
- 避免在公开仓库提交 `.env`、密钥、数据库备份、keystore。

## 文档索引

优先阅读：

- `docs/00_Project_Context.md`：课程项目背景与产品定位。
- `web/docs/00-docs-index.md`：当前 Web/App/后端文档总目录。
- `web/docs/06-code-file-guide.md`：代码文件职责。
- `web/docs/08-local-to-production-runbook.md`：本地到云端部署手册。
- `server/README.md`：后端接口与数据边界。

专题文档：

- `web/docs/11-pet-companion.md`：桌宠系统。
- `web/docs/14-home-meal-card-matching-algorithm.md`：首页饭卡排序算法。
- `web/docs/15-semantic-embedding-upgrade-plan.md`：语义 embedding 升级路线。
- `web/docs/18-pet-avatar-tag-sticker-design.md`：Q 版头像贴纸方案。

## 常用命令

前端：

```bash
cd web
npm run dev
npm run check
npm run build
```

后端：

```bash
cd server
npm run dev
npm run check
npm run build
npm run start
```

部署：

```powershell
.\deploy-cloud.ps1
```

更新检查接口：

```bash
curl "http://10.119.5.83/api/app/version/latest?platform=android&channel=official&versionCode=1"
```

健康检查：

```bash
curl http://10.119.5.83/api/health
```

## 当前状态说明

这个仓库处于“可真实内测的工程原型”阶段：核心链路已经接入云端数据与 APK 更新，但仍有生产化安全、运维、测试与合规工作需要继续补齐。

如果你是新的开发者或 AI 助手，请先阅读本文，再按 `web/docs/00-docs-index.md` 中的顺序进入具体功能文档。
