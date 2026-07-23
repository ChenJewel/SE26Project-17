const knownCampusDomains: Record<string, string> = {
  "fudan.edu.cn": "复旦大学",
  "m.fudan.edu.cn": "复旦大学",
  "sjtu.edu.cn": "上海交通大学",
  "tongji.edu.cn": "同济大学",
  "pku.edu.cn": "北京大学",
  "stu.pku.edu.cn": "北京大学",
  "tsinghua.edu.cn": "清华大学",
  "mails.tsinghua.edu.cn": "清华大学",
  "zju.edu.cn": "浙江大学",
  "mail.ustc.edu.cn": "中国科学技术大学",
  "ustc.edu.cn": "中国科学技术大学",
  "nju.edu.cn": "南京大学",
  "ruc.edu.cn": "中国人民大学",
  "buaa.edu.cn": "北京航空航天大学",
  "bupt.edu.cn": "北京邮电大学",
  "ecnu.edu.cn": "华东师范大学",
  "shufe.edu.cn": "上海财经大学",
};

export type CampusEmailResult = {
  valid: boolean;
  email: string;
  domain: string;
  school: string;
};

export function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function resolveCampusEmail(value: unknown): CampusEmailResult {
  const email = normalizeEmail(value);
  const domain = email.split("@")[1] ?? "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !domain) {
    return { valid: false, email, domain, school: "" };
  }

  const configuredSchool = resolveConfiguredCampusDomain(domain);
  if (configuredSchool) return { valid: true, email, domain, school: configuredSchool };

  const knownSchool = resolveKnownCampusDomain(domain);
  if (knownSchool) return { valid: true, email, domain, school: knownSchool };

  return { valid: false, email, domain, school: "" };
}

function resolveKnownCampusDomain(domain: string) {
  if (knownCampusDomains[domain]) return knownCampusDomains[domain];
  const matchedDomain = Object.keys(knownCampusDomains)
    .sort((left, right) => right.length - left.length)
    .find((campusDomain) => domain === campusDomain || domain.endsWith(`.${campusDomain}`));
  return matchedDomain ? knownCampusDomains[matchedDomain] : "";
}

function resolveConfiguredCampusDomain(domain: string) {
  const raw = process.env.CAMPUS_EMAIL_DOMAINS?.trim();
  if (!raw) return "";

  for (const entry of raw.split(",")) {
    const [rawDomain, rawSchool] = entry.split(":");
    const campusDomain = rawDomain?.trim().toLowerCase();
    if (!campusDomain) continue;
    if (domain === campusDomain || domain.endsWith(`.${campusDomain}`)) {
      return rawSchool?.trim() || "校园邮箱";
    }
  }
  return "";
}
