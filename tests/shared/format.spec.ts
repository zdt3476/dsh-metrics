import { describe, expect, it } from 'vitest'
import {
  formatCurrency,
  formatDate,
  formatDuration,
  formatNumber,
  formatPercent,
  formatTokens,
} from '../../src/shared/format'

describe('format utilities', () => {
  it('formats numbers with commas', () => {
    expect(formatNumber(0)).toBe('0')
    expect(formatNumber(1234)).toBe('1,234')
    expect(formatNumber(1234567)).toBe('1,234,567')
    expect(formatNumber(null)).toBe('0')
    expect(formatNumber(undefined)).toBe('0')
  })

  it('formats tokens with SI suffixes', () => {
    expect(formatTokens(0)).toBe('0')
    expect(formatTokens(500)).toBe('500')
    expect(formatTokens(1200)).toBe('1.2k')
    expect(formatTokens(123000)).toBe('123k')
    expect(formatTokens(1500000)).toBe('1.5M')
    expect(formatTokens(2500000000)).toBe('2.5B')
    expect(formatTokens(null)).toBe('0')
  })

  it('formats percentages', () => {
    expect(formatPercent(0)).toBe('0.0%')
    expect(formatPercent(0.5)).toBe('50.0%')
    expect(formatPercent(0.854)).toBe('85.4%')
    expect(formatPercent(1)).toBe('100.0%')
    expect(formatPercent(null)).toBe('0.0%')
  })

  it('formats currency', () => {
    expect(formatCurrency(12.34, 'CNY')).toBe('¥12.34')
    expect(formatCurrency(56.78, 'USD')).toBe('$56.78')
    expect(formatCurrency(100, 'EUR')).toBe('100.00 EUR')
    expect(formatCurrency(null)).toBe('0.00')
  })

  it('formats duration', () => {
    expect(formatDuration(0)).toBe('0s')
    expect(formatDuration(45000)).toBe('45s')
    expect(formatDuration(125000)).toBe('2m 5s')
    expect(formatDuration(3660000)).toBe('1h 1m')
  })

  it('formats date safely', () => {
    const d = new Date('2026-10-20T12:30:00Z')
    expect(formatDate(d)).toBeDefined()
  })
})
