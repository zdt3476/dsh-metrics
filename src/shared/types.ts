/**
 * Token 用量统计 — 跨端共享类型定义。
 *
 * 宿主（Host）与客户端（Client）对齐使用本协议，避免隐式字段偏差与契约漂移。
 */

export interface TokenCounters {
  calls: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  reasoningTokens: number
  totalTokens: number
}

export interface TokenCountersWithRate extends TokenCounters {
  cacheHitRate: number
}

export interface RawTokenUsage {
  inputTokens?: number
  outputTokens?: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
  reasoningTokens?: number
  totalTokens?: number
}

export interface SessionEventRecordInput {
  sessionId?: string
  provider?: string
  model?: string
  turn?: number
  step?: number
  usage?: RawTokenUsage
  time?: number
  parentSession?: string
  cwd?: string
  origin?: string
  delegationDepth?: number
  purpose?: string
}

export interface AccountWallet {
  currency: string
  balance: string
}

export interface AccountSnapshot {
  id: string
  name: string | null
  balance: AccountWallet[] | null
  bonus: AccountWallet[] | null
  usageUrl: string | null
  topUpUrl: string | null
  refreshedAt: number
}

export interface SessionSummaryItem {
  id: string
  title?: string
  provider?: string
  model?: string
  parentSession?: string
  cwd?: string
  origin?: string
  delegationDepth?: number
  firstAt?: number
  lastAt?: number
  counters: TokenCounters
}

export interface TrendSeries {
  key: string
  label: string
  values: Record<string, number>
}

export interface ModelTrend {
  days: string[]
  series: TrendSeries[]
}

export interface ScanProgress {
  active: boolean
  done: number
  total: number
  startedAt: number
  finishedAt: number
}

export interface IntegrityCheck {
  seenKeys: number
  totalCalls: number
  consistent: boolean
}

export interface FailedAttemptsRecord {
  count: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  billable: number
}

export interface PluginConfig {
  flushDelayMs: number
  snapshotCacheMs: number
  retentionDays: number
  maxSessions: number
  maxTrendSeries: number
  maxSeenEntries: number
  trackFailedAttempts: boolean
  trackAccount: boolean
  autoUpdate: boolean
  watchFiles: boolean
  updateRoutes?: boolean
}

export interface MetricsSnapshot {
  generatedAt: number
  today: string
  totals: {
    all: TokenCountersWithRate
    today: TokenCountersWithRate
    week: TokenCountersWithRate
  }
  trend: Record<string, TokenCountersWithRate>
  config: {
    trackFailedAttempts: boolean
    snapshotCacheMs: number
    retentionDays: number
    maxTrendSeries: number
  }
  byDay: Record<string, TokenCounters>
  byModelDay: Record<string, Record<string, TokenCountersWithRate>>
  modelTrend: ModelTrend
  byProvider: Record<string, TokenCounters>
  byModel: Record<string, TokenCounters>
  byModelName: Record<string, TokenCountersWithRate>
  byProject: Record<string, TokenCountersWithRate>
  byOrigin: Record<string, TokenCountersWithRate>
  byHour?: Record<number, TokenCounters>
  failedAttempts: FailedAttemptsRecord | null
  accounts: Record<string, TokenCountersWithRate>
  currentAccount: AccountSnapshot | null
  bySession: Record<string, SessionSummaryItem>
  sessionCount: number
  scannedCount: number
  scan: ScanProgress
  buildId: string
  integrity: IntegrityCheck
  storePath: string
  repositoryUrl: string
}

export interface StoreData {
  version: number
  buildId: string
  needsRebuild: boolean
  createdAt: number
  updatedAt: number
  seen: Record<string, number>
  total: TokenCounters
  byDay: Record<string, TokenCounters>
  byProvider: Record<string, TokenCounters>
  byModel: Record<string, TokenCounters>
  byModelName: Record<string, TokenCounters>
  byDayModel: Record<string, Record<string, TokenCounters>>
  byDayModelName: Record<string, Record<string, TokenCounters>>
  bySession: Record<string, {
    counters: TokenCounters
    provider?: string
    model?: string
    title?: string
    parentSession?: string
    cwd?: string
    origin?: string
    delegationDepth?: number
    firstAt?: number
    lastAt?: number
  }>
  byProject: Record<string, TokenCounters>
  byOrigin: Record<string, TokenCounters>
  byHour?: Record<number, TokenCounters>
  failedAttempts: FailedAttemptsRecord
  accounts: Record<string, TokenCounters>
  currentAccount: AccountSnapshot | null
  scanned: Record<string, number>
}

export interface UpdateCheckResult {
  ok: boolean
  hasUpdate?: boolean
  currentVersion?: string
  latestVersion?: string
  releaseUrl?: string
  releaseNotes?: string
  publishedAt?: string
  error?: string
}

export interface ReloadResult {
  ok: boolean
  oldVersion?: string
  newVersion?: string
  error?: string
}
