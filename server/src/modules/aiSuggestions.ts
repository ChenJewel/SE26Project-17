import { createHash, createHmac } from "node:crypto";
import { postgresStore } from "../data/postgres.js";
import { makeId } from "../data/store.js";
import { realtimeHub } from "../realtime.js";
import type { AiSuggestionJob, AiSuggestionMode, Conversation, Message } from "../types.js";
import { buildConversationEvidence, type AiEvidenceResult } from "./aiMemory.js";
import { finalizeAiSuggestions, parseAiSuggestionProviderText } from "./aiSuggestionSafety.js";

export interface AiSuggestionResponse {
  status: "ready" | "pending" | "disabled" | "failed";
  suggestions: string[];
  fallbackSuggestions: string[];
  jobId?: string;
  recommendationLogId?: string;
  context: {
    source: string;
    provider: string;
    mode: AiSuggestionMode;
    lastMessageId?: string;
    reason?: string;
  };
}

interface BuildAiSuggestionResponseInput {
  conversation: Conversation;
  currentUserId: string;
  messages: Array<Pick<Message, "id" | "senderUserId" | "text">>;
  draft: string;
  mode: AiSuggestionMode;
  fallbackSuggestions: string[];
}

interface QueueEntry {
  jobId: string;
  cacheKey: string;
  contextHash: string;
  notifyUserIds: string[];
  draft: string;
  snapshotLastMessageId?: string;
}

const queue: QueueEntry[] = [];
let runningJobs = 0;
let warnedAboutDefaultPrivacySecret = false;

export function readAiSuggestionMode(value: unknown): AiSuggestionMode {
  return value === "opener" || value === "advance" ? value : "reply";
}

export async function readAiSuggestionGovernanceStatus() {
  const stats = await postgresStore.getAiSuggestionGovernanceStats();
  return {
    provider: readAiProvider(),
    model: process.env.OLLAMA_CHAT_MODEL || "qwen3:1.7b",
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434",
    enabled: {
      profile: process.env.AI_PROFILE_ENABLED !== "false",
      recall: process.env.AI_RECALL_ENABLED !== "false",
      embedding: process.env.AI_EMBEDDING_ENABLED !== "false",
      pgvector: process.env.AI_PGVECTOR_ENABLED !== "false",
    },
    queue: {
      pending: queue.length,
      running: runningJobs,
      maxConcurrent: readPositiveInteger(process.env.AI_MAX_CONCURRENT_JOBS, 1),
    },
    modelRuntime: {
      timeoutMs: readPositiveInteger(process.env.AI_MODEL_TIMEOUT_MS, 60000),
      keepAlive: readOllamaKeepAlive(),
      numPredict: readPositiveInteger(process.env.AI_MODEL_NUM_PREDICT, 220),
      numCtx: readPositiveInteger(process.env.AI_MODEL_NUM_CTX, 2048),
      promptMode: "compact-evidence-v3.1-fast-quality-gated",
    },
    cacheTtlMs: readPositiveInteger(process.env.AI_SUGGESTION_CACHE_TTL_MS, 10 * 60 * 1000),
    stats,
  };
}

