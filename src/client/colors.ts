/**
 * 模型/条目的稳定配色。
 *
 * 颜色由名称哈希决定而非出现顺序，这样同一模型在榜单、图表、明细里颜色一致，
 * 不会因为排序变化而换色。
 */

export const MODEL_PALETTE = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ec4899',
  '#8b5cf6',
  '#06b6d4',
  '#ef4444',
  '#84cc16',
  '#6366f1',
  '#14b8a6',
  '#f97316',
  '#64748b',
] as const

export function colorForName(name: string): string {
  let hash = 0
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) >>> 0
  }
  return MODEL_PALETTE[hash % MODEL_PALETTE.length]
}
