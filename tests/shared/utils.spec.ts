import { describe, expect, it } from 'vitest'
import {
  addUsage,
  cacheHitRate,
  dayKey,
  emptyCounters,
  finite,
  mergeCounters,
  sessionOrigin,
} from '../../src/shared/utils'

describe('shared utils', () => {
  it('creates empty counters', () => {
    const c = emptyCounters()
    expect(c.calls).toBe(0)
    expect(c.totalTokens).toBe(0)
    expect(c.inputTokens).toBe(0)
  })

  it('validates finite positive numbers', () => {
    expect(finite(10)).toBe(10)
    expect(finite(-5)).toBe(0)
    expect(finite(NaN)).toBe(0)
    expect(finite(Infinity)).toBe(0)
    expect(finite('abc')).toBe(0)
  })

  it('accumulates usage into counters correctly', () => {
    const c = emptyCounters()
    addUsage(c, {
      inputTokens: 100,
      outputTokens: 50,
      cacheReadTokens: 200,
      cacheWriteTokens: 30,
      reasoningTokens: 20,
    })
    expect(c.calls).toBe(1)
    expect(c.inputTokens).toBe(100)
    expect(c.outputTokens).toBe(50)
    expect(c.cacheReadTokens).toBe(200)
    expect(c.cacheWriteTokens).toBe(30)
    expect(c.reasoningTokens).toBe(20)
    expect(c.totalTokens).toBe(380)
  })

  it('merges counters', () => {
    const target = emptyCounters()
    target.calls = 2
    target.totalTokens = 100

    const source = emptyCounters()
    source.calls = 3
    source.totalTokens = 200

    mergeCounters(target, source)
    expect(target.calls).toBe(5)
    expect(target.totalTokens).toBe(300)
  })

  it('calculates cache hit rate', () => {
    expect(cacheHitRate(null)).toBe(0)
    expect(cacheHitRate(emptyCounters())).toBe(0)

    const c = emptyCounters()
    c.inputTokens = 100
    c.cacheReadTokens = 300
    // read / (read + input) = 300 / 400 = 0.75
    expect(cacheHitRate(c)).toBe(0.75)
  })

  it('formats dayKey consistently', () => {
    const key = dayKey(new Date('2026-10-20T10:00:00'))
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('derives session origin', () => {
    expect(sessionOrigin({ origin: 'workflow' })).toBe('workflow')
    expect(sessionOrigin({ parentSession: 'sess-1' })).toBe('subagent')
    expect(sessionOrigin({ delegationDepth: 1 })).toBe('subagent')
    expect(sessionOrigin({})).toBe('main')
    expect(sessionOrigin(undefined)).toBe('main')
  })
})
