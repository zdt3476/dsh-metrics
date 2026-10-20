import type { ComponentType } from 'react'

export interface LocaleService {
  register: (ns: string, dicts: Record<string, Record<string, string>>) => () => void
  bind: (ns: string) => (key: string, params?: Record<string, string | number>) => string
  getLocale?: () => { active: string }
  getSnapshot?: () => { active: string }
  subscribe?: (callback: () => void) => () => void
}

export interface SlotRegistration {
  name: string
  id?: string
  key?: string
  order?: number
  locale?: string
  label?: () => string
  inject?: () => unknown
}

export interface SlotsService {
  inject: (name: string, callback: () => unknown) => unknown
  register: (
    registration: SlotRegistration,
    component: ComponentType<Record<string, unknown>>,
  ) => unknown
  entries?: (name: string) => unknown
}

export interface ClientCtx {
  locale: LocaleService
  slots: SlotsService
  effect: (fn: () => void | (() => void), name?: string) => void
}

export function entrySeated(ctx: ClientCtx, name: string, id: string): boolean {
  try {
    const entries = ctx.slots.entries?.(name)
    if (!Array.isArray(entries)) return false
    for (const entry of entries) {
      const options = (entry as { options?: { id?: string; key?: string } })?.options
      if (options && (options.id === id || options.key === id)) return true
    }
    return false
  } catch {
    return false
  }
}
