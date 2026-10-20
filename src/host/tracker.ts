import type {
  AccountSnapshot,
  FailedAttemptsRecord,
  MetricsSnapshot,
  ModelTrend,
  PluginConfig,
  RawTokenUsage,
  SessionEventRecordInput,
  SessionSummaryItem,
  StoreData,
  TokenCounters,
  TokenCountersWithRate,
  TrendSeries,
} from '../shared/types'
import {
  addUsage,
  cacheHitRate,
  dayKey,
  emptyCounters,
  mergeCounters,
  sessionOrigin,
} from '../shared/utils'
import { loadStore, saveStore, storePath } from './storage'

export interface LoggerLike {
  info?: (msg: string) => void
  warn?: (msg: string) => void
  error?: (msg: string) => void
}

export class TokenTracker {
  store: StoreData
  config: PluginConfig
  logger?: LoggerLike
  buildId: string
  home?: string
  dirty = false
  flushTimer?: NodeJS.Timeout
  storeRevision = 0
  cachedSnapshot?: MetricsSnapshot
  cachedSnapshotAt = 0
  cachedSnapshotRevision = -1
  scan = {
    active: false,
    done: 0,
    total: 0,
    startedAt: 0,
    finishedAt: 0,
  }

  constructor(options: {
    logger?: LoggerLike
    buildId: string
    config: PluginConfig
    home?: string
    store?: StoreData
  }) {
    this.logger = options.logger
    this.buildId = options.buildId
    this.config = options.config
    this.home = options.home

    if (options.store) {
      this.store = options.store
    } else {
      const loaded = loadStore(this.home, this.buildId, this.logger)
      this.store = loaded.store
    }
  }

  updateConfig(config: PluginConfig): void {
    this.config = config
    this.invalidateCache()
  }

  private invalidateCache(): void {
    this.storeRevision += 1
  }

  private dedupKey(input: SessionEventRecordInput): string {
    if (input.sessionId !== undefined && input.turn !== undefined && input.step !== undefined) {
      return `${input.sessionId}:${input.turn}:${input.step}`
    }
    if (input.sessionId !== undefined && input.purpose) {
      const sec = Math.floor((input.time ?? Date.now()) / 1000)
      return `${input.sessionId}:${input.purpose}:${sec}`
    }
    const sec = Math.floor((input.time ?? Date.now()) / 1000)
    return `${input.purpose ?? 'direct'}:${sec}:${input.provider ?? 'unknown'}/${input.model ?? 'unknown'}`
  }

  record(input: SessionEventRecordInput): boolean {
    if (!input || !input.usage) return false
    const key = this.dedupKey(input)
    if (this.store.seen[key] !== undefined) {
      return false
    }

    const now = input.time ?? Date.now()
    this.store.seen[key] = now
    this.capSeen()

    const day = dayKey(now)
    const provider = input.provider || 'unknown'
    const model = input.model || 'unknown'
    const modelKey = `${provider}/${model}`
    const usage = input.usage

    // 1. Total
    addUsage(this.store.total, usage)

    // 2. By Day
    this.store.byDay[day] ??= emptyCounters()
    addUsage(this.store.byDay[day], usage)

    // 3. By Provider
    this.store.byProvider[provider] ??= emptyCounters()
    addUsage(this.store.byProvider[provider], usage)

    // 4. By Model
    this.store.byModel[modelKey] ??= emptyCounters()
    addUsage(this.store.byModel[modelKey], usage)

    // 5. By ModelName
    this.store.byModelName[model] ??= emptyCounters()
    addUsage(this.store.byModelName[model], usage)

    // 6. By DayModel
    this.store.byDayModel[day] ??= {}
    this.store.byDayModel[day][modelKey] ??= emptyCounters()
    addUsage(this.store.byDayModel[day][modelKey], usage)

    // 7. By DayModelName
    this.store.byDayModelName[day] ??= {}
    this.store.byDayModelName[day][model] ??= emptyCounters()
    addUsage(this.store.byDayModelName[day][model], usage)

