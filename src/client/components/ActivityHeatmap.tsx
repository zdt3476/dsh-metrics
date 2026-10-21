import { useMemo, useState, type FC } from 'react'
import { formatNumber, formatTokens } from '../../shared/format'
import type { MetricsSnapshot } from '../../shared/types'
import { computeRhythm, rangeDayKeys, type TimeRange } from '../derived'

export interface ActivityHeatmapProps {
  snapshot: MetricsSnapshot
  range: TimeRange
  t: (key: string, params?: Record<string, string | number>) => string
}

/** 每本书的 Token 量级（粗略换算，仅用于直观类比）。 */
const BOOKS = [
  { key: 'huozhe', tokensPerBook: 120_000 },
  { key: 'santi', tokensPerBook: 900_000 },
  { key: 'honglou', tokensPerBook: 1_000_000 },
] as const

const WEEK_LENGTH = 7
const LEVEL_COUNT = 4
/** 周一为一周起点：把首日之前的日子补成空白，列才能对齐自然周。 */
const LEADING_BLANKS = (day: string): number => (new Date(`${day}T00:00:00`).getDay() + 6) % 7

interface HeatCell {
  day: string
  tokens: number
  calls: number
  level: number
}

type Slot = HeatCell | null

export const ActivityHeatmap: FC<ActivityHeatmapProps> = ({ snapshot, range, t }) => {
  const [bookIndex, setBookIndex] = useState(0)

  const { weeks, activeDays, totalTokens, rhythm } = useMemo(() => {
    const days = rangeDayKeys(snapshot, range)
    const max = days.reduce(
      (peak, day) => Math.max(peak, snapshot.byDay[day]?.totalTokens ?? 0),
      1,
    )

    let active = 0
    let sum = 0
    const cells: HeatCell[] = days.map(day => {
      const counters = snapshot.byDay[day]
      const tokens = counters?.totalTokens ?? 0
      sum += tokens
      if (tokens > 0) active += 1
      const ratio = tokens / max
      const level =
        tokens <= 0
          ? 0
          : ratio < 0.25
            ? 1
            : ratio < 0.5
              ? 2
              : ratio < 0.75
                ? 3
                : LEVEL_COUNT
      return { day, tokens, calls: counters?.calls ?? 0, level }
    })

    const slots: Slot[] = [
      ...Array.from({ length: cells.length > 0 ? LEADING_BLANKS(cells[0].day) : 0 }, () => null),
      ...cells,
    ]
    const columns: Slot[][] = []
    for (let start = 0; start < slots.length; start += WEEK_LENGTH) {
      columns.push(slots.slice(start, start + WEEK_LENGTH))
    }

    return {
      weeks: columns,
      activeDays: active,
      totalTokens: sum,
      rhythm: computeRhythm(snapshot, days),
    }
  }, [snapshot, range])

  const book = BOOKS[bookIndex % BOOKS.length]
  const bookCount = Math.max(1, Math.round(totalTokens / book.tokensPerBook))

  const insights = [
    { key: 'avg', label: t('activity.avg'), value: formatTokens(rhythm.avgPerActiveDay) },
    {
      key: 'peak',
      label: t('activity.peakDay'),
      value: rhythm.peakDay ? formatTokens(rhythm.peakDay.tokens) : '—',
      hint: rhythm.peakDay?.day,
    },
    {
      key: 'streak',
      label: t('activity.streak'),
      value: t('activity.streakValue', { count: rhythm.longestStreak }),
    },
  ]

  return (
    <section className="tm-activity">
      <header className="tm-activity-head">
        <h3 className="tm-activity-title">{t('activity.title')}</h3>
        <span className="tm-activity-hint">{t('activity.activeDays', { count: activeDays })}</span>
      </header>

      <div className="tm-activity-body">
        <div className="tm-heatmap-scroll">
          <div className="tm-heatmap-grid">
            {weeks.map((column, columnIndex) => (
              <div key={`col-${columnIndex}`} className="tm-heatmap-col">
                {column.map((cell, rowIndex) =>
                  cell === null ? (
                    <i key={`blank-${columnIndex}-${rowIndex}`} className="tm-heatmap-cell level-empty" />
                  ) : (
                    <i
                      key={cell.day}
                      className={`tm-heatmap-cell level-${cell.level}`}
                      title={`${cell.day} · ${formatTokens(cell.tokens)} · ${cell.calls} ${t('field.calls')}`}
                    />
                  ),
                )}
              </div>
            ))}
          </div>
        </div>

        <dl className="tm-activity-insights">
          {insights.map(item => (
            <div key={item.key} className="tm-activity-insight">
              <dt>{item.label}</dt>
              <dd title={item.hint}>{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <footer className="tm-activity-foot">
        <span className="tm-activity-metaphor">
          {t('metaphor.template', {
            count: formatNumber(bookCount),
            book: t(`book.${book.key}`),
          })}
          <button
            type="button"
            className="tm-metaphor-switch"
            onClick={() => setBookIndex(current => (current + 1) % BOOKS.length)}
            title={t('metaphor.switch')}
          >
            ↻
          </button>
        </span>

        <span className="tm-heatmap-legend">
          <span>{t('activity.less')}</span>
          {Array.from({ length: LEVEL_COUNT + 1 }, (_, level) => (
            <i key={`legend-${level}`} className={`tm-heatmap-cell level-${level}`} />
          ))}
          <span>{t('activity.more')}</span>
        </span>
      </footer>
    </section>
  )
}
