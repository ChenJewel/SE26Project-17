import { createHash } from "node:crypto";
import { postgresStore } from "../data/postgres.js";
import { makeId } from "../data/store.js";
import { realtimeHub } from "../realtime.js";
import type { AiSuggestionJob, AiSuggestionMode, Conversation, Message } from "../types.js";
import { buildConversationEvidence, type AiEvidenceResult } from "./aiMemory.js";
import { finalizeAiSuggestions } from "./aiSuggestionSafety.js";

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
}

const queue: QueueEntry[] = [];
let runningJobs = 0;

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
    timeoutMs: readPositiveInteger(process.env.AI_MODEL_TIMEOUT_MS, 12000),
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
  const contextHash = hashJson(context);
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
      ...context,
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
    const suggestions = await generateWithProvider(job);
    const completed = await postgresStore.completeAiSuggestionJob(job.id, suggestions);
    await postgresStore.upsertAiSuggestionCache({
      cacheKey: entry.cacheKey,
      mode: job.mode,
      provider: job.provider,
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

async function generateWithProvider(job: AiSuggestionJob) {
  if (job.provider === "ollama") return generateWithOllama(job);
  throw new Error(`Unsupported AI provider: ${job.provider}`);
}

async function generateWithOllama(job: AiSuggestionJob) {
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
  const model = process.env.OLLAMA_CHAT_MODEL || "qwen3:1.7b";
  const timeoutMs = readPositiveInteger(process.env.AI_MODEL_TIMEOUT_MS, 12000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        stream: false,
        think: false,
        prompt: buildOllamaPrompt(job),
        options: {
          temperature: 0.72,
          top_p: 0.9,
          num_predict: 260,
        },
      }),
    });

    if (!response.ok) throw new Error(`Ollama returned ${response.status}.`);
    const payload = (await response.json()) as { response?: unknown };
    return finalizeSuggestions(parseSuggestions(String(payload.response ?? "")), job.fallbackSuggestions);
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
    feedbackHints,
    messages: input.messages.slice(-8).map((message) => ({
      role: message.senderUserId === input.currentUserId ? "me" : "other",
      text: message.text.slice(0, 180),
    })),
  };
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

function readPositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}
