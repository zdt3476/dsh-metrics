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

/**
 * cordis 的插件运行时记录与 fiber。
 *
 * `fiber.restart()` 会先销毁该插件的全部 effect，再用 `runtime.callback` 重新启动，
 * 因此换掉 callback 就等价于「用磁盘上的新代码重新装载插件」。
 */
interface ReloadableRuntime {
  callback?: unknown
  Config?: unknown
  name?: string
}

interface ReloadableFiber {
  runtime: ReloadableRuntime | null
  restart: () => Promise<void>
}

interface ReloadedModule {
  name?: string
  version?: string
  apply?: unknown
  Config?: unknown
}

/**
 * 把新导入的模块接管到当前 fiber 上并重启，使路由、事件监听与 version 常量一起刷新。
 *
 * 仅替换 runtime.callback 而不重启，会让插件继续运行旧闭包——这正是此前
 * 「重载成功但接口仍报旧版本」的原因。
 */
async function swapRuntime(ctx: Context, imported: ReloadedModule, logger?: LoggerLike): Promise<boolean> {
  const fiber = (ctx as unknown as { fiber?: ReloadableFiber }).fiber
  if (!fiber?.runtime || typeof imported.apply !== 'function' || typeof fiber.restart !== 'function') {
    logger?.warn?.('token-metrics: 当前上下文不支持重启，已跳过插件重挂载')
    return false
  }

  fiber.runtime.callback = imported.apply
  if (imported.Config !== undefined) fiber.runtime.Config = imported.Config
  if (imported.name !== undefined) fiber.runtime.name = imported.name

  await fiber.restart()
  return true
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

      const imported = await import(url.href) as ReloadedModule
      logger?.info?.(`token-metrics: 模块加载成功，新版本：${imported.version ?? 'unknown'}`)

      const swapped = await swapRuntime(ctx, imported, logger)
      if (swapped) {
        logger?.info?.(`token-metrics: 插件已重挂载，当前版本：${imported.version ?? 'unknown'}`)
      }

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
