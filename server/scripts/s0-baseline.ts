import fixtures from "./s0-baseline-fixtures.json" assert { type: "json" };
import type { AiSuggestionMode, MealCard, MealExchangeRequest, User } from "../src/types.js";
import { rankMealCardsForUser } from "../src/modules/recommendation.js";
import {
  buildCanonicalTagMatches,
  cosineSimilarity,
  createHashEmbedding,
  extractCanonicalTagMatches,
  labelForTag,
} from "../src/modules/semanticSignals.js";

type IcebreakerCase = {
  id: string;
  mode: AiSuggestionMode;
  currentUserTags: string[];
  otherUserTags: string[];
  expectedEvidenceTags?: string[];
  mealCardText?: string;
  messages?: string[];
  draft?: string;
};

type HomeCase = {
  id: string;
  currentUserTags: string[];
  expectedTopCardId?: string;
  cards: Array<{
    id: string;
    userTags: string[];
    text: string;
    time: string;
    place: string;
    people: string;
    tags: string[];
  }>;
};

const data = fixtures as { now: string; icebreakerCases: IcebreakerCase[]; homeCases: HomeCase[] };
const now = new Date(data.now);

const result = {
  now: now.toISOString(),
  semanticSampleCount:
    data.icebreakerCases.reduce((sum, item) => sum + item.currentUserTags.length + item.otherUserTags.length, 0) +
    data.homeCases.reduce((sum, item) => sum + item.currentUserTags.length + item.cards.reduce((cardSum, card) => cardSum + card.tags.length + card.userTags.length, 0), 0),
  icebreakers: data.icebreakerCases.map(buildIcebreakerBaseline),
  mealCards: data.homeCases.map(buildHomeBaseline),
};

console.log(JSON.stringify(process.argv.includes("--full") ? result : summarizeResult(result), undefined, 2));

if (hasBaselineFailures(result)) {
  process.exitCode = 1;
}

function buildIcebreakerBaseline(item: IcebreakerCase) {
  const currentTags = buildCanonicalTagMatches({ text: "", rawTags: item.currentUserTags });
  const otherTags = buildCanonicalTagMatches({ text: "", rawTags: item.otherUserTags });
  const contextText = [item.mealCardText, ...(item.messages ?? []), item.draft].filter(Boolean).join(" ");
  const queryTags = extractCanonicalTagMatches(contextText);
  const evidenceSignals = buildEvidenceSignals(currentTags.map((match) => match.canonicalTag), otherTags.map((match) => match.canonicalTag), queryTags.map((match) => match.canonicalTag));
  const fallbackSuggestions = buildFallbackSuggestions(item.mode, evidenceSignals[0]?.label, item.draft || item.messages?.at(-1) || item.mealCardText || "");

  return {
    id: item.id,
    mode: item.mode,
    expectedEvidenceTags: item.expectedEvidenceTags ?? [],
    expectedEvidenceMatched: (item.expectedEvidenceTags ?? []).every((tag) => evidenceSignals.some((signal) => signal.tag === tag)),
    canonical: {
      current: currentTags,
      other: otherTags,
      query: queryTags,
    },
    evidenceSignals,
    reason: buildEvidenceReason(evidenceSignals),
    suggestions: fallbackSuggestions,
  };
}

function buildHomeBaseline(item: HomeCase) {
  const currentUser = makeUser("baseline-current", item.currentUserTags);
  const authorById = new Map<string, User>();
  const cards = item.cards.map((card, index) => {
    const author = makeUser(`author-${item.id}-${index}`, card.userTags);
    authorById.set(author.id, author);
    return makeMealCard(card, author, index);
  });

  const ranked = rankMealCardsForUser(cards, {
    currentUser,
    authorById,
    blockedUserIds: new Set(),
    userReportCounts: new Map(),
    cardReportCounts: new Map(),
    exchangeRequests: [] as MealExchangeRequest[],
    now,
  });

  return {
    id: item.id,
    expectedTopCardId: item.expectedTopCardId,
    expectedTopMatched: item.expectedTopCardId ? ranked[0]?.id === item.expectedTopCardId : undefined,
    currentCanonicalTags: buildCanonicalTagMatches({ text: "", rawTags: item.currentUserTags }),
    ranking: ranked.map((card, index) => ({
      rank: index + 1,
      cardId: card.id,
      matchScore: card.matchScore,
      reason: card.reason,
      tags: card.tags,
      canonicalTags: buildCanonicalTagMatches({ text: [card.text, card.place, card.people, ...card.tags].join(" "), rawTags: card.tags }),
    })),
  };
}

