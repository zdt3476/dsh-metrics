import { describe, expect, it } from 'vitest'
import { compareVersions, parseRepository, parseVersion } from '../../src/host/updater'

describe('updater', () => {
  it('parses semver versions', () => {
    expect(parseVersion('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3, pre: null })
    expect(parseVersion('0.2.0-rc.1')).toEqual({ major: 0, minor: 2, patch: 0, pre: ['rc', '1'] })
    expect(parseVersion('invalid')).toBeNull()
  })

  it('compares versions according to semver spec', () => {
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0)
    expect(compareVersions('1.0.1', '1.0.0')).toBe(1)
    expect(compareVersions('1.0.0', '1.1.0')).toBe(-1)
    expect(compareVersions('2.0.0', '1.9.9')).toBe(1)
    expect(compareVersions('1.0.0-rc.1', '1.0.0')).toBe(-1)
    expect(compareVersions('1.0.0', '1.0.0-rc.1')).toBe(1)
  })

  it('parses github repositories', () => {
    expect(parseRepository('github:user/repo')).toEqual({ owner: 'user', repo: 'repo' })
    expect(parseRepository('https://github.com/user/repo.git')).toEqual({ owner: 'user', repo: 'repo' })
    expect(parseRepository('git+https://github.com/user/repo')).toEqual({ owner: 'user', repo: 'repo' })
    expect(parseRepository({ url: 'https://github.com/user/repo' })).toEqual({ owner: 'user', repo: 'repo' })
    expect(parseRepository(null)).toBeNull()
  })
})
