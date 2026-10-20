import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BreakdownTable } from '../../src/client/components/BreakdownTable'
import { OverviewHeatmapCard } from '../../src/client/components/OverviewHeatmapCard'
import { TrendChart } from '../../src/client/components/TrendChart'
import { DICT_ZH } from '../../src/client/i18n'
import type { MetricsSnapshot } from '../../src/shared/types'
import { emptyCounters } from '../../src/shared/utils'

const mockSnapshot: MetricsSnapshot = {
  generatedAt: Date.now(),
  today: '2026-10-20',
  totals: {
    all: { ...emptyCounters(), totalTokens: 4_300_000, calls: 25_210, cacheHitRate: 0.45 },
    today: { ...emptyCounters(), totalTokens: 120_000, calls: 500, cacheHitRate: 0.5 },
    week: { ...emptyCounters(), totalTokens: 800_000, calls: 3000, cacheHitRate: 0.4 },
  },
  trend: {
    '2026-10-18': { ...emptyCounters(), totalTokens: 200_000, calls: 1000, cacheHitRate: 0.4 },
    '2026-10-19': { ...emptyCounters(), totalTokens: 300_000, calls: 1500, cacheHitRate: 0.5 },
    '2026-10-20': { ...emptyCounters(), totalTokens: 120_000, calls: 500, cacheHitRate: 0.45 },
  },
  config: {
    trackFailedAttempts: false,
    snapshotCacheMs: 3000,
    retentionDays: 400,
    maxTrendSeries: 6,
  },
  byDay: {
    '2026-10-18': { ...emptyCounters(), totalTokens: 200_000, calls: 1000 },
    '2026-10-19': { ...emptyCounters(), totalTokens: 300_000, calls: 1500 },
    '2026-10-20': { ...emptyCounters(), totalTokens: 120_000, calls: 500 },
  },
  byHour: {
    17: { ...emptyCounters(), calls: 800, totalTokens: 150_000 },
    10: { ...emptyCounters(), calls: 300, totalTokens: 50_000 },
  },
  byModelDay: {
    'deepseek-v4.1': {
      '2026-10-20': { ...emptyCounters(), totalTokens: 100_000, calls: 400, cacheHitRate: 0.5 },
    },
  },
  modelTrend: {
    days: ['2026-10-18', '2026-10-19', '2026-10-20'],
    series: [
      { key: 'deepseek-v4.1', label: 'deepseek-v4.1', values: { '2026-10-18': 100_000, '2026-10-19': 200_000, '2026-10-20': 100_000 } },
    ],
  },
  byProvider: { deepseek: { ...emptyCounters(), totalTokens: 4_300_000 } },
  byModel: { 'deepseek/deepseek-v4.1': { ...emptyCounters(), totalTokens: 4_300_000 } },
  byModelName: { 'deepseek-v4.1': { ...emptyCounters(), totalTokens: 4_300_000, cacheHitRate: 0.45 } },
  byProject: {},
  byOrigin: {},
  failedAttempts: null,
  accounts: {},
  currentAccount: null,
  bySession: {
    'sess-1': {
      id: 'sess-1',
      title: '优化 Token 指标',
      provider: 'deepseek',
      model: 'deepseek-v4.1',
      lastAt: Date.now(),
      counters: { ...emptyCounters(), totalTokens: 50000, calls: 12 },
    },
  },
  sessionCount: 309,
  scannedCount: 309,
  scan: { active: false, done: 0, total: 0, startedAt: 0, finishedAt: 0 },
  buildId: 'test-build',
  integrity: { seenKeys: 25210, totalCalls: 25210, consistent: true },
  storePath: '/path/to/store',
  repositoryUrl: 'https://github.com/zdt3476/dsh-metrics',
}

const t = (k: string) => DICT_ZH[k] ?? k

describe('OverviewHeatmapCard component', () => {
  it('renders 6 summary statistics cards and metaphor text', () => {
    const html = renderToStaticMarkup(h(OverviewHeatmapCard, { snapshot: mockSnapshot, t }))
    // 会话数
    expect(html).toContain('会话数')
    expect(html).toContain('309')
    // 消息数
    expect(html).toContain('消息数')
    expect(html).toContain('25,210')
    // Token 总量
    expect(html).toContain('Token 总量')
    expect(html).toContain('4.3M')
    // 高峰时段（17 点 -> 下午 5 点）
    expect(html).toContain('高峰时段')
    expect(html).toContain('下午 5 点')
    // 最常用模型
    expect(html).toContain('最常用模型')
    expect(html).toContain('deepseek-v4.1')
    // 热力图容器
    expect(html).toContain('tm-heatmap-matrix')
    // 书籍换算文案
    expect(html).toContain('你的 Token 用量相当于')
    expect(html).toContain('《活着》')
  })
})

describe('BreakdownTable component tabs', () => {
  it('includes session tab and excludes origin and account tabs', () => {
    const html = renderToStaticMarkup(h(BreakdownTable, { snapshot: mockSnapshot, t }))
    expect(html).toContain('按模型')
    expect(html).toContain('按供应商')
    expect(html).toContain('按项目')
    expect(html).toContain('按会话')
    expect(html).not.toContain('按来源')
    expect(html).not.toContain('按账号')
  })
})

describe('TrendChart component adaptive layout', () => {
  it('renders adaptive wrap and trend paths', () => {
    const html = renderToStaticMarkup(
      h(TrendChart, {
        trend: mockSnapshot.trend,
        modelTrend: mockSnapshot.modelTrend,
        t,
      }),
    )
    expect(html).toContain('tm-charts-adaptive-wrap')
    expect(html).toContain('tm-chart-card')
  })
})