export async function buildAiSuggestionResponse(input: BuildAiSuggestionResponseInput): Promise<AiSuggestionResponse> {
  const settings = await postgresStore.getUserSettings(input.currentUserId);
  const aiEnabled = settings.settings.aiIcebreaker !== false;
  const provider = readAiProvider();
  const lastMessageId = input.messages[input.messages.length - 1]?.id;

  if (!aiEnabled || provider === "disabled") {
    return withRecommendationLog(input, {
      status: "disabled",
      suggestions: input.fallbackSuggestions,
      fallbackSuggestions: input.fallbackSuggestions,
      context: {
        source: "local-icebreaker-v1",
        provider: aiEnabled ? provider : "user-disabled",
        mode: input.mode,
        lastMessageId,
        reason: aiEnabled ? "AI provider is disabled." : "AI icebreaker assistant is disabled in settings.",
      },
    });
  }

  const evidence = await buildConversationEvidence(input.conversation, input.currentUserId, buildEvidenceQueryText(input));
  const feedbackHints = await buildFeedbackHints(input.currentUserId);

  if (provider === "template") {
    return withRecommendationLog(input, {
      status: "ready",
      suggestions: input.fallbackSuggestions,
      fallbackSuggestions: input.fallbackSuggestions,
      context: {
        source: "local-icebreaker-v1",
        provider,
        mode: input.mode,
        lastMessageId,
        reason: evidence.reason ?? "Template fallback is active.",
      },
    });
  }

  const context = buildSuggestionContext(input, evidence, feedbackHints);
  const storedContext = sanitizeSuggestionJobInput(context);
  const contextHash = hashJson(storedContext);
  const cacheKey = `ai-suggestions:${provider}:${input.mode}:${input.currentUserId}:${input.conversation.id}:${contextHash}`;
  const cached = await postgresStore.findAiSuggestionCache(cacheKey);
  if (cached && Date.parse(cached.expiresAt) > Date.now() && cached.suggestions.length) {
    return withRecommendationLog(input, {
      status: "ready",
      suggestions: finalizeSuggestions(cached.suggestions, input.fallbackSuggestions),
      fallbackSuggestions: input.fallbackSuggestions,
      context: {
        source: "ai-cache-v1",
        provider,
        mode: input.mode,
        lastMessageId,
        reason: evidence.reason ?? "Matched a recent cached suggestion for this conversation context.",
      },
    });
  }

  const job = await postgresStore.createAiSuggestionJob({
    id: makeId("ai-job"),
    conversationId: input.conversation.id,
    requesterUserId: input.currentUserId,
    targetUserId: input.conversation.memberUserIds.find((userId) => userId !== input.currentUserId),
    mode: input.mode,
    provider,
    input: {
      ...storedContext,
      cacheKey,
      contextHash,
    },
    fallbackSuggestions: input.fallbackSuggestions,
  });
  enqueueAiSuggestionJob({
    jobId: job.id,
    cacheKey,
    contextHash,
    notifyUserIds: [input.currentUserId],
    draft: input.draft,
    snapshotLastMessageId: lastMessageId,
  });

  return withRecommendationLog(input, {
    status: "pending",
    suggestions: input.fallbackSuggestions,
    fallbackSuggestions: input.fallbackSuggestions,
    jobId: job.id,
    context: {
      source: "local-icebreaker-v1",
      provider,
      mode: input.mode,
      lastMessageId,
      reason: evidence.reason ?? "Showing a template fallback while the local model thinks in the background.",
    },
  }, job.id);
}

export async function readAiSuggestionJob(jobId: string, requesterUserId: string): Promise<AiSuggestionResponse | undefined> {
  const job = await postgresStore.findAiSuggestionJob(jobId);
  if (!job || job.requesterUserId !== requesterUserId) return undefined;

  const jobSuggestions = readJobSuggestions(job);
  const suggestions = jobSuggestions.length ? finalizeSuggestions(jobSuggestions, job.fallbackSuggestions) : [];
  const status = job.status === "succeeded" && suggestions.length ? "ready" : job.status === "failed" ? "failed" : "pending";
  return {
    status,
    suggestions: suggestions.length ? suggestions : job.fallbackSuggestions,
    fallbackSuggestions: job.fallbackSuggestions,
    jobId: job.id,
    context: {
      source: job.status === "succeeded" ? "ai-job-v1" : "local-icebreaker-v1",
      provider: job.provider,
      mode: job.mode,
      lastMessageId: typeof job.input.lastMessageId === "string" ? job.input.lastMessageId : undefined,
      reason: job.errorMessage ?? readEvidenceReason(job) ?? (job.status === "succeeded" ? "Generated by the configured AI provider." : "AI suggestion job is still running."),
    },
  };
}

export async function updateAiSuggestionFeedback(input: {
  recommendationLogId: string;
  requesterUserId: string;
  selectedIndex?: number;
  selectedText?: string;
  sentMessageId?: string;
}) {
  return postgresStore.updateAiRecommendationLog({
    id: input.recommendationLogId,
    requesterUserId: input.requesterUserId,
    selectedIndex: input.selectedIndex,
    selectedText: input.selectedText,
    sentMessageId: input.sentMessageId,
  });
}

async function withRecommendationLog(
  input: BuildAiSuggestionResponseInput,
  response: AiSuggestionResponse,
  jobId?: string
): Promise<AiSuggestionResponse> {
  try {
    const log = await postgresStore.createAiRecommendationLog({
      id: makeId("ai-rec"),
      conversationId: input.conversation.id,
      requesterUserId: input.currentUserId,
      targetUserId: input.conversation.memberUserIds.find((userId) => userId !== input.currentUserId),
      jobId,
      mode: input.mode,
      provider: response.context.provider,
      context: response.context,
      suggestions: response.suggestions,
    });
    return { ...response, recommendationLogId: log.id };
  } catch (error) {
    console.warn("Failed to create AI recommendation log.", error);
    return response;
  }
}

