import { useCallback, useEffect, useState, type FC } from 'react'
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
import { UsageRanking } from './UsageRanking'
import { TrendChart } from './TrendChart'
import { UpdateBanner } from './UpdateBanner'
import { UsageSummary } from './UsageSummary'

/** 间隔文案由数值推导，避免候选值与文案各写一份后漂移。 */
function refreshLabel(value: number, t: TokenUsagePanelProps['t']): string {
  if (value <= 0) return t('refresh.off')
  return value >= 60_000 ? `${value / 60_000}m` : `${value / 1_000}s`
}

export interface TokenUsagePanelProps {
  t: (key: string, params?: Record<string, string | number>) => string
}


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
  const refreshOptions = REFRESH_INTERVALS.map(value => ({
    value,
    label: refreshLabel(value, t),
  }))

  const loadData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true)
    try {
      const res = await fetch('/api/dsh-metrics/summary')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as MetricsSnapshot
      setSnapshot(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
      if (isManual) setRefreshing(false)
    }
  }, [])

  const checkUpdate = useCallback(async () => {
    try {
      const res = await fetch('/api/dsh-metrics/update/check')
      if (!res.ok) return
      const data = (await res.json()) as UpdateCheckResult
      if (data.ok) setUpdateInfo(data)
    } catch {
      // ignore
    }
  }, [])

  const handleApplyUpdate = async () => {
    setUpdating(true)
    try {
      await fetch('/api/dsh-metrics/reload', { method: 'POST' })
      await loadData(true)
      await checkUpdate()
    } catch {
      // ignore
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
      void loadData()
    }, refreshInterval)
    return () => clearInterval(timer)
  }, [refreshInterval, loadData])

  if (loading && !snapshot) {
    return (
      <div className="tm-container">
        <div className="tm-empty">{t('loading')}</div>
      </div>
    )
  }

  if (error && !snapshot) {
    return (
      <div className="tm-container">
        <div className="tm-banner tm-banner-warning">
          <span>{t('error')}: {error}</span>
          <button type="button" className="tm-btn" onClick={() => void loadData(true)}>
            {t('retry')}
          </button>
        </div>
      </div>
    )
  }

  if (!snapshot) return null

  return (
    <div className="tm-container">
      <div className="tm-header">
        <div className="tm-title-group">
          <h1 className="tm-title">
            <span>{t('panel.title')}</span>
            <span className="tm-status-pill">
              <span className="tm-status-dot" />
              <span>{t('panel.live')}</span>
            </span>
          </h1>
        </div>

        <div className="tm-controls">
          <div className="tm-refresh-group">
            {refreshOptions.map(item => (
              <button
                key={item.value}
                type="button"
                className={`tm-refresh-pill ${refreshInterval === item.value ? 'active' : ''}`}
                onClick={() => setRefreshInterval(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="tm-btn-refresh"
            onClick={() => void loadData(true)}
            disabled={refreshing}
            title={refreshing ? t('refreshing') : t('refresh')}
          >
            <span className={refreshing ? 'tm-spin' : ''}>↻</span>
          </button>
        </div>
      </div>

      <UpdateBanner
        updateInfo={updateInfo}
        updating={updating}
        onUpdate={() => void handleApplyUpdate()}
        t={t}
      />

      {snapshot.scan?.active && (
        <div className="tm-banner">
          <div>
            <strong>{t('scan.title')}</strong>: {t('scan.hint')}
          </div>
          <div>
            {t('scan.progress')}: {snapshot.scan.done} / {snapshot.scan.total}
          </div>
        </div>
      )}

      <AccountCard account={snapshot.currentAccount} t={t} />

      <UsageSummary snapshot={snapshot} range={range} onRangeChange={setRange} t={t} />

      <div className="tm-bottom-grid">
        <TrendChart trend={snapshot.trend} modelTrend={snapshot.modelTrend} t={t} />
        <UsageRanking snapshot={snapshot} t={t} />
      </div>

      <div className="tm-bottom-grid tm-bottom-split">
        <ActivityHeatmap snapshot={snapshot} t={t} />
        <ProviderList snapshot={snapshot} t={t} />
      </div>

      <div className="tm-footnote">
        <div>
          <span>{t('storePath')}: </span>
          <code>{snapshot.storePath}</code>
        </div>
        <div>
          <span>{t('scanned')}: {snapshot.scannedCount}</span>
          <span className="tm-footnote-sep">·</span>
          <span>{t('updatedAt')}: {new Date(snapshot.generatedAt).toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  )
}