    // 8. By Session
    if (input.sessionId) {
      const sess = (this.store.bySession[input.sessionId] ??= {
        counters: emptyCounters(),
        provider,
        model,
        cwd: input.cwd,
        origin: input.origin ?? sessionOrigin({ parentSession: input.parentSession, delegationDepth: input.delegationDepth }),
        parentSession: input.parentSession,
        delegationDepth: input.delegationDepth,
        firstAt: now,
        lastAt: now,
      })
      addUsage(sess.counters, usage)
      sess.provider = provider
      sess.model = model
      if (input.cwd) sess.cwd = input.cwd
      if (input.parentSession) sess.parentSession = input.parentSession
      if (input.delegationDepth !== undefined) sess.delegationDepth = input.delegationDepth
      sess.firstAt = Math.min(sess.firstAt ?? now, now)
      sess.lastAt = Math.max(sess.lastAt ?? now, now)
    }

    // 9. By Project (cwd)
    if (input.cwd) {
      this.store.byProject[input.cwd] ??= emptyCounters()
      addUsage(this.store.byProject[input.cwd], usage)
    }

    // 10. By Origin
    const origin = input.origin ?? sessionOrigin({ parentSession: input.parentSession, delegationDepth: input.delegationDepth })
    this.store.byOrigin[origin] ??= emptyCounters()
    addUsage(this.store.byOrigin[origin], usage)

    // 11. By Account
    if (this.store.currentAccount?.id) {
      const accId = this.store.currentAccount.id
      this.store.accounts[accId] ??= emptyCounters()
      addUsage(this.store.accounts[accId], usage)
    }

    this.dirty = true
    this.invalidateCache()
    this.scheduleFlush()
    return true
  }

  recordFailedAttempt(usage?: Partial<RawTokenUsage>, dedupKey?: string): void {
    if (dedupKey && this.store.seen[dedupKey] !== undefined) return
    if (dedupKey) {
      this.store.seen[dedupKey] = Date.now()
      this.capSeen()
    }

    this.store.failedAttempts.count += 1
    if (usage) {
      const input = usage.inputTokens ?? 0
      const output = usage.outputTokens ?? 0
      const total = usage.totalTokens ?? (input + output)
      this.store.failedAttempts.inputTokens += input
      this.store.failedAttempts.outputTokens += output
      this.store.failedAttempts.totalTokens += total
      if (total > 0) {
        this.store.failedAttempts.billable += 1
      }
    }

    this.dirty = true
    this.invalidateCache()
    this.scheduleFlush()
  }

  setTitle(sessionId: string, title?: string): void {
    if (!sessionId || !title) return
    const sess = this.store.bySession[sessionId]
    if (sess) {
      sess.title = title
      this.dirty = true
      this.invalidateCache()
      this.scheduleFlush()
    }
  }

  setCurrentAccount(account: AccountSnapshot | null): void {
    this.store.currentAccount = account
    this.dirty = true
    this.invalidateCache()
    this.scheduleFlush()
  }

  private capSeen(): void {
    const keys = Object.keys(this.store.seen)
    const limit = this.config.maxSeenEntries
    if (keys.length <= limit) return
    const dropCount = Math.floor(limit * 0.2)
    const sorted = keys.map(k => ({ k, t: this.store.seen[k] })).sort((a, b) => a.t - b.t)
    for (let i = 0; i < dropCount; i += 1) {
      delete this.store.seen[sorted[i].k]
    }
  }

  beginScan(total: number): void {
    this.scan = {
      active: true,
      done: 0,
      total,
      startedAt: Date.now(),
      finishedAt: 0,
    }
    this.invalidateCache()
  }

  advanceScan(): void {
    if (!this.scan.active) return
    this.scan.done += 1
    if (this.scan.done % 20 === 0) {
      this.invalidateCache()
    }
  }

  endScan(): void {
    this.scan.active = false
    this.scan.finishedAt = Date.now()
    this.invalidateCache()
  }

  markDirty(): void {
    this.dirty = true
    this.invalidateCache()
  }

