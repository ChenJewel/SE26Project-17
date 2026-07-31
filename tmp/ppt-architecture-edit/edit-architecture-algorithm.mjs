import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const source = "D:/U eat/tmp/ppt-architecture-edit/source.pptx";
const output =
  "D:/xwechat_files/wxid_w5tl0ctp3rxe22_0f07/msg/file/2026-07/Ueat 高校约饭搭子匹配系统 答辩PPT_架构算法修改版.pptx";
const qaDir = "D:/U eat/tmp/ppt-architecture-edit/final-render";

async function writeBlob(filePath, blob) {
  await fs.writeFile(filePath, new Uint8Array(await blob.arrayBuffer()));
}

async function replaceTextOnSlide(presentation, slide, replacements) {
  const layout = JSON.parse(await (await slide.export({ format: "layout" })).text());
  for (const element of layout.elements ?? []) {
    if (!element.aid || typeof element.text !== "string") continue;
    const nextText = replacements.get(element.text);
    if (nextText === undefined) continue;
    const target = presentation.resolve(element.aid);
    target.text.replace(element.text, nextText);
  }
}

function setNotes(slide, lines) {
  slide.speakerNotes.textFrame.setText(lines.join("\n"));
  slide.speakerNotes.setVisible(true);
}

const presentation = await PresentationFile.importPptx(await FileBlob.load(source));

const slide11 = presentation.slides.getItem(10);
const slide12 = presentation.slides.getItem(11);
const patternSlide = presentation.slides.getItem(11);
const designPatternSlide = patternSlide.duplicate();
designPatternSlide.moveTo(12);
const algorithmSlide = patternSlide.duplicate();
algorithmSlide.moveTo(13);

await replaceTextOnSlide(
  presentation,
  slide11,
  new Map([
    ["01 前端交互层", "01 前端与多端层"],
    [
      "基于响应式Web技术栈，实现PC端与移动端的无缝适配。采用组件化开发模式，确保多终端界面交互体验高度一致，快速响应校园场景的界面迭代需求。",
      "React + Vite + TypeScript 构建 Web 单页应用，Capacitor 复用前端产物封装 Android APK；页面负责展示，状态与接口下沉到 hooks/services。",
    ],
    ["02 业务服务层", "02 后端业务接口层"],
    [
      "核心业务拆分为用户中心、智能匹配、消息推送及社区内容四大微服务模块。各模块独立部署、低耦合，支持功能的并行开发与弹性扩展，提升系统维护效率。",
      "Express 按 auth、users、meal-cards、posts、chat 等 Router 拆分业务入口，统一 JSON 响应和鉴权边界，降低模块间耦合。",
    ],
    ["03 数据支撑层", "03 数据与实时层"],
    [
      "构建结构化数据体系，存储用户画像、订单信息、社区动态及兴趣标签。通过高效的数据存取与处理能力，为智能匹配算法和个性化推荐提供坚实的数据基础。",
      "PostgreSQL 保存用户、饭卡、帖子、聊天、通知和桌宠状态；WebSocket Hub 维护在线连接，把聊天、通知和内容变更实时推送到前端。",
    ],
    [
      "架构优势：采用前后端分离的轻量级设计，兼顾开发效率与系统稳定性，能够灵活应对校园场景下用户量的突发增长与功能的快速迭代需求，确保系统的高可用性。",
      "架构优势：前后端分离 + 接口层隔离 + 实时事件同步，让 Web、Android 与后端模块可以独立迭代，并支撑推荐算法、AI 破冰和管理后台持续扩展。",
    ],
  ]),
);
setNotes(slide11, [
  "这一页强调真实系统的三层架构：前端与多端展示、后端业务接口、数据与实时同步。",
  "讲述时可以顺着用户请求路径说明：React 页面调用 services，Express Router 接收请求，postgresStore 写入 PostgreSQL，必要时通过 WebSocket 推送变化。",
  "[Sources]",
  "Local repo: D:/U eat/README.md; D:/U eat/web/docs/06-code-file-guide.md; D:/U eat/server/src/app.ts; D:/U eat/server/src/realtime.ts",
]);

