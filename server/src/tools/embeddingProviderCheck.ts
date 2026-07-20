import { createEmbedding, readEmbeddingConfig } from "../modules/embeddingProvider.js";

process.env.AI_EMBEDDING_PROVIDER ??= "ollama";
process.env.OLLAMA_EMBEDDING_MODEL ??= "bge-m3";
process.env.AI_EMBEDDING_VECTOR_DIMENSIONS ??= "1024";

const samples = [
  "\u65e5\u6599 \u65e5\u672c\u83dc \u65e5\u5f0f\u98df\u7269 \u5c45\u9152\u5c4b",
  "\u6e05\u6de1 \u5c11\u6cb9 \u4e0d\u8fa3 \u60f3\u627e\u4f4e\u538b\u529b\u996d\u642d\u5b50",
  "\u98df\u5802\u4e8c\u697c \u591c\u5bb5 \u63a2\u5e97",
];

const config = readEmbeddingConfig();
const results = [];

for (const [index, sample] of samples.entries()) {
  const result = await createEmbedding(sample, { allowFallback: false });
  if (!result) throw new Error("Embedding provider is disabled.");
  results.push({
    run: index + 1,
    provider: result.provider,
    modelVersion: result.modelVersion,
    dimensions: result.dimensions,
    elapsedMs: result.elapsedMs,
  });
}

const dimensions = new Set(results.map((result) => result.dimensions));
const memory = process.memoryUsage();
const summary = {
  provider: config.provider,
  modelVersion: config.modelVersion,
  expectedDimensions: config.vectorDimensions,
  dimensions: Array.from(dimensions),
  minElapsedMs: Math.min(...results.map((result) => result.elapsedMs)),
  maxElapsedMs: Math.max(...results.map((result) => result.elapsedMs)),
  rssMb: Number((memory.rss / 1024 / 1024).toFixed(1)),
  heapUsedMb: Number((memory.heapUsed / 1024 / 1024).toFixed(1)),
  results,
};

console.log(JSON.stringify(summary, null, 2));

if (config.provider !== "ollama") throw new Error(`Expected ollama provider for S2 validation, got ${config.provider}.`);
if (!dimensions.has(config.vectorDimensions) || dimensions.size !== 1) {
  throw new Error(`Embedding dimension mismatch. Expected ${config.vectorDimensions}, got ${Array.from(dimensions).join(", ")}.`);
}
