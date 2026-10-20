import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { dataDir, emptyStore, isOwnStore, loadStore, saveStore, storePath } from '../../src/host/storage'
import { STORE_VERSION } from '../../src/shared/utils'

describe('storage', () => {
  it('identifies own store files', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'tm-test-store-'))
    const file = join(tmp, 'test.json')

    writeFileSync(file, 'not json', 'utf8')
    expect(isOwnStore(file)).toBe(false)

    writeFileSync(
      file,
      JSON.stringify({
        version: STORE_VERSION,
        seen: {},
        total: {},
        byDay: {},
      }),
      'utf8',
    )
    expect(isOwnStore(file)).toBe(true)
    rmSync(tmp, { recursive: true, force: true })
  })

  it('initializes and saves store atomically', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'tm-test-save-'))
    const { store, fresh } = loadStore(tmp, 'build-1')
    expect(fresh).toBe(true)
    expect(store.version).toBe(STORE_VERSION)

    store.total.calls = 5
    saveStore(tmp, store)

    const reloaded = loadStore(tmp, 'build-1')
    expect(reloaded.fresh).toBe(false)
    expect(reloaded.store.total.calls).toBe(5)

    rmSync(tmp, { recursive: true, force: true })
  })
})
