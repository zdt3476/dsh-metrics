/**
 * dsh-metrics — 宿主侧入口（Host Half）。
 *
 * 遵循 Cordis 插件规范，捕获会话日志事件与补充通路，统计全量模型 Token 消耗，
 * 支持本地账本持久化、历史日志回扫、账号余额展示、Web 路由暴露与自更新热重载。
 */

import type { Context } from '@deepseek-ai/cordis'
import { statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { RawTokenUsage } from '../shared/types'
import { sessionOrigin } from '../shared/utils'
import { watchAccount } from './account'
import { backfillFromDisk, backfillFromLogs, type PersistenceServiceLike } from './backfill'
import { Config, resolveConfig } from './config'
import { isReloading, selfReload, watchPackage } from './reload'
import { registerRoutes } from './routes'
import { dataDir } from './storage'
import { acquireTracker } from './tracker'
import { loadPricingTable } from './pricing'
import { PluginUpdater } from './updater'

export const name = 'dsh-metrics'
export const version = '0.6.0'
export { Config } from './config'

const PACKAGE_DIR = fileURLToPath(new URL('../../', import.meta.url))
const PACKAGE_URL = new URL('../../', import.meta.url).href
const ENTRY_URL = new URL('../index.js', import.meta.url).href

const BUILD_ID = (() => {
  try {
    const stat = statSync(fileURLToPath(import.meta.url))
    return `${stat.size}:${Math.floor(stat.mtimeMs)}`
  } catch {
    return 'unknown'
  }
})()

export function apply(ctx: Context, rawConfig?: unknown): void {
  const logger = ctx.logger ?? console
  const config = resolveConfig(rawConfig)
  const { tracker, fresh } = acquireTracker(logger, BUILD_ID, config)

  // 1. 主通路：监听会话事件
  ;(ctx as unknown as { on: (event: string, handler: unknown) => void }).on(
    'session/event',
    (session: { id?: string; header?: { parentSession?: string; cwd?: string; delegationDepth?: number } }, event: { type?: string; time?: number; data?: { turn?: number; step?: number; title?: string; message?: { source?: { provider?: string; model?: string } }; usage?: RawTokenUsage; stream?: Array<{ chunk?: { type?: string; usage?: RawTokenUsage } }> } }) => {
    try {
      const sessionId = session?.id
      const header = session?.header
      if (event?.type === 'assistant/message') {
        const data = event.data ?? {}
        const source = data.message?.source ?? {}
        tracker.record({
          sessionId,
          provider: source.provider,
          model: source.model,
          turn: data.turn,
          step: data.step,
          usage: data.usage,
          time: event.time,
          parentSession: header?.parentSession,
          cwd: header?.cwd,
          origin: sessionOrigin(header),
          delegationDepth: header?.delegationDepth,
        })
      } else if (event?.type === 'assistant/attempt') {
        const stream = event.data?.stream ?? []
        let usage: RawTokenUsage | undefined
        for (const record of stream) {
          if (record?.chunk?.type === 'usage' && record.chunk.usage) {
            usage = record.chunk.usage
          }
        }
        tracker.recordFailedAttempt(
          usage,
          sessionId === undefined ? undefined : `${sessionId}:${event.data?.turn}:${event.data?.step}`,
        )
      } else if (event?.type === 'session/title' && sessionId !== undefined) {
        tracker.setTitle(sessionId, event.data?.title)
      }
    } catch (error) {
      logger?.warn?.(`[dsh-metrics] 处理会话事件失败：${error instanceof Error ? error.message : String(error)}`)
    }
  })

  // 2. 补充通路：处理不落 assistant/message 的调用
  ;(ctx as unknown as { on: (event: string, handler: unknown) => void }).on(
    'llm/stream',
    (options: { provider?: string; model?: string; sessionId?: string; purpose?: string }, next: () => AsyncIterable<{ type?: string; usage?: RawTokenUsage }>) => {
    const inner = next()
    const provider = options?.provider
    const model = options?.model
    const sessionId = options?.sessionId
    const purpose = options?.purpose
    const needsSupplement = purpose === 'compaction' || purpose === 'session-title' || sessionId === undefined

    if (!needsSupplement) return inner

    return (async function* tap() {
      let lastUsage: RawTokenUsage | undefined
      for await (const chunk of inner) {
        if (chunk?.type === 'usage' && chunk.usage !== undefined) {
          lastUsage = chunk.usage
        }
        yield chunk
      }
      if (lastUsage === undefined) return
      try {
        tracker.record({
          sessionId,
          provider,
          model,
          usage: lastUsage,
          purpose: purpose ?? 'direct',
          time: Date.now(),
        })
      } catch (error) {
        logger?.warn?.(`[dsh-metrics] 记录补充调用失败：${error instanceof Error ? error.message : String(error)}`)
      }
    })()
  })

  // 3. 历史会话日志回扫
  if (fresh) {
    let started = false
    const begin = (persistence: PersistenceServiceLike | undefined, source: string) => {
      if (started || persistence === undefined) return
      started = true
      logger?.info?.(`[dsh-metrics] 通过 ${source} 取得 sessionPersistence，开始回扫`)
      queueMicrotask(() => {
        backfillFromLogs(tracker, logger, persistence)
          .then((scanned) => {
            if (!scanned || scanned === 0) {
              logger?.info?.('[dsh-metrics] persistence 未读到会话，改用磁盘直读')
              return backfillFromDisk(tracker, logger)
            }
            return undefined
          })
          .catch((error) => {
            logger?.warn?.(`[dsh-metrics] 历史回扫异常：${error instanceof Error ? error.message : String(error)}`)
          })
      })
    }

    try {
      ctx.inject(['sessionPersistence'], (scoped) => {
        begin(scoped.get('sessionPersistence') as PersistenceServiceLike | undefined, 'inject')
      })
    } catch {
      // ignore
    }

    const poll = async () => {
      for (let attempt = 0; attempt < 12 && !started; attempt += 1) {
        begin(ctx.get('sessionPersistence') as PersistenceServiceLike | undefined, 'poll')
        if (started) return
        await new Promise(resolve => setTimeout(resolve, 250))
      }
    }

    const diskFallback = async () => {
      for (let attempt = 0; attempt < 12 && !started; attempt += 1) {
        await new Promise(resolve => setTimeout(resolve, 250))
      }
      if (started) return
      started = true
      logger?.info?.('[dsh-metrics] sessionPersistence 不可用，改用磁盘直读回扫')
      try {
        await backfillFromDisk(tracker, logger)
      } catch (error) {
        logger?.warn?.(`[dsh-metrics] 磁盘回扫异常：${error instanceof Error ? error.message : String(error)}`)
      }
    }

    queueMicrotask(() => { void poll() })
    queueMicrotask(() => { void diskFallback() })
  }

  // 3.5 模型价格：后台拉取并缓存，失败时残留缓存仍可用
  ctx.effect(() => {
    let stopped = false
    const refresh = async () => {
      const result = await loadPricingTable(dataDir(tracker.home), logger)
      if (stopped) return
      tracker.setPricing(result.prices, result.fetchedAt)
    }
    void refresh()
    const timer = setInterval(() => { void refresh() }, 6 * 3600_000)
    timer?.unref?.()
    return () => {
      stopped = true
      clearInterval(timer)
    }
  }, 'dsh-metrics: 价格表')

  // 4. 账号快照监视
  if (config.trackAccount) {
    watchAccount(ctx, tracker, logger)
  }

  // 5. 自更新与热重载
  let updater: PluginUpdater | undefined
  if (config.autoUpdate || config.updateRoutes) {
    updater = new PluginUpdater({
      pkgDir: PACKAGE_DIR,
      dataDir: dataDir(tracker.home),
      log: (message: string) => logger?.info?.(message),
      runningVersion: version,
    })

    const reloadFromDisk = async () => {
      if (isReloading()) throw new Error('已有一次重载在进行')
      const result = await selfReload(ctx, {
        logger,
        packageUrl: PACKAGE_URL,
        entryUrl: ENTRY_URL,
      })
      if (!result.ok) throw new Error(result.error)
      return result
    }

    if (config.watchFiles) {
      ctx.effect(() => watchPackage(PACKAGE_DIR, {
        logger,
        onChange: () => {
          if (isReloading()) return
          logger?.info?.('[dsh-metrics] 监视到文件变化，触发热重载')
          void reloadFromDisk().catch((error) => {
            logger?.warn?.(`[dsh-metrics] 热重载失败：${error instanceof Error ? error.message : String(error)}`)
          })
        },
      }), 'dsh-metrics: 文件监视')
    }

    if (config.autoUpdate) {
      const checkUpdater = async () => {
        try {
          await updater?.check()
        } catch (error) {
          logger?.warn?.(`[dsh-metrics] 检查更新失败：${error instanceof Error ? error.message : String(error)}`)
        }
      }
      ctx.effect(() => {
        const kickoff = setTimeout(() => { void checkUpdater() }, 30_000)
        kickoff?.unref?.()
        const timer = setInterval(() => { void checkUpdater() }, 6 * 3600_000)
        timer?.unref?.()
        return () => {
          clearTimeout(kickoff)
          clearInterval(timer)
        }
      }, 'dsh-metrics: 更新检查')
    }
  }

  // 6. 注册 Web API 路由
  registerRoutes(ctx, tracker, {
    version,
    updater,
    onReload: async () => {
      const result = await selfReload(ctx, {
        logger,
        packageUrl: PACKAGE_URL,
        entryUrl: ENTRY_URL,
      })
      if (!result.ok) throw new Error(result.error)
      return result
    },
  })
}

export type {
  AccountSnapshot,
  AccountWallet,
  FailedAttemptsRecord,
  IntegrityCheck,
  MetricsSnapshot,
  ModelTrend,
  PluginConfig,
  RawTokenUsage,
  ScanProgress,
  SessionEventRecordInput,
  SessionSummaryItem,
  StoreData,
  TokenCounters,
  TokenCountersWithRate,
  TrendSeries,
  UpdateCheckResult,
} from '../shared/types'
export { TokenTracker } from './tracker'
