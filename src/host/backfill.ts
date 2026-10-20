import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { zstdDecompressSync } from 'node:zlib'
import type { RawTokenUsage, StoreData } from '../shared/types'
import { emptyCounters, sessionOrigin } from '../shared/utils'
import type { LoggerLike, TokenTracker } from './tracker'

export function sessionsDir(): string {
  const home = process.env.DSH_HOME?.trim() || join(homedir(), '.dsh')
  return join(home, 'sessions')
}

export function collectSessionFiles(root: string): string[] {
  const files: string[] = []
  const walk = (dir: string) => {
    let entries: string[] = []
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }
    for (const name of entries) {
      const full = join(dir, name)
      try {
        const info = statSync(full)
        if (info.isDirectory()) {
          walk(full)
        } else if (name.startsWith('session.v') && name.includes('jsonl')) {
          files.push(full)
        }
      } catch {
        continue
      }
    }
  }
  walk(root)
  return files
}

export function readSessionLog(file: string): string {
  const raw = readFileSync(file)
  if (typeof zstdDecompressSync === 'function') {
    try {
      return zstdDecompressSync(raw).toString('utf8')
    } catch {
      // ignore
    }
  }
  try {
    return raw.toString('utf8')
  } catch {
    return ''
  }
}

export interface ParsedSessionLog {
  header?: {
    id?: string
    parentSession?: string
    cwd?: string
    delegationDepth?: number
    origin?: string
    [key: string]: unknown
  }
  events: Array<{
    type?: string
    seq?: number
    time?: number
    data?: {
      turn?: number
      step?: number
      title?: string
      message?: {
        source?: {
          provider?: string
          model?: string
        }
      }
      usage?: RawTokenUsage
      stream?: Array<{ chunk?: { type?: string; usage?: RawTokenUsage } }>
    }
  }>
}

export function parseSessionLog(text: string): ParsedSessionLog {
  let header: ParsedSessionLog['header']
  const events: ParsedSessionLog['events'] = []
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      const event = JSON.parse(trimmed)
      if (event.type === 'session') {
        header = event
      } else if (typeof event.seq === 'number') {
        events.push(event)
      }
    } catch {
      continue
    }
  }
  return { header, events }
}

function prepareFullRebuild(tracker: TokenTracker, logger?: LoggerLike): StoreData | undefined {
  if (tracker.store.needsRebuild !== true) return undefined
  const backup = JSON.parse(JSON.stringify(tracker.store)) as StoreData
  logger?.info?.('token-metrics: 执行全量重算（清空派生聚合后重扫）')
  tracker.reset()
  return backup
}

function rollbackFullRebuild(tracker: TokenTracker, backup: StoreData | undefined, logger?: LoggerLike): void {
  if (!backup) return
  tracker.store = backup
  tracker.markDirty()
  logger?.warn?.('token-metrics: 全量重算未扫到数据，已回滚到原数据')
}

export async function backfillFromDisk(tracker: TokenTracker, logger?: LoggerLike): Promise<number> {
  let sessionsRoot = ''
  try {
    sessionsRoot = sessionsDir()
  } catch {
    return 0
  }
  if (!existsSync(sessionsRoot)) return 0

  let files: string[] = []
  try {
    files = collectSessionFiles(sessionsRoot)
  } catch (error) {
    logger?.warn?.(`token-metrics: 扫描会话目录失败：${error instanceof Error ? error.message : String(error)}`)
    return 0
  }

  let recorded = 0
  let scanned = 0
  const rebuildBackup = prepareFullRebuild(tracker, logger)
  tracker.beginScan(files.length)

  for (const file of files) {
    let text = ''
    try {
      text = readSessionLog(file)
    } catch (error) {
      logger?.warn?.(`token-metrics: 读取 ${file} 失败：${error instanceof Error ? error.message : String(error)}`)
      continue
    }
    const { header, events } = parseSessionLog(text)
    const id = header?.id
    if (!id) continue

    const revision = `disk:${events.length}`
    const previous = tracker.store.needsRebuild ? undefined : tracker.store.scanned[id] as { revision?: string; seq?: number } | undefined
    if (previous && previous.revision === revision) continue
    const fromSeq = typeof previous?.seq === 'number' ? previous.seq : -1
    let maxSeq = fromSeq

    for (const event of events) {
      const seq = typeof event.seq === 'number' ? event.seq : undefined
      if (seq !== undefined) {
        if (seq <= fromSeq) continue
        if (seq > maxSeq) maxSeq = seq
      }
      if (event.type === 'assistant/message') {
        const data = event.data ?? {}
        const source = data.message?.source ?? {}
        if (
          tracker.record({
            sessionId: id,
            provider: source.provider,
            model: source.model,
            turn: data.turn,
            step: data.step,
            usage: data.usage,
            time: event.time,
            parentSession: header.parentSession,
            cwd: header.cwd,
            origin: sessionOrigin(header),
            delegationDepth: header.delegationDepth,
          })
        ) {
          recorded += 1
        }
      } else if (event.type === 'assistant/attempt') {
        let attemptUsage: RawTokenUsage | undefined
        for (const record of event.data?.stream ?? []) {
          if (record?.chunk?.type === 'usage' && record.chunk.usage) {
            attemptUsage = record.chunk.usage
          }
        }
        tracker.recordFailedAttempt(attemptUsage, `${id}:${event.data?.turn}:${event.data?.step}`)
      } else if (event.type === 'session/title') {
        tracker.setTitle(id, event.data?.title)
      }
    }

    tracker.store.scanned[id] = { revision, seq: maxSeq } as unknown as number
    scanned += 1
    tracker.advanceScan()
  }

  tracker.endScan()

  if (rebuildBackup !== undefined && recorded === 0) {
    rollbackFullRebuild(tracker, rebuildBackup, logger)
  } else if (tracker.store.needsRebuild && scanned > 0) {
    tracker.store.needsRebuild = false
  }

  if (recorded > 0) tracker.flush()
  logger?.info?.(`token-metrics: 磁盘回扫完成：检查 ${scanned} 个会话，补录 ${recorded} 次调用`)
  return scanned
}

