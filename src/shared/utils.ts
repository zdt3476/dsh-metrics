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
