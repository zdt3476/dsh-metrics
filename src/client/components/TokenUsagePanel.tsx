import { useCallback, useEffect, useRef, useState, type FC } from 'react'
import type { MetricsSnapshot, UpdateCheckResult } from '../../shared/types'
import type { TimeRange } from '../derived'
import {
  loadRefreshInterval,
  loadTimeRange,
  REFRESH_INTERVALS,
  saveRefreshInterval,
  saveTimeRange,
} from '../persist'
import { AccountCard } from './AccountCard'
import { ActivityHeatmap } from './ActivityHeatmap'
import { ProviderList } from './ProviderList'
import { Segmented } from './Segmented'
import { PanelSkeleton } from './Skeleton'
import { EmptyState, Notice } from './States'
import { UsageRanking } from './UsageRanking'
import { TrendChart } from './TrendChart'
import { UpdateBanner } from './UpdateBanner'
import { UsageSummary } from './UsageSummary'

export interface TokenUsagePanelProps {
  t: (key: string, params?: Record<string, string | number>) => string
}

/** 间隔文案由数值推导，避免候选值与文案各写一份后漂移。 */
function refreshLabel(value: number, t: TokenUsagePanelProps['t']): string {
  if (value <= 0) return t('refresh.off')
  return value >= 60_000 ? `${value / 60_000}m` : `${value / 1_000}s`
}

/** 面板是否已有任何可展示的调用记录。 */
function hasData(snapshot: MetricsSnapshot): boolean {
  return snapshot.totals.all.calls > 0 || snapshot.totals.all.totalTokens > 0
}

/**
 * 主面板。
 *
 * 状态约定（任一时刻只有一个主状态成立）：
 *   1. 首次加载无数据  → 骨架屏
 *   2. 首次加载失败    → 错误提示条（带重试），不显示空壳
 *   3. 有快照但无调用  → 空态（保留页头与刷新控件，用户可以直接重试）
 *   4. 有快照有数据    → 正常内容
 * 刷新失败发生在「已有数据」阶段时不替换内容，只在顶部挂一条错误提示，
 * 保证旧数据继续可读 —— 这是看板的核心体验：宁可短暂陈旧，也不要白屏。
 */
