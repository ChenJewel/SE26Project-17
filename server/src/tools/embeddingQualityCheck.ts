import { createEmbedding, readEmbeddingConfig } from "../modules/embeddingProvider.js";
import { cosineSimilarity } from "../modules/semanticSignals.js";

process.env.AI_EMBEDDING_PROVIDER ??= "ollama";
process.env.OLLAMA_EMBEDDING_MODEL ??= "bge-m3";
process.env.AI_EMBEDDING_VECTOR_DIMENSIONS ??= "1024";

interface QualityGroup {
  id: string;
  positives: string[];
  negatives: string[];
}

const groups: QualityGroup[] = [
  {
    id: "japanese-food-aliases",
    positives: ["\u65e5\u6599", "\u65e5\u672c\u83dc", "\u65e5\u5f0f\u98df\u7269", "\u5c45\u9152\u5c4b\u62c9\u9762"],
    negatives: ["\u5065\u8eab\u9e21\u80f8\u8089", "\u56fe\u4e66\u9986\u81ea\u4e60", "\u64cd\u573a\u8dd1\u6b65"],
  },
  {
    id: "light-food-aliases",
    positives: ["\u6e05\u6de1\u5c11\u6cb9", "\u4e0d\u8fa3\u5c11\u6cb9", "\u8f7b\u98df\u6c99\u62c9"],
    negatives: ["\u91cd\u8fa3\u706b\u9505", "\u9ebb\u8fa3\u70e7\u70e4", "\u591c\u5bb5\u70e4\u4e32"],
  },
  {
    id: "low-pressure-social",
    positives: ["\u6162\u70ed\u4f4e\u538b\u529b", "\u4e0d\u5c34\u5c2c\u968f\u4fbf\u804a", "\u5b89\u9759\u6162\u6162\u5403"],
    negatives: ["\u70ed\u95f9\u62fc\u684c", "\u591a\u4eba\u8f70\u8db4", "\u9ea6\u9738\u805a\u4f1a"],
  },
  {
    id: "canteen-aliases",
    positives: ["\u4e8c\u98df\u5802", "\u7b2c\u4e8c\u98df\u5802", "\u98df\u5802\u4e8c\u697c", "\u4e8c\u9910"],
    negatives: ["\u6821\u5916\u5546\u573a", "\u5730\u94c1\u53e3", "\u5bbf\u820d\u697c\u4e0b"],
  },
  {
    id: "late-night",
    positives: ["\u591c\u5bb5", "\u6df1\u591c\u5403\u70b9", "\u665a\u4e0a\u52a0\u9910"],
    negatives: ["\u65e9\u9910\u8c46\u6d46", "\u5468\u672b\u65e9\u8336", "\u5348\u996d\u4fbf\u5f53"],
  },
  {
    id: "explore-places",
    positives: ["\u63a2\u5e97", "\u65b0\u5e97\u6253\u5361", "\u79cd\u8349\u9910\u5385"],
    negatives: ["\u590d\u4e60\u81ea\u4e60", "\u5145\u7535\u5916\u5356", "\u4e0d\u60f3\u6392\u961f"],
  },
];

const minimumAveragePositive = readNumber(process.env.AI_EMBEDDING_QUALITY_MIN_POSITIVE, 0.48);
const minimumAverageSeparation = readNumber(process.env.AI_EMBEDDING_QUALITY_MIN_SEPARATION, 0.06);
const config = readEmbeddingConfig();
const embeddingByText = new Map<string, number[]>();

const startedAt = Date.now();
for (const text of unique(groups.flatMap((group) => [...group.positives, ...group.negatives]))) {
  const result = await createEmbedding(text, { allowFallback: false });
  if (!result) throw new Error("Embedding provider is disabled.");
  if (result.provider !== "ollama") throw new Error(`Expected ollama provider, got ${result.provider}.`);
  embeddingByText.set(text, result.embedding);
}

const summaries = groups.map((group) => {
  const positiveScores = pairwiseScores(group.positives);
  const negativeScores = crossScores(group.positives, group.negatives);
  const averagePositive = average(positiveScores);
  const averageNegative = average(negativeScores);
  const separation = averagePositive - averageNegative;
  return {
    id: group.id,
    positiveCount: positiveScores.length,
    negativeCount: negativeScores.length,
    averagePositive: round4(averagePositive),
    minPositive: round4(Math.min(...positiveScores)),
    averageNegative: round4(averageNegative),
    maxNegative: round4(Math.max(...negativeScores)),
    separation: round4(separation),
    passed: averagePositive >= minimumAveragePositive && separation >= minimumAverageSeparation,
  };
});

const failed = summaries.filter((summary) => !summary.passed);
const output = {
  provider: config.provider,
  modelVersion: config.modelVersion,
  expectedDimensions: config.vectorDimensions,
  sampleCount: embeddingByText.size,
  minimumAveragePositive,
  minimumAverageSeparation,
  elapsedMs: Date.now() - startedAt,
  failedCount: failed.length,
  groups: summaries,
};

console.log(JSON.stringify(output, null, 2));

if (failed.length) {
  throw new Error(`Embedding quality check failed for: ${failed.map((summary) => summary.id).join(", ")}`);
}

function pairwiseScores(texts: string[]) {
  const scores: number[] = [];
  for (let i = 0; i < texts.length; i += 1) {
    for (let j = i + 1; j < texts.length; j += 1) {
      scores.push(score(texts[i], texts[j]));
    }
  }
  return scores;
}

function crossScores(left: string[], right: string[]) {
  return left.flatMap((leftText) => right.map((rightText) => score(leftText, rightText)));
}

function score(left: string, right: string) {
  const leftEmbedding = embeddingByText.get(left);
  const rightEmbedding = embeddingByText.get(right);
  if (!leftEmbedding || !rightEmbedding) return 0;
  return cosineSimilarity(leftEmbedding, rightEmbedding);
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function round4(value: number) {
  return Number(value.toFixed(4));
}

function readNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
