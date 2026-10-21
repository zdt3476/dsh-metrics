/**
 * 模型价格：从 OpenRouter 公开的 models 接口拉取并缓存。
 *
 * 只用基础价（prompt / completion / input_cache_read / input_cache_write /
 * internal_reasoning）。接口里的峰谷 overrides 需要按调用时间逐条判定，
 * 而账本是按天聚合的，无法回放，因此这里明确不套用折扣——
 * 宁可高估，也不编造一个看似精确的数字。
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ModelPrice, PricingTable } from '../shared/types'
import { normalizeModelName } from '../shared/utils'

const SOURCE_URL = 'https://openrouter.ai/api/v1/models'
const CACHE_FILE = 'pricing.json'
const CACHE_TTL_MS = 24 * 3600_000
const FETCH_TIMEOUT_MS = 15_000

interface RawModel {
  id?: string
  pricing?: Record<string, string | number | undefined>
}

interface CachePayload {
  fetchedAt: number
  prices: PricingTable
}

function toPrice(pricing: Record<string, string | number | undefined> | undefined): ModelPrice | null {
  if (!pricing) return null
  const num = (key: string): number | undefined => {
    const value = pricing[key]
    const parsed = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
  }

  const input = num('prompt')
  const output = num('completion')
  if (input === undefined && output === undefined) return null

  return {
    input: input ?? 0,
    output: output ?? 0,
    cacheRead: num('input_cache_read') ?? input ?? 0,
    cacheWrite: num('input_cache_write') ?? input ?? 0,
    reasoning: num('internal_reasoning') ?? output ?? 0,
  }
}

function buildTable(models: RawModel[]): PricingTable {
  // 同一归一化名可能有多个版本，先按「与归一化名相等程度」排序，再取最优者，
  // 而不是一遇分歧就整条丢弃——否则绝大多数常见模型都会拿不到价格。
  const ranked = new Map<string, Array<{ id: string; score: number; price: ModelPrice }>>()

  for (const model of models) {
    if (!model.id) continue
    const price = toPrice(model.pricing)
    if (!price) continue

    const key = normalizeModelName(model.id)
    const tail = model.id.toLowerCase().slice(model.id.lastIndexOf('/') + 1)
    // 分数越小越可信：0 表示去掉厂商后与归一化名完全一致
    const score = tail === key ? 0 : tail.replace(/:(free|batch|extended|thinking)$/g, '') === key ? 1 : 2

    const bucket = ranked.get(key) ?? []
    bucket.push({ id: model.id, score, price })
    ranked.set(key, bucket)
  }

  const table: PricingTable = {}
  for (const [key, bucket] of ranked) {
    bucket.sort((a, b) => a.score - b.score || a.id.localeCompare(b.id))
    table[key] = bucket[0].price
  }
  return table
}

export function pricingCachePath(home?: string): string {
  return join(home ?? '', CACHE_FILE)
}

function readCache(dir: string): CachePayload | null {
  const file = join(dir, CACHE_FILE)
  if (!existsSync(file)) return null
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as CachePayload
    if (typeof parsed?.fetchedAt !== 'number' || typeof parsed?.prices !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

function writeCache(dir: string, payload: CachePayload): void {
  try {
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, CACHE_FILE), JSON.stringify(payload), 'utf8')
  } catch {
    // 缓存写不进去只影响下次启动要重新拉取，不影响本次统计
  }
}

/**
 * 取价格表：内存 → 磁盘缓存 → 网络。
 * 任何一步失败都返回已有数据，绝不让用量统计因网络问题不可用。
 */
export async function loadPricingTable(
  dir: string,
  logger?: { warn?: (message: string) => void },
  now = Date.now(),
): Promise<{ prices: PricingTable; fetchedAt: number | null; stale: boolean }> {
  const cached = readCache(dir)
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return { prices: cached.prices, fetchedAt: cached.fetchedAt, stale: false }
  }

  try {
    const response = await fetch(SOURCE_URL, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { accept: 'application/json' },
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const payload = (await response.json()) as { data?: RawModel[] }
    const prices = buildTable(payload.data ?? [])
    if (Object.keys(prices).length === 0) throw new Error('价格表为空')

    writeCache(dir, { fetchedAt: now, prices })
    return { prices, fetchedAt: now, stale: false }
  } catch (error) {
    logger?.warn?.(
      `[dsh-metrics] 拉取模型价格失败，沿用缓存：${error instanceof Error ? error.message : String(error)}`,
    )
    if (cached) return { prices: cached.prices, fetchedAt: cached.fetchedAt, stale: true }
    return { prices: {}, fetchedAt: null, stale: true }
  }
}
