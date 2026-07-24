import { createHash } from "node:crypto";

export type SemanticDimension = "food" | "scene" | "time" | "social" | "intent" | "topic" | "budget" | "location";

export type SemanticTagMethod = "rule" | "embedding" | "model" | "manual" | "custom";

export interface CanonicalTagMatch {
  rawText: string;
  normalizedText: string;
  canonicalTag: string;
  label: string;
  dimension: SemanticDimension | "custom";
  confidence: number;
  method: SemanticTagMethod;
}

export interface SemanticDraft {
  text: string;
  rawTags?: string[];
}

export interface SemanticTagMappingOverlay {
  rawText: string;
  normalizedText?: string;
  canonicalTag: string;
  confidence: number;
  method: Exclude<SemanticTagMethod, "custom">;
  status: "pending" | "active" | "rejected" | "archived";
}

interface TaxonomyEntry {
  tag: string;
  label: string;
  dimension: SemanticDimension;
  aliases: string[];
  negativeAliases?: string[];
}

export const semanticTaxonomy: TaxonomyEntry[] = [
  food("japanese_food", "日料/日式食物", ["日本菜", "日本料理", "日料", "日式", "日式食物", "和食", "居酒屋", "寿司", "刺身", "拉面", "乌冬", "天妇罗", "鳗鱼饭"]),
  food("korean_food", "韩餐/烤肉", ["韩餐", "韩国菜", "韩国料理", "韩料", "烤肉", "韩式烤肉", "部队锅", "拌饭", "炸鸡"]),
  food("hotpot", "火锅/串串", ["火锅", "串串", "冒菜", "麻辣烫", "涮锅", "小火锅"]),
  food("spicy_food", "重口/辣味", ["吃辣", "喜欢吃辣", "重口", "重口味", "川菜", "湘菜", "麻辣", "香辣", "辣锅"], ["不辣", "不吃辣", "少辣", "微辣", "不能吃辣", "不要辣", "怕辣"]),
  food("light_food", "清淡/轻食", ["清淡", "不辣", "不吃辣", "少油", "少盐", "轻食", "沙拉", "健康餐", "低脂", "低卡", "粥"]),
  food("dessert_drink", "甜品/饮品", ["奶茶", "咖啡", "甜品", "蛋糕", "冰淇淋", "面包", "饮品", "果茶", "酸奶"]),
  food("noodle_rice", "面饭主食", ["拉面", "拌面", "意面", "米线", "米粉", "盖饭", "炒饭", "拌饭", "煲仔饭", "粉面"]),
  food("seafood", "海鲜", ["海鲜", "鱼生", "虾", "螃蟹", "蟹", "贝", "生蚝", "烤鱼"]),
  food("western_food", "西餐/简餐", ["西餐", "披萨", "意面", "牛排", "汉堡", "brunch", "早午餐", "三明治", "简餐"]),
  food("bbq_grill", "烧烤/烤串", ["烧烤", "烤串", "烤肉串", "烤鸡翅", "烤鱼", "烤肉店"]),
  food("cantonese_food", "粤菜/港式", ["粤菜", "港式", "茶餐厅", "烧腊", "肠粉", "点心", "早茶"]),
  food("home_style_food", "家常菜", ["家常菜", "小炒", "炒菜", "盖浇饭", "下饭菜", "妈妈味"]),
  food("vegetarian_food", "素食/植物基", ["素食", "素菜", "不吃肉", "植物基", "轻素", "斋饭"]),
  food("halal_food", "清真", ["清真", "兰州拉面", "牛肉面", "回民餐厅", "清真食堂"]),
  food("fast_food", "快餐", ["快餐", "麦当劳", "肯德基", "kfc", "汉堡王", "便利店饭", "便当"]),
  food("snack_street_food", "小吃/街边", ["小吃", "路边摊", "街边", "夜市", "煎饼", "炸串", "手抓饼"]),
  food("thai_southeast_asian_food", "泰餐/东南亚菜", ["泰餐", "泰国菜", "东南亚菜", "越南菜", "越南粉", "冬阴功", "咖喱", "泰式"]),
  food("dumpling_wonton", "饺子/馄饨", ["饺子", "水饺", "煎饺", "锅贴", "馄饨", "云吞", "小笼包"]),
  food("breakfast_staple", "早餐主食", ["包子", "油条", "饭团", "豆浆油条", "小笼", "烧麦", "早餐铺"]),
  food("protein_meal", "高蛋白/健身餐", ["高蛋白", "鸡胸肉", "牛肉饭", "健身餐", "蛋白质", "增肌餐", "减脂餐"]),

  scene("quiet_dining", "安静小店", ["安静", "安静一点", "小店", "少说话", "不吵", "舒服", "氛围好", "清净"], ["热闹", "很吵", "太吵", "大局"]),
  scene("lively_group", "热闹饭局", ["热闹", "多人局", "大局", "气氛组", "人多", "一起嗨"], ["安静", "不吵", "低压力"]),
  scene("photo_share", "拍照分享", ["拍照", "出片", "好看", "打卡", "照片", "拍照好看", "适合拍照"]),
  scene("quick_meal", "快速吃饭", ["快吃", "快速", "赶时间", "速战速决", "简单吃", "随便吃点"]),
  scene("long_chat", "久坐聊天", ["久坐", "慢慢聊", "坐久一点", "适合聊天", "聊天局", "边吃边聊"]),
  scene("study_dining", "学习后吃饭", ["自习后", "复习完", "图书馆旁", "学习完", "ddl后", "下课后"]),
  scene("takeout_delivery", "外卖/打包", ["外卖", "打包", "带走", "宿舍吃", "寝室吃", "不堂食"]),
  scene("one_on_one_scene", "一对一", ["一对一", "两个人", "2人", "两人", "小范围"]),
  scene("group_scene", "小组饭局", ["三四个人", "3人", "4人", "小组", "多人", "组局"]),
  scene("outdoor_walk", "散步顺路", ["散步", "顺路", "走走", "饭后走", "校园走走"]),
  scene("solo_friendly_scene", "单人友好", ["一个人也行", "单人友好", "自己吃也行", "可拼桌", "拼桌", "不介意一个人"]),
  scene("queue_light_scene", "少排队", ["不用排队", "少排队", "不排队", "排队短", "不想排队", "快出餐", "窗口快"]),

  time("breakfast", "早餐", ["早餐", "早饭", "早八", "豆浆", "包子", "早上吃"]),
  time("lunch", "午饭", ["午饭", "午餐", "中午", "午间", "12点"]),
  time("dinner", "晚饭", ["晚饭", "晚餐", "今晚吃", "傍晚", "晚上吃"]),
  time("late_night", "夜宵", ["夜宵", "宵夜", "晚上十点", "下课后吃", "深夜", "半夜", "熬夜后"]),
  time("after_class", "下课后", ["下课后", "课后", "放学后", "上完课", "课表结束"]),
  time("weekend", "周末", ["周末", "星期六", "星期天", "周六", "周日", "双休日"]),
  time("today", "今天", ["今天", "今晚", "现在", "一会儿", "等会儿"]),
  time("tomorrow", "明天", ["明天", "明晚", "明早", "明天中午"]),
  time("exam_after", "考完", ["考完", "考试后", "交完作业", "ddl后", "答辩后"]),
  time("between_classes", "课间空档", ["课间", "两节课之间", "空档", "没课的时候", "课间吃", "课间十分钟"]),

  social("gentle_chat", "轻松慢聊", ["慢热", "轻松", "随便聊", "不尬聊", "社恐", "社恐友好", "慢慢熟"]),
  social("low_pressure", "低压力相处", ["随缘", "不尬", "不催", "慢慢来", "舒服", "低压力", "安静一点"]),
  social("casual_chat", "轻松闲聊", ["闲聊", "随便聊", "哈哈", "有趣", "好玩", "聊天"]),
  social("talkative", "话多能聊", ["话多", "能聊", "爱聊天", "聊天很多", "话题多", "健谈"]),
  social("listener", "愿意听", ["愿意听", "倾听", "听你说", "当听众", "听故事"]),
  social("humor", "幽默轻松", ["幽默", "好笑", "段子", "笑点", "搞笑", "有梗"]),
  social("introvert_friendly", "内向友好", ["内向", "i人", "社恐友好", "不太主动", "被动聊天", "慢热"]),
  social("extrovert_energy", "外向活跃", ["外向", "e人", "活跃", "主动", "热场", "带话题"]),
  social("polite_boundary", "边界感", ["边界感", "礼貌", "不冒犯", "分寸", "不油腻"]),
  social("newcomer_friendly", "新朋友友好", ["第一次见", "新生友好", "不认识也行", "破冰友好", "新朋友友好", "第一次约饭"]),

  intent("active_invite", "直接约饭", ["约饭", "一起吃", "饭搭子", "找搭子", "约个饭", "一起去吃"]),
  intent("explore_new_places", "探索新店", ["探店", "新店", "种草", "没去过", "尝试", "打卡新店"]),
  intent("planner", "偏好计划", ["几点", "时间", "预约", "定一个", "安排", "计划", "提前定"]),
  intent("spontaneous", "临时随缘", ["临时", "随缘", "突然想吃", "看情况", "随便定", "临时约"]),
  intent("taste_check", "先对口味", ["对口味", "确认口味", "能不能吃辣", "忌口", "口味对一下"]),
  intent("place_check", "先定地点", ["定地点", "哪里吃", "去哪吃", "地点", "位置", "集合"]),
  intent("time_check", "先定时间", ["定时间", "几点吃", "什么时候", "时间对一下", "哪天"]),
  intent("make_friends", "认识新朋友", ["认识新朋友", "交朋友", "扩列", "认识一下", "新朋友"]),
  intent("share_order", "拼单分着尝", ["拼单", "分着尝", "一起点", "点几个菜", "可以分食", "一起尝"]),
  intent("post_meal_activity", "饭后顺带活动", ["饭后散步", "吃完逛逛", "顺便逛", "吃完学习", "饭后自习", "吃完看电影"]),

  topic("study_work", "学习/自习", ["自习", "图书馆", "作业", "ddl", "实验", "复习", "课程"]),
  topic("fitness", "健身/运动", ["健身", "运动", "跑步", "撸铁", "游泳", "羽毛球", "篮球"]),
  topic("movie_show", "电影/演出", ["电影", "演唱会", "话剧", "展览", "演出", "音乐节"]),
  topic("game_acg", "游戏/二次元", ["游戏", "开黑", "二次元", "动漫", "漫画", "switch"]),
  topic("music", "音乐", ["音乐", "听歌", "乐队", "livehouse", "唱歌", "歌单"]),
  topic("travel", "旅行", ["旅行", "旅游", "周边游", "citywalk", "出游", "逛逛"]),
  topic("pets", "宠物", ["猫", "狗", "宠物", "撸猫", "猫咖", "养猫", "养狗"]),
  topic("career", "实习/求职", ["实习", "求职", "面试", "简历", "工作", "职业"]),
  topic("campus_life", "校园生活", ["校园生活", "社团", "选课", "校园活动", "学院", "新生", "校内活动"]),
  topic("photography", "摄影/拍照", ["摄影", "相机", "拍照技巧", "修图", "胶片", "约拍", "拍风景"]),

  budget("budget_friendly", "平价", ["平价", "便宜", "性价比", "学生党", "实惠", "预算低", "不贵"]),
  budget("mid_range_budget", "中等预算", ["人均50", "人均60", "中等预算", "正常价位", "别太贵"]),
  budget("treat_meal", "请客/庆祝", ["请客", "庆祝", "犒劳", "吃顿好的", "生日饭", "奖励自己"]),
  budget("aa_split", "AA", ["aa", "AA", "各付各的", "平摊", "分摊"]),
  budget("coupon_discount", "优惠券/折扣", ["优惠券", "团购", "折扣", "满减", "套餐", "券"]),
  budget("premium_budget", "贵一点也行", ["贵一点", "人均100", "人均一百", "预算高一点", "改善伙食", "小贵也行"]),

  location("canteen", "食堂/校园", ["食堂", "一食堂", "二食堂", "第二食堂", "二餐", "三食堂", "四食堂", "食堂二楼", "校内食堂"]),
  location("campus", "校内", ["校园", "校内", "学校里", "本校", "交大", "闵行", "徐汇"]),
  location("nearby", "附近", ["附近", "周边", "旁边", "不远", "近一点", "走路能到"]),
  location("dorm_area", "宿舍区", ["宿舍", "寝室", "宿舍区", "宿舍楼下", "寝室楼下"]),
  location("library_area", "图书馆附近", ["图书馆", "图书馆旁", "图书馆附近", "自习室旁"]),
  location("gate_area", "校门口", ["校门口", "东门", "西门", "南门", "北门", "门口"]),
  location("mall_area", "商场", ["商场", "商圈", "万达", "龙湖", "合生汇", "大悦城"]),
  location("subway_area", "地铁附近", ["地铁", "地铁站", "站附近", "交通方便"]),
  location("off_campus", "校外", ["校外", "出去吃", "外面", "市区", "远一点"]),
  location("online_remote", "线上/云吃饭", ["线上", "云吃饭", "视频吃饭", "边语音边吃"]),
  location("teaching_building_area", "教学楼附近", ["教学楼", "教室附近", "上课楼下", "教学区", "上课附近"]),
  location("sports_field_area", "操场/体育馆附近", ["操场", "体育馆", "球场", "健身房附近", "体育场", "运动场"]),
];

