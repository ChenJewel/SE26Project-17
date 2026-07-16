# Ueat 校园约饭系统

Ueat 是一个面向高校学生的校园约饭与轻社交系统。项目希望通过约饭卡、校园社区和即时聊天等功能，降低陌生同学从线上认识到线下见面的门槛，并为用户提供相对安全、低压力的交流方式。

当前仓库以 **React Web/PWA + Capacitor Android + Node.js API** 为主要实现路线，同时保留 Taro 跨端客户端作为微信小程序与 H5 的后续扩展方案。

## 技术栈

- Web 客户端：React 18、TypeScript、Vite、Tailwind CSS、Zustand
- Android 客户端：Capacitor 8、原生 Android Gradle 工程
- 跨端客户端：Taro 4、React、TypeScript
- 服务端：Node.js、Express、TypeScript、PostgreSQL、WebSocket
- 持续集成：GitHub Actions
- 云端部署：Ubuntu、Nginx、systemd

## 项目结构

```text
SE26project-17/
├─ web/                    # 主 Web/PWA 客户端及 Capacitor Android 工程
│  ├─ src/                # 页面、组件、状态、类型与 API 调用
│  ├─ public/             # PWA 图标、manifest 和 Service Worker
│  ├─ android/            # Capacitor Android 原生工程
│  ├─ docs/               # 产品、交互、数据模型和部署文档
│  └─ scripts/            # Android 签名等辅助脚本
├─ server/                 # Express 后端与实时通信服务
│  ├─ src/modules/        # 认证、用户、约饭卡、社区、聊天等模块
│  ├─ src/data/           # SQLite/PostgreSQL 数据访问层
│  ├─ src/common/         # HTTP 与请求公共工具
│  ├─ src/tools/          # 数据迁移工具
│  ├─ data/               # 本地运行数据目录（运行数据不入库）
│  └─ deploy/             # Ubuntu、Nginx 和 systemd 部署文件
├─ ueat-cross/             # Taro 跨端客户端，面向小程序与 H5
├─ docs/                   # Vision、问卷、项目背景与测试说明
├─ TechPrototype/          # 技术方案、架构视图和部署指导
├─ UIPrototype/            # UML、界面与迭代过程交付文档
├─ .github/workflows/      # Android APK 自动构建与发布流程
├─ .codex/                 # 项目内 Codex 辅助配置与技能
├─ deploy-cloud.ps1        # Web 与服务端云部署脚本
└─ README.md               # 项目总览
```

## 核心模块

### Web 客户端

`web/` 是当前功能最完整、主要维护的客户端。

- `src/pages/`：登录、首页约饭卡、发布卡片、社区、聊天、个人主页和设置页面。
- `src/components/`：底部导航、用户头像、内容详情、帖子与聊天子组件。
- `src/hooks/`：认证、约饭卡、社区、聊天、通知、实时事件和全局详情状态。
- `src/services/`：对后端认证、用户、帖子、聊天、搜索、上传等接口的封装。
- `src/types/`：用户、认证、约饭、聊天和通知等领域类型。
- `src/config/runtime.ts`：API 地址、WebSocket 地址和运行目标配置。
- `android/`：由 Capacitor 管理的 Android 工程，也是自动发布 APK 使用的工程。

### 服务端

`server/` 提供 REST API、实时消息与数据持久化能力。

- `src/modules/auth.ts`：注册、登录、退出和邮箱验证。
- `src/modules/users.ts`：个人资料、关注、拉黑及用户内容查询。
- `src/modules/mealCards.ts`：约饭卡的创建、查询、修改、删除与邀请。
- `src/modules/posts.ts`、`comments.ts`：社区帖子、评论、点赞与收藏。
- `src/modules/chat.ts`：会话、消息、已读、输入状态和消息撤回。
- `src/modules/notifications.ts`：用户通知。
- `src/modules/search.ts`：全局搜索。
- `src/modules/reports.ts`：举报与后台处理。
- `src/modules/uploads.ts`：头像、帖子和聊天媒体上传。
- `src/realtime.ts`：WebSocket 实时事件。
- `src/data/`：本地与生产数据库实现及统一存储接口。

### Taro 跨端客户端

`ueat-cross/` 是从 Web 原型迁移而来的跨端实现，可构建微信小程序和 H5。目前主要使用本地模拟数据，接入真实后端前需要进一步拆分状态层并补充 API 服务。

### 文档与原型资料

- `docs/`：项目愿景、调研问卷、上下文说明和移动端测试文档。
- `TechPrototype/`：系统技术方案、UML/架构视图、Android 打包和 Ubuntu 部署指导。
- `UIPrototype/`：界面原型、UML 模型、迭代计划与评估报告等课程交付物。
- `web/docs/`：与当前实现直接对应的产品边界、导航、交互、数据模型和上线手册。

## 本地运行

### 1. 启动服务端

```bash
cd server
npm install
copy .env.example .env
npm run dev
```

服务端默认地址为 `http://127.0.0.1:3000`。数据库等配置项请参考 `server/.env.example`。

### 2. 启动 Web 客户端

```bash
cd web
npm install
copy .env.example .env
npm run dev
```

浏览器访问终端显示的 Vite 地址。连接其他设备或云端服务时，需要在环境变量中配置 API 与 WebSocket 地址。

## 检查与构建

```bash
# Web 类型检查、代码检查与生产构建
cd web
npm run check
npm run lint
npm run build

# 服务端类型检查与构建
cd ../server
npm run check
npm run build
```

## Android APK

Android 正式打包工程位于 `web/android/`：

```bash
cd web
npm install
npm run app:sync-android
npm run app:open-android
```

也可以通过 `.github/workflows/android-release.yml` 构建签名 APK。推送 `v*` 格式的标签或手动触发工作流后，会生成 APK、SHA-256 校验文件并发布 GitHub Release。签名所需密钥应存放在 GitHub Actions Secrets 中，不应提交到仓库。

## 云端部署

根目录 `deploy-cloud.ps1` 会依次构建 Web 和服务端、整理部署包并上传到 Ubuntu 服务器。服务器安装与运维细节见：

- `server/deploy/`
- `web/docs/08-local-to-production-runbook.md`
- `TechPrototype/Ubuntu云服务器与App后端部署说明.md`

运行部署脚本前，请确认目标主机、SSH 权限、数据库和环境变量均已正确配置。

## 当前状态

- Web/PWA 主流程和主要后端 API 已具备原型实现。
- Android 使用 Capacitor 封装 Web 客户端，并提供自动发布流程。
- Taro 跨端客户端保留为微信小程序/H5 扩展路线，尚未完全接入真实后端。
- 项目仍处于课程原型与迭代阶段，生产部署前需要进一步完善安全、测试、监控与数据治理。
