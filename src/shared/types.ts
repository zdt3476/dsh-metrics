/**
 * Token 用量统计 — 跨端共享类型定义。
 *
 * 宿主（Host）与客户端（Client）对齐使用本协议，避免隐式字段偏差与契约漂移。
 */

/** 单位：美元 / token（OpenRouter 原始口径）。 */
export interface ModelPrice {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  reasoning: number
}

/** 归一化模型名 → 单价。 */
export type PricingTable = Record<string, ModelPrice>

/** 按小时聚合的近期用量；用于「24 小时」这类跨天的滚动范围。 */
export interface HourBucket {
  /** epoch 小时序号：Math.floor(时间戳 / 3600000)。 */
  hour: number
  counters: TokenCounters
  /** 按模型拆分，便于在该范围内按各自单价计费。 */
  byModel: Record<string, TokenCounters>
}

/** 最近一分钟粒度的速率快照。 */
export interface RateSnapshot {
  windowMinutes: number
  calls: number
  tokens: number
}

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
  /** 日 → `provider/model`（与 byModel 同口径）→ 计数；非 24 小时范围的模型/供应商区间统计都读它。 */
  byModelDay: Record<string, Record<string, TokenCountersWithRate>>
  modelTrend: ModelTrend
  byProvider: Record<string, TokenCounters>
  byModel: Record<string, TokenCounters>
  byModelName: Record<string, TokenCountersWithRate>
  byProject: Record<string, TokenCountersWithRate>
  byOrigin: Record<string, TokenCountersWithRate>
  byHour?: Record<number, TokenCounters>
  /** 模型单价表；为空表示尚未取到价格，前端据此隐藏成本。 */
  pricing: PricingTable
  pricingFetchedAt: number | null
  /** 最近一分钟粒度的速率，用于真实的 RPM / TPM。 */
  rate: RateSnapshot
  /** 最近 72 小时的小时桶，支撑滚动 24 小时范围。 */
  recentHours: HourBucket[]
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
  /** 最近若干分钟的调用与 Token 数，用于真实 RPM/TPM。 */
  recentMinutes?: Array<{ minute: number; calls: number; tokens: number }>
  /** 最近 72 小时的小时桶，用于滚动 24 小时范围。 */
  recentHours?: HourBucket[]
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