const taxonomyByTag = new Map(semanticTaxonomy.map((entry) => [entry.tag, entry]));
const aliases = new Map(
  semanticTaxonomy.flatMap((entry) => [entry.tag, entry.label, ...entry.aliases].map((alias) => [normalizeRawToken(alias), entry] as const))
);

export const fallbackEmbeddingModel = "local-hash-embedding-v1";

export function extractCanonicalTagMatches(text: string, activeMappings: SemanticTagMappingOverlay[] = []): CanonicalTagMatch[] {
  const normalized = normalizeRawToken(text);
  if (!normalized) return [];

  const matches = [
    ...extractStaticCanonicalTagMatches(text),
    ...extractMappingCanonicalTagMatches(text, activeMappings),
  ];

  return uniqueMatches(matches);
}

function extractStaticCanonicalTagMatches(text: string): CanonicalTagMatch[] {
  const normalized = normalizeRawToken(text);
  if (!normalized) return [];

  return semanticTaxonomy
    .filter(
      (entry) =>
        !(entry.negativeAliases ?? []).some((alias) => normalized.includes(normalizeRawToken(alias))) &&
        [entry.tag, entry.label, ...entry.aliases].some((alias) => normalized.includes(normalizeRawToken(alias)))
    )
    .map((entry) => ({
      rawText: text,
      normalizedText: normalized,
      canonicalTag: entry.tag,
      label: entry.label,
      dimension: entry.dimension,
      confidence: aliases.get(normalized)?.tag === entry.tag ? 0.96 : 0.88,
      method: "rule" as const,
    }));
}

