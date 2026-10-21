import { describe, expect, it } from 'vitest'
import { createTranslator, DICT_EN, DICT_ZH } from '../../src/client/i18n'

describe('client i18n', () => {
  it('translates chinese keys', () => {
    const t = createTranslator('zh')
    expect(t('panel.title')).toBe(DICT_ZH['panel.title'])
    expect(t('range.today')).toBe('今日')
  })

  it('translates english keys', () => {
    const t = createTranslator('en')
    expect(t('panel.title')).toBe(DICT_EN['panel.title'])
    expect(t('range.today')).toBe('Today')
  })

  it('interpolates parameters', () => {
    const t = createTranslator('zh')
    expect(t('not.exist {name}', { name: 'DSH' })).toBe('not.exist DSH')
  })

  it('keeps zh and en dictionaries in sync', () => {
    const zhKeys = Object.keys(DICT_ZH).sort()
    const enKeys = Object.keys(DICT_EN).sort()
    expect(enKeys).toEqual(zhKeys)
  })
})
