import { afterEach, describe, expect, it } from 'vitest'
import { TIME_RANGES } from '../../src/client/derived'
import { loadTimeRange, parseTimeRange, saveTimeRange } from '../../src/client/persist'

/** 最小 Storage 替身：node 环境默认没有 localStorage。 */
function installStorage(initial: Record<string, string> = {}): Map<string, string> {
  const data = new Map(Object.entries(initial))
  const fake = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    clear: () => data.clear(),
    key: (index: number) => [...data.keys()][index] ?? null,
    get length() {
      return data.size
    },
  } as unknown as Storage
  Object.defineProperty(globalThis, 'localStorage', { value: fake, configurable: true })
  return data
}

function removeStorage(): void {
  Object.defineProperty(globalThis, 'localStorage', { value: undefined, configurable: true })
}

afterEach(() => {
  removeStorage()
})

describe('parseTimeRange', () => {
  it('接受全部合法范围', () => {
    for (const range of TIME_RANGES) {
      expect(parseTimeRange(range)).toBe(range)
    }
  })

  it('拒绝空值与脏数据', () => {
    for (const raw of [null, undefined, '', '1d', 'ALL', ' week ', '{}']) {
      expect(parseTimeRange(raw)).toBeNull()
    }
  })
})

describe('时间范围持久化', () => {
  it('退出再进入后保留上次选择', () => {
    installStorage()
    saveTimeRange('7d')
    // 模拟面板卸载后重新挂载：重新读取一次初值
    expect(loadTimeRange()).toBe('7d')
  })

  it('无持久化记录时回退到「全部」', () => {
    installStorage()
    expect(loadTimeRange()).toBe('all')
  })

  it('存储中的脏值被忽略', () => {
    installStorage({ 'dsh-metrics.range': 'last-year' })
    expect(loadTimeRange()).toBe('all')
  })

  it('localStorage 不可用时不抛错且回退默认值', () => {
    removeStorage()
    expect(loadTimeRange()).toBe('all')
    expect(() => saveTimeRange('3d')).not.toThrow()
  })
})