function extractMappingCanonicalTagMatches(text: string, activeMappings: SemanticTagMappingOverlay[]) {
  const normalized = normalizeRawToken(text);
  if (!normalized) return [];

  return activeMappings
    .filter((mapping) => mapping.status === "active")
    .filter((mapping) => isStandardCanonicalTag(mapping.canonicalTag))
    .filter((mapping) => {
      const normalizedMapping = mapping.normalizedText ?? normalizeRawToken(mapping.rawText);
      return normalizedMapping.length >= 2 && normalized.includes(normalizedMapping);
    })
    .map((mapping) => {
      const entry = taxonomyByTag.get(mapping.canonicalTag)!;
      return {
        rawText: text,
        normalizedText: normalized,
        canonicalTag: mapping.canonicalTag,
        label: entry.label,
        dimension: entry.dimension,
        confidence: Math.min(0.98, Math.max(0.5, mapping.confidence)),
        method: mapping.method,
      };
    });
}

export function extractCanonicalTags(text: string, activeMappings: SemanticTagMappingOverlay[] = []) {
  return extractCanonicalTagMatches(text, activeMappings).map((match) => match.canonicalTag);
}

export function buildCanonicalTagMatches(draft: SemanticDraft, activeMappings: SemanticTagMappingOverlay[] = []): CanonicalTagMatch[] {
  const ruleMatches = uniqueMatches([
    ...extractCanonicalTagMatches(draft.text, activeMappings),
    ...(draft.rawTags ?? []).flatMap((tag) => extractCanonicalTagMatches(tag, activeMappings)),
  ]);
  const ruleTags = new Set(ruleMatches.map((match) => match.canonicalTag));
  const customMatches = (draft.rawTags ?? [])
    .map((tag) => normalizeCustomTag(tag))
    .filter((tag): tag is string => Boolean(tag))
    .filter((tag) => !ruleTags.has(resolveCanonicalTag(tag, activeMappings) ?? ""))
    .map((tag) => ({
      rawText: tag,
      normalizedText: normalizeRawToken(tag),
      canonicalTag: `custom:${tag}`,
      label: tag,
      dimension: "custom" as const,
      confidence: 0.35,
      method: "custom" as const,
    }));

  return uniqueMatches([...ruleMatches, ...customMatches]).slice(0, 12);
}

