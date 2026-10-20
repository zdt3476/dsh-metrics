import { watch } from 'node:fs'
import { createRequire, registerHooks } from 'node:module'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import type { ReloadResult } from '../shared/types'
import type { LoggerLike } from './tracker'

const require = createRequire(import.meta.url)

let inFlight: Promise<ReloadResult> | null = null

const hooksKey = Symbol.for('dsh-metrics.reload-hooks')
const globalScope = globalThis as unknown as { [key: symbol]: Map<string, unknown> }
const reloadHooks = (globalScope[hooksKey] ??= new Map<string, unknown>())

export function enableFreshDependencies(packageUrl: string): void {
  if (reloadHooks.has(packageUrl)) return
  try {
    const hook = registerHooks({
      resolve(specifier: string, context: Record<string, unknown>, nextResolve: (...args: unknown[]) => { url: string }) {
        const resolved = nextResolve(specifier, context)
        const parentURL = context.parentURL as string | undefined
        if (!parentURL?.startsWith(packageUrl) || !resolved.url.startsWith(packageUrl)) return resolved
        const generation = new URL(parentURL).searchParams.get('dtu-reload')
        if (generation === null) return resolved
        const target = new URL(resolved.url)
        target.searchParams.set('dtu-reload', generation)
        return { ...resolved, url: target.href }
      },
    } as unknown as Parameters<typeof registerHooks>[0])
    reloadHooks.set(packageUrl, hook)
  } catch {
    // registerHooks not available or failed
  }
}

export function isReloading(): boolean {
  return inFlight !== null
}

export function packageCacheKeys(loadCache: Map<string, unknown>, packageUrl: string): string[] {
  const base = decodeURIComponent(packageUrl).replace(/\/+$/, '').toLowerCase() + '/'
  const keys: string[] = []
  for (const key of loadCache.keys()) {
    if (typeof key !== 'string') continue
    let normalized = ''
    try {
      normalized = decodeURIComponent(key).toLowerCase()
    } catch {
      normalized = key.toLowerCase()
    }
    if (normalized.startsWith(base)) keys.push(key)
  }
  return keys
}

export function purgeCaches(packageUrl: string): () => void {
  const cjsRestorers: Array<() => void> = []
  const baseDir = fileURLToPath(packageUrl).toLowerCase()
  for (const [id, mod] of Object.entries(require.cache)) {
    if (id.toLowerCase().startsWith(baseDir)) {
      delete require.cache[id]
      cjsRestorers.push(() => {
        require.cache[id] = mod
      })
    }
  }

  return () => {
    for (const restore of cjsRestorers) restore()
  }
}

export async function selfReload(
  ctx: Context,
  options: {
    logger?: LoggerLike
    packageUrl: string
    entryUrl: string
    expectedVersion?: string
  },
): Promise<ReloadResult> {
  if (inFlight) return inFlight

  inFlight = (async (): Promise<ReloadResult> => {
    const logger = options.logger
    logger?.info?.('token-metrics: 开始热重载...')
    const restoreCjs = purgeCaches(options.packageUrl)

    try {
      enableFreshDependencies(options.packageUrl)
      const generation = Date.now()
      const url = new URL(options.entryUrl)
      url.searchParams.set('dtu-reload', String(generation))

      const imported = await import(url.href) as { name?: string; version?: string }
      logger?.info?.(`token-metrics: 模块加载成功，新版本：${imported.version ?? 'unknown'}`)

      return {
        ok: true,
        newVersion: imported.version,
      }
    } catch (error) {
      restoreCjs()
      const msg = error instanceof Error ? error.message : String(error)
      logger?.warn?.(`token-metrics: 热重载失败：${msg}`)
      return {
        ok: false,
        error: msg,
      }
    } finally {
      inFlight = null
    }
  })()

  return inFlight
}

export function watchPackage(
  dir: string,
  options: {
    logger?: LoggerLike
    onChange: () => void
  },
): () => void {
  try {
    const watcher = watch(dir, { recursive: true }, (event, filename) => {
      if (!filename) return
      if (filename.includes('usage.json') || filename.includes('node_modules') || filename.startsWith('.')) return
      options.onChange()
    })
    return () => watcher.close()
  } catch {
    return () => {}
  }
}