export interface PersistenceSnapshot {
  revision?: string | number
  header?: {
    id?: string
    parentSession?: string
    cwd?: string
    origin?: string
    delegationDepth?: number
  }
}

export interface PersistenceServiceLike {
  list: () => Promise<PersistenceSnapshot[]>
  open: (id: string, mode: string) => Promise<{
    read: () => Promise<{
      events: Array<{
        type?: string
        seq?: number
        time?: number
        data?: {
          turn?: number
          step?: number
          title?: string
          message?: { source?: { provider?: string; model?: string } }
          usage?: RawTokenUsage
          stream?: Array<{ chunk?: { type?: string; usage?: RawTokenUsage } }>
        }
      }>
    }>
  }>
}

export async function backfillFromLogs(
  tracker: TokenTracker,
  logger: LoggerLike | undefined,
  persistence: PersistenceServiceLike,
): Promise<number> {
  let snapshots: PersistenceSnapshot[] = []
  try {
    snapshots = await persistence.list()
  } catch (error) {
    logger?.warn?.(`token-metrics: 列出会话失败，跳过历史回扫：${error instanceof Error ? error.message : String(error)}`)
    return 0
  }

  let scanned = 0
  let recorded = 0
  const rebuildBackup = prepareFullRebuild(tracker, logger)
  tracker.beginScan(snapshots.length)

  for (const snapshot of snapshots) {
    const id = snapshot.header?.id
    if (!id) continue
    const revision = String(snapshot.revision ?? '')
    const previous = tracker.store.needsRebuild ? undefined : tracker.store.scanned[id] as { revision?: string; seq?: number } | undefined
    if (previous && previous.revision === revision) continue
    const fromSeq = typeof previous?.seq === 'number' ? previous.seq : -1

    let handle
    try {
      handle = await persistence.open(id, 'read')
    } catch {
      continue
    }

    try {
      const { events } = await handle.read()
      let maxSeq = fromSeq
      for (const event of events) {
        const seq = typeof event.seq === 'number' ? event.seq : undefined
        if (seq !== undefined) {
          if (seq <= fromSeq) continue
          if (maxSeq === undefined || seq > maxSeq) maxSeq = seq
        }
        if (event.type === 'assistant/message') {
          const data = event.data ?? {}
          const source = data.message?.source ?? {}
          if (
            tracker.record({
              sessionId: id,
              provider: source.provider,
              model: source.model,
              turn: data.turn,
              step: data.step,
              usage: data.usage,
              time: event.time,
              parentSession: snapshot.header?.parentSession,
              cwd: snapshot.header?.cwd,
              origin: sessionOrigin(snapshot.header),
              delegationDepth: snapshot.header?.delegationDepth,
            })
          ) {
            recorded += 1
          }
        } else if (event.type === 'assistant/attempt') {
          let attemptUsage: RawTokenUsage | undefined
          for (const record of event.data?.stream ?? []) {
            if (record?.chunk?.type === 'usage' && record.chunk.usage) {
              attemptUsage = record.chunk.usage
            }
          }
          tracker.recordFailedAttempt(attemptUsage, `${id}:${event.data?.turn}:${event.data?.step}`)
        } else if (event.type === 'session/title') {
          tracker.setTitle(id, event.data?.title)
        }
      }
      tracker.store.scanned[id] = { revision, seq: maxSeq } as unknown as number
      scanned += 1
    } catch {
      // ignore read error
    }
    tracker.advanceScan()
  }

  tracker.endScan()

  if (rebuildBackup !== undefined && recorded === 0) {
    rollbackFullRebuild(tracker, rebuildBackup, logger)
  } else if (tracker.store.needsRebuild && scanned > 0) {
    tracker.store.needsRebuild = false
  }

  if (recorded > 0) tracker.flush()
  logger?.info?.(`token-metrics: persistence 回扫完成：检查 ${scanned} 个会话，补录 ${recorded} 次调用`)
  return scanned
}
