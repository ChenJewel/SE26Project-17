// 测试环境全局变量配置（在测试文件 import 之前执行）
process.env.ALLOW_INSECURE_USER_ID_AUTH = "true";
process.env.ALLOW_DEMO_AUTH_FALLBACK = "true";
process.env.AUTH_TOKEN_SECRET = "vitest-test-secret-0123456789abcdef0123456789abcdef";
process.env.AUTH_TOKEN_TTL_DAYS = "30";
process.env.CAMPUS_EMAIL_DOMAINS = "fudan.edu.cn:复旦大学,sjtu.edu.cn:上海交通大学,tongji.edu.cn:同济大学";