await replaceTextOnSlide(
  presentation,
  slide12,
  new Map([
    ["核心技术实现", "基于接口的架构设计"],
    ["多维度加权匹配算法", "前端 API Facade"],
    [
      "构建以兴趣标签为核心权重，融合时间、地点及专业年级的智能匹配模型。支持“精准匹配”“随机匹配”“主题匹配”三种模式，最大化提升匹配的契合度与成功率。",
      "统一 apiClient 处理 baseUrl、Token、JSON 和错误；业务接口集中在 services/*Api.ts，页面不直接拼请求。",
    ],
    ["场景化破冰话题引擎", "Hooks 状态边界"],
    [
      "基于智能规则引擎，结合用户兴趣偏好、用餐场景及时段特征，动态生成差异化的破冰话题。有效打破社交僵局，降低沟通门槛，提升用户间的互动意愿。",
      "页面负责展示与交互，约饭卡、社区、聊天、桌宠等业务状态收敛到 hooks；后续替换接口或 store 时不影响页面结构。",
    ],
    ["校园身份认证机制", "后端 Router 模块化"],
    [
      "深度对接校园学号与官方邮箱校验体系，建立严格的实名认证准入机制。从源头保障平台用户身份的真实性，打造纯净、安全的校园专属社交圈层。",
      "Express 按业务拆分 auth、users、meal-cards、posts、chat、reports 等 Router；统一响应格式，权限由后端再次校验",
    ],
    ["站内闭环通信方案", "数据访问接口隔离"],
    [
      "内置端到端加密的即时通讯模块，所有沟通行为均在平台内闭环完成。全程屏蔽外部联系方式泄露，有效规避信息滥用风险，全方位守护用户隐私安全。",
      "业务模块通过 postgresStore 读写数据库，SQL 与迁移逻辑集中在数据层；未来替换存储或增加缓存时，业务 API 契约保持稳定。",
    ],
  ]),
);
setNotes(slide12, [
  "这一页回答老师要求的“基于接口的设计”。重点不是接口数量，而是展示层、状态层、服务层、后端模块和数据层之间都有清晰边界。",
  "可以用约饭卡为例：Home 页面调用 useMealCards，hook 调用 mealCardsApi，mealCardsApi 走 apiClient，后端 mealCardsRouter 再调用 postgresStore。",
  "[Sources]",
  "Local repo: D:/U eat/web/src/services/apiClient.ts; D:/U eat/web/src/services/mealCardsApi.ts; D:/U eat/web/docs/06-code-file-guide.md; D:/U eat/server/src/app.ts",
]);

await replaceTextOnSlide(
  presentation,
  designPatternSlide,
  new Map([
    ["核心技术实现", "设计模式与关键技术"],
    ["多维度加权匹配算法", "Facade / Adapter"],
    [
      "构建以兴趣标签为核心权重，融合时间、地点及专业年级的智能匹配模型。支持“精准匹配”“随机匹配”“主题匹配”三种模式，最大化提升匹配的契合度与成功率。",
      "apiClient 与各业务 Api 文件封装请求细节；页面只调用业务动作，避免鉴权、URL、错误处理散落到组件里。",
    ],
    ["场景化破冰话题引擎", "Observer / Pub-Sub"],
    [
      "基于智能规则引擎，结合用户兴趣偏好、用餐场景及时段特征，动态生成差异化的破冰话题。有效打破社交僵局，降低沟通门槛，提升用户间的互动意愿。",
      "WebSocket Hub 按用户维护连接。饭卡、帖子、聊天变化后发布事件，前端订阅后触发局部刷新。",
    ],
    ["校园身份认证机制", "Strategy / Scoring"],
    [
      "深度对接校园学号与官方邮箱校验体系，建立严格的实名认证准入机制。从源头保障平台用户身份的真实性，打造纯净、安全的校园专属社交圈层。",
      "推荐排序封装在 recommendation 模块中。过滤、打分、语义特征和反馈数据可独立调整，外部接口保持不变。",
    ],
    ["站内闭环通信方案", "Async Job / Cache"],
    [
      "内置端到端加密的即时通讯模块，所有沟通行为均在平台内闭环完成。全程屏蔽外部联系方式泄露，有效规避信息滥用风险，全方位守护用户隐私安全。",
      "画像、embedding、约饭卡特征和推荐缓存走后台刷新，避免重计算阻塞主链路，提升首页加载稳定性。",
    ],
  ]),
);
setNotes(designPatternSlide, [
  "这一页把代码里的设计模式讲成人话：Facade/Adapter 解决调用复杂度，Observer/Pub-Sub 解决实时同步，Strategy/Scoring 解决算法可替换，Async Job/Cache 解决性能。",
  "答辩时不用背模式名定义，要说明每种模式在 U eat 中解决的具体问题。",
  "[Sources]",
  "Local repo: D:/U eat/web/src/services/apiClient.ts; D:/U eat/web/src/hooks/useRealtimeEvents.ts; D:/U eat/server/src/realtime.ts; D:/U eat/server/src/modules/recommendation.ts; D:/U eat/server/src/modules/mealCardRecommendationFeatures.ts",
]);

