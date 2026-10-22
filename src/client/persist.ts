/**
 * 面板偏好持久化。
 *
 * 面板在切换界面时会被整块卸载，组件内 state 随之丢失（表现为「重新进入又回到默认值」），
 * 因此少量偏好写进 localStorage，重新进入时恢复上次选择。
 */

import { TIME_RANGES, type TimeRange } from './derived'

const RANGE_KEY = 'dsh-metrics.range'
const REFRESH_KEY = 'dsh-metrics.refresh-interval'

const DEFAULT_RANGE: TimeRange = 'all'
const DEFAULT_REFRESH_INTERVAL = 30_000

/** 自动刷新间隔候选值（毫秒，0 表示关闭）；顺序即界面排列顺序，也是持久化白名单。 */
export const REFRESH_INTERVALS: readonly number[] = [10_000, 30_000, 60_000, 0]

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    // 隐私模式等场景下访问 localStorage 会抛错，此时退化为不持久化
    return null
  }
}

function readRaw(key: string): string | null {
  return storage()?.getItem(key) ?? null
}

function writeRaw(key: string, value: string): void {
  storage()?.setItem(key, value)
}

/** 只接受白名单内的值，历史版本或手改过的脏数据一律回退到默认值。 */
export function parseTimeRange(raw: string | null | undefined): TimeRange | null {
  if (!raw) return null
  return (TIME_RANGES as readonly string[]).includes(raw) ? (raw as TimeRange) : null
}

export function parseRefreshInterval(raw: string | null | undefined): number | null {
  if (!raw) return null
  const value = Number(raw)
  return REFRESH_INTERVALS.includes(value) ? value : null
}

export function loadTimeRange(): TimeRange {
  return parseTimeRange(readRaw(RANGE_KEY)) ?? DEFAULT_RANGE
}

export function saveTimeRange(range: TimeRange): void {
  writeRaw(RANGE_KEY, range)
}

export function loadRefreshInterval(): number {
  return parseRefreshInterval(readRaw(REFRESH_KEY)) ?? DEFAULT_REFRESH_INTERVAL
}

export function saveRefreshInterval(interval: number): void {
  writeRaw(REFRESH_KEY, String(interval))
}
