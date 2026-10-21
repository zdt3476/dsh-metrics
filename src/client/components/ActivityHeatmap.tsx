import { useMemo, type FC } from 'react'
import { formatTokens } from '../../shared/format'
import type { MetricsSnapshot } from '../../shared/types'
import { rangeDayKeys, type TimeRange } from '../derived'

export interface ActivityHeatmapProps {
  snapshot: MetricsSnapshot
  range: TimeRange
  t: (key: string, params?: Record<string, string | number>) => string
}

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']
const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
const LEVEL_COUNT = 4

interface Cell {
  day: string
  tokens: number
  level: number
  /** 该格所在自然周的周一索引，用于月份标签定位。 */
  weekIndex: number
}

/** 周一为一周起点。 */
const weekdayIndex = (day: string): number => (new Date(`${day}T00:00:00`).getDay() + 6) % 7

/**
 * Token 活动热力图：行是星期，列是自然周，顶部按月份打标签。
 * 与 GitHub 图表不同，这里以「星期几」为行，方便看出每周的使用规律。
 */
export const ActivityHeatmap: FC<ActivityHeatmapProps> = ({ snapshot, range, t }) => {
  const { weeks, monthMarks, activeDays } = useMemo(() => {
    const days = rangeDayKeys(snapshot, range)
    if (days.length === 0) return { weeks: [], monthMarks: [], activeDays: 0 }

    const max = days.reduce((peak, day) => Math.max(peak, snapshot.byDay[day]?.totalTokens ?? 0), 1)

    // 起点补齐到周一，终点补齐到周日，保证每列都是完整一周
    const leading = weekdayIndex(days[0])
    const padded: Array<Cell | null> = Array.from({ length: leading }, () => null)
    let active = 0
    days.forEach(day => {
      const tokens = snapshot.byDay[day]?.totalTokens ?? 0
      if (tokens > 0) active += 1
      padded.push({ day, tokens, level: levelOf(tokens, max), weekIndex: 0 })
    })
    while (padded.length % 7 !== 0) padded.push(null)

    const columns: Array<Array<Cell | null>> = []
    for (let start = 0; start < padded.length; start += 7) {
      columns.push(padded.slice(start, start + 7))
    }

    // 月份标签：某列首次出现新月份时打点
    const marks: Array<{ weekIndex: number; label: string }> = []
    let lastMonth = -1
    columns.forEach((column, weekIndex) => {
      const first = column.find((cell): cell is Cell => cell !== null)
      if (!first) return
      const month = new Date(`${first.day}T00:00:00`).getMonth()
      if (month !== lastMonth) {
        lastMonth = month
        marks.push({ weekIndex, label: MONTH_LABELS[month] })
      }
    })

    return { weeks: columns, monthMarks: marks, activeDays: active }
  }, [snapshot, range])

  return (
    <section className="tm-activity">
      <header className="tm-card-head">
        <h3 className="tm-card-title">{t('metric.activity')}</h3>
        <span className="tm-activity-hint">{t('activity.activeDays', { count: activeDays })}</span>
      </header>

      <div className="tm-heatmap-scroll">
        <div className="tm-heatmap-months" style={{ gridTemplateColumns: `28px repeat(${weeks.length}, 14px)` }}>
          <span />
          {weeks.map((_, weekIndex) => {
            const mark = monthMarks.find(item => item.weekIndex === weekIndex)
            return (
              <span key={`m-${weekIndex}`} className="tm-heatmap-month">
                {mark ? mark.label : ''}
              </span>
            )
          })}
        </div>

        <div className="tm-heatmap-body">
          <div className="tm-heatmap-weekdays">
            {WEEKDAY_LABELS.map(label => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <div className="tm-heatmap-grid">
            {weeks.map((column, weekIndex) => (
              <div key={`w-${weekIndex}`} className="tm-heatmap-col">
                {column.map((cell, rowIndex) =>
                  cell === null ? (
                    <i key={`e-${weekIndex}-${rowIndex}`} className="tm-heatmap-cell level-empty" />
                  ) : (
                    <i
                      key={cell.day}
                      className={`tm-heatmap-cell level-${cell.level}`}
                      title={`${cell.day} · ${formatTokens(cell.tokens)}`}
                    />
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <footer className="tm-heatmap-legend">
        <span>{t('activity.less')}</span>
        {Array.from({ length: LEVEL_COUNT + 1 }, (_, level) => (
          <i key={`l-${level}`} className={`tm-heatmap-cell level-${level}`} />
        ))}
        <span>{t('activity.more')}</span>
      </footer>
    </section>
  )
}

function levelOf(tokens: number, max: number): number {
  if (tokens <= 0) return 0
  const ratio = tokens / max
  if (ratio < 0.25) return 1
  if (ratio < 0.5) return 2
  if (ratio < 0.75) return 3
  return LEVEL_COUNT
}
