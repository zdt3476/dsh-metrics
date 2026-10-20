import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('package manifest & artifacts', () => {
  const root = process.cwd()
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

  it('declares correct package metadata', () => {
    expect(pkg.name).toBe('@zdt3476/dsh-metrics')
    expect(pkg.version).toBeDefined()
    expect(pkg.main).toBe('lib/index.js')
    expect(pkg.types).toBe('lib/index.d.ts')
    expect(pkg.exports['.'].default).toBe('./lib/index.js')
    expect(pkg.exports['./client']).toBe('./lib/client.js')
    expect(pkg.repository.url).toContain('zdt3476/dsh-metrics')
  })

  it('includes all distribution artifacts in files whitelist', () => {
    const requiredFiles = [
      'lib/index.js',
      'lib/index.d.ts',
      'lib/client.js',
      'cordis.patch.yml',
      'icon.svg',
      'README.md',
      'LICENSE',
    ]
    for (const file of requiredFiles) {
      expect(pkg.files).toContain(file)
      expect(existsSync(join(root, file))).toBe(true)
    }
  })
})
