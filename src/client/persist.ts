/**
 * 面板偏好持久化。
 *
 * 面板在切换界面时会被整块卸载，组件内 state 随之丢失（表现为「重新进入又回到全部」），
 * 因此少量偏好写进 localStorage，重新进入时恢复上次选择。
 */

import { TIME_RANGES, type TimeRange } from './derived'

const RANGE_KEY = 'dsh-metrics.range'
const DEFAULT_RANGE: TimeRange = 'all'

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    // 隐私模式等场景下访问 localStorage 会抛错，此时退化为不持久化
    return null
  }
}

/** 只接受白名单内的值，历史版本或手改过的脏数据一律回退到默认值。 */
export function parseTimeRange(raw: string | null | undefined): TimeRange | null {
  if (!raw) return null
  return (TIME_RANGES as readonly string[]).includes(raw) ? (raw as TimeRange) : null
}

export function loadTimeRange(): TimeRange {
  return parseTimeRange(storage()?.getItem(RANGE_KEY)) ?? DEFAULT_RANGE
}

export function saveTimeRange(range: TimeRange): void {
  storage()?.setItem(RANGE_KEY, range)
}