await replaceTextOnSlide(
  presentation,
  algorithmSlide,
  new Map([
    ["核心技术实现", "匹配算法设计"],
    ["多维度加权匹配算法", "候选集过滤"],
    [
      "构建以兴趣标签为核心权重，融合时间、地点及专业年级的智能匹配模型。支持“精准匹配”“随机匹配”“主题匹配”三种模式，最大化提升匹配的契合度与成功率。",
      "首页只保留仍有效的 active 饭卡，并过滤拉黑、举报、已交换请求等不可推荐对象，先保证推荐安全与有效。",
    ],
    ["场景化破冰话题引擎", "特征提取与归一"],
    [
      "基于智能规则引擎，结合用户兴趣偏好、用餐场景及时段特征，动态生成差异化的破冰话题。有效打破社交僵局，降低沟通门槛，提升用户间的互动意愿。",
      "从用户偏好、饭卡标签、时间地点、作者画像、语义标签和推荐缓存中提取特征，把不同来源的数据统一成可比较的匹配信号。",
    ],
    ["校园身份认证机制", "加权排序与解释"],
    [
      "深度对接校园学号与官方邮箱校验体系，建立严格的实名认证准入机制。从源头保障平台用户身份的真实性，打造纯净、安全的校园专属社交圈层。",
      "rankMealCardsForUser 综合标签相似度、时间地点契合、社交安全与缓存特征生成 matchScore，并返回 reason 解释推荐理由。",
    ],
    ["站内闭环通信方案", "反馈闭环优化"],
    [
      "内置端到端加密的即时通讯模块，所有沟通行为均在平台内闭环完成。全程屏蔽外部联系方式泄露，有效规避信息滥用风险，全方位守护用户隐私安全。",
      "系统记录曝光、打开详情、跳过、推进到约饭等事件，形成 recommendation feedback，用于评估排序效果并支持后续调参。",
    ],
  ]),
);
setNotes(algorithmSlide, [
  "这一页讲算法主线：先过滤，再提取特征，再加权排序，最后用用户行为反馈形成闭环。",
  "可以强调当前算法不是黑盒大模型，而是可解释的业务评分管线，适合课程验收展示；后续可叠加 embedding 和 pgvector 做语义升级。",
  "[Sources]",
  "Local repo: D:/U eat/web/docs/14-home-meal-card-matching-algorithm.md; D:/U eat/web/docs/15-semantic-embedding-upgrade-plan.md; D:/U eat/server/src/modules/mealCards.ts; D:/U eat/server/src/modules/recommendation.ts; D:/U eat/server/src/modules/recommendationFeedback.ts",
]);

await fs.rm(qaDir, { recursive: true, force: true });
await fs.mkdir(qaDir, { recursive: true });
const finalInspect = await presentation.inspect({ kind: "slide,textbox,shape,notes", maxChars: 120000 });
await fs.writeFile(path.join(qaDir, "final-inspect.ndjson"), finalInspect.ndjson, "utf8");
for (const [index, slide] of presentation.slides.items.entries()) {
  const stem = `slide-${String(index + 1).padStart(2, "0")}`;
  await writeBlob(path.join(qaDir, `${stem}.png`), await presentation.export({ slide, format: "png", scale: 1 }));
  await fs.writeFile(path.join(qaDir, `${stem}.layout.json`), await (await slide.export({ format: "layout" })).text(), "utf8");
}
await writeBlob(path.join(qaDir, "montage.webp"), await presentation.export({ format: "webp", montage: true, scale: 1 }));

const pptx = await PresentationFile.exportPptx(presentation);
await pptx.save(output);
console.log(output);