function enqueueAiSuggestionJob(entry: QueueEntry) {
  queue.push(entry);
  void drainAiSuggestionQueue();
}

async function drainAiSuggestionQueue() {
  const maxConcurrentJobs = readPositiveInteger(process.env.AI_MAX_CONCURRENT_JOBS, 1);
  while (runningJobs < maxConcurrentJobs && queue.length) {
    const entry = queue.shift()!;
    runningJobs += 1;
    void runAiSuggestionJob(entry).finally(() => {
      runningJobs -= 1;
      void drainAiSuggestionQueue();
    });
  }
}

async function runAiSuggestionJob(entry: QueueEntry) {
  const job = await postgresStore.markAiSuggestionJobRunning(entry.jobId);
  if (!job) return;

  try {
    const activeJob = await enhanceAiSuggestionJobContext(job, entry);
    const suggestions = await generateWithProvider(activeJob);
    const completed = await postgresStore.completeAiSuggestionJob(job.id, suggestions);
    await postgresStore.upsertAiSuggestionCache({
      cacheKey: entry.cacheKey,
      mode: activeJob.mode,
      provider: activeJob.provider,
      contextHash: entry.contextHash,
      suggestions,
      expiresAt: new Date(Date.now() + readPositiveInteger(process.env.AI_SUGGESTION_CACHE_TTL_MS, 10 * 60 * 1000)).toISOString(),
    });
    broadcastJobUpdate(completed ?? job, suggestions, entry.notifyUserIds);
  } catch (error) {
    const failed = await postgresStore.failAiSuggestionJob(job.id, error instanceof Error ? error.message : "AI suggestion failed.");
    broadcastJobUpdate(failed ?? job, [], entry.notifyUserIds);
  }
}

export async function recoverInterruptedAiSuggestionJobs() {
  const recoveredCount = await postgresStore.failInterruptedAiSuggestionJobs(
    "AI suggestion job was interrupted by a server restart. Showing fallback suggestions."
  );
  if (recoveredCount > 0) {
    console.warn(`Recovered ${recoveredCount} interrupted AI suggestion job(s) after startup.`);
  }
  return recoveredCount;
}

async function enhanceAiSuggestionJobContext(job: AiSuggestionJob, entry: QueueEntry): Promise<AiSuggestionJob> {
  try {
    const conversation = await postgresStore.findConversation(job.conversationId);
    if (!conversation || !conversation.memberUserIds.includes(job.requesterUserId)) return job;
    const messages = messagesUpToSnapshot(await postgresStore.listMessages(conversation.id), entry.snapshotLastMessageId ?? readString(job.input.lastMessageId));
    const draft = entry.draft;
    const evidence = await buildConversationEvidence(
      conversation,
      job.requesterUserId,
      buildEvidenceQueryText({
        conversation,
        currentUserId: job.requesterUserId,
        messages,
        draft,
        mode: job.mode,
        fallbackSuggestions: job.fallbackSuggestions,
      }),
      { allowRealtimeQueryEmbedding: true }
    );
    const feedbackHints = await buildFeedbackHints(job.requesterUserId);
    const context = buildSuggestionContext(
      {
        conversation,
        currentUserId: job.requesterUserId,
        messages,
        draft,
        mode: job.mode,
        fallbackSuggestions: job.fallbackSuggestions,
      },
      evidence,
      feedbackHints
    );
    const storedContext = sanitizeSuggestionJobInput(context);
    const updatedInput = {
      ...storedContext,
      cacheKey: job.input.cacheKey,
      contextHash: job.input.contextHash,
      evidenceRecallMode: "background-realtime-query-embedding-v1",
      evidenceRefreshedAt: new Date().toISOString(),
    };
    const updated = await postgresStore.updateAiSuggestionJobInput(job.id, updatedInput);
    return { ...(updated ?? job), input: { ...context, cacheKey: job.input.cacheKey, contextHash: job.input.contextHash } };
  } catch (error) {
    console.warn("Failed to enhance AI suggestion context with realtime semantic recall.", error);
    return job;
  }
}

async function generateWithProvider(job: AiSuggestionJob) {
  if (job.provider === "ollama") return generateWithOllama(job);
  throw new Error(`Unsupported AI provider: ${job.provider}`);
}