export function buildCanonicalTags(draft: SemanticDraft, activeMappings: SemanticTagMappingOverlay[] = []) {
  return buildCanonicalTagMatches(draft, activeMappings).map((match) => match.canonicalTag);
}

export function labelForTag(tag: string) {
  if (tag.startsWith("custom:")) return tag.slice("custom:".length);
  return taxonomyByTag.get(tag)?.label ?? tag.replace(/^(shared|query|target):/, "");
}

export function getTagDimension(tag: string) {
  if (tag.startsWith("custom:")) return "custom";
  return taxonomyByTag.get(tag)?.dimension ?? "topic";
}

export function normalizeToCanonicalTag(value: string, activeMappings: SemanticTagMappingOverlay[] = []) {
  const normalized = normalizeRawToken(value);
  const mapped = activeMappings.find(
    (mapping) =>
      mapping.status === "active" &&
      isStandardCanonicalTag(mapping.canonicalTag) &&
      (mapping.normalizedText ?? normalizeRawToken(mapping.rawText)) === normalized
  );
  if (mapped) return mapped.canonicalTag;
  return aliases.get(normalized)?.tag ?? normalized;
}

export function resolveCanonicalTag(value: string, activeMappings: SemanticTagMappingOverlay[] = []) {
  const normalized = normalizeRawToken(value);
  const mapped = activeMappings.find(
    (mapping) =>
      mapping.status === "active" &&
      isStandardCanonicalTag(mapping.canonicalTag) &&
      (mapping.normalizedText ?? normalizeRawToken(mapping.rawText)) === normalized
  );
  return mapped?.canonicalTag ?? aliases.get(normalized)?.tag;
}