  reset(): void {
    const fresh = emptyCounters()
    this.store.seen = {}
    this.store.total = fresh
    this.store.byDay = {}
    this.store.byProvider = {}
    this.store.byModel = {}
    this.store.byModelName = {}
    this.store.byDayModel = {}
    this.store.byDayModelName = {}
    this.store.bySession = {}
    this.store.byProject = {}
    this.store.byOrigin = {}
    this.store.accounts = {}
    this.store.failedAttempts = { count: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, billable: 0 }
    this.dirty = true
    this.invalidateCache()
  }

  pruneOldDays(now = Date.now()): void {
    if (this.config.retentionDays <= 0) return
    const cutoffDay = dayKey(now - this.config.retentionDays * 86_400_000)
    for (const day of Object.keys(this.store.byDay)) {
      if (day < cutoffDay) {
        delete this.store.byDay[day]
        delete this.store.byDayModel[day]
        delete this.store.byDayModelName[day]
        this.dirty = true
      }
    }
    if (this.dirty) {
      this.invalidateCache()
      this.scheduleFlush()
    }
  }

  scheduleFlush(): void {
    if (this.flushTimer !== undefined) return
    this.flushTimer = setTimeout(() => {
      this.flushTimer = undefined
      this.flush()
    }, this.config.flushDelayMs)
    this.flushTimer?.unref?.()
  }

  flush(): void {
    if (this.flushTimer !== undefined) {
      clearTimeout(this.flushTimer)
      this.flushTimer = undefined
    }
    if (!this.dirty) return
    saveStore(this.home, this.store, this.logger)
    this.dirty = false
  }

  snapshot(): MetricsSnapshot {
    const now = Date.now()
    const valid =
      this.cachedSnapshot !== undefined &&
      this.cachedSnapshotRevision === this.storeRevision &&
      now - this.cachedSnapshotAt < this.config.snapshotCacheMs

    if (valid && this.cachedSnapshot) {
      return this.cachedSnapshot
    }

    const value = this.buildSnapshot(now)
    this.cachedSnapshot = value
    this.cachedSnapshotAt = now
    this.cachedSnapshotRevision = this.storeRevision
    return value
  }

