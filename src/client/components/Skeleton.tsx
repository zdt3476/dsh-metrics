/**
 * 加载骨架屏。
 *
 * 结构刻意与真实面板一一对应（首屏主导指标 → 支撑指标 → 图表 → 列表），
 * 这样数据到达时元素不会整体位移。用骨架而不是转圈：布局尺寸提前就位，
 * 用户能先建立对页面结构的预期。
 */

import type { FC } from 'react'
import { cn } from './cn'

/** 单块灰色占位。width 传 CSS 宽度，用于模拟文字长短不一的自然感。 */
export const Skeleton: FC<{ className?: string; width?: string }> = ({ className, width }) => (
  <div className={cn('tm-skeleton', className)} style={width ? { width } : undefined} />
)

/** 一块指标卡骨架：标签 + 主数值 + 一条迷你线。 */
const StatSkeleton: FC<{ lead?: boolean }> = ({ lead = false }) => (
  <div className={lead ? 'tm-stat tm-stat--lead' : 'tm-stat'}>
    <Skeleton className="tm-skeleton--label" width="48%" />
    <Skeleton className={lead ? 'tm-skeleton--lead' : 'tm-skeleton--value'} width="64%" />
    <Skeleton className="tm-skeleton--caption" width="38%" />
    <Skeleton className="tm-skeleton--spark" />
  </div>
)

/** 单块图表面板骨架。 */
const CardSkeleton: FC<{ rows?: number }> = ({ rows = 4 }) => (
  <section className="tm-panel-card">
    <div className="tm-panel-head">
      <Skeleton className="tm-skeleton--text" width="110px" />
      <Skeleton className="tm-skeleton--text" width="70px" />
    </div>
    <Skeleton className="tm-skeleton--chart" />
    <div className="tm-skeleton-stack">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="tm-skeleton--line" width={`${92 - index * 9}%`} />
      ))}
    </div>
  </section>
)

/**
 * 整页骨架。
 * 只在首次加载（尚无任何数据）时使用；后续刷新保留旧数据，用顶部进度条示意，
 * 避免把已有内容替换成骨架造成闪烁。
 *
 * 结构必须与真实面板逐块对齐：缺失任何一块（账户条、总览标题行）都会让数据到达
 * 后整体下移，用户会看到明显跳动。这里是「等价占位」而不是「大致相似」。
 */
export const PanelSkeleton: FC = () => (
  <div className="tm-root" aria-busy="true" aria-live="polite">
    {/* 每块占位的高度都按真实元素校准：偏差会累积成数据到达后的整体跳动 */}
    <header className="tm-header">
      <div className="tm-titlebar">
        <Skeleton className="tm-skeleton--title" width="96px" />
        <Skeleton className="tm-skeleton--pill" width="42px" />
      </div>
      <div className="tm-controls">
        <Skeleton className="tm-skeleton--seg" width="220px" />
        <Skeleton className="tm-skeleton--iconbtn" />
      </div>
    </header>

    {/* 账户条 */}
    <div className="tm-account">
      <div className="tm-account-id">
        <Skeleton className="tm-skeleton--avatar" />
        <div className="tm-account-text">
          <Skeleton className="tm-skeleton--text" width="96px" />
          <Skeleton className="tm-skeleton--caption" width="132px" />
        </div>
      </div>
      <div className="tm-balances">
        <Skeleton className="tm-skeleton--caption" width="72px" />
        <Skeleton className="tm-skeleton--caption" width="72px" />
      </div>
    </div>

    {/* 总览标题行 + 时间范围控件 */}
    <div className="tm-panel-head">
      <Skeleton className="tm-skeleton--title" width="48px" />
      <Skeleton className="tm-skeleton--seg" width="300px" />
    </div>

    <section className="tm-hero">
      <StatSkeleton lead />
      <StatSkeleton lead />
      <StatSkeleton />
    </section>

    <section className="tm-support">
      <StatSkeleton />
      <StatSkeleton />
      <StatSkeleton />
      <StatSkeleton />
    </section>

    <div className="tm-grid-main">
      <CardSkeleton rows={3} />
      <CardSkeleton rows={4} />
    </div>

    <div className="tm-grid-split">
      <CardSkeleton rows={0} />
      <CardSkeleton rows={5} />
    </div>

    <span className="tm-footer">
      <Skeleton className="tm-skeleton--text" width="180px" />
    </span>
  </div>
)
