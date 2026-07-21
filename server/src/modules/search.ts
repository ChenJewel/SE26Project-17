import { Router } from "express";
import { sendFailure, sendSuccess, toPublicUser } from "../common/http.js";
import { getCurrentUserId } from "../common/request.js";
import { postgresStore } from "../data/postgres.js";
import type { CommunityPost, MealCard, User } from "../types.js";
import { buildCanonicalTags, cosineSimilarity, createHashEmbedding, normalizeRawToken } from "./semanticSignals.js";

export const searchRouter = Router();

searchRouter.get("/", async (req, res) => {
  const currentUserId = getCurrentUserId(req);
  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const page = clampInt(req.query.page, 1, 500, 1);
  const limit = clampInt(req.query.limit, 1, 50, 20);
  const offset = (page - 1) * limit;

  if (!query) {
    sendFailure(res, 400, "INVALID_SEARCH_QUERY", "q is required.");
    return;
  }

  const fetchLimit = limit + 1;
  const [allUsers, allPosts, allCards] = await Promise.all([
    postgresStore.listSearchableUsers(),
    postgresStore.listPublishedPosts(),
    postgresStore.listActiveMealCards(),
  ]);
  const rankedUsers = rankUsersForSearch(query, allUsers);
  const rankedPosts = rankPostsForSearch(query, allPosts);
  const rankedCards = rankMealCardsForSearch(query, allCards);
  const users = rankedUsers.slice(offset, offset + fetchLimit);
  const posts = rankedPosts.slice(offset, offset + fetchLimit);
  const cards = rankedCards.slice(offset, offset + fetchLimit);

  const visibleUsers = users.slice(0, limit);
  const visiblePosts = posts.slice(0, limit);
  const visibleCards = cards.slice(0, limit);
  const usersWithFollow = await Promise.all(
    visibleUsers.map(async (user) => ({
      ...toPublicUser(user),
      follow: await postgresStore.getFollowSummary(currentUserId, user.id),
      highlights: buildHighlights(query, {
        nickname: user.nickname,
        school: user.school,
        bio: user.bio,
      }),
    }))
  );

  const suggestion = users.length || posts.length || cards.length ? undefined : await suggestQuery(query);

  sendSuccess(res, {
    query,
    page,
    limit,
    hasMore: users.length > visibleUsers.length || posts.length > visiblePosts.length || cards.length > visibleCards.length,
    suggestion,
    users: usersWithFollow,
    posts: visiblePosts.map((post) => ({
      ...post,
      highlights: buildHighlights(query, {
        title: post.title,
        text: post.text,
        author: post.author,
        place: post.place,
        topic: post.topic,
      }),
    })),
    cards: visibleCards.map((card) => ({
      ...card,
      highlights: buildHighlights(query, {
        nickname: card.nickname,
        text: card.text,
        place: card.place,
        time: card.time,
        tags: card.tags.join(" "),
      }),
    })),
  });
});

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function rankUsersForSearch(query: string, users: User[]) {
  return users
    .map((user) => ({
      item: user,
      score: scoreSearchCandidate(query, [user.nickname, user.email, user.school ?? "", user.bio ?? "", ...user.preferenceTags], [user.school ?? "", ...user.preferenceTags]),
    }))
    .filter((result) => result.score >= 14)
    .sort((left, right) => right.score - left.score || Number(right.item.verified) - Number(left.item.verified) || parseTime(right.item.updatedAt) - parseTime(left.item.updatedAt))
    .map((result) => result.item);
}

function rankPostsForSearch(query: string, posts: CommunityPost[]) {
  return posts
    .map((post) => ({
      item: post,
      score: scoreSearchCandidate(query, [post.title, post.text, post.author, post.place, post.channel, post.topic], [post.topic, post.channel, post.place]),
    }))
    .filter((result) => result.score >= 18)
    .sort((left, right) => right.score - left.score || parseTime(right.item.createdAt) - parseTime(left.item.createdAt))
    .map((result) => result.item);
}