async function generateWithOllama(job: AiSuggestionJob) {
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
  const model = process.env.OLLAMA_CHAT_MODEL || "qwen3:1.7b";
  const timeoutMs = readPositiveInteger(process.env.AI_MODEL_TIMEOUT_MS, 60000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const prompt = buildFastQualityGatedOllamaPrompt(job);

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        stream: false,
        think: false,
        keep_alive: readOllamaKeepAlive(),
        prompt,
        options: {
          temperature: 0.68,
          top_p: 0.86,
          num_ctx: readPositiveInteger(process.env.AI_MODEL_NUM_CTX, 2048),
          num_predict: readPositiveInteger(process.env.AI_MODEL_NUM_PREDICT, 220),
        },
      }),
    });

    if (!response.ok) throw new Error(`Ollama returned ${response.status}.`);
    const payload = (await response.json()) as { response?: unknown };
    return finalizeSuggestions(parseAiSuggestionProviderText(String(payload.response ?? "")), job.fallbackSuggestions);
  } finally {
    clearTimeout(timer);
  }
}

function buildSuggestionContext(input: BuildAiSuggestionResponseInput, evidence: AiEvidenceResult, feedbackHints: string[]) {
  return {
    conversationId: input.conversation.id,
    conversationType: input.conversation.conversationType ?? "direct",
    mode: input.mode,
    draft: input.draft,
    lastMessageId: input.messages[input.messages.length - 1]?.id,
    evidenceSignals: evidence.signals,
    evidenceReason: evidence.reason,
    profileSummaries: evidence.profileSummaries ?? [],
    evidencePolicy: {
      allowedSources: ["public_profile_tags", "public_meal_cards", "public_posts", "public_comments", "current_conversation_query"],
      privateChatUse: "current_session_reply_only",
      longTermProfileFromPrivateChat: false,
      mustGroundSuggestionsInEvidence: true,
      mustNotGuessPersonality: true,
    },
    generationGuidance: [
      "优先使用 shared/query/complementary 证据中的公开线索。",
      "可以围绕共同食物、场景偏好、低压力邀约或对方公开兴趣开场。",
      "不要把画像说成性格判断，不要暴露算法或 AI。",
    ],
    feedbackHints,
    messages: input.messages.slice(-8).map((message) => ({
      id: message.id,
      role: message.senderUserId === input.currentUserId ? "me" : "other",
      text: message.text.slice(0, 180),
    })),
  };
}

function sanitizeSuggestionJobInput(input: Record<string, unknown>) {
  const messages = Array.isArray(input.messages) ? input.messages : [];
  const draft = readString(input.draft) ?? "";
  const sanitized: Record<string, unknown> = { ...input };
  delete sanitized.draft;
  delete sanitized.messages;

  sanitized.messageRefs = messages
    .map((message) => {
      if (!message || typeof message !== "object" || Array.isArray(message)) return undefined;
      const record = message as Record<string, unknown>;
      const id = readString(record.id);
      const role = readString(record.role);
      if (!id && !role) return undefined;
      return {
        ...(id ? { id } : {}),
        ...(role ? { role } : {}),
      };
    })
    .filter((messageRef): messageRef is Record<string, string> => Boolean(messageRef));
  sanitized.privateContext = {
    draftHash: draft ? hashPrivateText(draft) : undefined,
    draftLength: draft.length,
    messageTextHash: hashPrivateJson(
      messages.map((message) => {
        if (!message || typeof message !== "object" || Array.isArray(message)) return {};
        const record = message as Record<string, unknown>;
        return {
          role: readString(record.role) ?? "",
          text: readString(record.text) ?? "",
        };
      })
    ),
    messageCount: messages.length,
    storagePolicy: "hashes_and_message_refs_only",
    hashVersion: "hmac-sha256-v1",
  };
  return sanitized;
}

function messagesUpToSnapshot<T extends Pick<Message, "id">>(messages: T[], lastMessageId?: string) {
  if (!lastMessageId) return messages;
  const index = messages.findIndex((message) => message.id === lastMessageId);
  return index >= 0 ? messages.slice(0, index + 1) : messages;
}

function buildEvidenceQueryText(input: BuildAiSuggestionResponseInput) {
  const recentMessages = input.messages
    .slice(-4)
    .map((message) => message.text)
    .join(" ");
  return [input.draft, recentMessages].filter(Boolean).join(" ").slice(0, 600);
}

