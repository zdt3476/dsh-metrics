/**
 * dsh-metrics — 客户端入口（Client Half）。
 *
 * 注册全局国际化语言字典、侧边栏入口图标以及主面板视图。
 */

import { createElement as h } from 'react'
import { TokenUsageIcon } from './components/TokenUsageIcon'
import { TokenUsagePanel } from './components/TokenUsagePanel'
import { DICT_EN, DICT_ZH } from './i18n'
import { entrySeated, type ClientCtx } from './services'

import './styles/base.css'
import './styles/panel.css'
import './styles/cards.css'
import './styles/charts.css'
import './styles/tables.css'

const NS = 'dsh-metrics'
const PANEL_ID = 'dsh-metrics'

export const name = 'dsh-metrics'
export const inject = ['locale', 'slots']

export function apply(ctx: ClientCtx): void {
  // 防重挂载检查
  if (entrySeated(ctx, 'sidebar.panellist', PANEL_ID)) {
    return
  }

  // 1. 注册语言字典
  try {
    ctx.effect(() => {
      return ctx.locale.register(NS, { zh: DICT_ZH, en: DICT_EN })
    }, 'dsh-metrics: dictionaries')
  } catch (error) {
    console.error('[dsh-metrics] 注册语言字典异常：', error)
  }

  const t = ctx.locale?.bind?.(NS) ?? ((key: string) => DICT_ZH[key] ?? key)

  // 2. 注册主面板
  try {
    ctx.slots.inject('main', () => {
      return ctx.slots.register(
        {
          name: 'main',
          key: PANEL_ID,
          inject: () => ({ t }),
        },
        () => h(TokenUsagePanel, { t }),
      )
    })
  } catch (error) {
    console.error('[dsh-metrics] 注册 main slot 异常：', error)
  }

  // 3. 注册侧边栏入口
  try {
    ctx.slots.inject('sidebar.panellist', () => {
      return ctx.slots.register(
        {
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 20,
          label: () => t('panel.title'),
        },
        () => h(TokenUsageIcon, { size: 20 }),
      )
    })
  } catch (error) {
    console.error('[dsh-metrics] 注册 sidebar.panellist slot 异常：', error)
  }
}
