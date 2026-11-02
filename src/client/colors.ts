/**
 * 图表配色分配。
 *
 * 取值为 CSS 变量而非色值字面量：明暗主题各有一套低饱和序列（见 theme.css），
 * 由宿主 body[data-ds-dark-theme] 统一切换。SVG 的 stroke/fill 支持 var()，
 * 因此图表跟随主题即时变化，无需 JS 参与。
 *
 * 分配策略：纯哈希会撞色 —— deepseek / anthropic / alibaba 曾全部落在同一个槽位，
 * 同屏三条图例颜色一样就失去了区分意义。因此改为「哈希定起点 + 顺序避让」：
 * 在同一个列表/图表内按调用顺序分配，已被占用的槽位就往后挪。稳定且不撞色。
 */

/** 序列色槽位总数，与 theme.css 的 --tm-series-N 一一对应。 */
export const SERIES_SLOTS = 8

/** 取第 index 个序列色（自动取模，超出槽位时循环）。 */
export function seriesColor(index: number): string {
  return `var(--tm-series-${(index % SERIES_SLOTS) + 1})`
}

/** 名称的稳定哈希，用作分配的起始槽位。 */
function hashOf(name: string): number {
  let hash = 0
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) >>> 0
  }
  return hash
}

/**
 * 为一个具名序列分配颜色，已占用的槽位会被跳过。
 * 调用方按稳定顺序（如用量降序）依次调用即可保证同屏不撞色。
 */
export function createColorAllocator(): (name: string) => string {
  const used = new Set<number>()
  return (name: string): string => {
    const start = hashOf(name) % SERIES_SLOTS
    for (let offset = 0; offset < SERIES_SLOTS; offset += 1) {
      const slot = (start + offset) % SERIES_SLOTS
      if (!used.has(slot)) {
        used.add(slot)
        return seriesColor(slot)
      }
    }
    // 序列数超过槽位数时只能复用：循环回去，至少保持确定性
    return seriesColor(start)
  }
}

/** 「其他」聚合项用中性色，不与具体条目抢注意力。 */
export const NEUTRAL_SLICE_COLOR = 'var(--tm-ink-3)'
