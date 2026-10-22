import { useMemo, useRef, useState, type FC, type MouseEvent } from 'react'
import { formatNumber, formatTokens } from '../../shared/format'
import { dayKey } from '../../shared/utils'
import type { MetricsSnapshot } from '../../shared/types'
import { computeRhythm, formatHour, heatmapDays, peakHour } from '../derived'

export interface ActivityHeatmapProps {
  snapshot: MetricsSnapshot
  t: (key: string, params?: Record<string, string | number>) => string
}

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']
/** 行标签只标记这三天，和 GitHub 贡献图一致，避免七行文字糊成一片。 */
const WEEKDAY_LABELED_ROWS = new Set([0, 2, 4])
const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
const LEVEL_COUNT = 4
/** 月份标签之间至少间隔的列数，太窄时舍去后一个，避免文字互相压住。 */
const MONTH_LABEL_MIN_GAP = 3

interface Cell {
  day: string
  tokens: number
  calls: number
  level: number
}

interface TipState {
  cell: Cell
  left: number
  top: number
}

/**
 * Token 活动热力图：参考 GitHub 贡献图，固定展示最近 12 个月，
 * 列是自然周、行是星期，悬停任意格子给出当天的用量与调用次数。
 */
export const ActivityHeatmap: FC<ActivityHeatmapProps> = ({ snapshot, t }) => {
  const hostRef = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<TipState | null>(null)

  const { weeks, monthMarks, activeDays, rhythm, peak, today } = useMemo(() => {
    const days = heatmapDays()
    const day = dayKey(Date.now())
    const max = days.reduce((peak, key) => Math.max(peak, snapshot.byDay[key]?.totalTokens ?? 0), 1)

    const cells: Array<Cell | null> = days.map(key => {
      // 本周里晚于今天的格子属于未来，留空不参与统计
      if (key > day) return null
      const counters = snapshot.byDay[key]
      const tokens = counters?.totalTokens ?? 0
      return { day: key, tokens, calls: counters?.calls ?? 0, level: levelOf(tokens, max) }
    })

    const columns: Array<Array<Cell | null>> = []
    for (let start = 0; start < cells.length; start += 7) columns.push(cells.slice(start, start + 7))

    // 月份标签：某列首次出现新月份时打点，过密的后一个标签让位
    const marks: Array<{ weekIndex: number; label: string }> = []
    let lastMonth = -1
    columns.forEach((column, weekIndex) => {
      const first = column.find((cell): cell is Cell => cell !== null)
      if (!first) return
      const month = new Date(`${first.day}T00:00:00`).getMonth()
      if (month === lastMonth) return
      lastMonth = month
      const previous = marks[marks.length - 1]
      if (previous && weekIndex - previous.weekIndex < MONTH_LABEL_MIN_GAP) return
      marks.push({ weekIndex, label: MONTH_LABELS[month] })
    })

    return {
      weeks: columns,
      monthMarks: marks,
      activeDays: cells.filter(cell => cell !== null && cell.tokens > 0).length,
      rhythm: computeRhythm(snapshot, days),
      peak: peakHour(snapshot),
      today: day,
    }
  }, [snapshot])

  const handleEnter = (event: MouseEvent<HTMLElement>, cell: Cell) => {
    const host = hostRef.current?.getBoundingClientRect()
    const rect = event.currentTarget.getBoundingClientRect()
    if (!host) return
    setTip({
      cell,
      left: rect.left - host.left + rect.width / 2,
      top: rect.top - host.top,
    })
  }

  return (
    <section className="tm-activity">
      <header className="tm-card-head">
        <h3 className="tm-card-title">{t('metric.activity')}</h3>
        <span className="tm-activity-hint">{t('activity.activeDays', { count: activeDays })}</span>
      </header>

      <div className="tm-heatmap-wrap" ref={hostRef}>
        <div className="tm-heatmap-scroll" onMouseLeave={() => setTip(null)}>
          <div className="tm-heatmap-inner">
            <span />
            <div className="tm-heatmap-months" style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}>
            {weeks.map((_, weekIndex) => {
              const mark = monthMarks.find(item => item.weekIndex === weekIndex)
              return (
                <span key={`m-${weekIndex}`} className="tm-heatmap-month">
                  {mark ? mark.label : ''}
                </span>
              )
            })}
            </div>

            <div className="tm-heatmap-weekdays">
              {WEEKDAY_LABELS.map((label, row) => (
                <span key={label}>{WEEKDAY_LABELED_ROWS.has(row) ? label : ''}</span>
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
                        className={`tm-heatmap-cell level-${cell.level}${cell.day === today ? ' is-today' : ''}`}
                        aria-label={tipText(cell, t)}
                        onMouseEnter={event => handleEnter(event, cell)}
                      />
                    ),
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {tip && (
          <div
            className="tm-tip tm-heatmap-tip"
            style={{ left: `${tip.left}px`, top: `${tip.top}px` }}
            role="tooltip"
          >
            <div className="tm-tip-title">{formatDay(tip.cell.day, t)}</div>
            <div className="tm-tip-row">
              <span>tokens</span>
              <b>{formatTokens(tip.cell.tokens)}</b>
            </div>
            <div className="tm-tip-row">
              <span>{t('field.calls')}</span>
              <b>{formatNumber(tip.cell.calls)}</b>
            </div>
          </div>
        )}
      </div>

      <footer className="tm-heatmap-legend">
        <span>{t('activity.less')}</span>
        {Array.from({ length: LEVEL_COUNT + 1 }, (_, level) => (
          <i key={`l-${level}`} className={`tm-heatmap-cell level-${level}`} />
        ))}
        <span>{t('activity.more')}</span>
      </footer>

      <dl className="tm-rhythm">
        <div>
          <dt>{t('activity.avg')}</dt>
          <dd>{formatTokens(rhythm.avgPerActiveDay)}</dd>
        </div>
        <div>
          <dt>{t('activity.peakDay')}</dt>
          <dd>{rhythm.peakDay ? formatTokens(rhythm.peakDay.tokens) : '—'}</dd>
        </div>
        <div>
          <dt>{t('activity.streak')}</dt>
          <dd>{t('activity.streakValue', { count: rhythm.longestStreak })}</dd>
        </div>
        <div>
          <dt>{t('stat.peakHour')}</dt>
          <dd>{peak === null ? '—' : formatHour(peak)}</dd>
        </div>
      </dl>
    </section>
  )
}

function formatDay(day: string, t: (key: string, params?: Record<string, string | number>) => string): string {
  const [, month, date] = day.split('-')
  return t('activity.tipDate', { month: Number(month), day: Number(date) })
}

function tipText(cell: Cell, t: (key: string, params?: Record<string, string | number>) => string): string {
  return `${formatDay(cell.day, t)} ${formatTokens(cell.tokens)} ${t('field.calls')} ${formatNumber(cell.calls)}`
}

function levelOf(tokens: number, max: number): number {
  if (tokens <= 0) return 0
  const ratio = tokens / max
  if (ratio < 0.25) return 1
  if (ratio < 0.5) return 2
  if (ratio < 0.75) return 3
  return LEVEL_COUNT
}
