import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveConfig } from '../../src/host/config'
import { TokenTracker } from '../../src/host/tracker'

describe('TokenTracker', () => {
  it('deduplicates identical events', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'tm-tracker-dedup-'))
    const tracker = new TokenTracker({
      buildId: 'test-1',
      config: resolveConfig({}),
      home: tmp,
    })

    const payload = {
      sessionId: 'sess-123',
      turn: 1,
      step: 1,
      provider: 'deepseek',
      model: 'deepseek-chat',
      usage: { inputTokens: 10, outputTokens: 20 },
      time: Date.now(),
    }

    const first = tracker.record(payload)
    expect(first).toBe(true)
    expect(tracker.store.total.calls).toBe(1)
    expect(tracker.store.total.inputTokens).toBe(10)
    expect(tracker.store.total.outputTokens).toBe(20)

    // Repeat identical event
    const second = tracker.record(payload)
    expect(second).toBe(false)
    expect(tracker.store.total.calls).toBe(1)

    rmSync(tmp, { recursive: true, force: true })
  })

  it('aggregates across dimensions and produces snapshot', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'tm-tracker-snap-'))
    const tracker = new TokenTracker({
      buildId: 'test-2',
      config: resolveConfig({}),
      home: tmp,
    })

    tracker.record({
      sessionId: 'sess-a',
      turn: 1,
      step: 1,
      provider: 'deepseek',
      model: 'deepseek-chat',
      cwd: '/workspace/project-x',
      origin: 'main',
      usage: { inputTokens: 100, outputTokens: 50, cacheReadTokens: 150 },
      time: Date.now(),
    })

    tracker.record({
      sessionId: 'sess-b',
      turn: 1,
      step: 1,
      provider: 'openai',
      model: 'gpt-4o',
      cwd: '/workspace/project-y',
      origin: 'subagent',
      usage: { inputTokens: 200, outputTokens: 100 },
      time: Date.now(),
    })

    const snap = tracker.snapshot()
    expect(snap.totals.all.calls).toBe(2)
    expect(snap.totals.all.inputTokens).toBe(300)
    expect(snap.totals.all.outputTokens).toBe(150)
    expect(snap.totals.all.cacheReadTokens).toBe(150)
    expect(snap.byProvider.deepseek).toBeDefined()
    expect(snap.byProvider.openai).toBeDefined()
    expect(snap.byProject['/workspace/project-x']).toBeDefined()
    expect(snap.byOrigin.main).toBeDefined()
    expect(snap.byOrigin.subagent).toBeDefined()
    expect(snap.bySession['sess-a']).toBeDefined()
    expect(snap.byHour).toBeDefined()
    const nowHour = new Date().getHours()
    expect(snap.byHour?.[nowHour]?.calls).toBe(2)

    rmSync(tmp, { recursive: true, force: true })
  })

  it('records failed attempts without throwing', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'tm-tracker-fail-'))
    const tracker = new TokenTracker({
      buildId: 'test-3',
      config: resolveConfig({ trackFailedAttempts: true }),
      home: tmp,
    })

    tracker.recordFailedAttempt({ inputTokens: 5, outputTokens: 0 }, 'fail-key-1')
    expect(tracker.store.failedAttempts.count).toBe(1)
    expect(tracker.store.failedAttempts.inputTokens).toBe(5)

    const snap = tracker.snapshot()
    expect(snap.failedAttempts?.count).toBe(1)

    rmSync(tmp, { recursive: true, force: true })
  })
})
