import {
  buildCanonicalTagMatches,
  getTagDimension,
  isStandardCanonicalTag,
  labelForTag,
  normalizeRawToken,
  resolveCanonicalTag,
  type SemanticDimension,
  type SemanticTagMethod,
} from "./semanticSignals.js";

export type SemanticMappingStatus = "pending" | "active" | "rejected" | "archived";
export type SemanticCandidateSourceType = "profile_tag" | "meal_card" | "post" | "comment" | "admin" | "private_chat";

export interface SemanticCandidateSource {
  id: string;
  sourceType: SemanticCandidateSourceType;
  visibility: "public" | "private";
  text: string;
  rawTags?: string[];
}

export interface SemanticTagMappingCandidate {
  rawText: string;
  normalizedText: string;
  canonicalTag: string;
  label: string;
  dimension: SemanticDimension;
  confidence: number;
  method: Exclude<SemanticTagMethod, "custom">;
  status: SemanticMappingStatus;
  source: string;
  sourceCount: number;
  sampleSources: Array<{
    sourceId: string;
    sourceType: SemanticCandidateSourceType;
    rawText: string;
    text: string;
  }>;
  taxonomyVersion: string;
  embeddingModel?: string;
}

export const semanticTaxonomyVersion = "s1-canonical-taxonomy-v1";

const ignoredCandidateTokens = /^(全部|其他|默认|暂无|不限|随便|未知|test|测试)$/i;
const unsafeCandidateTokens = /(微信|手机号|电话|vx|qq|身份证|宿舍号|门牌|密码)/i;
const genericContextTags = new Set(["active_invite", "low_pressure", "casual_chat"]);

export function buildSemanticTagMappingCandidates(
  sources: SemanticCandidateSource[],
  existingMappings: Array<{ normalizedText: string; canonicalTag: string; status: SemanticMappingStatus }> = []
) {
  const existingKeys = new Set(
    existingMappings
      .filter((mapping) => mapping.status === "active" || mapping.status === "rejected")
      .map((mapping) => mappingKey(mapping.normalizedText, mapping.canonicalTag))
  );
  const aggregate = new Map<string, SemanticTagMappingCandidate>();

  for (const source of sources) {
    if (source.visibility !== "public" || source.sourceType === "private_chat") continue;
    for (const rawText of source.rawTags ?? []) {
      const normalizedText = normalizeCandidateToken(rawText);
      if (!normalizedText || ignoredCandidateTokens.test(normalizedText) || unsafeCandidateTokens.test(rawText)) continue;
      const directCanonical = resolveCanonicalTag(rawText);
      if (directCanonical && isStandardCanonicalTag(directCanonical)) continue;

      const contextTags = buildCanonicalTagMatches({
        text: source.text,
        rawTags: (source.rawTags ?? []).filter((tag) => tag !== rawText),
      })
        .map((match) => match.canonicalTag)
        .filter(isStandardCanonicalTag);
      if (!contextTags.length) continue;

      const canonicalTag = chooseCanonicalTagForCandidate(rawText, contextTags);
      if (!canonicalTag || existingKeys.has(mappingKey(normalizedText, canonicalTag))) continue;

      const key = mappingKey(normalizedText, canonicalTag);
      const current = aggregate.get(key);
      if (current) {
        current.sourceCount += 1;
        current.confidence = candidateConfidence(current.sourceCount, current.method);
        if (current.sampleSources.length < 3) {
          current.sampleSources.push(sampleSource(source, rawText));
        }
        continue;
      }

      aggregate.set(key, {
        rawText,
        normalizedText,
        canonicalTag,
        label: labelForTag(canonicalTag),
        dimension: getTagDimension(canonicalTag) as SemanticDimension,
        confidence: candidateConfidence(1, "rule"),
        method: "rule",
        status: "pending",
        source: source.sourceType,
        sourceCount: 1,
        sampleSources: [sampleSource(source, rawText)],
        taxonomyVersion: semanticTaxonomyVersion,
      });
    }
  }

  return [...aggregate.values()].sort(
    (left, right) => right.sourceCount - left.sourceCount || right.confidence - left.confidence || left.normalizedText.localeCompare(right.normalizedText)
  );
}

function chooseCanonicalTagForCandidate(rawText: string, contextTags: string[]) {
  const rawMatches = buildCanonicalTagMatches({ text: rawText }).map((match) => match.canonicalTag);
  const directContextMatch = rawMatches.find((tag) => contextTags.includes(tag) && isStandardCanonicalTag(tag));
  return directContextMatch ?? contextTags.find((tag) => !genericContextTags.has(tag)) ?? contextTags[0];
}

function normalizeCandidateToken(rawText: string) {
  const normalized = normalizeRawToken(rawText).replace(/[，。！？、,.!?;:：'"`]/g, "");
  if (normalized.length < 2 || normalized.length > 14) return undefined;
  return normalized;
}

function candidateConfidence(sourceCount: number, method: Exclude<SemanticTagMethod, "custom">) {
  const base = method === "manual" ? 0.9 : 0.52;
  return Number(Math.min(0.78, base + Math.log2(sourceCount + 1) * 0.06).toFixed(2));
}

function sampleSource(source: SemanticCandidateSource, rawText: string) {
  return {
    sourceId: source.id,
    sourceType: source.sourceType,
    rawText,
    text: source.text.slice(0, 120),
  };
}

function mappingKey(normalizedText: string, canonicalTag: string) {
  return `${normalizedText}::${canonicalTag}`;
}
