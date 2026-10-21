import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { UsageRanking } from '../../src/client/components/UsageRanking'
import { TrendChart } from '../../src/client/components/TrendChart'
import { UsageSummary } from '../../src/client/components/UsageSummary'
import { createTranslator } from '../../src/client/i18n'
import type { MetricsSnapshot } from '../../src/shared/types'
import { emptyCounters } from '../../src/shared/utils'

const today = Date.now()
const dayOf = (offset: number) => new Date(today - offset * 86_400_000)
const key = (offset: number) => {
  const d = dayOf(offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const counters = (totalTokens: number, calls: number, cacheRead = 0) => ({
  ...emptyCounters(),
  totalTokens,
  calls,
  cacheReadTokens: cacheRead,
  inputTokens: totalTokens - cacheRead,
})

const snapshot: MetricsSnapshot = {
  generatedAt: today,
  today: key(0),
  totals: {
    all: { ...counters(4_300_000, 25_210, 3_000_000), cacheHitRate: 0.45 },
    today: { ...counters(120_000, 500), cacheHitRate: 0.5 },
    week: { ...counters(800_000, 3_000), cacheHitRate: 0.4 },
  },
  trend: {
    [key(2)]: { ...counters(200_000, 1_000, 120_000), cacheHitRate: 0.4 },
    [key(1)]: { ...counters(300_000, 1_500, 200_000), cacheHitRate: 0.5 },
    [key(0)]: { ...counters(120_000, 500, 80_000), cacheHitRate: 0.45 },
  },
  config: {
    trackFailedAttempts: false,
    snapshotCacheMs: 3000,
    retentionDays: 400,
    maxTrendSeries: 6,
  },
  byDay: {
    [key(2)]: counters(200_000, 1_000, 120_000),
    [key(1)]: counters(300_000, 1_500, 200_000),
    [key(0)]: counters(120_000, 500, 80_000),
  },
  byHour: {
    17: counters(150_000, 800),
    10: counters(50_000, 300),
  },
  pricing: {
    'deepseek-v4-1': { input: 0.0000003, output: 0.0000012, cacheRead: 0.000000006, cacheWrite: 0.0000003, reasoning: 0.0000012 },
  },
  pricingFetchedAt: today,
  rate: { windowMinutes: 60, calls: 120, tokens: 900_000 },
  byModelDay: {
    'deepseek-v4.1': {
      [key(0)]: { ...counters(100_000, 400, 60_000), cacheHitRate: 0.5 },
    },
  },
  modelTrend: {
    days: [key(2), key(1), key(0)],
    series: [
      {
        key: 'deepseek-v4.1',
        label: 'deepseek-v4.1',
        values: { [key(2)]: 100_000, [key(1)]: 200_000, [key(0)]: 100_000 },
      },
    ],
  },
  byProvider: { deepseek: counters(4_300_000, 25_210, 3_000_000) },
  byModel: { 'deepseek/deepseek-v4.1': counters(4_300_000, 25_210, 3_000_000) },
  byModelName: { 'deepseek-v4.1': { ...counters(4_300_000, 25_210), cacheHitRate: 0.45 } },
  byProject: {},
  byOrigin: {},
  failedAttempts: null,
  accounts: {},
  currentAccount: null,
  bySession: {
    'sess-1': {
      id: 'sess-1',
      title: '重构用量看板',
      provider: 'deepseek',
      model: 'deepseek-v4.1',
      firstAt: today - 3_600_000,
      lastAt: today,
      counters: counters(50_000, 12),
    },
  },
  sessionCount: 323,
  scannedCount: 323,
  scan: { active: false, done: 0, total: 0, startedAt: 0, finishedAt: 0 },
  buildId: 'test-build',
  integrity: { seenKeys: 25_210, totalCalls: 25_210, consistent: true },
  storePath: '/tmp/usage.json',
  repositoryUrl: 'https://github.com/zdt3476/dsh-metrics',
}

describe('UsageSummary', () => {
  const zh = createTranslator('zh')

  it('renders the two primary tiles and four rate tiles', () => {
    const html = renderToStaticMarkup(
      h(UsageSummary, { snapshot, range: 'all' as const, onRangeChange: () => {}, t: zh }),
    )

    expect(html).toContain('总览')
    // 两张主卡：请求总数 / Token 总数
    expect(html).toContain('4.3M')
    expect(html).toContain('请求总数')
    expect(html).toContain('Token 总数')
    expect(html).toContain('25,210')
    expect(html).toContain('45.0%')
    // 四张速率卡
    expect(html).toContain('RPM')
    expect(html).toContain('TPM')
    expect(html).toContain('成本')
  })

  it('renders token composition inline on the token tile', () => {
    const html = renderToStaticMarkup(
      h(UsageSummary, { snapshot, range: 'all' as const, onRangeChange: () => {}, t: zh }),
    )
    expect(html).toContain('命中')
    expect(html).toContain('思考')
  })

  it('renders sparklines for metrics that have a daily series', () => {
    const html = renderToStaticMarkup(
      h(UsageSummary, { snapshot, range: 'all' as const, onRangeChange: () => {}, t: zh }),
    )
    // 六张卡都挂了日级序列
    expect(html.match(/class="tm-spark"/g)?.length).toBe(6)
  })

  it('exposes the range switch as the single source of range', () => {
    const html = renderToStaticMarkup(
      h(UsageSummary, { snapshot, range: '7d' as const, onRangeChange: () => {}, t: zh }),
    )
    expect(html).toContain('tm-range-group')
    expect(html).toContain('tm-range-btn active')
    expect(html).toContain('aria-pressed')
  })
})

describe('UsageRanking', () => {
  const zh = createTranslator('zh')

  it('renders a donut with a legend list and a metric switch', () => {
    const html = renderToStaticMarkup(h(UsageRanking, { snapshot, t: zh }))

    expect(html).toContain('模型用量')
    expect(html).toContain('tm-donut')
    expect(html).toContain('tm-model-legend')

    // 口径切换：按调用 / 按用量
    expect(html).toContain('按调用')
    expect(html).toContain('按用量')

    // 列表展示模型名与占比
    expect(html).toContain('deepseek-v4.1')
    expect(html).toContain('%')
  })
})

describe('TrendChart', () => {
  const zh = createTranslator('zh')

  it('renders a single multi-model line chart with legend', () => {
    const html = renderToStaticMarkup(
      h(TrendChart, { trend: snapshot.trend, modelTrend: snapshot.modelTrend, t: zh }),
    )
    expect(html).toContain('tm-trend')
    expect(html).toContain('tm-trend-svg')
    expect(html).toContain('tm-trend-legend')
  })
})