function rankMealCardsForSearch(query: string, cards: MealCard[]) {
  return cards
    .map((card) => ({
      item: card,
      score: scoreSearchCandidate(query, [card.nickname, card.text, card.time, card.place, card.people, card.reason, ...card.tags], [card.place, card.people, ...card.tags]),
    }))
    .filter((result) => result.score >= 18)
    .sort((left, right) => right.score - left.score || right.item.matchScore - left.item.matchScore || parseTime(right.item.createdAt) - parseTime(left.item.createdAt))
    .map((result) => result.item);
}

function scoreSearchCandidate(query: string, fields: string[], rawTags: string[]) {
  const normalizedQuery = normalizeRawToken(query);
  const text = fields.filter(Boolean).join(" ");
  const normalizedText = normalizeRawToken(text);
  if (!normalizedQuery || !normalizedText) return 0;

  let score = 0;
  if (normalizedText.includes(normalizedQuery)) score += 80;
  if (fields.some((field) => normalizeRawToken(field).startsWith(normalizedQuery))) score += 28;

  const queryTags = new Set(buildCanonicalTags({ text: query, rawTags: [query] }).filter((tag) => !tag.startsWith("custom:")));
  const targetTags = new Set(buildCanonicalTags({ text, rawTags }).filter((tag) => !tag.startsWith("custom:")));
  const semanticOverlap = jaccard(queryTags, targetTags);
  score += semanticOverlap * 86;

  const similarity = cosineSimilarity(createHashEmbedding(query), createHashEmbedding(text));
  if (similarity >= 0.34) score += similarity * 42;

  return score;
}

function jaccard(left: Set<string>, right: Set<string>) {
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const item of left) {
    if (right.has(item)) overlap += 1;
  }
  return overlap / (left.size + right.size - overlap);
}

function parseTime(value?: string) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildHighlights(query: string, fields: Record<string, string | undefined>) {
  const highlights: Record<string, string> = {};
  for (const [field, value] of Object.entries(fields)) {
    const snippet = highlightSnippet(value ?? "", query);
    if (snippet) highlights[field] = snippet;
  }
  return highlights;
}

function highlightSnippet(value: string, query: string) {
  const normalizedValue = value.trim();
  if (!normalizedValue) return undefined;
  const lowerValue = normalizedValue.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerValue.indexOf(lowerQuery);
  if (index < 0) return undefined;

  const start = Math.max(0, index - 18);
  const end = Math.min(normalizedValue.length, index + query.length + 32);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < normalizedValue.length ? "..." : "";
  const before = normalizedValue.slice(start, index);
  const match = normalizedValue.slice(index, index + query.length);
  const after = normalizedValue.slice(index + query.length, end);
  return `${prefix}${before}<mark>${match}</mark>${after}${suffix}`;
}

async function suggestQuery(query: string) {
  const candidates = await postgresStore.listSearchCandidates();
  const normalizedQuery = query.trim().toLowerCase();
  let best: { term: string; distance: number } | undefined;

  for (const term of candidates) {
    const normalizedTerm = term.trim().toLowerCase();
    if (!normalizedTerm || normalizedTerm === normalizedQuery) continue;
    const distance = levenshtein(normalizedQuery, normalizedTerm);
    const threshold = Math.max(2, Math.ceil(Math.min(normalizedQuery.length, normalizedTerm.length) * 0.42));
    if (distance <= threshold && (!best || distance < best.distance)) {
      best = { term, distance };
    }
  }

  return best?.term;
}

function levenshtein(a: string, b: string) {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array.from({ length: b.length + 1 }, () => 0);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      current[j] =
        a[i - 1] === b[j - 1]
          ? previous[j - 1]
          : Math.min(previous[j - 1] + 1, previous[j] + 1, current[j - 1] + 1);
    }
    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j];
  }

  return previous[b.length];
}
