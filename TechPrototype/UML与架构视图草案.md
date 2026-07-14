# ueat UML 与架构视图草案

本文档用于第二周技术原型评审材料。后续可将 Mermaid 图导出为图片，放入 Word 或 PPT。

## 1. 用例模型

### 1.1 核心参与者

- 当前用户：注册登录、浏览约饭卡、发布约饭卡、发帖、聊天、管理个人资料。
- 其他用户：被浏览、被关注、接收约饭邀请、参与聊天。
- 管理员：处理举报、审核内容。
- 系统：推荐约饭卡、生成通知、同步聊天消息。

### 1.2 用例图

```mermaid
flowchart LR
  User["当前用户"]
  Other["其他用户"]
  Admin["管理员"]
  System["系统"]

  Login["注册/登录"]
  BrowseCards["浏览约饭卡"]
  FilterCards["筛选/搜索约饭卡"]
  PublishCard["发布约饭卡"]
  InviteMeal["想一起吃"]
  Chat["聊天沟通"]
  PublishPost["发布社区帖子"]
  InteractPost["评论/点赞/收藏"]
  FollowUser["关注用户"]
  Report["举报内容或用户"]
  ReviewReport["审核举报"]
  Recommend["计算推荐匹配"]
  Notify["生成通知"]

  User --> Login
  User --> BrowseCards
  User --> FilterCards
  User --> PublishCard
  User --> InviteMeal
  User --> Chat
  User --> PublishPost
  User --> InteractPost
  User --> FollowUser
  User --> Report

  Other --> Chat
  Other --> InteractPost

  Admin --> ReviewReport

  System --> Recommend
  System --> Notify
  BrowseCards --> Recommend
  InviteMeal --> Chat
  Report --> ReviewReport
```

## 2. 分析模型

### 2.1 领域对象

核心领域对象：

- User：用户账号与资料。
- MealCard：约饭卡。
- Post：社区帖子。
- Comment：评论。
- Follow：关注关系。
- Block：拉黑关系。
- Report：举报记录。
- Conversation：聊天会话。
- Message：聊天消息。
- MealExchangeRequest：约饭卡交换请求。
- Notification：通知。

### 2.2 领域类图

```mermaid
classDiagram
  class User {
    +string id
    +string email
    +string nickname
    +string avatarUrl
    +boolean verified
    +string[] preferenceTags
  }

  class MealCard {
    +string id
    +string userId
    +string text
    +string time
    +string place
    +string people
    +string[] tags
    +number matchScore
    +string reason
    +string status
  }

  class Post {
    +string id
    +string authorId
    +string title
    +string text
    +string mediaType
    +string status
  }

  class Comment {
    +string id
    +string postId
    +string authorId
    +string text
  }

  class Conversation {
    +string id
    +string type
    +Date createdAt
  }

  class Message {
    +string id
    +string conversationId
    +string senderId
    +string type
    +string content
  }

  class MealExchangeRequest {
    +string id
    +string senderUserId
    +string receiverUserId
    +string ownCardId
    +string targetCardId
    +string status
  }

  class Notification {
    +string id
    +string type
    +string actorUserId
    +string targetType
    +string targetId
    +Date readAt
  }

  class Report {
    +string id
    +string reporterId
    +string targetType
    +string targetId
    +string status
  }

  User "1" --> "*" MealCard
  User "1" --> "*" Post
  Post "1" --> "*" Comment
  User "1" --> "*" Comment
  Conversation "1" --> "*" Message
  MealExchangeRequest "1" --> "1" Message
  User "1" --> "*" Notification
  User "1" --> "*" Report
```

## 3. 设计模型

### 3.1 前后端模块设计

```mermaid
flowchart TB
  subgraph AppClient["Android App / WebView 前端"]
    Pages["pages 页面"]
    Components["components 组件"]
    Hooks["hooks 业务状态"]
    ApiClient["api client"]
    Capacitor["Capacitor Android 容器"]
  end

  subgraph Server["API 服务"]
    Auth["Auth 模块"]
    Users["Users 模块"]
    MealCards["MealCards 模块"]
    Posts["Posts 模块"]
    Chat["Chat 模块"]
    Recommendation["Recommendation 模块"]
    Notifications["Notifications 模块"]
  end

  subgraph Data["数据与资源"]
    DB["PostgreSQL"]
    Storage["媒体资源存储"]
  end

  Capacitor --> Pages
  Pages --> Components
  Pages --> Hooks
  Hooks --> ApiClient
  ApiClient --> Auth
  ApiClient --> Users
  ApiClient --> MealCards
  ApiClient --> Posts
  ApiClient --> Chat
  ApiClient --> Notifications
  MealCards --> Recommendation
  Auth --> DB
  Users --> DB
  MealCards --> DB
  Posts --> DB
  Chat --> DB
  Notifications --> DB
  Posts --> Storage
```

### 3.2 “想一起吃”时序图

