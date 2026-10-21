import { describe, expect, it } from 'vitest'
import { costOf, modelNameCandidates, normalizeModelName, resolveModelKey } from '../../src/shared/utils'
import { computeRangeCost, dailyCostSeries } from '../../src/client/derived'
import type { MetricsSnapshot, ModelPrice } from '../../src/shared/types'
import { emptyCounters } from '../../src/shared/utils'

const PRICE: ModelPrice = {
  input: 0.000001,
  output: 0.000002,
  cacheRead: 0.0000001,
  cacheWrite: 0.000001,
  reasoning: 0.000002,
}

const counters = (input: number, output: number, cacheRead = 0) => ({
  ...emptyCounters(),
  inputTokens: input,
  outputTokens: output,
  cacheReadTokens: cacheRead,
  totalTokens: input + output + cacheRead,
  cacheHitRate: 0,
})

function makeSnapshot(overrides: Partial<MetricsSnapshot> = {}): MetricsSnapshot {
  return {
    generatedAt: 0,
    today: '2026-10-21',
    totals: {
      all: { ...emptyCounters(), cacheHitRate: 0 },
      today: { ...emptyCounters(), cacheHitRate: 0 },
      week: { ...emptyCounters(), cacheHitRate: 0 },
    },
    trend: {},
    config: { trackFailedAttempts: false, snapshotCacheMs: 0, retentionDays: 400, maxTrendSeries: 6 },
    byDay: {},
    byModelDay: {},
    modelTrend: { days: [], series: [] },
    byProvider: {},
    byModel: {},
    byModelName: {},
    byProject: {},
    byOrigin: {},
    pricing: {},
    pricingFetchedAt: null,
    rate: { windowMinutes: 60, calls: 0, tokens: 0 },
    recentHours: [],
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
    ...overrides,
  }
}

describe('normalizeModelName', () => {
  it('strips vendor prefix, variant suffix and date suffix', () => {
    expect(normalizeModelName('deepseek/deepseek-v4.1-flash-1017')).toBe('deepseek-v4-1-flash')
    expect(normalizeModelName('google/gemini-3.8-flash:batch')).toBe('gemini-3-8-flash')
    expect(normalizeModelName('Codex/gpt-6.1-sol')).toBe('gpt-6-1-sol')
    expect(normalizeModelName('  GEMINI-3.8-FLASH  ')).toBe('gemini-3-8-flash')
  })

  it('folds dots and underscores so 5.5 and 5-5 converge', () => {
    expect(normalizeModelName('anthropic/claude-opus-5.5')).toBe(normalizeModelName('claude-opus-5-5'))
    expect(normalizeModelName('a/b_model')).toBe('b-model')
  })
})

describe('modelNameCandidates', () => {
  it('progressively trims trailing qualifiers', () => {
    expect(modelNameCandidates('gemini-3-8-flash-high')).toEqual([
      'gemini-3-8-flash-high',
      'gemini-3-8-flash',
      'gemini-3-8',
      'gemini-3',
    ])
  })

  it('never trims down to a single segment', () => {
    expect(modelNameCandidates('solo')).toEqual(['solo'])
  })
})

describe('resolveModelKey', () => {
  const table = { 'gemini-3-8-flash': PRICE }

  it('falls back to the trimmed alias', () => {
    expect(resolveModelKey(table, 'gemini-3.8-flash-tiered')).toBe('gemini-3-8-flash')
  })

  it('returns null when nothing matches', () => {
    expect(resolveModelKey(table, 'totally-unknown-model')).toBeNull()
  })
})

describe('costOf', () => {
  it('prices each token class with its own rate', () => {
    const cost = costOf(
      { inputTokens: 1000, outputTokens: 500, cacheReadTokens: 10_000, cacheWriteTokens: 100, reasoningTokens: 200 },
      PRICE,
    )
    // 1000*1e-6 + 500*2e-6 + 10000*1e-7 + 100*1e-6 + 200*2e-6
    expect(cost).toBeCloseTo(0.001 + 0.001 + 0.001 + 0.0001 + 0.0004, 10)
  })

  it('treats missing counters as zero', () => {
    expect(costOf({}, PRICE)).toBe(0)
  })
})

describe('computeRangeCost', () => {
  it('sums per-model cost inside the range only', () => {
    const snapshot = makeSnapshot({
      pricing: { 'deepseek-v4-1': PRICE },
      byModelDay: {
        'deepseek-v4.1': {
          '2026-10-20': counters(1000, 1000),
          '2026-10-21': counters(2000, 2000),
          '2026-09-01': counters(999_999, 999_999),
        },
      },
    })

    const scoped = computeRangeCost(snapshot, ['2026-10-20', '2026-10-21'])
    // (3000*1e-6) + (3000*2e-6) = 0.009
    expect(scoped.total).toBeCloseTo(0.009, 10)
    expect(scoped.unavailable).toBe(false)
    expect(scoped.missing).toEqual([])
  })

  it('reports unpriced models instead of silently zeroing them', () => {
    const snapshot = makeSnapshot({
      pricing: {},
      byModelDay: { 'mystery-model': { '2026-10-21': counters(100, 100) } },
    })
    const result = computeRangeCost(snapshot, ['2026-10-21'])
    expect(result.total).toBe(0)
    expect(result.unavailable).toBe(true)
    expect(result.missing).toEqual(['mystery-model'])
  })

  it('matches prices through normalized model names', () => {
    const snapshot = makeSnapshot({
      pricing: { 'gpt-6-1-sol': PRICE },
      byModelDay: { 'Codex/gpt-6.1-sol': { '2026-10-21': counters(1000, 0) } },
    })
    expect(computeRangeCost(snapshot, ['2026-10-21']).total).toBeCloseTo(0.001, 10)
  })
})

describe('dailyCostSeries', () => {
  it('returns one value per requested day', () => {
    const snapshot = makeSnapshot({
      pricing: { 'deepseek-v4-1': PRICE },
      byModelDay: { 'deepseek-v4.1': { '2026-10-21': counters(1000, 0) } },
    })
    expect(dailyCostSeries(snapshot, ['2026-10-20', '2026-10-21'])).toEqual([0, 0.001])
  })
})