async function buildFeedbackHints(userId: string) {
  const logs = await postgresStore.listRecentAiRecommendationLogs(userId, 30);
  return Array.from(
    new Set(
      logs
        .filter((log) => log.sentMessageId || log.selectedText)
        .map((log) => log.selectedText?.trim())
        .filter((text): text is string => Boolean(text))
        .slice(0, 4)
    )
  );
}

function buildOllamaPrompt(job: AiSuggestionJob) {
  return [
    "你是 U eat 的聊天破冰助手。请只输出 JSON 字符串数组，不要解释。",
    "目标：给用户 4 条自然、轻松、有边界感的中文聊天建议。",
    "要求：每条 12-36 个中文字符；不油腻；不替用户承诺见面；不要提到算法、画像、AI。",
    `场景模式：${job.mode}`,
    `上下文 JSON：${JSON.stringify(job.input)}`,
    "输出示例：[\"这家店你之前去过吗？\",\"我有点好奇你最爱点哪道菜\"]",
  ].join("\n");
}

function buildCompactOllamaPrompt(job: AiSuggestionJob) {
  const context = buildCompactPromptContext(job);
  return [
    "你是 U eat 聊天破冰助手。只输出 JSON 字符串数组，不要解释。",
    "目标：给用户 4 条自然、轻松、有边界感的中文聊天建议。",
    "硬性要求：每条 12-36 个中文字符；不油腻；不替用户承诺见面；不提算法、画像、AI；不猜性格；只能基于 evidence。",
    "优先围绕共同食物、饭局场景、低压力邀约、对方公开兴趣或当前话题接话。",
    `compactContext=${JSON.stringify(context)}`,
    '输出示例：["这家你之前去过吗？","我有点好奇你最推荐哪道菜"]',
  ].join("\n");
}

function buildQualityGatedOllamaPrompt(job: AiSuggestionJob) {
  const context = buildCompactPromptContext(job);
  return [
    "你是 U eat 聊天破冰助手。只输出严格 JSON 字符串数组，不要解释，不要 markdown。",
    "请生成 6 个候选句，后端会自动挑出最安全自然的 4 个展示。",
    "每个候选必须是中文、12-36 字、自然轻松、有边界感，像真人顺手发出的一句话。",
    "优先围绕 evidence 里的共同食物、饭局场景、低压力邀约、对方公开兴趣或当前话题接话。",
    "禁止：泛泛问“今天想吃什么”、替用户承诺见面、猜性格、提 AI/算法/画像、索要联系方式、过度亲密。",
    "格式硬要求：返回值必须能被 JSON.parse 解析，形如 [\"...\",\"...\",\"...\",\"...\",\"...\",\"...\"]。",
    `compactContext=${JSON.stringify(context)}`,
    '示例：["你刚提到日料，我有点想听你推荐哪家。","这家你之前去过吗，适合轻松聊会儿吗？","如果今天想低压力一点，我们可以先从口味对齐。","你公开饭卡里提到拉面，我正好也想试试。","这个话题还挺好接的，你更偏安静店还是热闹店？","看起来我们都能接受清淡口味，要不要先交换一家店？"]',
  ].join("\n");
}

function buildFastQualityGatedOllamaPrompt(job: AiSuggestionJob) {
  const context = buildCompactPromptContext(job);
  return [
    "你是 U eat 聊天破冰助手。只输出 JSON 字符串数组，不要解释。",
    "生成 5 个中文候选句，后端会挑 4 个展示。",
    "每句 12-36 字，轻松自然，有边界感，像真人顺手发出。",
    "只基于 evidence 或当前话题；优先食物、饭局场景、低压力接话。",
    "不要泛泛问今天想吃什么；不要提 AI/算法/画像；不要猜性格、要联系方式或过度亲密。",
    `context=${JSON.stringify(context)}`,
    '格式例子：["你刚提到日料，我有点想听你推荐哪家。","这家你之前去过吗，适合轻松聊会儿吗？","如果想低压力一点，我们先从口味对齐。","你饭卡里提到拉面，我正好也想试试。","你更偏安静店，还是热闹一点的店？"]',
  ].join("\n");
}

