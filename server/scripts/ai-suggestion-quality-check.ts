import { finalizeAiSuggestions, parseAiSuggestionProviderText } from "../src/modules/aiSuggestionSafety.js";

const fallbackSuggestions = [
  "我们可以先从口味聊起，你最近更想吃清淡还是热闹一点的？",
  "这话题挺适合慢慢聊，你平时更喜欢安静店还是人多一点？",
  "如果今天想轻松一点，我们可以先交换一家最近想去的店。",
  "我有点好奇你最近收藏过哪家店，方便推荐一下吗？",
];

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) throw new Error(`${message}. Expected ${expected}, got ${actual}.`);
}

const jsonArray = parseAiSuggestionProviderText(
  '["你刚提到日料，我有点想听你推荐哪家。","这家你之前去过吗，适合轻松聊会儿吗？"]'
);
assertEqual(jsonArray.length, 2, "JSON array suggestions should be parsed");

const jsonObject = parseAiSuggestionProviderText(
  '{"suggestions":["如果今天想低压力一点，我们可以先从口味对齐。","你公开饭卡里提到拉面，我正好也想试试。"]}'
);
assertEqual(jsonObject.length, 2, "JSON object suggestions should be parsed");

const looseText = parseAiSuggestionProviderText("1. 今天想吃什么？\n2. 你喜欢吃什么？");
assertEqual(looseText.length, 0, "Loose non-JSON output should not be accepted");

const finalized = finalizeAiSuggestions(
  [
    "今天想吃什么？",
    "这杯饮料你喝过吗？",
    "你刚提到日料，我有点想听你推荐哪家。",
    "这家你之前去过吗，适合轻松聊会儿吗？",
    "加我微信吧，我们马上约。",
  ],
  fallbackSuggestions
);

assertEqual(finalized.suggestions.length, 4, "Final suggestions should always contain four items");
assert(finalized.report.rejectedCount >= 3, "Generic and unsafe model suggestions should be rejected");
assert(!finalized.suggestions.includes("今天想吃什么？"), "Generic model suggestion should not survive");
assert(!finalized.suggestions.some((suggestion) => /微信|vx|wechat/i.test(suggestion)), "Contact exchange should not survive");

const deduped = finalizeAiSuggestions(
  [
    "这家你之前去过吗，适合轻松聊会儿吗？",
    "这家你之前去过吗，适合轻松聊会儿吗？",
    "如果今天想低压力一点，我们可以先从口味对齐。",
    "你公开饭卡里提到拉面，我正好也想试试。",
    "这个话题还挺好接的，你更偏安静店还是热闹店？",
  ],
  fallbackSuggestions
);
assertEqual(new Set(deduped.suggestions).size, 4, "Duplicate model suggestions should be collapsed");

console.log(
  JSON.stringify(
    {
      success: true,
      parsed: {
        jsonArray: jsonArray.length,
        jsonObject: jsonObject.length,
        looseText: looseText.length,
      },
      finalized: finalized.suggestions,
      rejected: finalized.report.blockedReasons,
    },
    null,
    2
  )
);
