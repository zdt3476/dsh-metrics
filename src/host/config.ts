import z from '@deepseek-ai/schemastery'
import type { PluginConfig } from '../shared/types'

export const DEFAULTS: PluginConfig = {
  flushDelayMs: 2000,
  snapshotCacheMs: 3000,
  retentionDays: 400,
  maxSessions: 500,
  maxTrendSeries: 6,
  maxSeenEntries: 200_000,
  showSessions: false,
  trackFailedAttempts: false,
  trackAccount: true,
  autoUpdate: true,
  watchFiles: false,
  updateRoutes: true,
}

export function volatileField<S extends z>(field: S): S {
  const volatile = (field as unknown as { volatile?: () => S }).volatile
  return typeof volatile === 'function' ? volatile.call(field) : field
}

export const Config = z.object({
  flushDelayMs: z.number().min(250).max(60_000).default(DEFAULTS.flushDelayMs),
  snapshotCacheMs: z.number().min(0).max(60_000).default(DEFAULTS.snapshotCacheMs),
  retentionDays: z.number().min(0).max(3650).default(DEFAULTS.retentionDays),
  maxSessions: z.number().min(0).max(5000).default(DEFAULTS.maxSessions),
  maxTrendSeries: z.number().min(1).max(20).default(DEFAULTS.maxTrendSeries),
  maxSeenEntries: z.number().min(1000).max(2_000_000).default(DEFAULTS.maxSeenEntries),
  showSessions: volatileField(z.boolean().default(DEFAULTS.showSessions)),
  trackFailedAttempts: volatileField(z.boolean().default(DEFAULTS.trackFailedAttempts)),
  trackAccount: volatileField(z.boolean().default(DEFAULTS.trackAccount)),
  autoUpdate: volatileField(z.boolean().default(DEFAULTS.autoUpdate)),
  watchFiles: z.boolean().default(DEFAULTS.watchFiles),
  updateRoutes: z.boolean().default(DEFAULTS.updateRoutes ?? true),
})

export type Config = typeof Config extends z<infer T> ? T : PluginConfig

export function resolveConfig(raw?: unknown): PluginConfig {
  const source = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const number = (value: unknown, fallback: number, min: number, max: number): number => {
    const parsed = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(parsed)) return fallback
    return Math.min(max, Math.max(min, Math.round(parsed)))
  }

  return {
    flushDelayMs: number(source.flushDelayMs, DEFAULTS.flushDelayMs, 250, 60_000),
    snapshotCacheMs: number(source.snapshotCacheMs, DEFAULTS.snapshotCacheMs, 0, 60_000),
    retentionDays: number(source.retentionDays, DEFAULTS.retentionDays, 0, 3650),
    maxSessions: number(source.maxSessions, DEFAULTS.maxSessions, 0, 5000),
    maxTrendSeries: number(source.maxTrendSeries, DEFAULTS.maxTrendSeries, 1, 20),
    maxSeenEntries: number(source.maxSeenEntries, DEFAULTS.maxSeenEntries, 1000, 2_000_000),
    showSessions: source.showSessions === true,
    trackFailedAttempts: source.trackFailedAttempts === true,
    trackAccount: source.trackAccount !== false,
    autoUpdate: source.autoUpdate !== false,
    watchFiles: source.watchFiles === true,
    updateRoutes: source.updateRoutes !== false,
  }
}
