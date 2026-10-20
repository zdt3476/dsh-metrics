/**
 * 共享格式化函数：数值、Token 数量、百分比、货币与日期。
 */

export function formatNumber(val: number | string | null | undefined): string {
  if (val === null || val === undefined) return '0'
  const n = typeof val === 'number' ? val : Number(val)
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString('en-US')
}

export function formatTokens(val: number | string | null | undefined): string {
  if (val === null || val === undefined) return '0'
  const n = typeof val === 'number' ? val : Number(val)
  if (!Number.isFinite(n)) return '0'
  if (n < 0) return '0'
  if (n < 1_000) return String(Math.round(n))
  if (n < 1_000_000) {
    const k = n / 1_000
    return k >= 100 ? `${Math.round(k)}k` : `${k.toFixed(1).replace(/\.0$/, '')}k`
  }
  if (n < 1_000_000_000) {
    const m = n / 1_000_000
    return m >= 100 ? `${Math.round(m)}M` : `${m.toFixed(2).replace(/\.?0+$/, '')}M`
  }
  const b = n / 1_000_000_000
  return `${b.toFixed(2).replace(/\.?0+$/, '')}B`
}

export function formatPercent(rate: number | null | undefined, decimals = 1): string {
  if (rate === null || rate === undefined || !Number.isFinite(rate)) return '0.0%'
  const clamped = Math.max(0, Math.min(1, rate))
  return `${(clamped * 100).toFixed(decimals)}%`
}

export function formatCurrency(amount: string | number | null | undefined, currency?: string): string {
  if (amount === null || amount === undefined) return '0.00'
  const n = typeof amount === 'number' ? amount : parseFloat(String(amount))
  if (!Number.isFinite(n)) return String(amount)
  const formatted = n.toFixed(2)
  if (!currency) return formatted
  const upper = currency.toUpperCase()
  if (upper === 'CNY' || upper === 'RMB') return `¥${formatted}`
  if (upper === 'USD') return `$${formatted}`
  return `${formatted} ${upper}`
}

export function formatDate(time: number | string | Date): string {
  try {
    const d = new Date(time)
    if (Number.isNaN(d.getTime())) return String(time)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return String(time)
  }
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0s'
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}
