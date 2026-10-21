import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ActivityHeatmap } from '../../src/client/components/ActivityHeatmap'
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

  it('renders aggregated metrics only once each', () => {
    const html = renderToStaticMarkup(
      h(UsageSummary, { snapshot, range: 'all' as const, onRangeChange: () => {}, t: zh }),
    )

    expect(html).toContain('总览')
    expect(html).toContain('Token 总量')
    // 全局总计取 totals.all，按 formatTokens 渲染
    expect(html).toContain('4.3M')
    // 缓存率、调用次数、会话数、活跃天数、高峰时段各出现一次
    expect(html).toContain('45.0%')
    expect(html).toContain('25,210')
    expect(html).toContain('323')
    expect(html).toContain('17:00')
    // 今日 / 本周并列在同一主指标下
    expect(html).toContain('今日')
    expect(html).toContain('本周')
  })

  it('renders the token composition bar and legend', () => {
    const html = renderToStaticMarkup(
      h(UsageSummary, { snapshot, range: 'all' as const, onRangeChange: () => {}, t: zh }),
    )
    expect(html).toContain('Token 构成')
    expect(html).toContain('tm-composition-bar')
    expect(html).toContain('seg-cacheRead')
    expect(html).toContain('seg-input')
  })

  it('renders sparklines for metrics that have a daily series', () => {
    const html = renderToStaticMarkup(
      h(UsageSummary, { snapshot, range: 'all' as const, onRangeChange: () => {}, t: zh }),
    )
    // 主指标 + 缓存率 + 调用均有日级序列，其余无序列的格子不画
    expect(html.match(/class="tm-spark"/g)?.length).toBe(3)
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

describe('ActivityHeatmap', () => {
  const zh = createTranslator('zh')

  it('renders heatmap cells and the localized metaphor line', () => {
    const html = renderToStaticMarkup(
      h(ActivityHeatmap, { snapshot, range: '7d' as const, t: zh }),
    )
    expect(html).toContain('活跃度')
    expect(html).toContain('tm-heatmap-grid')
    // 7 天范围正好一列 7 格
    expect(html.match(/tm-heatmap-cell level-/g)?.length ?? 0).toBeGreaterThanOrEqual(7)
    // 趣味换算使用模板本地化，而非硬编码中文
    expect(html).toContain('你的 Token 用量相当于')
    expect(html).toContain('活着')
  })

  it('localizes the metaphor for english', () => {
    const en = createTranslator('en')
    const html = renderToStaticMarkup(h(ActivityHeatmap, { snapshot, range: '7d' as const, t: en }))
    expect(html).toContain('Your token usage equals')
    expect(html).toContain('To Live')
    expect(html).not.toContain('你的 Token 用量相当于')
  })
})

describe('UsageRanking', () => {
  const zh = createTranslator('zh')

  it('renders a data-bar leaderboard with four dimensions and sort switch', () => {
    const html = renderToStaticMarkup(h(UsageRanking, { snapshot, t: zh }))

    expect(html).toContain('按模型')
    expect(html).toContain('按供应商')
    expect(html).toContain('按项目')
    expect(html).toContain('按会话')
    expect(html).not.toContain('按来源')
    expect(html).not.toContain('按账号')

    // 排序不再是点表头，而是工具栏三档切换
    expect(html).toContain('tm-sort-group')
    expect(html).toContain('按用量')
    expect(html).toContain('按调用')
    expect(html).toContain('按缓存率')

    // 占比以整行背景条表达，并带百分比数值
    expect(html).toContain('tm-rank-bar')
    expect(html).toContain('tm-rank-share')
    expect(html).toContain('aria-expanded')

    // 明细默认收起，不占常驻列宽
    expect(html).not.toContain('tm-rank-detail')
  })
})

describe('TrendChart', () => {
  const zh = createTranslator('zh')

  it('renders the adaptive wrapper', () => {
    const html = renderToStaticMarkup(
      h(TrendChart, { trend: snapshot.trend, modelTrend: snapshot.modelTrend, t: zh }),
    )
    expect(html).toContain('tm-charts-adaptive-wrap')
    expect(html).toContain('tm-chart-card')
  })
})