  private buildSnapshot(now: number): MetricsSnapshot {
    const today = dayKey(now)
    const weekStart = dayKey(now - 6 * 86_400_000)

    const sumDaysFrom = (fromDay: string): TokenCounters => {
      const counters = emptyCounters()
      for (const [day, val] of Object.entries(this.store.byDay)) {
        if (day >= fromDay) mergeCounters(counters, val)
      }
      return counters
    }

    const withRate = (counters: TokenCounters): TokenCountersWithRate => ({
      ...counters,
      cacheHitRate: cacheHitRate(counters),
    })

    const totals = {
      all: withRate(this.store.total),
      today: withRate(this.store.byDay[today] ?? emptyCounters()),
      week: withRate(sumDaysFrom(weekStart)),
    }

    const sessions: SessionSummaryItem[] = Object.entries(this.store.bySession)
      .map(([id, entry]) => ({
        id,
        title: entry.title,
        provider: entry.provider,
        model: entry.model,
        parentSession: entry.parentSession,
        cwd: entry.cwd,
        origin: entry.origin,
        delegationDepth: entry.delegationDepth,
        firstAt: entry.firstAt,
        lastAt: entry.lastAt,
        counters: entry.counters,
      }))
      .sort((a, b) => (b.lastAt ?? 0) - (a.lastAt ?? 0))
      .slice(0, this.config.maxSessions)

    const days = Object.keys(this.store.byDay).sort()

    // 按模型拆分的每日序列
    const dayList = Object.keys(this.store.byDayModelName ?? {}).sort()
    const byModelDay: Record<string, Record<string, TokenCountersWithRate>> = {}
    for (const day of dayList) {
      for (const [name, counters] of Object.entries(this.store.byDayModelName[day] ?? {})) {
        byModelDay[name] ??= {}
        byModelDay[name][day] = withRate(counters)
      }
    }

    // Top 模型趋势
    const modelTrend: ModelTrend = (() => {
      if (dayList.length === 0) return { days: [], series: [] }
      const modelTotals = new Map<string, number>()
      for (const day of dayList) {
        for (const [key, counters] of Object.entries(this.store.byDayModelName[day] ?? {})) {
          modelTotals.set(key, (modelTotals.get(key) ?? 0) + (counters.totalTokens ?? 0))
        }
      }
      const ranked = [...modelTotals.entries()].sort((a, b) => b[1] - a[1])
      const topKeys = ranked.slice(0, this.config.maxTrendSeries).map(([k]) => k)
      const topSet = new Set(topKeys)
      const hasRest = ranked.length > topKeys.length

      const series: TrendSeries[] = topKeys.map(key => ({
        key,
        label: key,
        values: Object.fromEntries(
          dayList.map(day => [day, this.store.byDayModelName[day]?.[key]?.totalTokens ?? 0]),
        ),
      }))

      if (hasRest) {
        series.push({
          key: '__rest__',
          label: 'rest',
          values: Object.fromEntries(
            dayList.map(day => {
              let sum = 0
              for (const [key, counters] of Object.entries(this.store.byDayModelName[day] ?? {})) {
                if (!topSet.has(key)) sum += counters.totalTokens ?? 0
              }
              return [day, sum]
            }),
          ),
        })
      }
      return { days: dayList, series }
    })()

    return {
      generatedAt: now,
      today,
      totals,
      trend: Object.fromEntries(
        days.map(day => [day, withRate(this.store.byDay[day])]),
      ),
      config: {
        showSessions: this.config.showSessions,
        trackFailedAttempts: this.config.trackFailedAttempts,
        snapshotCacheMs: this.config.snapshotCacheMs,
        retentionDays: this.config.retentionDays,
        maxTrendSeries: this.config.maxTrendSeries,
      },
      byDay: Object.fromEntries(days.map(day => [day, this.store.byDay[day]])),
      byModelDay,
      modelTrend,
      byProvider: this.store.byProvider,
      byModel: this.store.byModel,
      byModelName: Object.fromEntries(
        (Object.entries(this.store.byModelName)
          .map(([name, counters]): [string, TokenCountersWithRate] => [name, withRate(counters)])
          .sort((a, b) => (b[1].totalTokens ?? 0) - (a[1].totalTokens ?? 0))),
      ),
      byProject: Object.fromEntries(
        (Object.entries(this.store.byProject)
          .map(([cwd, counters]): [string, TokenCountersWithRate] => [cwd, withRate(counters)])
          .sort((a, b) => (b[1].totalTokens ?? 0) - (a[1].totalTokens ?? 0))),
      ),
      byOrigin: Object.fromEntries(
        Object.entries(this.store.byOrigin).map(([origin, counters]) => [origin, withRate(counters)]),
      ),
      failedAttempts: this.config.trackFailedAttempts ? { ...this.store.failedAttempts } : null,
      accounts: Object.fromEntries(
        Object.entries(this.store.accounts).map(([id, entry]) => [id, withRate(entry)]),
      ),
      currentAccount: this.store.currentAccount,
      bySession: this.config.showSessions
        ? Object.fromEntries(sessions.map(s => [s.id, s]))
        : {},
      sessionCount: Object.keys(this.store.bySession).length,
      scannedCount: Object.keys(this.store.scanned).length,
      scan: { ...this.scan },
      buildId: this.buildId,
      integrity: {
        seenKeys: Object.keys(this.store.seen).length,
        totalCalls: this.store.total.calls,
        consistent: this.store.total.calls >= 0,
      },
      storePath: storePath(this.home),
      repositoryUrl: 'https://github.com/zdt3476/dsh-metrics',
    }
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __DSH_METRICS_TRACKER__: {
    buildId: string
    tracker: TokenTracker
  } | undefined
}

export function acquireTracker(
  logger: LoggerLike | undefined,
  buildId: string,
  config: PluginConfig,
  home?: string,
): { tracker: TokenTracker; fresh: boolean } {
  const existing = globalThis.__DSH_METRICS_TRACKER__
  if (existing && existing.buildId === buildId) {
    existing.tracker.updateConfig(config)
    return { tracker: existing.tracker, fresh: false }
  }

  const tracker = new TokenTracker({ logger, buildId, config, home })
  globalThis.__DSH_METRICS_TRACKER__ = { buildId, tracker }
  return { tracker, fresh: true }
}
