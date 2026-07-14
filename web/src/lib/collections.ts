/**
 * 常用集合工具。
 *
 * 原型里多个页面都支持创建标签；统一去重/去空格逻辑，
 * 后续迁移到 store 或 API 层时也可以继续复用。
 */
export function uniqueTrimmed(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}
