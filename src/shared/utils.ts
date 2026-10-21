import type { RawTokenUsage, TokenCounters } from './types'

export const STORE_VERSION = 1

export function emptyCounters(): TokenCounters {
  return {
    calls: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    reasoningTokens: 0,
    totalTokens: 0,
  }
}

export function finite(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
}

export function cacheHitRate(counters?: Partial<TokenCounters> | null): number {
  if (!counters) return 0
  const read = counters.cacheReadTokens ?? 0
  const input = counters.inputTokens ?? 0
  const denominator = read + input
  if (denominator <= 0) return 0
  return read / denominator
}

export function addUsage(counters: TokenCounters, usage?: Partial<RawTokenUsage> | null): void {
  if (!usage || typeof usage !== 'object') return
  const input = finite(usage.inputTokens)
  const output = finite(usage.outputTokens)
  const cacheRead = finite(usage.cacheReadTokens)
  const cacheWrite = finite(usage.cacheWriteTokens)
  const reasoning = finite(usage.reasoningTokens)
  const total = finite(usage.totalTokens) || (input + output + cacheRead + cacheWrite)

  counters.calls += 1
  counters.inputTokens += input
  counters.outputTokens += output
  counters.cacheReadTokens += cacheRead
  counters.cacheWriteTokens += cacheWrite
  counters.reasoningTokens += reasoning
  counters.totalTokens += total
}

export function mergeCounters(target: TokenCounters, source?: Partial<TokenCounters> | null): TokenCounters {
  if (!source) return target
  const keys: (keyof TokenCounters)[] = [
    'calls',
    'inputTokens',
    'outputTokens',
    'cacheReadTokens',
    'cacheWriteTokens',
    'reasoningTokens',
    'totalTokens',
  ]
  for (const key of keys) {
    const val = source[key]
    if (typeof val === 'number' && Number.isFinite(val)) {
      target[key] += val
    }
  }
  return target
}

export function dayKey(time: number | string | Date): string {
  const d = new Date(time)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function sessionOrigin(header?: {
  parentSession?: string
  delegationDepth?: number
  origin?: string
}): string {
  if (header?.origin) return header.origin
  if (header?.parentSession !== undefined || (header?.delegationDepth ?? 0) > 0) return 'subagent'
  return 'main'
}

/**
 * 归一化模型名，用于把账本里的调用名匹配到价格表。
 *
 * 去掉厂商标识、`:free` 之类变体标记与日期后缀，两侧共用同一规则，
 * 避免主客端各写一份导致匹配结果不一致。
 */
export function normalizeModelName(raw: string): string {
  let name = raw.trim().toLowerCase()
  const slash = name.lastIndexOf('/')
  if (slash >= 0) name = name.slice(slash + 1)
  name = name.replace(/:(free|batch|extended|thinking)$/g, '')
  name = name.replace(/-\d{4}$/, '')
  return name
}

/** 按单价把一组计数折算成金额（美元）。价格缺失时返回 null，不猜测。 */
export function costOf(counters: {
  inputTokens?: number
  outputTokens?: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
  reasoningTokens?: number
}, price: { input: number; output: number; cacheRead: number; cacheWrite: number; reasoning: number }): number {
  return (
    (counters.inputTokens ?? 0) * price.input +
    (counters.outputTokens ?? 0) * price.output +
    (counters.cacheReadTokens ?? 0) * price.cacheRead +
    (counters.cacheWriteTokens ?? 0) * price.cacheWrite +
    (counters.reasoningTokens ?? 0) * price.reasoning
  )
}
