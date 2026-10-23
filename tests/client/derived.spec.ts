import { describe, expect, it } from 'vitest'
import { colorForName, MODEL_PALETTE } from '../../src/client/colors'
import {
  computeRangeStats,
  computeRhythm,
  costByModelKey,
  formatHour,
  groupCounters,
  peakHour,
  rangeDayKeys,
  rangeModelKeyCounters,
  relativeTime,
} from '../../src/client/derived'
import type { MetricsSnapshot } from '../../src/shared/types'
import { emptyCounters } from '../../src/shared/utils'

const NOW = new Date('2026-10-21T12:00:00+08:00').getTime()
const DAY = 86_400_000
const dayKeyOf = (offset: number) => {
  const d = new Date(NOW - offset * DAY)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const counters = (totalTokens: number, calls: number, cacheRead = 0) => ({
  ...emptyCounters(),
  totalTokens,
  calls,
  cacheReadTokens: cacheRead,
  inputTokens: Math.max(0, totalTokens - cacheRead),
})

function makeSnapshot(partial: Partial<MetricsSnapshot> = {}): MetricsSnapshot {
  return {
    generatedAt: NOW,
    today: dayKeyOf(0),
    totals: {
      all: { ...counters(4_300_000, 25_210, 3_000_000), cacheHitRate: 0.45 },
      today: { ...counters(120_000, 500), cacheHitRate: 0.5 },
      week: { ...counters(800_000, 3_000), cacheHitRate: 0.4 },
    },
    trend: {},
    config: { trackFailedAttempts: false, snapshotCacheMs: 3000, retentionDays: 400, maxTrendSeries: 6 },
    byDay: {},
    byHour: {},
    pricing: {},
    pricingFetchedAt: null,
    rate: { windowMinutes: 60, calls: 0, tokens: 0 },
    recentHours: [],
    byModelDay: {},
    modelTrend: { days: [], series: [] },
    byProvider: {},
    byModel: {},
    byModelName: {},
    byProject: {},
    byOrigin: {},
    failedAttempts: null,
    accounts: {},
    currentAccount: null,
    bySession: {},
    sessionCount: 0,
    scannedCount: 0,
    scan: { active: false, done: 0, total: 0, startedAt: 0, finishedAt: 0 },
    buildId: 'test',
    integrity: { seenKeys: 0, totalCalls: 0, consistent: true },
    storePath: '/tmp/usage.json',
    repositoryUrl: 'https://github.com/zdt3476/dsh-metrics',
    ...partial,
  }
}

describe('rangeDayKeys', () => {
  it('produces exact day counts for scoped ranges', () => {
    const snapshot = makeSnapshot()
    expect(rangeDayKeys(snapshot, '7d', NOW)).toHaveLength(7)
    expect(rangeDayKeys(snapshot, '30d', NOW)).toHaveLength(30)
    expect(rangeDayKeys(snapshot, '7d', NOW).at(-1)).toBe(dayKeyOf(0))
  })

  it('pads the all-time range to at least 24 weeks', () => {
    const snapshot = makeSnapshot({ byDay: { [dayKeyOf(1)]: counters(1000, 2) } })
    expect(rangeDayKeys(snapshot, 'all', NOW).length).toBeGreaterThanOrEqual(168)
  })

  it('still pads the all-time range when history is empty', () => {
    expect(rangeDayKeys(makeSnapshot(), 'all', NOW).length).toBeGreaterThanOrEqual(168)
  })
})

describe('computeRangeStats', () => {
  const snapshot = makeSnapshot({
    byDay: {
      [dayKeyOf(0)]: counters(100_000, 10, 60_000),
      [dayKeyOf(1)]: counters(50_000, 5, 20_000),
      [dayKeyOf(20)]: counters(70_000, 7, 10_000),
    },
    bySession: {
      a: { id: 'a', title: 'A', provider: 'p', model: 'm', firstAt: NOW - DAY, lastAt: NOW, counters: counters(1, 1) },
      b: { id: 'b', title: 'B', provider: 'p', model: 'm', firstAt: NOW - 40 * DAY, lastAt: NOW - 40 * DAY, counters: counters(1, 1) },
    },
    sessionCount: 2,
  })

  it('uses pre-computed totals for the all range', () => {
    const stats = computeRangeStats(snapshot, 'all', NOW)
    expect(stats.totalTokens).toBe(4_300_000)
    expect(stats.calls).toBe(25_210)
    expect(stats.sessionCount).toBe(2)
    expect(stats.activeDays).toBe(3)
  })

  it('recomputes scoped ranges from the day buckets', () => {
    const week = computeRangeStats(snapshot, '7d', NOW)
    expect(week.totalTokens).toBe(150_000)
    expect(week.calls).toBe(15)
    expect(week.activeDays).toBe(2)
    // 只有 7 天内活跃过的会话计入
    expect(week.sessionCount).toBe(1)

    const month = computeRangeStats(snapshot, '30d', NOW)
    expect(month.totalTokens).toBe(220_000)
    expect(month.sessionCount).toBe(1)
  })
})

describe('peakHour', () => {
  it('prefers the hourly distribution', () => {
    const snapshot = makeSnapshot({
      byHour: { 9: counters(1000, 3), 17: counters(2000, 40) },
    })
    expect(peakHour(snapshot)).toBe(17)
  })

  it('falls back to session timestamps when hourly data is missing', () => {
    // 用本地时间构造，避免 CI（UTC）与本地时区解析结果不同
    const at = new Date(2026, 9, 20, 21, 30, 0).getTime()
    const snapshot = makeSnapshot({
      bySession: {
        a: { id: 'a', title: 'A', provider: 'p', model: 'm', firstAt: at, lastAt: at, counters: counters(1, 5) },
      },
    })
    expect(peakHour(snapshot)).toBe(21)
  })

  it('returns null when there is no signal at all', () => {
    expect(peakHour(makeSnapshot())).toBeNull()
  })
})

describe('formatHour', () => {
  it('formats as 24h clock', () => {
    expect(formatHour(0)).toBe('00:00')
    expect(formatHour(17)).toBe('17:00')
  })
})

describe('computeRhythm', () => {
  it('reports average, peak day and longest streak', () => {
    const snapshot = makeSnapshot({
      byDay: {
        [dayKeyOf(3)]: counters(10_000, 1),
        [dayKeyOf(2)]: counters(30_000, 1),
        [dayKeyOf(1)]: counters(20_000, 1),
        [dayKeyOf(0)]: counters(5_000, 1),
      },
    })
    const rhythm = computeRhythm(snapshot, [dayKeyOf(4), dayKeyOf(3), dayKeyOf(2), dayKeyOf(1), dayKeyOf(0)])
    expect(rhythm.longestStreak).toBe(4)
    expect(rhythm.peakDay?.tokens).toBe(30_000)
    expect(rhythm.avgPerActiveDay).toBe(16_250)
  })

  it('breaks the streak on an idle day', () => {
    const snapshot = makeSnapshot({
      byDay: { [dayKeyOf(3)]: counters(1_000, 1), [dayKeyOf(1)]: counters(1_000, 1) },
    })
    const rhythm = computeRhythm(snapshot, [dayKeyOf(3), dayKeyOf(2), dayKeyOf(1)])
    expect(rhythm.longestStreak).toBe(1)
  })
})

describe('relativeTime', () => {
  it('buckets by minute, hour and day', () => {
    expect(relativeTime(NOW - 30_000, NOW)).toEqual({ unit: 'now', count: 0 })
    expect(relativeTime(NOW - 5 * 60_000, NOW)).toEqual({ unit: 'minute', count: 5 })
    expect(relativeTime(NOW - 3 * 3_600_000, NOW)).toEqual({ unit: 'hour', count: 3 })
    expect(relativeTime(NOW - 2 * DAY, NOW)).toEqual({ unit: 'day', count: 2 })
  })

  it('returns null for missing timestamps', () => {
    expect(relativeTime(undefined, NOW)).toBeNull()
    expect(relativeTime(0, NOW)).toBeNull()
  })
})

describe('colorForName', () => {
  it('is deterministic and stays inside the palette', () => {
    const first = colorForName('deepseek-v4.1-flash')
    expect(colorForName('deepseek-v4.1-flash')).toBe(first)
    expect(MODEL_PALETTE).toContain(first)
  })

  it('distinguishes common model names', () => {
    const names = ['deepseek-v4.1-flash', 'gemini-3.8-flash-high', 'gpt-6.1-sol']
    const colors = new Set(names.map(colorForName))
    expect(colors.size).toBeGreaterThan(1)
  })
})

describe('区间聚合（模型 / 供应商）', () => {
  const snapshot = makeSnapshot({
    byModelDay: {
      'provider-a/model-x': {
        [dayKeyOf(0)]: { ...counters(100, 10, 40), cacheHitRate: 0.4 },
        [dayKeyOf(1)]: { ...counters(200, 20, 80), cacheHitRate: 0.4 },
        [dayKeyOf(20)]: { ...counters(9_000, 900, 0), cacheHitRate: 0 },
      },
      'provider-b/model-x': {
        [dayKeyOf(0)]: { ...counters(300, 30, 0), cacheHitRate: 0 },
      },
      'provider-b/model-y': {
        [dayKeyOf(40)]: { ...counters(50_000, 5_000, 0), cacheHitRate: 0 },
      },
    },
    pricing: { 'model-x': { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, reasoning: 0 } },
  })

  it('7 天范围只统计区间内的天，不把更早的用量算进来', () => {
    const all = rangeModelKeyCounters(snapshot, 'all', NOW)
    const week = rangeModelKeyCounters(snapshot, '7d', NOW)
    expect(all.get('provider-a/model-x')?.totalTokens).toBe(9_300)
    // 20 天前与 40 天前的那两笔不应进入 7 天窗口
    expect(week.get('provider-a/model-x')?.totalTokens).toBe(300)
    expect(week.get('provider-b/model-y')).toBeUndefined()
  })

  it('模型名跨供应商合并，供应商维度各自独立', () => {
    const byKey = rangeModelKeyCounters(snapshot, '7d', NOW)
    const models = groupCounters(byKey, 'model')
    const providers = groupCounters(byKey, 'provider')

    expect(models.get('model-x')?.totalTokens).toBe(600)
    expect(models.get('model-x')?.calls).toBe(60)
    expect(providers.get('provider-a')?.totalTokens).toBe(300)
    expect(providers.get('provider-b')?.totalTokens).toBe(300)
    expect(providers.get('provider-b')?.calls).toBe(30)
  })

  it('成本按区间内用量计价，缺价格的键为 null', () => {
    const byKey = rangeModelKeyCounters(snapshot, '7d', NOW)
    const cost = costByModelKey(snapshot, byKey)
    // model-x 单价 1/1，输入 600-120 缓存 + 输出 0 → 以 counters 的 inputTokens 为准
    expect(cost.get('provider-a/model-x')).toBeGreaterThan(0)
    expect(cost.get('provider-b/model-y')).toBeUndefined()
  })

  it('24 小时走小时桶，同样保留供应商信息', () => {
    const hourNow = Math.floor(NOW / 3_600_000)
    const snap = makeSnapshot({
      recentHours: [
        { hour: hourNow, counters: counters(500, 5, 0), byModel: { 'provider-a/model-x': counters(500, 5, 0) } },
        { hour: hourNow - 30, counters: counters(9_999, 99, 0), byModel: { 'provider-a/model-z': counters(9_999, 99, 0) } },
      ],
    })
    const byKey = rangeModelKeyCounters(snap, '24h', NOW)
    expect(byKey.get('provider-a/model-x')?.totalTokens).toBe(500)
    // 30 小时前的桶在窗口外
    expect(byKey.get('provider-a/model-z')).toBeUndefined()
    expect(groupCounters(byKey, 'provider').get('provider-a')?.totalTokens).toBe(500)
  })
})
