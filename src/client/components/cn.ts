/**
 * 类名合并工具。
 *
 * 组件里存在「基础类 + 条件类 + 调用方覆盖」三层叠加，直接拼字符串会留下重复类，
 * 且后写的类未必赢（CSS 顺序而非 className 顺序决定优先级）。这里只做去重后合并，
 * 不引入 tailwind-merge —— 本项目的类都是语义类，同名即同义，去重即可。
 */

export function cn(...values: Array<string | false | null | undefined>): string {
  const seen = new Set<string>()
  for (const value of values) {
    if (!value) continue
    for (const token of value.split(/\s+/)) {
      if (token) seen.add(token)
    }
  }
  return [...seen].join(' ')
}
