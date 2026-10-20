import { DICT_EN } from './i18nEn'
import { DICT_ZH } from './i18nZh'

export { DICT_EN, DICT_ZH }

export type TranslationKey = keyof typeof DICT_ZH

export function createTranslator(locale: string = 'zh'): (key: string, params?: Record<string, string | number>) => string {
  const dict = locale.startsWith('en') ? DICT_EN : DICT_ZH
  return (key: string, params?: Record<string, string | number>): string => {
    let text = dict[key] ?? key
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(new RegExp(`{${k}}`, 'g'), String(v))
      }
    }
    return text
  }
}
