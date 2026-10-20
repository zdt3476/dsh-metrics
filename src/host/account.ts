import type { Context } from '@deepseek-ai/cordis'
import type { AccountSnapshot, AccountWallet } from '../shared/types'
import type { LoggerLike, TokenTracker } from './tracker'

export interface DeepSeekAccountService {
  getState: () => Promise<{ status?: string; links?: { usageUrl?: string; topUpUrl?: string } }>
  getProfile: (client: unknown) => Promise<{ status?: string; value?: { id?: string | number; name?: string } }>
  getBalance: (client: unknown) => Promise<{
    status?: string
    value?: Array<{ currency: string; balance: string }>
    bonusWallets?: Array<{ currency: string; balance: string }>
  }>
  getDeviceIdentity: () => Promise<{ userId?: string | number }>
}

export function watchAccount(
  ctx: Context,
  tracker: TokenTracker,
  logger?: LoggerLike,
): void {
  const refreshAccount = async () => {
    try {
      const account = ctx.get('deepseekAccount') as DeepSeekAccountService | undefined
      if (!account) return

      const state = await account.getState().catch(() => undefined)
      if (state?.status !== 'credential-stored') {
        tracker.setCurrentAccount(null)
        return
      }

      const client = {
        version: '0.1.0',
        locale: 'zh',
        timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60,
      }

      const [profile, balance, identity] = await Promise.all([
        account.getProfile(client).catch(() => null),
        account.getBalance(client).catch(() => null),
        account.getDeviceIdentity().catch(() => undefined),
      ])

      const id = profile?.status === 'ready'
        ? (profile.value?.id ?? identity?.userId ?? undefined)
        : identity?.userId

      const walletList = (wallets?: Array<{ currency: string; balance: string }> | null): AccountWallet[] | null => {
        if (!Array.isArray(wallets)) return null
        return wallets.map(w => ({ currency: String(w.currency), balance: String(w.balance) }))
      }

      const snapshot: AccountSnapshot = {
        id: id === undefined || id === null ? 'signed-in' : String(id),
        name: profile?.status === 'ready' ? (profile.value?.name ?? null) : null,
        balance: balance?.status === 'ready' ? walletList(balance.value) : null,
        bonus: balance?.status === 'ready' ? walletList(balance.bonusWallets) : null,
        usageUrl: state.links?.usageUrl ?? null,
        topUpUrl: state.links?.topUpUrl ?? null,
        refreshedAt: Date.now(),
      }

      tracker.setCurrentAccount(snapshot)
    } catch (error) {
      logger?.warn?.(`token-metrics: 刷新账号信息失败：${error instanceof Error ? error.message : String(error)}`)
    }
  }

  queueMicrotask(() => {
    void refreshAccount()
  })

  ctx.effect(() => {
    const timer = setInterval(() => {
      void refreshAccount()
    }, 600_000)
    timer?.unref?.()
    return () => clearInterval(timer)
  }, 'token-metrics: 账号刷新')
}