```mermaid
sequenceDiagram
  actor User as 当前用户
  participant Web as App 前端
  participant API as API 服务
  participant Chat as 聊天/实时服务
  participant DB as 数据库
  participant Other as 接收方

  User->>Web: 点击“想一起吃”
  Web->>API: POST /meal-cards/:cardId/invite
  API->>DB: 校验用户、目标卡片、拉黑关系
  API->>DB: 创建或复用 conversation
  API->>DB: 创建 exchange_request
  API->>DB: 创建 meal_card_exchange 消息
  API->>Chat: 推送 exchange-request:new
  Chat-->>Other: 实时通知新邀请
  API-->>Web: 返回 conversationId 和 requestId
  Web->>Web: 打开聊天详情
  Other->>Chat: 接受或拒绝
  Chat->>API: 更新交换请求状态
  API->>DB: 保存 accepted/rejected
  Chat-->>Web: 推送 exchange-request:updated
```

### 3.3 约饭卡推荐活动图

```mermaid
flowchart TD
  Start([开始])
  LoadUser["读取当前用户偏好"]
  LoadCards["读取候选约饭卡"]
  Filter["过滤本人、拉黑、关闭、删除卡片"]
  Score["计算标签/时间/地点/人数/信任分"]
  Reason["生成推荐理由"]
  Sort["按匹配分和发布时间排序"]
  Return["返回首页卡片列表"]
  End([结束])

  Start --> LoadUser --> LoadCards --> Filter --> Score --> Reason --> Sort --> Return --> End
```

## 4. 架构视图

### 4.1 逻辑视图

```mermaid
flowchart LR
  Auth["认证与用户"]
  Card["约饭卡"]
  Rec["推荐匹配"]
  Community["社区内容"]
  Social["关注/拉黑/举报"]
  Chat["聊天会话"]
  Notify["通知"]

  Auth --> Card
  Auth --> Community
  Auth --> Social
  Auth --> Chat
  Card --> Rec
  Card --> Chat
  Community --> Notify
  Social --> Notify
  Chat --> Notify
```

### 4.2 进程视图

```mermaid
flowchart LR
  Browser["Android App WebView"]
  Rest["REST API"]
  WS["WebSocket 服务"]
  DB["PostgreSQL"]
  Storage["媒体存储"]

  Browser -- HTTPS --> Rest
  Browser -- WebSocket --> WS
  Rest --> DB
  WS --> DB
  Rest --> Storage
```

### 4.3 部署视图

```mermaid
flowchart TB
  UserDevice["安卓手机/模拟器"]
  APK["ueat.apk\nCapacitor Android"]
  ApiHost["Node.js API 服务器"]
  DbHost["PostgreSQL 数据库"]
  ObjectStorage["对象存储"]

  UserDevice --> APK
  UserDevice --> ApiHost
  ApiHost --> DbHost
  ApiHost --> ObjectStorage
```

## 5. 数据库 ER 草案

```mermaid
erDiagram
  USERS ||--o{ MEAL_CARDS : publishes
  USERS ||--o{ POSTS : writes
  USERS ||--o{ COMMENTS : writes
  POSTS ||--o{ COMMENTS : has
  USERS ||--o{ FOLLOWS : follows
  USERS ||--o{ REPORTS : creates
  CONVERSATIONS ||--o{ MESSAGES : contains
  USERS ||--o{ CONVERSATION_MEMBERS : joins
  CONVERSATIONS ||--o{ CONVERSATION_MEMBERS : has
  MESSAGES ||--o| MEAL_EXCHANGE_REQUESTS : carries
  USERS ||--o{ NOTIFICATIONS : receives

  USERS {
    string id PK
    string email
    string nickname
    boolean verified
  }

  MEAL_CARDS {
    string id PK
    string user_id FK
    string text
    string time
    string place
    string status
  }

  POSTS {
    string id PK
    string author_id FK
    string title
    string text
    string media_type
    string status
  }

  COMMENTS {
    string id PK
    string post_id FK
    string author_id FK
    string text
  }

  CONVERSATIONS {
    string id PK
    string type
  }

  MESSAGES {
    string id PK
    string conversation_id FK
    string sender_id FK
    string type
    string content
  }

  MEAL_EXCHANGE_REQUESTS {
    string id PK
    string message_id FK
    string sender_user_id FK
    string receiver_user_id FK
    string status
  }
```

## 6. 可直接放入评审 PPT 的结论

- ueat 技术原型采用 Android App 容器 + 前后端分离 + 分层架构，避免把真实业务请求散落在页面组件里。
- 当前界面原型的 hooks 边界可以作为迁移 API 的承接点。
- 核心技术验证包括推荐匹配算法、约饭卡交换消息、REST API、WebSocket 实时同步。
- MVP 不引入复杂微服务，先保证用户、内容、聊天、举报等主链路可运行。
- Capacitor 让当前 React/Vite 移动端前端可以打包为 APK，同时为后续其他客户端保留统一领域模型和接口边界。
