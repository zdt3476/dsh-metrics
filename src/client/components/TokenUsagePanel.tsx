import { useCallback, useEffect, useState, type FC } from 'react'
import { formatNumber, formatPercent, formatTokens } from '../../shared/format'
import type { MetricsSnapshot, UpdateCheckResult } from '../../shared/types'
import { AccountCard } from './AccountCard'
import { BreakdownTable } from './BreakdownTable'
import { MetricCard } from './MetricCard'
import { TrendChart } from './TrendChart'
import { UpdateBanner } from './UpdateBanner'

export interface TokenUsagePanelProps {
  t: (key: string, params?: Record<string, string | number>) => string
}

export const TokenUsagePanel: FC<TokenUsagePanelProps> = ({ t }) => {
  const [snapshot, setSnapshot] = useState<MetricsSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshInterval, setRefreshInterval] = useState<number>(30_000)
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null)
  const [updating, setUpdating] = useState(false)

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

  const { totals, scan } = snapshot

  return (
    <div className="tm-container">
      {/* 头部标题与控制组 */}
      <div className="tm-header">
        <div className="tm-title-group">
          <h1 className="tm-title">
            <span>{t('panel.title')}</span>
            <span className="tm-status-pill">
              <span className="tm-status-dot" />
              <span>实时</span>
            </span>
          </h1>
        </div>

        <div className="tm-controls">
          {/* 自动刷新分段切换药丸 */}
          <div className="tm-refresh-group">
            {[
              { val: 10_000, label: '10s' },
              { val: 30_000, label: '30s' },
              { val: 60_000, label: '1m' },
              { val: 0, label: '关闭' },
            ].map(item => (
              <button
                key={item.val}
                type="button"
                className={`tm-refresh-pill ${refreshInterval === item.val ? 'active' : ''}`}
                onClick={() => setRefreshInterval(item.val)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* 极简手动刷新按钮 */}
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

      {/* 升级提示 */}
      <UpdateBanner
        updateInfo={updateInfo}
        updating={updating}
        onUpdate={() => void handleApplyUpdate()}
        t={t}
      />

      {/* 会话扫描进行中提示 */}
      {scan?.active && (
        <div className="tm-banner">
          <div>
            <strong>{t('scan.title')}</strong>: {t('scan.hint')}
          </div>
          <div>
            {t('scan.progress')}: {scan.done} / {scan.total}
          </div>
        </div>
      )}

      {/* 核心 KPI 6 列卡片 */}
      <div className="tm-cards-grid">
        <MetricCard
          title={t('field.total')}
          value={formatTokens(totals.all.totalTokens)}
          sub={
            <span>
              {t('field.calls')}: {formatNumber(totals.all.calls)}
            </span>
          }
        />
        <MetricCard
          title={t('field.cacheHitRate')}
          value={formatPercent(totals.all.cacheHitRate)}
          sub={
            <span style={{ color: 'var(--tm-success)' }}>
              {t('field.cacheRead')}: {formatTokens(totals.all.cacheReadTokens)}
            </span>
          }
        />
        <MetricCard
          title={t('range.today')}
          value={formatTokens(totals.today.totalTokens)}
          sub={
            <span>
              {t('field.cacheHitRate')}: {formatPercent(totals.today.cacheHitRate)}
            </span>
          }
        />
        <MetricCard
          title={t('range.week')}
          value={formatTokens(totals.week.totalTokens)}
          sub={
            <span>
              {t('field.calls')}: {formatNumber(totals.week.calls)}
            </span>
          }
        />
        <MetricCard
          title={t('field.input')}
          value={formatTokens(totals.all.inputTokens)}
          sub={
            <span>
              {t('field.output')}: {formatTokens(totals.all.outputTokens)}
            </span>
          }
        />
        <MetricCard
          title={t('field.reasoning')}
          value={formatTokens(totals.all.reasoningTokens)}
          sub={
            <span>
              {t('field.cacheWrite')}: {formatTokens(totals.all.cacheWriteTokens)}
            </span>
          }
        />
      </div>

      {/* 账号与余额卡片 */}
      <AccountCard account={snapshot.currentAccount} t={t} />

      {/* 趋势图表 */}
      <TrendChart
        trend={snapshot.trend}
        modelTrend={snapshot.modelTrend}
        t={t}
      />

      {/* 维度明细表格 */}
      <BreakdownTable snapshot={snapshot} t={t} />

      {/* 底部极简状态栏 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '11px',
          color: 'var(--tm-text-muted)',
          flexWrap: 'wrap',
          gap: '8px',
          paddingTop: '8px',
        }}
      >
        <div>
          <span>{t('storePath')}: </span>
          <code style={{ fontFamily: 'var(--tm-font-mono)' }}>{snapshot.storePath}</code>
        </div>
        <div>
          <span>{t('scanned')}: {snapshot.scannedCount}</span>
          <span style={{ margin: '0 6px' }}>·</span>
          <span>{t('updatedAt')}: {new Date(snapshot.generatedAt).toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  )
}
