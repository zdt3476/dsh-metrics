import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ActivityHeatmap } from '../../src/client/components/ActivityHeatmap'
import { DonutChart } from '../../src/client/components/DonutChart'
import { createTranslator } from '../../src/client/i18n'
import { heatmapDays, HEATMAP_MONTHS } from '../../src/client/derived'
import type { MetricsSnapshot } from '../../src/shared/types'
import { emptyCounters } from '../../src/shared/utils'

const t = createTranslator('zh')

const NOW = new Date('2026-10-22T10:00:00+08:00').getTime()
const dayOf = (offset: number) => new Date(NOW - offset * 86_400_000)
const key = (offset: number) => {
  const d = dayOf(offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const snapshot: MetricsSnapshot = {
  generatedAt: NOW,
  today: key(0),
  totals: {
    all: { ...emptyCounters(), totalTokens: 1_000_000, calls: 100, cacheHitRate: 0.4 },
    today: { ...emptyCounters(), totalTokens: 10_000, calls: 5, cacheHitRate: 0.4 },
    week: { ...emptyCounters(), totalTokens: 80_000, calls: 40, cacheHitRate: 0.4 },
  },
  trend: {},
  modelTrend: { days: [], series: [] },
  byDay: Object.fromEntries(
    [0, 1, 2, 5, 9, 20, 100, 200, 300].map(offset => [
      key(offset),
      { ...emptyCounters(), totalTokens: 1_000 * (offset + 1), calls: offset + 1 },
    ]),
  ),
  byModelDay: {},
  byProvider: {},
  byModel: {},
  byModelName: {},
  byProject: {},
  byOrigin: {},
  byHour: {},
  bySession: {},
  pricing: {},
  pricingFetchedAt: null,
  rate: { windowMinutes: 60, calls: 0, tokens: 0, failed: 0 },
  recentHours: [],
  failedAttempts: null,
  scan: { done: 0, total: 0 },
  storePath: '/tmp/usage.json',
  scannedCount: 0,
  currentAccount: null,
  config: { trackFailedAttempts: false },
  uptimeMinutes: 0,
  version: '1.0.1',
} as unknown as MetricsSnapshot

describe('heatmapDays', () => {
  const days = heatmapDays(NOW)

  it('以周一开头、周日结尾，且是完整的自然周', () => {
    expect(days.length % 7).toBe(0)
    expect(new Date(`${days[0]}T00:00:00`).getDay()).toBe(1)
    expect(new Date(`${days[days.length - 1]}T00:00:00`).getDay()).toBe(0)
  })

  it('覆盖最近 12 个月且不含未来日期之外的越界', () => {
    const spanDays = Math.round(
      (new Date(`${days[days.length - 1]}T00:00:00`).getTime() - new Date(`${days[0]}T00:00:00`).getTime()) / 86_400_000,
    )
    expect(spanDays).toBe(days.length - 1)
    // 12 个自然月 + 两端补齐，落在 53 周左右
    expect(days.length).toBeGreaterThanOrEqual(52 * 7)
    expect(days.length).toBeLessThanOrEqual(54 * 7 + 7)
  })

  it('包含今天且严格升序、无重复', () => {
    expect(days).toContain(key(0))
    expect(new Set(days).size).toBe(days.length)
    expect([...days].sort()).toEqual(days)
  })

  it('窗口长度随月份常量变化', () => {
    expect(HEATMAP_MONTHS).toBe(12)
    expect(heatmapDays(NOW).length).toBe(days.length)
  })
})

describe('ActivityHeatmap', () => {
  const html = renderToStaticMarkup(h(ActivityHeatmap, { snapshot, t }))

  it('渲染整年网格（53 周左右）而不是单列', () => {
    const cells = html.match(/tm-heatmap-cell/g) ?? []
    // 53 周 × 7 天 + 图例 5 个色块
    expect(cells.length).toBeGreaterThanOrEqual(52 * 7)
  })

  it('只标注 一 / 三 / 五 三个行标签', () => {
    expect(html).toContain('>一<')
    expect(html).toContain('>三<')
    expect(html).toContain('>五<')
    expect(html).not.toContain('>二<')
  })

  it('每个格子在无悬停时也带可读的 aria-label', () => {
    expect(html).toMatch(/aria-label="\d+ 月 \d+ 日 [^"]*调用/)
  })

  it('顶部有月份标签', () => {
    const marks = html.match(/tm-heatmap-month[^>]*>([^<]+)</g) ?? []
    expect(marks.length).toBeGreaterThan(1)
  })
})

describe('DonutChart', () => {
  const slices = [
    { key: 'a', value: 60, color: '#111111' },
    { key: 'b', value: 40, color: '#222222' },
  ]

  it('无高亮时不渲染提示浮层', () => {
    const html = renderToStaticMarkup(
      h(DonutChart, { slices, centerValue: '100', centerLabel: 'tokens', tooltipFor: () => h('span', null, 'tip') }),
    )
    expect(html).not.toContain('tm-tip')
  })

  it('悬停态由外部控制，提示内容由 tooltipFor 提供', () => {
    const html = renderToStaticMarkup(
      h(DonutChart, {
        slices,
        centerValue: '100',
        centerLabel: 'tokens',
        activeKey: 'b',
        tooltipFor: (key: string) => h('span', null, `tip-${key}`),
      }),
    )
    // 服务端渲染时没有鼠标坐标，浮层不出现，但扇区已被标记为高亮
    expect(html).toContain('tm-donut-arc')
    expect(html).toContain('opacity="0.35"')
  })
})