export function isStandardCanonicalTag(tag: string) {
  return taxonomyByTag.has(tag);
}

export function normalizeSemanticTokens(
  values: Array<string | undefined>,
  options: { includeCustom?: boolean; activeMappings?: SemanticTagMappingOverlay[] } = {}
) {
  return unique(
    values.flatMap((value) => {
      const canonical = resolveCanonicalTag(value ?? "", options.activeMappings ?? []);
      if (canonical) return [canonical];
      if (!options.includeCustom) return [];
      const custom = normalizeCustomTag(value ?? "");
      return custom ? [`custom:${custom}`] : [];
    })
  );
}

export function createHashEmbedding(text: string, dimensions = 64) {
  const vector = Array.from({ length: dimensions }, () => 0);
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
  if (!normalized) return vector;

  for (let index = 0; index < normalized.length; index += 1) {
    const gram = normalized.slice(index, index + 2);
    const hash = createHash("sha256").update(gram).digest();
    const dimension = hash[0] % dimensions;
    const sign = hash[1] % 2 === 0 ? 1 : -1;
    vector[dimension] += sign;
  }

  return normalizeVector(vector);
}

export function cosineSimilarity(left: number[], right: number[]) {
  const length = Math.min(left.length, right.length);
  if (!length) return 0;
  let score = 0;
  for (let index = 0; index < length; index += 1) {
    score += left[index] * right[index];
  }
  return score;
}

export function normalizeRawToken(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function food(tag: string, label: string, aliases: string[], negativeAliases?: string[]): TaxonomyEntry {
  return { tag, label, dimension: "food", aliases, negativeAliases };
}

function scene(tag: string, label: string, aliases: string[], negativeAliases?: string[]): TaxonomyEntry {
  return { tag, label, dimension: "scene", aliases, negativeAliases };
}

function time(tag: string, label: string, aliases: string[], negativeAliases?: string[]): TaxonomyEntry {
  return { tag, label, dimension: "time", aliases, negativeAliases };
}

function social(tag: string, label: string, aliases: string[], negativeAliases?: string[]): TaxonomyEntry {
  return { tag, label, dimension: "social", aliases, negativeAliases };
}

function intent(tag: string, label: string, aliases: string[], negativeAliases?: string[]): TaxonomyEntry {
  return { tag, label, dimension: "intent", aliases, negativeAliases };
}

function topic(tag: string, label: string, aliases: string[], negativeAliases?: string[]): TaxonomyEntry {
  return { tag, label, dimension: "topic", aliases, negativeAliases };
}

function budget(tag: string, label: string, aliases: string[], negativeAliases?: string[]): TaxonomyEntry {
  return { tag, label, dimension: "budget", aliases, negativeAliases };
}

function location(tag: string, label: string, aliases: string[], negativeAliases?: string[]): TaxonomyEntry {
  return { tag, label, dimension: "location", aliases, negativeAliases };
}

function normalizeVector(vector: number[]) {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!magnitude) return vector;
  return vector.map((value) => Number((value / magnitude).toFixed(6)));
}

function normalizeCustomTag(tag: string) {
  const normalized = tag.replace(/\s+/g, "").replace(/[，。！？、,.!?;:：'"`]/g, "").trim();
  if (normalized.length < 2 || normalized.length > 14) return undefined;
  if (/^(全部|其他|默认|暂无|不限|随便|未知)$/i.test(normalized)) return undefined;
  return normalized;
}

function uniqueMatches(matches: CanonicalTagMatch[]) {
  const seen = new Set<string>();
  return matches.filter((match) => {
    if (seen.has(match.canonicalTag)) return false;
    seen.add(match.canonicalTag);
    return true;
  });
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}