function buildCompactPromptContext(job: AiSuggestionJob) {
  const input = job.input;
  return {
    mode: job.mode,
    draft: clipText(readString(input.draft) ?? "", 80),
    reason: clipText(readString(input.evidenceReason) ?? "", 90),
    evidence: readRecordArray(input.evidenceSignals)
      .slice(0, readPositiveInteger(process.env.AI_PROMPT_MAX_EVIDENCE_SIGNALS, 3))
      .map((signal) => ({
        kind: clipText(readString(signal.kind) ?? "", 18),
        label: clipText(readString(signal.label) ?? "", 24),
        score: roundScore(signal.score),
        evidence: readStringArray(signal.evidence).slice(0, 2).map((item) => clipText(item, 42)),
      })),
    profileHints: readRecordArray(input.profileSummaries)
      .slice(0, 2)
      .map((profile) => ({
        role: clipText(readString(profile.role) ?? "", 12),
        topLabels: readStringArray(profile.topLabels).slice(0, 3),
      })),
    recentMessages: readRecordArray(input.messages)
      .slice(-readPositiveInteger(process.env.AI_PROMPT_MAX_MESSAGES, 4))
      .map((message) => ({
        role: clipText(readString(message.role) ?? "", 8),
        text: clipText(readString(message.text) ?? "", 70),
      })),
    feedbackHints: readStringArray(input.feedbackHints).slice(0, 2).map((hint) => clipText(hint, 50)),
    policy: {
      privateChatUse: "current_session_only",
      noLongTermProfileFromPrivateChat: true,
      mustGroundInEvidence: true,
    },
  };
}

function parseSuggestions(text: string) {
  const cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/```json|```/g, "")
    .trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(cleaned.slice(start, end + 1));
      if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === "string");
    } catch {
      // Fall back to line parsing below.
    }
  }
  return cleaned
    .split(/\r?\n|[；;]/)
    .map((line) => line.replace(/^[-\d.、\s"]+|["\s]+$/g, ""))
    .filter(Boolean);
}

function finalizeSuggestions(suggestions: string[], fallbackSuggestions: string[] = []) {
  const { suggestions: safeSuggestions, report } = finalizeAiSuggestions(suggestions, fallbackSuggestions);
  if (report.rejectedCount) {
    console.warn("AI suggestion safety filter rejected suggestions.", report);
  }
  return safeSuggestions;
}

function readJobSuggestions(job: AiSuggestionJob) {
  const suggestions = job.result.suggestions;
  return Array.isArray(suggestions) ? suggestions.filter((item): item is string => typeof item === "string") : [];
}

function readEvidenceReason(job: AiSuggestionJob) {
  return typeof job.input.evidenceReason === "string" ? job.input.evidenceReason : undefined;
}

function broadcastJobUpdate(job: AiSuggestionJob, suggestions: string[], userIds: string[]) {
  const normalizedSuggestions = suggestions.length ? finalizeSuggestions(suggestions, job.fallbackSuggestions) : job.fallbackSuggestions;
  realtimeHub.broadcastToUsers(userIds, {
    type: "chat.ai.suggestions.ready",
    data: {
      conversationId: job.conversationId,
      jobId: job.id,
      status: job.status,
      suggestions: normalizedSuggestions,
      reason: job.errorMessage ?? readEvidenceReason(job) ?? "AI suggestions are ready.",
    },
  });
}

function readAiProvider() {
  const provider = (process.env.AI_PROVIDER || "template").toLowerCase();
  if (provider === "ollama" || provider === "disabled" || provider === "template") return provider;
  return "template";
}

function hashJson(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 32);
}

function hashPrivateText(value: string) {
  return createHmac("sha256", readPrivacyHashSecret()).update(value).digest("hex").slice(0, 32);
}

function hashPrivateJson(value: unknown) {
  return hashPrivateText(JSON.stringify(value));
}

function readPrivacyHashSecret() {
  const secret = process.env.AI_PRIVACY_HASH_SECRET?.trim();
  if (secret) return secret;

  if (!warnedAboutDefaultPrivacySecret) {
    warnedAboutDefaultPrivacySecret = true;
    console.warn("AI_PRIVACY_HASH_SECRET is not configured; using development privacy hash secret.");
  }
  return "ueat-development-privacy-hash-secret";
}

function readString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function readRecordArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
}

function clipText(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, Math.max(0, maxLength - 1))}…` : normalized;
}

function roundScore(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value * 100) / 100 : undefined;
}

function readOllamaKeepAlive() {
  return process.env.AI_MODEL_KEEP_ALIVE?.trim() || "15m";
}

function readPositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}
