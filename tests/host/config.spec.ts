import { describe, expect, it } from 'vitest'
import { DEFAULTS, resolveConfig } from '../../src/host/config'

describe('config', () => {
  it('falls back to defaults when raw config is empty', () => {
    const config = resolveConfig({})
    expect(config.flushDelayMs).toBe(DEFAULTS.flushDelayMs)
    expect(config.snapshotCacheMs).toBe(DEFAULTS.snapshotCacheMs)
    expect(config.retentionDays).toBe(DEFAULTS.retentionDays)
    expect(config.maxSessions).toBe(DEFAULTS.maxSessions)
    expect(config.trackAccount).toBe(true)
    expect(config.autoUpdate).toBe(true)
  })

  it('clamps bounds on numeric fields', () => {
    const config = resolveConfig({
      flushDelayMs: 10, // min is 250
      snapshotCacheMs: 999999, // max is 60000
      maxSessions: -100, // min is 0
    })
    expect(config.flushDelayMs).toBe(250)
    expect(config.snapshotCacheMs).toBe(60000)
    expect(config.maxSessions).toBe(0)
  })

  it('respects boolean flags', () => {
    const config = resolveConfig({
      trackAccount: false,
      autoUpdate: false,
    })
    expect(config.trackAccount).toBe(false)
    expect(config.autoUpdate).toBe(false)
  })
})
