/**
 * 面板派生统计：按时间范围聚合、高峰时段推断、Token 构成拆分。
 *
 * 这些计算同时被总览卡片与活跃度热力图使用，集中在此以保证两者口径一致。
 */

import type { MetricsSnapshot } from '../shared/types'
import { cacheHitRate, emptyCounters, mergeCounters } from '../shared/utils'
import { dayKey } from '../shared/utils'

export type TimeRange = 'all' | '30d' | '7d'

const DAY_MS = 86_400_000
/** 「全部」范围下热力图至少铺满的周长，避免数据稀疏时网格塌缩成一列。 */
const MIN_ALL_SPAN_DAYS = 168

export interface RangeStats {
  totalTokens: number
  calls: number
  activeDays: number
  sessionCount: number
  cacheHitRate: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}

export interface CompositionPart {
  key: 'input' | 'output' | 'cacheRead' | 'cacheWrite'
  value: number
}

/** 生成覆盖该范围的日期序列（升序，最后一项为今天）。 */
export function rangeDayKeys(snapshot: MetricsSnapshot, range: TimeRange, now = Date.now()): string[] {
  const today = dayKey(now)
  if (range !== 'all') {
    const span = range === '7d' ? 7 : 30
    return Array.from({ length: span }, (_, i) => dayKey(now - (span - 1 - i) * DAY_MS))
  }

  const known = Object.keys(snapshot.byDay).sort()
  const earliest = known[0] ?? today
  const elapsed = Math.ceil((now - new Date(`${earliest}T00:00:00`).getTime()) / DAY_MS)
  const span = Math.max(MIN_ALL_SPAN_DAYS, Number.isFinite(elapsed) ? elapsed : MIN_ALL_SPAN_DAYS)
  return Array.from({ length: span }, (_, i) => dayKey(now - (span - 1 - i) * DAY_MS))
}

/** 按范围汇总；「全部」直接取已算好的全局总计，避免重复累加。 */
export function computeRangeStats(
  snapshot: MetricsSnapshot,
  range: TimeRange,
  now = Date.now(),
): RangeStats {
  if (range === 'all') {
    const all = snapshot.totals.all
    return {
      totalTokens: all.totalTokens,
      calls: all.calls,
      activeDays: Object.values(snapshot.byDay).filter(day => (day.totalTokens ?? 0) > 0).length,
      sessionCount: snapshot.sessionCount,
      cacheHitRate: all.cacheHitRate,
      inputTokens: all.inputTokens,
      outputTokens: all.outputTokens,
      cacheReadTokens: all.cacheReadTokens,
      cacheWriteTokens: all.cacheWriteTokens,
    }
  }

  const acc = emptyCounters()
  let activeDays = 0
  for (const day of rangeDayKeys(snapshot, range, now)) {
    const counters = snapshot.byDay[day]
    if (!counters) continue
    mergeCounters(acc, counters)
    if ((counters.totalTokens ?? 0) > 0) activeDays += 1
  }

  const cutoff = now - (range === '7d' ? 7 : 30) * DAY_MS
  let sessionCount = 0
  for (const session of Object.values(snapshot.bySession)) {
    if ((session.lastAt ?? 0) >= cutoff || (session.firstAt ?? 0) >= cutoff) {
      sessionCount += 1
    }
  }

  return {
    totalTokens: acc.totalTokens,
    calls: acc.calls,
    activeDays,
    sessionCount,
    cacheHitRate: cacheHitRate(acc),
    inputTokens: acc.inputTokens,
    outputTokens: acc.outputTokens,
    cacheReadTokens: acc.cacheReadTokens,
    cacheWriteTokens: acc.cacheWriteTokens,
  }
}

/**
 * 推断调用最密集的小时。
 *
 * 优先使用小时级分布；历史账本没有该字段时，退回按会话时间戳加权推断。
 */
export function peakHour(snapshot: MetricsSnapshot): number | null {
  let best: number | null = null
  let bestCalls = 0

  for (const [rawHour, counters] of Object.entries(snapshot.byHour ?? {})) {
    const hour = Number(rawHour)
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) continue
    const calls = counters.calls ?? 0
    if (calls > bestCalls) {
      bestCalls = calls
      best = hour
    }
  }
  if (best !== null) return best

  const bySessionHour = new Map<number, number>()
  for (const session of Object.values(snapshot.bySession)) {
    const at = session.lastAt || session.firstAt
    if (!at) continue
    const hour = new Date(at).getHours()
    bySessionHour.set(hour, (bySessionHour.get(hour) ?? 0) + (session.counters?.calls ?? 1))
  }
  for (const [hour, calls] of bySessionHour) {
    if (calls > bestCalls) {
      bestCalls = calls
      best = hour
    }
  }
  return best
}

/** 24 小时制显示，避免依赖具体语言的分时段措辞。 */
export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`
}

/** Token 构成：四项之和即 totalTokens（totalTokens 由上游缺失时按此四项求和得出）。 */
export function compositionParts(stats: RangeStats): CompositionPart[] {
  return [
    { key: 'input', value: stats.inputTokens },
    { key: 'output', value: stats.outputTokens },
    { key: 'cacheRead', value: stats.cacheReadTokens },
    { key: 'cacheWrite', value: stats.cacheWriteTokens },
  ]
}

export interface RhythmStats {
  /** 活跃日均用量；无活跃日时为 0。 */
  avgPerActiveDay: number
  peakDay: { day: string; tokens: number } | null
  /** 最长连续活跃天数。 */
  longestStreak: number
}

/** 使用节奏洞察：补充热力图之外的聚合结论，避免卡片右侧留白。 */
export function computeRhythm(snapshot: MetricsSnapshot, days: string[]): RhythmStats {
  let activeDays = 0
  let total = 0
  let peakDay: RhythmStats['peakDay'] = null
  let longestStreak = 0
  let currentStreak = 0

  for (const day of days) {
    const tokens = snapshot.byDay[day]?.totalTokens ?? 0
    if (tokens > 0) {
      activeDays += 1
      total += tokens
      currentStreak += 1
      if (currentStreak > longestStreak) longestStreak = currentStreak
      if (peakDay === null || tokens > peakDay.tokens) peakDay = { day, tokens }
    } else {
      currentStreak = 0
    }
  }

  return {
    avgPerActiveDay: activeDays > 0 ? Math.round(total / activeDays) : 0,
    peakDay,
    longestStreak,
  }
}
