import { createHashEmbedding, fallbackEmbeddingModel } from "./semanticSignals.js";

export type AiEmbeddingProvider = "ollama" | "hash" | "disabled";

export interface AiEmbeddingConfig {
  provider: AiEmbeddingProvider;
  modelVersion?: string;
  ollamaBaseUrl: string;
  ollamaModel: string;
  vectorDimensions: number;
  timeoutMs: number;
  fallbackModel: string;
}

export interface AiEmbeddingResult {
  embedding: number[];
  provider: AiEmbeddingProvider;
  modelVersion: string;
  dimensions: number;
  elapsedMs: number;
  fallbackFrom?: string;
}

const defaultOllamaModel = "bge-m3";
const defaultOllamaBaseUrl = "http://127.0.0.1:11434";
const bgeM3Dimensions = 1024;

export function readEmbeddingConfig(): AiEmbeddingConfig {
  const explicitProvider = normalizeProvider(process.env.AI_EMBEDDING_PROVIDER);
  const provider =
    explicitProvider ??
    (process.env.AI_EMBEDDING_ENABLED === "false" ? "disabled" : process.env.OLLAMA_EMBEDDING_MODEL ? "ollama" : "hash");
  const ollamaModel = (process.env.OLLAMA_EMBEDDING_MODEL || defaultOllamaModel).trim();
  const vectorDimensions = readPositiveInteger(
    process.env.AI_EMBEDDING_VECTOR_DIMENSIONS,
    provider === "ollama" && ollamaModel === "bge-m3" ? bgeM3Dimensions : provider === "hash" ? 64 : 0
  );

  return {
    provider,
    modelVersion: provider === "ollama" ? `ollama:${ollamaModel}` : provider === "hash" ? fallbackEmbeddingModel : undefined,
    ollamaBaseUrl: (process.env.OLLAMA_BASE_URL || process.env.OLLAMA_EMBEDDING_BASE_URL || defaultOllamaBaseUrl).replace(/\/+$/, ""),
    ollamaModel,
    vectorDimensions,
    timeoutMs: readPositiveInteger(process.env.AI_EMBEDDING_TIMEOUT_MS, 15_000),
    fallbackModel: fallbackEmbeddingModel,
  };
}

export function shouldCreateInlineEmbeddings() {
  return readEmbeddingConfig().provider === "hash";
}

export function shouldQueueEmbeddingBackfill() {
  return readEmbeddingConfig().provider === "ollama";
}

export function createFallbackEmbedding(text: string): AiEmbeddingResult {
  const startedAt = Date.now();
  const embedding = createHashEmbedding(text);
  return {
    embedding,
    provider: "hash",
    modelVersion: fallbackEmbeddingModel,
    dimensions: embedding.length,
    elapsedMs: Date.now() - startedAt,
  };
}

export async function createEmbedding(text: string, options: { allowFallback?: boolean } = {}): Promise<AiEmbeddingResult | undefined> {
  const config = readEmbeddingConfig();
  if (config.provider === "disabled") return undefined;
  if (config.provider === "hash") return createFallbackEmbedding(text);

  const modelVersion = config.modelVersion ?? `ollama:${config.ollamaModel}`;
  const startedAt = Date.now();
  try {
    const embedding = await requestOllamaEmbedding(config, text);
    return {
      embedding,
      provider: "ollama",
      modelVersion,
      dimensions: embedding.length,
      elapsedMs: Date.now() - startedAt,
    };
  } catch (error) {
    if (options.allowFallback === false) throw error;
    const fallback = createFallbackEmbedding(text);
    return { ...fallback, fallbackFrom: modelVersion };
  }
}

async function requestOllamaEmbedding(config: AiEmbeddingConfig, text: string) {
  const response = await fetch(`${config.ollamaBaseUrl}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: config.ollamaModel, input: text }),
    signal: AbortSignal.timeout(config.timeoutMs),
  });
  if (!response.ok) throw new Error(`Ollama embedding failed with HTTP ${response.status}`);

  const body = (await response.json()) as { embeddings?: unknown; embedding?: unknown };
  const rawEmbedding = Array.isArray(body.embeddings) ? body.embeddings[0] : body.embedding;
  const embedding = normalizeEmbedding(rawEmbedding);
  if (!embedding.length) throw new Error("Ollama embedding response did not include a vector.");
  if (config.vectorDimensions && embedding.length !== config.vectorDimensions) {
    throw new Error(`Ollama embedding dimensions mismatch: expected ${config.vectorDimensions}, got ${embedding.length}.`);
  }
  return embedding;
}

function normalizeEmbedding(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "number" && Number.isFinite(item) ? Number(item.toFixed(6)) : undefined))
    .filter((item): item is number => typeof item === "number");
}

function normalizeProvider(value: string | undefined): AiEmbeddingProvider | undefined {
  if (value === "ollama" || value === "hash" || value === "disabled") return value;
  return undefined;
}

function readPositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}