function buildEvidenceSignals(currentTags: string[], otherTags: string[], queryTags: string[]) {
  const currentSet = new Set(currentTags.filter((tag) => !tag.startsWith("custom:")));
  const otherSet = new Set(otherTags.filter((tag) => !tag.startsWith("custom:")));
  const querySet = new Set(queryTags.filter((tag) => !tag.startsWith("custom:")));
  const signals: Array<{ type: string; tag: string; label: string; score: number; evidence: string[] }> = [];

  for (const tag of currentSet) {
    if (otherSet.has(tag)) {
      signals.push({
        type: "shared_canonical",
        tag,
        label: labelForTag(tag),
        score: querySet.has(tag) ? 0.95 : 0.82,
        evidence: [`current:${tag}`, `other:${tag}`],
      });
    }
  }

  for (const tag of querySet) {
    if (otherSet.has(tag) && !signals.some((signal) => signal.tag === tag)) {
      signals.push({
        type: "query_to_other_public",
        tag,
        label: labelForTag(tag),
        score: 0.74,
        evidence: [`query:${tag}`, `other:${tag}`],
      });
    }
  }

  if (!signals.length) {
    const bestOther = otherTags.find((tag) => !tag.startsWith("custom:"));
    if (bestOther) {
      signals.push({
        type: "target_public_interest",
        tag: bestOther,
        label: labelForTag(bestOther),
        score: 0.42,
        evidence: [`other:${bestOther}`],
      });
    }
  }

  return signals.sort((left, right) => right.score - left.score).slice(0, 4);
}

function buildEvidenceReason(signals: Array<{ label: string; type: string }>) {
  if (!signals.length) return "公开语义线索不足，使用当前话题和稳妥 fallback。";
  const shared = signals.find((signal) => signal.type === "shared_canonical");
  if (shared) return `双方公开内容都出现了 ${shared.label} 相关线索。`;
  return `优先基于对方公开内容里的 ${signals[0].label} 线索开场。`;
}

function buildFallbackSuggestions(mode: AiSuggestionMode, label = "这顿饭", topic: string) {
  const clippedTopic = clip(topic || label, 18);
  if (mode === "advance") {
    return [
      `要不要先把时间定一下？我觉得围绕${label}挺好聊的。`,
      "如果你方便，我们可以先选一个低压力的地方。",
      `我对「${clippedTopic}」有兴趣，要不要顺着这个约一下？`,
      "不用太正式，先确认口味和地点就好。",
    ];
  }
  if (mode === "opener") {
    return [
      `看到你也提到${label}，要不要先从口味对一下？`,
      `我先坦白，我对${label}这类话题挺有兴趣。`,
      "我有点慢热，但这顿饭看起来可以轻松聊。",
      "如果你方便，我们可以先找个舒服点的地方。",
    ];
  }
  return [
    `你刚说的「${clippedTopic}」我接住了，可以多讲一点吗？`,
    "这个我有兴趣。要不我们先从时间和口味对一下？",
    "听起来很适合边吃边聊，你更想轻松一点还是安静一点？",
    "我不想只敷衍一句，你比较在意哪一点？",
  ];
}

function makeUser(id: string, preferenceTags: string[]): User {
  return {
    id,
    email: `${id}@example.test`,
    passwordHash: "baseline",
    role: "user",
    nickname: id,
    avatarText: id.slice(0, 2).toUpperCase(),
    verified: false,
    school: "U eat University",
    bio: preferenceTags.join(" "),
    preferenceTags,
    profileCompleted: true,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

function makeMealCard(input: HomeCase["cards"][number], author: User, index: number): MealCard {
  return {
    id: input.id,
    userId: author.id,
    nickname: author.nickname,
    avatarText: author.avatarText,
    verified: false,
    text: input.text,
    time: input.time,
    place: input.place,
    people: input.people,
    tags: input.tags,
    matchScore: 72,
    reason: "baseline seed",
    createdAt: new Date(now.getTime() - index * 36e5).toISOString(),
    updatedAt: now.toISOString(),
    status: "active",
    editCount: 0,
  };
}

function clip(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

function summarizeResult(input: typeof result) {
  return {
    now: input.now,
    semanticSampleCount: input.semanticSampleCount,
    hashFallbackProbe: {
      japaneseFoodSimilarity: Number(cosineSimilarity(createHashEmbedding("日料"), createHashEmbedding("日本菜")).toFixed(4)),
      lightFoodSimilarity: Number(cosineSimilarity(createHashEmbedding("清淡"), createHashEmbedding("不辣")).toFixed(4)),
    },
    icebreakers: input.icebreakers.map((item) => ({
      id: item.id,
      mode: item.mode,
      expectedEvidenceTags: item.expectedEvidenceTags,
      expectedEvidenceMatched: item.expectedEvidenceMatched,
      evidenceSignals: item.evidenceSignals,
      reason: item.reason,
      suggestions: item.suggestions,
    })),
    mealCards: input.mealCards.map((item) => ({
      id: item.id,
      expectedTopCardId: item.expectedTopCardId,
      expectedTopMatched: item.expectedTopMatched,
      ranking: item.ranking.map((card) => ({
        rank: card.rank,
        cardId: card.cardId,
        matchScore: card.matchScore,
        reason: card.reason,
        canonicalTags: card.canonicalTags.map((tag) => tag.canonicalTag),
      })),
    })),
  };
}

function hasBaselineFailures(input: typeof result) {
  return (
    input.icebreakers.some((item) => !item.expectedEvidenceMatched || item.suggestions.length !== 4) ||
    input.mealCards.some((item) => item.expectedTopMatched === false)
  );
}
