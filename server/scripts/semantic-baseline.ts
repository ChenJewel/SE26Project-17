import samples from "./semantic-baseline-samples.json" assert { type: "json" };
import {
  buildCanonicalTagMatches,
  cosineSimilarity,
  createHashEmbedding,
  extractCanonicalTagMatches,
  normalizeSemanticTokens,
  semanticTaxonomy,
} from "../src/modules/semanticSignals.js";

interface SampleGroup {
  id: string;
  expectedTag?: string;
  expectedTags?: string[];
  samples: string[];
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function pairwiseSimilarities(values: string[]) {
  const scores: number[] = [];
  for (let leftIndex = 0; leftIndex < values.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < values.length; rightIndex += 1) {
      scores.push(cosineSimilarity(createHashEmbedding(values[leftIndex]), createHashEmbedding(values[rightIndex])));
    }
  }
  return scores;
}

const groups = samples as SampleGroup[];
let failed = false;
const requiredDimensions = ["food", "scene", "time", "social", "intent", "topic", "budget", "location"];
const presentDimensions = new Set(semanticTaxonomy.map((entry) => entry.dimension));
const missingDimensions = requiredDimensions.filter((dimension) => !presentDimensions.has(dimension as never));
const minimumTagCountsByDimension: Record<string, number> = {
  food: 20,
  scene: 12,
  time: 10,
  social: 10,
  intent: 10,
  topic: 10,
  budget: 6,
  location: 12,
};
const tagCountsByDimension = Object.fromEntries(
  requiredDimensions.map((dimension) => [
    dimension,
    semanticTaxonomy.filter((entry) => entry.dimension === dimension).length,
  ])
);
const weakDimensions = Object.entries(minimumTagCountsByDimension)
  .filter(([dimension, minimum]) => (tagCountsByDimension[dimension] ?? 0) < minimum)
  .map(([dimension, minimum]) => ({ dimension, minimum, actual: tagCountsByDimension[dimension] ?? 0 }));
const customProbe = buildCanonicalTagMatches({ text: "", rawTags: ["冷门小店"] });
const customRetained = customProbe.some((match) => match.canonicalTag === "custom:冷门小店" && match.method === "custom" && match.dimension === "custom");
const strongTokensIgnoreCustom = normalizeSemanticTokens(["冷门小店"]).length === 0;
const optionalTokensKeepCustom = normalizeSemanticTokens(["冷门小店"], { includeCustom: true }).includes("custom:冷门小店");
const tagsWithTooFewAliases = semanticTaxonomy
  .filter((entry) => entry.aliases.length < 4)
  .map((entry) => ({ tag: entry.tag, aliasCount: entry.aliases.length }));
const negativeRuleProbes = [
  {
    text: "今天想吃不辣少油的饭",
    expectedPresent: ["light_food"],
    expectedAbsent: ["spicy_food"],
  },
  {
    text: "想找一个不吵的小店",
    expectedPresent: ["quiet_dining"],
    expectedAbsent: ["lively_group"],
  },
  {
    text: "不想排队，课间快速吃一下",
    expectedPresent: ["queue_light_scene", "between_classes"],
    expectedAbsent: [],
  },
  {
    text: "两节课之间在教学楼下吃点",
    expectedPresent: ["between_classes", "teaching_building_area"],
    expectedAbsent: ["dorm_area"],
  },
].map((probe) => {
  const tags = extractCanonicalTagMatches(probe.text).map((match) => match.canonicalTag);
  return {
    ...probe,
    tags,
    passed:
      probe.expectedPresent.every((tag) => tags.includes(tag)) &&
      probe.expectedAbsent.every((tag) => !tags.includes(tag)),
  };
});
if (
  missingDimensions.length ||
  weakDimensions.length ||
  tagsWithTooFewAliases.length ||
  negativeRuleProbes.some((probe) => !probe.passed) ||
  !customRetained ||
  !strongTokensIgnoreCustom ||
  !optionalTokensKeepCustom
) {
  failed = true;
}

console.log(
  JSON.stringify(
    {
      semanticLayer: "s1-canonical-taxonomy-v1",
      taxonomyTagCount: semanticTaxonomy.length,
      requiredDimensions,
      tagCountsByDimension,
      minimumTagCountsByDimension,
      missingDimensions,
      weakDimensions,
      minAliasesPerCanonicalTag: 4,
      tagsWithTooFewAliases,
      negativeRuleProbes,
      customRetained,
      strongTokensIgnoreCustom,
      optionalTokensKeepCustom,
    },
    undefined,
    2
  )
);

for (const group of groups) {
  const expectedTags = group.expectedTags ?? (group.expectedTag ? [group.expectedTag] : []);
  const rows = group.samples.map((sample) => {
    const matches = extractCanonicalTagMatches(sample);
    const primary = matches[0];
    return {
      sample,
      canonicalTag: primary?.canonicalTag ?? "missing",
      dimension: primary?.dimension ?? "missing",
      confidence: primary?.confidence ?? 0,
      ok: matches.some((match) => expectedTags.includes(match.canonicalTag)),
    };
  });

  const missed = rows.filter((row) => !row.ok);
  const hashSimilarity = average(pairwiseSimilarities(group.samples));
  if (missed.length) failed = true;

  console.log(
    JSON.stringify(
      {
        group: group.id,
        expectedTags,
        passed: missed.length === 0,
        sampleCount: group.samples.length,
        averageHashFallbackSimilarity: Number(hashSimilarity.toFixed(4)),
        misses: missed,
      },
      undefined,
      2
    )
  );
}

if (failed) {
  process.exitCode = 1;
}
