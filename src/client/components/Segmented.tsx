/**
 * 分段控件：时间范围、口径切换等多处复用。
 *
 * 用 role=group + aria-pressed 表达单选语义，而不是自己造 tablist ——
 * 这些按钮切换的是同一份数据的视图参数，不是面板导航，用按压态更贴合语义，
 * 也让键盘 Tab / 空格操作天然可用。
 */

import type { FC } from 'react'
import { cn } from './cn'

export interface SegmentedOption<T extends string | number> {
  value: T
  label: string
  /** 悬停说明，例如指标口径的解释。 */
  title?: string
}

export interface SegmentedProps<T extends string | number> {
  options: ReadonlyArray<SegmentedOption<T>>
  value: T
  onChange: (value: T) => void
  label: string
  disabled?: boolean
  className?: string
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
  disabled = false,
  className,
}: SegmentedProps<T>): ReturnType<FC> {
  return (
    <div className={cn('tm-seg', className)} role="group" aria-label={label}>
      {options.map(option => {
        const active = option.value === value
        return (
          <button
            key={String(option.value)}
            type="button"
            className="tm-seg-item"
            aria-pressed={active}
            title={option.title}
            disabled={disabled}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
