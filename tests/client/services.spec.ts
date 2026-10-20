import { describe, expect, it } from 'vitest'
import { entrySeated, type ClientCtx } from '../../src/client/services'

describe('client services', () => {
  it('guards duplicate entry seating', () => {
    const mockCtx: ClientCtx = {
      locale: {
        register: () => () => {},
        bind: () => (k: string) => k,
      },
      slots: {
        inject: () => {},
        register: () => {},
        entries: (name: string) => {
          if (name === 'sidebar.panellist') {
            return [{ options: { id: 'token-metrics' } }]
          }
          return []
        },
      },
      effect: () => {},
    }

    expect(entrySeated(mockCtx, 'sidebar.panellist', 'dsh-metrics')).toBe(false)
    mockCtx.slots.entries = (name: string) => {
      if (name === 'sidebar.panellist') {
        return [{ options: { id: 'dsh-metrics' } }]
      }
      return []
    }
    expect(entrySeated(mockCtx, 'sidebar.panellist', 'dsh-metrics')).toBe(true)
    expect(entrySeated(mockCtx, 'sidebar.panellist', 'other-plugin')).toBe(false)
    expect(entrySeated(mockCtx, 'main', 'dsh-metrics')).toBe(false)
  })
})
