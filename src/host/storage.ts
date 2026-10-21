import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { StoreData } from '../shared/types'
import { emptyCounters, STORE_VERSION } from '../shared/utils'

export const DIR_NAME = 'dsh-metrics'
export const LEGACY_DIR_NAMES = ['token-metrics', 'token-usage-stats', 'token-usage']

export function isOwnStore(filePath: string): boolean {
  try {
    const raw = readFileSync(filePath, 'utf8')
    const parsed = JSON.parse(raw)
    return (
      parsed !== null &&
      typeof parsed === 'object' &&
      parsed.version === STORE_VERSION &&
      typeof parsed.seen === 'object' &&
      parsed.seen !== null &&
      typeof parsed.total === 'object' &&
      parsed.total !== null &&
      typeof parsed.byDay === 'object' &&
      parsed.byDay !== null
    )
  } catch {
    return false
  }
}

export function dataDir(home?: string): string {
  const root = home ?? process.env.DSH_HOME?.trim() ?? join(homedir(), '.dsh')
  const next = join(root, DIR_NAME)
  const nextStore = join(next, 'usage.json')

  if (existsSync(nextStore)) return next

  for (const legacy of LEGACY_DIR_NAMES) {
    const previous = join(root, legacy)
    const previousStore = join(previous, 'usage.json')
    if (!existsSync(previousStore) || !isOwnStore(previousStore)) continue
    try {
      mkdirSync(next, { recursive: true })
      copyFileSync(previousStore, nextStore)
      return next
    } catch {
      return previous
    }
  }

  return next
}

export function storePath(home?: string): string {
  return join(dataDir(home), 'usage.json')
}

export function emptyStore(buildId: string): StoreData {
  return {
    version: STORE_VERSION,
    buildId,
    needsRebuild: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    seen: {},
    total: emptyCounters(),
    byDay: {},
    byProvider: {},
    byModel: {},
    byModelName: {},
    byDayModel: {},
    byDayModelName: {},
    bySession: {},
    byProject: {},
    byOrigin: {},
    byHour: {},
    recentMinutes: [],
    failedAttempts: { count: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, billable: 0 },
    accounts: {},
    currentAccount: null,
    scanned: {},
  }
}

export function loadStore(
  home: string | undefined,
  buildId: string,
  logger?: { warn?: (msg: string) => void },
): { store: StoreData; fresh: boolean } {
  const file = storePath(home)
  if (!existsSync(file)) {
    return { store: emptyStore(buildId), fresh: true }
  }

  try {
    const content = readFileSync(file, 'utf8')
    const parsed = JSON.parse(content) as StoreData
    if (parsed && parsed.version === STORE_VERSION && parsed.seen && parsed.total && parsed.byDay) {
      // 容错与补全字段
      parsed.byProvider ??= {}
      parsed.byModel ??= {}
      parsed.byModelName ??= {}
      parsed.byDayModel ??= {}
      parsed.byDayModelName ??= {}
      parsed.bySession ??= {}
      parsed.byProject ??= {}
      parsed.byOrigin ??= {}
      parsed.byHour ??= {}
      parsed.recentMinutes ??= []
      parsed.failedAttempts ??= { count: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, billable: 0 }
      parsed.accounts ??= {}
      parsed.currentAccount ??= null
      parsed.scanned ??= {}
      return { store: parsed, fresh: false }
    }
  } catch (error) {
    logger?.warn?.(`[dsh-metrics] 读取存储失败，重新初始化：${error instanceof Error ? error.message : String(error)}`)
  }

  return { store: emptyStore(buildId), fresh: true }
}

export function saveStore(
  home: string | undefined,
  store: StoreData,
  logger?: { warn?: (msg: string) => void },
): void {
  const dir = dataDir(home)
  const file = storePath(home)
  const temp = `${file}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`

  try {
    mkdirSync(dir, { recursive: true })
    store.updatedAt = Date.now()
    writeFileSync(temp, JSON.stringify(store, null, 2), 'utf8')
    renameSync(temp, file)
  } catch (error) {
    try {
      if (existsSync(temp)) unlinkSync(temp)
    } catch {
      // ignore
    }
    logger?.warn?.(`[dsh-metrics] 写入存储失败：${error instanceof Error ? error.message : String(error)}`)
  }
}
