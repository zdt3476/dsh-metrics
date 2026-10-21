import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { selfReload } from '../../src/host/reload'
import type { Context } from '@deepseek-ai/cordis'

const dirs: string[] = []

function makePackage(version: string): { dir: string; entry: string; packageUrl: string } {
  const dir = mkdtempSync(join(tmpdir(), 'tm-reload-'))
  dirs.push(dir)
  const entryFile = join(dir, 'entry.mjs')
  writeFileSync(
    entryFile,
    `export const name = 'fixture-plugin'\nexport const version = ${JSON.stringify(version)}\nexport function apply() {}\n`,
  )
  return { dir, entry: pathToFileURL(entryFile).href, packageUrl: pathToFileURL(`${dir}/`).href }
}

interface FakeFiber {
  runtime: { callback?: unknown; Config?: unknown; name?: string } | null
  restart: () => Promise<void>
}

const runtimeOf = (ctx: Context): FakeFiber['runtime'] =>
  (ctx as unknown as { fiber: FakeFiber }).fiber.runtime

function makeCtx(restarts: { count: number }): Context {
  const originalCallback = () => {}
  const fiber: FakeFiber = {
    runtime: { callback: originalCallback, name: 'fixture-plugin' },
    restart: async () => {
      restarts.count += 1
    },
  }
  return { fiber } as unknown as Context
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('selfReload', () => {
  it('reports the on-disk version and re-mounts the plugin runtime', async () => {
    const pkg = makePackage('9.9.9')
    const restarts = { count: 0 }
    const ctx = makeCtx(restarts)
    const before = runtimeOf(ctx)?.callback

    const result = await selfReload(ctx, {
      packageUrl: pkg.packageUrl,
      entryUrl: pkg.entry,
    })

    expect(result).toEqual({ ok: true, newVersion: '9.9.9' })

    // 关键：runtime.callback 必须换成新模块的 apply，并触发一次重启，
    // 否则插件会继续运行旧闭包（例如版本号、路由处理器都不更新）。
    expect(restarts.count).toBe(1)
    const runtime = runtimeOf(ctx)
    expect(typeof runtime?.callback).toBe('function')
    expect(runtime?.callback).not.toBe(before)
  })

  it('reports failure without touching the fiber when the entry cannot be imported', async () => {
    const pkg = makePackage('9.9.9')
    const restarts = { count: 0 }
    const ctx = makeCtx(restarts)
    const originalCallback = runtimeOf(ctx)?.callback

    const result = await selfReload(ctx, {
      packageUrl: pkg.packageUrl,
      entryUrl: pathToFileURL(join(pkg.dir, 'missing.mjs')).href,
    })

    expect(result.ok).toBe(false)
    expect(restarts.count).toBe(0)
    expect(runtimeOf(ctx)?.callback).toBe(originalCallback)
  })
})
