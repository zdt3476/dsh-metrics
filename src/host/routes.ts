import type { Context } from '@deepseek-ai/cordis'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { TokenTracker } from './tracker'
import type { PluginUpdater } from './updater'

export interface WebServerService {
  register: (route: {
    kind: string
    path: string
    handler: (req: IncomingMessage, res: ServerResponse) => Promise<void> | void
  }) => () => void
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const data = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
    'Cache-Control': 'no-store',
  })
  res.end(data)
}

export function registerRoutes(
  ctx: Context,
  tracker: TokenTracker,
  options: {
    version: string
    updater?: PluginUpdater
    onReload?: () => Promise<unknown>
  },
): void {
  ctx.inject(['webServer'], (webCtx) => {
    const server = webCtx.get('webServer') as WebServerService | undefined
    if (!server) return

    webCtx.effect(() => {
      try {
        const handler = async (req: IncomingMessage, res: ServerResponse) => {
          const url = new URL(req.url ?? '/', 'http://localhost')
          const isGet = req.method === 'GET'
          const isPost = req.method === 'POST'
          const sub = url.pathname.replace(/^\/api\/dsh-(?:token-)?metrics/, '')

          if (sub === '/summary') {
            if (!isGet) {
              sendJson(res, 405, { error: 'method not allowed' })
              return
            }
            sendJson(res, 200, tracker.snapshot())
            return
          }

          if (sub === '/flush') {
            if (!isGet && !isPost) {
              sendJson(res, 405, { error: 'method not allowed' })
              return
            }
            tracker.flush()
            sendJson(res, 200, tracker.snapshot())
            return
          }

          if (sub === '/version') {
            if (!isGet) {
              sendJson(res, 405, { error: 'method not allowed' })
              return
            }
            sendJson(res, 200, {
              version: options.version,
              buildId: tracker.buildId,
              repositoryUrl: 'https://github.com/zdt3476/dsh-metrics',
            })
            return
          }

          if (sub === '/update/check') {
            if (!isGet) {
              sendJson(res, 405, { error: 'method not allowed' })
              return
            }
            if (!options.updater) {
              sendJson(res, 503, { error: 'updater not enabled' })
              return
            }
            const result = await options.updater.check()
            sendJson(res, 200, result)
            return
          }

          if (sub === '/reload') {
            if (!isPost) {
              sendJson(res, 405, { error: 'method not allowed' })
              return
            }
            if (!options.onReload) {
              sendJson(res, 503, { error: 'reload not supported' })
              return
            }
            try {
              const reloadRes = await options.onReload()
              sendJson(res, 200, reloadRes)
            } catch (error) {
              sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
            }
            return
          }

          sendJson(res, 404, { error: 'not found' })
        }

        const unregNew = server.register({
          kind: 'prefix',
          path: '/api/dsh-metrics',
          handler,
        })
        const unregOld = server.register({
          kind: 'prefix',
          path: '/api/dsh-token-metrics',
          handler,
        })

        return () => {
          unregNew()
          unregOld()
        }
      } catch {
        return () => {}
      }
    })
  })
}
