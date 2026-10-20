import { createHash } from 'node:crypto'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import type { UpdateCheckResult } from '../shared/types'

export interface ParsedSemver {
  major: number
  minor: number
  patch: number
  pre: string[] | null
}

export function parseVersion(value?: string | null): ParsedSemver | null {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([\w.]+))?$/.exec(String(value ?? '').trim())
  if (!match) return null
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    pre: match[4] === undefined ? null : match[4].split('.'),
  }
}

export function compareVersions(a?: string | null, b?: string | null): number {
  const left = parseVersion(a)
  const right = parseVersion(b)
  if (!left || !right) return a === b ? 0 : (a ?? '') > (b ?? '') ? 1 : -1
  for (const key of ['major', 'minor', 'patch'] as const) {
    if (left[key] !== right[key]) return left[key] < right[key] ? -1 : 1
  }
  if (left.pre === null && right.pre === null) return 0
  if (left.pre === null) return 1
  if (right.pre === null) return -1
  const width = Math.max(left.pre.length, right.pre.length)
  for (let index = 0; index < width; index += 1) {
    const x = left.pre[index]
    const y = right.pre[index]
    if (x === undefined) return -1
    if (y === undefined) return 1
    const xNumeric = /^\d+$/.test(x)
    const yNumeric = /^\d+$/.test(y)
    if (xNumeric && yNumeric && Number(x) !== Number(y)) return Number(x) < Number(y) ? -1 : 1
    if (xNumeric !== yNumeric) return xNumeric ? -1 : 1
    if (x !== y) return x < y ? -1 : 1
  }
  return 0
}

export function parseRepository(value: unknown): { owner: string; repo: string } | null {
  if (!value) return null
  const raw = typeof value === 'string' ? value : (value as { url?: string }).url
  if (typeof raw !== 'string' || !raw.trim()) return null
  const cleaned = raw.trim().replace(/^git\+/, '')
  const shorthand = /^github:([^/]+)\/([^/#.]+?)(?:\.git)?(?:#.*)?$/.exec(cleaned)
  if (shorthand) return { owner: shorthand[1], repo: shorthand[2] }
  const match = /github\.com[/:]([^/]+)\/([^/#.]+?)(?:\.git)?(?:#.*)?$/.exec(cleaned)
  if (!match) return null
  return { owner: match[1], repo: match[2] }
}

export async function renameWithRetry(from: string, to: string): Promise<void> {
  let delay = 60
  for (let attempt = 0; ; attempt += 1) {
    try {
      renameSync(from, to)
      return
    } catch (error) {
      const code = (error as { code?: string })?.code
      if ((code === 'EPERM' || code === 'EACCES') && attempt < 8) {
        await new Promise(r => setTimeout(r, delay))
        delay = Math.min(delay * 1.5, 400)
        continue
      }
      throw error
    }
  }
}

export class PluginUpdater {
  pkgDir: string
  dataDir: string
  log?: (msg: string) => void
  runningVersion: string
  lastCheckResult?: UpdateCheckResult
  lastCheckAt = 0

  constructor(options: {
    pkgDir: string
    dataDir: string
    log?: (msg: string) => void
    runningVersion: string
  }) {
    this.pkgDir = options.pkgDir
    this.dataDir = options.dataDir
    this.log = options.log
    this.runningVersion = options.runningVersion
  }

  async check(): Promise<UpdateCheckResult> {
    try {
      const pkgPath = join(this.pkgDir, 'package.json')
      if (!existsSync(pkgPath)) {
        return { ok: false, error: 'package.json 不存在' }
      }
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
      const repo = parseRepository(pkg.repository)
      if (!repo) {
        return { ok: false, error: '未声明有效的 GitHub repository' }
      }

      const url = `https://api.github.com/repos/${repo.owner}/${repo.repo}/releases/latest`
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'dsh-metrics',
        },
      })

      if (!res.ok) {
        return { ok: false, error: `GitHub API 响应 ${res.status}` }
      }

      const data = await res.json() as {
        tag_name?: string
        html_url?: string
        body?: string
        published_at?: string
      }
      const latestTag = (data.tag_name ?? '').replace(/^v/, '')
      const hasUpdate = compareVersions(latestTag, this.runningVersion) > 0

      const result: UpdateCheckResult = {
        ok: true,
        hasUpdate,
        currentVersion: this.runningVersion,
        latestVersion: latestTag,
        releaseUrl: data.html_url,
        releaseNotes: data.body,
        publishedAt: data.published_at,
      }

      this.lastCheckResult = result
      this.lastCheckAt = Date.now()
      return result
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      return { ok: false, error: msg }
    }
  }
}
