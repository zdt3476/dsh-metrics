/**
 * 空态与行内提示条。
 *
 * 空态刻意左对齐、限制在 48ch 内，不做居中大卡片：这是数据看板里的一个缺席状态，
 * 不是落地页的营销区块，居中会把它抬成页面主角。
 *
 * 提示条区分 info / warn / error 三级，错误态带一个明确的补救动作（重试），
 * 不允许静默失败。
 */

import type { FC, ReactNode } from 'react'
import { cn } from './cn'

export interface EmptyStateProps {
  title: string
  text?: string
  action?: ReactNode
}

export const EmptyState: FC<EmptyStateProps> = ({ title, text, action }) => (
  <div className="tm-empty">
    <div className="tm-empty-title">{title}</div>
    {text && <p className="tm-empty-text">{text}</p>}
    {action && <div className="tm-empty-action">{action}</div>}
  </div>
)

export type NoticeTone = 'info' | 'accent' | 'warn' | 'error'

export interface NoticeProps {
  tone?: NoticeTone
  title: string
  text?: string
  actions?: ReactNode
}

const TONE_CLASS: Record<NoticeTone, string> = {
  info: '',
  accent: 'tm-notice--accent',
  warn: 'tm-notice--warn',
  error: 'tm-notice--error',
}

/**
 * 行内提示条。role 按语气区分：
 * error 用 alert（需要立刻被读屏播报），其余用 status（等空闲再播报，不打断）。
 */
export const Notice: FC<NoticeProps> = ({ tone = 'info', title, text, actions }) => (
  <div className={cn('tm-notice', TONE_CLASS[tone])} role={tone === 'error' ? 'alert' : 'status'}>
    <div className="tm-notice-body">
      <span className="tm-notice-title">{title}</span>
      {text && <span className="tm-notice-text">{text}</span>}
    </div>
    {actions && <div className="tm-notice-actions">{actions}</div>}
  </div>
)