export const TokenUsagePanel: FC<TokenUsagePanelProps> = ({ t }) => {
  const [snapshot, setSnapshot] = useState<MetricsSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshInterval, setRefreshInterval] = useState<number>(loadRefreshInterval)
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null)
  const [updating, setUpdating] = useState(false)
  // 面板切换界面时会被卸载，初值从 localStorage 恢复上次选择
  const [range, setRange] = useState<TimeRange>(loadTimeRange)
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)

  // 轮询触发的刷新不显示按钮转圈，避免页面长期处于「正在刷新」的观感
  const silentRef = useRef(false)

  const loadData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true)
    else if (!silentRef.current) setRefreshing(true)
    try {
      const res = await fetch('/api/dsh-metrics/summary', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as MetricsSnapshot
      setSnapshot(data)
      setError(null)
      setUpdatedAt(Date.now())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  // 轮询走静默刷新：不驱动按钮态，但失败仍然要暴露出来
  const poll = useCallback(async () => {
    silentRef.current = true
    try {
      await loadData()
    } finally {
      silentRef.current = false
    }
  }, [loadData])

  const checkUpdate = useCallback(async () => {
    try {
      const res = await fetch('/api/dsh-metrics/update/check')
      if (!res.ok) return
      const data = (await res.json()) as UpdateCheckResult
      if (data.ok) setUpdateInfo(data)
    } catch {
      // 版本检查是附带信息，失败不该打断主面板
    }
  }, [])

  const handleApplyUpdate = async () => {
    setUpdating(true)
    try {
      const res = await fetch('/api/dsh-metrics/reload', { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await loadData(true)
      await checkUpdate()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setUpdating(false)
    }
  }

  useEffect(() => {
    void loadData()
    void checkUpdate()
  }, [loadData, checkUpdate])

  useEffect(() => {
    saveTimeRange(range)
    saveRefreshInterval(refreshInterval)
  }, [range, refreshInterval])

  useEffect(() => {
    if (refreshInterval <= 0) return
    const timer = setInterval(() => {
      void poll()
    }, refreshInterval)
    return () => clearInterval(timer)
  }, [refreshInterval, poll])

  const refreshOptions = REFRESH_INTERVALS.map(value => ({
    value,
    label: refreshLabel(value, t),
  }))

  // 1. 首次加载：骨架屏，尺寸与真实布局对齐
  if (loading && !snapshot) return <PanelSkeleton />

  const showEmpty = snapshot !== null && !hasData(snapshot)
  const showFatalError = error !== null && snapshot === null
  // 空态下宣称「实时」会误导：此时自动刷新选中项本身也已禁用
  const liveState = showEmpty ? 'stale' : error !== null ? 'error' : refreshInterval > 0 ? 'live' : 'stale'

  return (
    <div className="tm-root">
      {refreshing && !loading && (
        <div className="tm-progress" role="progressbar" aria-label={t('refreshing')}>
          <div className="tm-progress-bar" />
        </div>
      )}

      <header className="tm-header">
        <div className="tm-titlebar">
          <h1 className="tm-title">{t('panel.title')}</h1>
          <span className={`tm-status tm-status--${liveState}`} title={t(`panel.${liveState}Hint`)}>
            <i className="tm-status-dot" />
            <span>{t(`panel.${liveState}`)}</span>
          </span>
        </div>

        <div className="tm-controls">
          {/* 没有可用数据时轮询没有意义：控件只会误导用户以为在持续追踪 */}
          {!showEmpty && snapshot !== null && (
            <Segmented
              label={t('refresh.label')}
              options={refreshOptions}
              value={refreshInterval}
              onChange={setRefreshInterval}
            />
          )}
          <button
            type="button"
            className="tm-iconbtn"
            onClick={() => void loadData(true)}
            disabled={refreshing}
            title={refreshing ? t('refreshing') : t('refresh')}
            aria-label={refreshing ? t('refreshing') : t('refresh')}
          >
            <span className={refreshing ? 'tm-spin' : undefined} aria-hidden="true">↻</span>
          </button>
        </div>
      </header>

      <UpdateBanner
        updateInfo={updateInfo}
        updating={updating}
        onUpdate={() => void handleApplyUpdate()}
        t={t}
      />

      {snapshot?.scan?.active && (
        <Notice
          tone="info"
          title={t('scan.title')}
          text={`${t('scan.hint')} ${t('scan.progress')} ${snapshot.scan.done} / ${snapshot.scan.total}`}
        />
      )}

      {/* 已有数据时的刷新失败：不替换内容，只提示并给重试入口 */}
      {error !== null && snapshot !== null && (
        <Notice
          tone="error"
          title={t('error')}
          text={error}
          actions={
            <button type="button" className="tm-btn" onClick={() => void loadData(true)}>
              {t('retry')}
            </button>
          }
        />
      )}

      {showFatalError && (
        <Notice
          tone="error"
          title={t('error')}
          text={error}
          actions={
            <button type="button" className="tm-btn tm-btn--primary" onClick={() => void loadData(true)}>
              {t('retry')}
            </button>
          }
        />
      )}

      {showEmpty && (
        <EmptyState
          title={t('empty.title')}
          text={t('empty')}
          action={
            <button type="button" className="tm-btn" onClick={() => void loadData(true)}>
              {t('retry')}
            </button>
          }
        />
      )}

      {snapshot !== null && !showEmpty && (
        <>
          <AccountCard account={snapshot.currentAccount} t={t} />

          <UsageSummary snapshot={snapshot} range={range} onRangeChange={setRange} t={t} />

          <div className="tm-grid-main">
            <TrendChart trend={snapshot.trend} modelTrend={snapshot.modelTrend} t={t} />
            <UsageRanking snapshot={snapshot} range={range} t={t} />
          </div>

          <div className="tm-grid-split">
            <ActivityHeatmap snapshot={snapshot} t={t} />
            <ProviderList snapshot={snapshot} range={range} t={t} />
          </div>

          <footer className="tm-footer">
            <span className="tm-footer-group">
              <span>{t('storePath')}</span>
              <code title={snapshot.storePath}>{snapshot.storePath}</code>
            </span>
            <span className="tm-footer-group">
              <span>
                {t('scanned')} {snapshot.scannedCount}
              </span>
              <i className="tm-footer-sep" aria-hidden="true">·</i>
              <span>
                {t('updatedAt')}{' '}
                {new Date(updatedAt ?? snapshot.generatedAt).toLocaleTimeString()}
              </span>
            </span>
          </footer>
        </>
      )}
    </div>
  )
}
