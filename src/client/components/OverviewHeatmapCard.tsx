import { useMemo, useState, type FC } from 'react'
import { formatNumber, formatTokens } from '../../shared/format'
import type { MetricsSnapshot } from '../../shared/types'
import { dayKey } from '../../shared/utils'

export type TimeRange = 'all' | '30d' | '7d'
export type OverviewTab = 'overview' | 'model'

export interface OverviewHeatmapCardProps {
  snapshot: MetricsSnapshot
  t: (key: string, params?: Record<string, string | number>) => string
}

interface BookMetaphor {
  name: string
  tokensPerBook: number
}

const BOOKS: BookMetaphor[] = [
  { name: '《活着》', tokensPerBook: 120_000 },
  { name: '《三体》', tokensPerBook: 900_000 },
  { name: '《红楼梦》', tokensPerBook: 1_000_000 },
]

export const OverviewHeatmapCard: FC<OverviewHeatmapCardProps> = ({ snapshot, t }) => {
  const [activeTab, setActiveTab] = useState<OverviewTab>('overview')
  const [timeRange, setTimeRange] = useState<TimeRange>('all')
  const [bookIdx, setBookIdx] = useState(0)

  const now = Date.now()
  const todayStr = dayKey(now)

  // 1. 根据选中的时间范围计算涵盖的日期列表
  const rangeDays = useMemo(() => {
    if (timeRange === '7d') {
      const list: string[] = []
      for (let i = 6; i >= 0; i -= 1) {
        list.push(dayKey(now - i * 86_400_000))
      }
      return list
    }
    if (timeRange === '30d') {
      const list: string[] = []
      for (let i = 29; i >= 0; i -= 1) {
        list.push(dayKey(now - i * 86_400_000))
      }
      return list
    }
    // all: 全部有记录的日期，若过少至少给满 24 周（168天）以让宽屏热力图更饱满
    const allStoreDays = Object.keys(snapshot.byDay).sort()
    const earliestDay = allStoreDays[0] || todayStr
    const earliestTime = new Date(`${earliestDay}T00:00:00`).getTime()
    const daysSince = Math.max(168, Math.ceil((now - earliestTime) / 86_400_000))
    const list: string[] = []
    for (let i = daysSince - 1; i >= 0; i -= 1) {
      list.push(dayKey(now - i * 86_400_000))
    }
    return list
  }, [timeRange, now, snapshot.byDay, todayStr])

  // 2. 当前时间范围内的模型排行列表
  const currentRangeRanking = useMemo(() => {
    if (timeRange === 'all') {
      return Object.entries(snapshot.byModelName).map(([m, c]) => [m, c.totalTokens] as [string, number])
    }
    const modelMap = new Map<string, number>()
    for (const [model, dayRecord] of Object.entries(snapshot.byModelDay ?? {})) {
      let sum = 0
      for (const d of rangeDays) {
        sum += dayRecord[d]?.totalTokens ?? 0
      }
      if (sum > 0) {
        modelMap.set(model, sum)
      }
    }
    const list = [...modelMap.entries()].sort((a, b) => b[1] - a[1])
    if (list.length === 0) {
      return Object.entries(snapshot.byModelName).map(([m, c]) => [m, c.totalTokens] as [string, number])
    }
    return list
  }, [timeRange, snapshot.byModelName, snapshot.byModelDay, rangeDays])

  // 3. 统计时间范围内的 6 项关键指标
  const metrics = useMemo(() => {
    let totalTokens = 0
    let calls = 0
    let activeDays = 0

    for (const d of rangeDays) {
      const dayData = snapshot.byDay[d]
      if (dayData) {
        totalTokens += dayData.totalTokens || 0
        calls += dayData.calls || 0
        if (dayData.totalTokens > 0) activeDays += 1
      }
    }

    if (timeRange === 'all') {
      totalTokens = snapshot.totals.all.totalTokens
      calls = snapshot.totals.all.calls
      activeDays = Object.values(snapshot.byDay).filter(c => c.totalTokens > 0).length
    }

    // 会话数
    let sessionCount = snapshot.sessionCount
    if (timeRange !== 'all') {
      const minTime = now - (timeRange === '7d' ? 7 : 30) * 86_400_000
      let activeSessions = 0
      for (const sess of Object.values(snapshot.bySession)) {
        if ((sess.lastAt ?? 0) >= minTime || (sess.firstAt ?? 0) >= minTime) {
          activeSessions += 1
        }
      }
      sessionCount = activeSessions || (activeDays > 0 ? Math.min(snapshot.sessionCount, activeDays * 3) : 0)
    }

    // 高峰时段：优先 byHour，次之遍历 bySession
    let bestHour = -1
    let maxHourCalls = 0
    if (snapshot.byHour && Object.keys(snapshot.byHour).length > 0) {
      for (const [hStr, counters] of Object.entries(snapshot.byHour)) {
        const h = Number(hStr)
        if (counters.calls > maxHourCalls || (counters.calls === maxHourCalls && (counters.totalTokens ?? 0) > 0)) {
          maxHourCalls = counters.calls
          bestHour = h
        }
      }
    }
    if (bestHour === -1 && snapshot.bySession) {
      const hourCounts: Record<number, number> = {}
      for (const sess of Object.values(snapshot.bySession)) {
        const t1 = sess.lastAt || sess.firstAt
        if (t1) {
          const h = new Date(t1).getHours()
          hourCounts[h] = (hourCounts[h] ?? 0) + (sess.counters?.calls || 1)
        }
      }
      for (const [hStr, count] of Object.entries(hourCounts)) {
        if (count > maxHourCalls) {
          maxHourCalls = count
          bestHour = Number(hStr)
        }
      }
    }

    let peakHourStr = t('stat.peakHourNone')
    if (bestHour !== -1) {
      const isZh = t('overview.title') === '概览'
      if (!isZh) {
        const ampm = bestHour >= 12 ? 'PM' : 'AM'
        const h12 = bestHour % 12 === 0 ? 12 : bestHour % 12
        peakHourStr = `${h12} ${ampm}`
      } else {
        if (bestHour < 6) peakHourStr = `凌晨 ${bestHour} 点`
        else if (bestHour < 12) peakHourStr = `上午 ${bestHour} 点`
        else if (bestHour === 12) peakHourStr = `中午 12 点`
        else if (bestHour < 18) peakHourStr = `下午 ${bestHour - 12} 点`
        else peakHourStr = `晚上 ${bestHour - 12} 点`
      }
    }

    // 最常用模型
    const topModel = currentRangeRanking[0]?.[0] || Object.keys(snapshot.byModelName)[0] || '--'

    return {
      totalTokens,
      calls,
      activeDays,
      sessionCount,
      peakHourStr,
      topModel,
    }
  }, [rangeDays, snapshot, timeRange, now, t, currentRangeRanking])

  // 4. 构建热力图周-日方块矩阵（7行 × N列）
  const heatmapData = useMemo(() => {
    if (rangeDays.length === 0) return { weeks: [], maxVal: 1 }

    const daysMap = snapshot.byDay
    let maxVal = 1
    for (const d of rangeDays) {
      const val = daysMap[d]?.totalTokens ?? 0
      if (val > maxVal) maxVal = val
    }

    const daysWithInfo = rangeDays.map(d => {
      const dayData = daysMap[d]
      const tokens = dayData?.totalTokens ?? 0
      const calls = dayData?.calls ?? 0
      let level = 0
      if (tokens > 0) {
        const ratio = tokens / maxVal
        if (ratio < 0.25) level = 1
        else if (ratio < 0.5) level = 2
        else if (ratio < 0.75) level = 3
        else level = 4
      }
      return {
        day: d,
        tokens,
        calls,
        level,
      }
    })

    const weeks: Array<typeof daysWithInfo> = []
    const weekCount = Math.ceil(daysWithInfo.length / 7)
    for (let w = 0; w < weekCount; w += 1) {
      weeks.push(daysWithInfo.slice(w * 7, w * 7 + 7))
    }

    return { weeks, maxVal }
  }, [rangeDays, snapshot.byDay])

  // 5. 书籍换算文案
  const currentBook = BOOKS[bookIdx % BOOKS.length]
  const bookCount = Math.max(1, Math.round(metrics.totalTokens / currentBook.tokensPerBook))

  const handleNextBook = () => {
    setBookIdx(prev => (prev + 1) % BOOKS.length)
  }

  return (
    <div className="tm-overview-card">
      {/* 顶部 Tab 导航与时间范围控制 */}
      <div className="tm-overview-header">
        <div className="tm-overview-tabs">
          <button
            type="button"
            className={`tm-overview-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            {t('overview.title')}
          </button>
          <button
            type="button"
            className={`tm-overview-tab-btn ${activeTab === 'model' ? 'active' : ''}`}
            onClick={() => setActiveTab('model')}
          >
            {t('filter.model')}
          </button>
        </div>

        <div className="tm-overview-ranges">
          <button
            type="button"
            className={`tm-overview-range-btn ${timeRange === 'all' ? 'active' : ''}`}
            onClick={() => setTimeRange('all')}
          >
            {t('range.all')}
          </button>
          <button
            type="button"
            className={`tm-overview-range-btn ${timeRange === '30d' ? 'active' : ''}`}
            onClick={() => setTimeRange('30d')}
          >
            {t('range.30d')}
          </button>
          <button
            type="button"
            className={`tm-overview-range-btn ${timeRange === '7d' ? 'active' : ''}`}
            onClick={() => setTimeRange('7d')}
          >
            {t('range.7d')}
          </button>
        </div>
      </div>

      {activeTab === 'overview' ? (
        <>
          {/* 6 宫格微质感统计卡片 */}
          <div className="tm-overview-grid">
            <div className="tm-overview-stat-cell">
              <span className="tm-overview-stat-label">{t('stat.sessions')}</span>
              <span className="tm-overview-stat-value">{formatNumber(metrics.sessionCount)}</span>
            </div>
            <div className="tm-overview-stat-cell">
              <span className="tm-overview-stat-label">{t('stat.messages')}</span>
              <span className="tm-overview-stat-value">{formatNumber(metrics.calls)}</span>
            </div>
            <div className="tm-overview-stat-cell">
              <span className="tm-overview-stat-label">{t('stat.totalTokens')}</span>
              <span className="tm-overview-stat-value">{formatTokens(metrics.totalTokens)}</span>
            </div>
            <div className="tm-overview-stat-cell">
              <span className="tm-overview-stat-label">{t('stat.activeDays')}</span>
              <span className="tm-overview-stat-value">{metrics.activeDays}</span>
            </div>
            <div className="tm-overview-stat-cell">
              <span className="tm-overview-stat-label">{t('stat.peakHour')}</span>
              <span className="tm-overview-stat-value" style={{ fontSize: '15px' }}>
                {metrics.peakHourStr}
              </span>
            </div>
            <div className="tm-overview-stat-cell" title={metrics.topModel}>
              <span className="tm-overview-stat-label">{t('stat.topModel')}</span>
              <span className="tm-overview-stat-value" style={{ fontSize: '13px' }}>
                {metrics.topModel}
              </span>
            </div>
          </div>

          {/* 下半部分左右两栏：左侧活跃热力图与趣味折算，右侧模型用量排行 */}
          <div className="tm-overview-body">
            <div className="tm-overview-heatmap-col">
              <div className="tm-heatmap-wrap">
                <div className="tm-heatmap-matrix">
                  {heatmapData.weeks.map((week, wIdx) => (
                    <div key={`w-${wIdx}`} className="tm-heatmap-week">
                      {week.map(cell => (
                        <div
                          key={`c-${cell.day}`}
                          className={`tm-heatmap-cell level-${cell.level}`}
                          title={`${cell.day}: ${formatTokens(cell.tokens)} (${cell.calls} ${t('field.calls')})`}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* 趣味换算文案 */}
              <div className="tm-overview-metaphor">
                <span>
                  你的 Token 用量相当于 {formatNumber(bookCount)} 本
                  <span
                    className="tm-metaphor-book"
                    onClick={handleNextBook}
                    title="点击切换对比书籍"
                  >
                    {currentBook.name}
                  </span>
                  。
                </span>
              </div>
            </div>

            {/* 右侧：模型用量排行，完美利用大屏空白空间 */}
            <div className="tm-overview-ranking-col">
              <div className="tm-overview-ranking-header">
                <span>{t('stat.modelRanking')}</span>
                <span>{timeRange === 'all' ? t('range.all') : timeRange === '30d' ? t('range.30d') : t('range.7d')}</span>
              </div>
              <div className="tm-overview-model-list">
                {currentRangeRanking.slice(0, 5).map(([modelName, tokens]) => {
                  const maxToken = currentRangeRanking[0]?.[1] || 1
                  const barPercent = Math.min(100, Math.max(0, (tokens / maxToken) * 100))
                  const totalPercent = Math.min(100, Math.max(0, (tokens / (metrics.totalTokens || 1)) * 100))
                  return (
                    <div key={modelName} className="tm-overview-model-row">
                      <div
                        style={{
                          minWidth: '120px',
                          maxWidth: '160px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontWeight: 500,
                          fontSize: '12px',
                        }}
                        title={modelName}
                      >
                        {modelName}
                      </div>
                      <div className="tm-overview-model-bar-wrap">
                        <div className="tm-progress-bar" style={{ flex: 1, margin: 0, height: '6px' }}>
                          <div className="tm-progress-fill" style={{ width: `${barPercent}%` }} />
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--tm-text-muted)', minWidth: '36px', textAlign: 'right' }}>
                          {totalPercent.toFixed(1)}%
                        </span>
                      </div>
                      <div style={{ minWidth: '60px', textAlign: 'right', fontWeight: 600, fontFamily: 'var(--tm-font-mono)', fontSize: '12px' }}>
                        {formatTokens(tokens)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      ) : (
        /* 模型 Tab：展示更完整的模型列表 */
        <div className="tm-overview-model-list">
          <div className="tm-overview-ranking-header" style={{ marginBottom: '6px' }}>
            <span>{t('filter.allModels') || '全部模型分布'}</span>
            <span>{currentRangeRanking.length} 款模型</span>
          </div>
          {currentRangeRanking.map(([modelName, tokens]) => {
            const maxToken = currentRangeRanking[0]?.[1] || 1
            const barPercent = Math.min(100, Math.max(0, (tokens / maxToken) * 100))
            const totalPercent = Math.min(100, Math.max(0, (tokens / (metrics.totalTokens || 1)) * 100))
            return (
              <div key={modelName} className="tm-overview-model-row">
                <div style={{ minWidth: '160px', fontWeight: 500, fontSize: '12px' }}>
                  {modelName}
                </div>
                <div className="tm-overview-model-bar-wrap">
                  <div className="tm-progress-bar" style={{ flex: 1, margin: 0 }}>
                    <div className="tm-progress-fill" style={{ width: `${barPercent}%` }} />
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--tm-text-muted)', minWidth: '40px', textAlign: 'right' }}>
                    {totalPercent.toFixed(1)}%
                  </span>
                </div>
                <div style={{ minWidth: '70px', textAlign: 'right', fontWeight: 600, fontFamily: 'var(--tm-font-mono)' }}>
                  {formatTokens(tokens)}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
