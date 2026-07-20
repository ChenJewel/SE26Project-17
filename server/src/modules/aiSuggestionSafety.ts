export interface AiSuggestionSafetyReport {
  originalCount: number;
  acceptedCount: number;
  rejectedCount: number;
  blockedReasons: Record<string, number>;
}

interface SafetyDecision {
  safe: boolean;
  reason?: string;
}

const maxSuggestionLength = 72;
const maxModelSuggestionLength = 52;
const minSuggestionLength = 4;
const minModelSuggestionLength = 8;

const blockedPatterns: Array<{ reason: string; pattern: RegExp }> = [
  { reason: "contact_exchange", pattern: /(\u5fae\u4fe1|vx|wechat|qq|\u624b\u673a\u53f7|\u7535\u8bdd|\u52a0\u6211)/i },
  { reason: "over_intimate", pattern: /(\u4eb2\u7231\u7684|\u5b9d\u8d1d|\u8001\u516c|\u8001\u5a46|\u60f3\u4f60\u4e86|\u7231\u4e0a\u4f60)/i },
  { reason: "pressure_or_guilt", pattern: /(\u4e0d\u56de|\u4e0d\u7406\u6211|\u5fc5\u987b|\u9a6c\u4e0a|\u7acb\u523b|\u7ed9\u6211\u4e00\u4e2a\u673a\u4f1a)/i },
  { reason: "promise_or_identity", pattern: /(\u6211\u4f1a\u4e00\u76f4|\u6211\u80af\u5b9a|\u4f60\u4e00\u5b9a\u662f|\u6211\u4eec\u5c31\u662f\u5929\u751f)/i },
  { reason: "sensitive_inference", pattern: /(\u8eab\u6750|\u957f\u76f8|\u5bb6\u5883|\u6536\u5165|\u75be\u75c5|\u6291\u90c1|\u5b97\u6559|\u653f\u6cbb)/i },
  { reason: "unsafe_meetup", pattern: /(\u53bb\u4f60\u5bb6|\u6765\u6211\u5bb6|\u5355\u72ec\u8fc7\u591c|\u5f00\u623f)/i },
  { reason: "ai_disclosure", pattern: /(AI|\u7b97\u6cd5|\u753b\u50cf|\u5927\u6a21\u578b|\u63a8\u7406)/i },
];

const lowQualityModelPatterns: Array<{ reason: string; pattern: RegExp }> = [
  { reason: "too_generic", pattern: /^(\u4eca\u5929)?\u60f3\u5403\u70b9?\u4ec0\u4e48[?？。！!]*$/ },
  { reason: "too_generic", pattern: /^\u4f60\u559c\u6b22\u5403\u4ec0\u4e48[?？。！!]*$/ },
  { reason: "too_generic", pattern: /^\u8fd9\u676f\u996e\u6599\u4f60\u559d\u8fc7\u5417[?？。！!]*$/ },
  { reason: "too_generic", pattern: /^\u4f60\u5728\u5e72\u561b[?？。！!]*$/ },
  { reason: "meta_instruction", pattern: /(\u5efa\u8bae|\u8bdd\u672f|\u7834\u51b0|\u5019\u9009|\u7528\u6237|\u5bf9\u65b9)/ },
  { reason: "weak_grounding", pattern: /(\u4f60\u4e00\u5b9a|\u4f60\u5e94\u8be5|\u770b\u8d77\u6765|\u6211\u731c)/ },
];

export function parseAiSuggestionProviderText(text: string) {
  const cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/```json|```/gi, "")
    .trim();
  const parsed = parseJsonSuggestionValue(cleaned) ?? parseJsonSuggestionValueFromSlice(cleaned);
  return parsed ? readSuggestionArray(parsed) : [];
}

export function finalizeAiSuggestions(
  suggestions: string[],
  fallbackSuggestions: string[]
): { suggestions: string[]; report: AiSuggestionSafetyReport } {
  const report: AiSuggestionSafetyReport = {
    originalCount: suggestions.length,
    acceptedCount: 0,
    rejectedCount: 0,
    blockedReasons: {},
  };

  const accepted: string[] = [];
  for (const suggestion of suggestions) {
    const cleaned = cleanSuggestion(suggestion);
    const decision = evaluateSuggestionSafety(cleaned, { strictQuality: true });
    if (!decision.safe) {
      report.rejectedCount += 1;
      const reason = decision.reason ?? "unknown";
      report.blockedReasons[reason] = (report.blockedReasons[reason] ?? 0) + 1;
      continue;
    }
    accepted.push(cleaned);
  }

  const merged = uniqueSuggestions([...accepted, ...fallbackSuggestions.map(cleanSuggestion)])
    .filter((suggestion) => evaluateSuggestionSafety(suggestion, { strictQuality: false }).safe)
    .slice(0, 4);

  if (!merged.length) throw new Error("AI provider returned no safe suggestions.");

  report.acceptedCount = Math.min(accepted.length, 4);
  return { suggestions: merged, report };
}

function cleanSuggestion(suggestion: string) {
  return suggestion
    .replace(/^[\s"'“”‘’[\]({（【]+|[\s"'“”‘’\])}）】]+$/g, "")
    .replace(/^\d+[.、\s]+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxSuggestionLength);
}

function evaluateSuggestionSafety(suggestion: string, options: { strictQuality: boolean }): SafetyDecision {
  if (suggestion.length < minSuggestionLength) return { safe: false, reason: "too_short" };
  if (!/[\u4e00-\u9fff]/.test(suggestion)) return { safe: false, reason: "not_chinese" };
  for (const blocked of blockedPatterns) {
    if (blocked.pattern.test(suggestion)) return { safe: false, reason: blocked.reason };
  }
  if (options.strictQuality) {
    if (suggestion.length < minModelSuggestionLength) return { safe: false, reason: "too_short" };
    if (suggestion.length > maxModelSuggestionLength) return { safe: false, reason: "too_long" };
    for (const blocked of lowQualityModelPatterns) {
      if (blocked.pattern.test(suggestion)) return { safe: false, reason: blocked.reason };
    }
    if (!/[?？。！!呢吗呀吧~～]$/.test(suggestion)) return { safe: false, reason: "unfinished_sentence" };
  }
  return { safe: true };
}

function uniqueSuggestions(suggestions: string[]) {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const suggestion of suggestions.filter(Boolean)) {
    const key = normalizeSuggestionKey(suggestion);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(suggestion);
  }
  return unique;
}

function normalizeSuggestionKey(suggestion: string) {
  return suggestion
    .replace(/[?？。！!，,、；;：:\s"'“”‘’~～]/g, "")
    .replace(/[呀呢吧啊哦啦嘛哇]{1,2}$/g, "")
    .toLowerCase();
}

function parseJsonSuggestionValue(text: string): unknown | undefined {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function parseJsonSuggestionValueFromSlice(text: string): unknown | undefined {
  const arrayStart = text.indexOf("[");
  const arrayEnd = text.lastIndexOf("]");
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    return parseJsonSuggestionValue(text.slice(arrayStart, arrayEnd + 1));
  }

  const objectStart = text.indexOf("{");
  const objectEnd = text.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) {
    return parseJsonSuggestionValue(text.slice(objectStart, objectEnd + 1));
  }
  return undefined;
}

function readSuggestionArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (!value || typeof value !== "object") return [];

  const record = value as Record<string, unknown>;
  const candidates = [record.suggestions, record.items, record.candidates];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate.filter((item): item is string => typeof item === "string");
  }
  return [];
}
