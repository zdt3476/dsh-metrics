/**
 * Tailwind 编译期提取 —— 构建插件。
 *
 * 目标：把 src/client/styles/app.css（Tailwind 入口 + 语义令牌 + 组件层）在构建期
 * 编译成一段纯 CSS 字符串，交给 tsdown 现有的 styleInjectionModule 内联进
 * lib/client.js。运行时零新增依赖，产物仍是一个自包含的 CJS 模块。
 *
 * 为什么不用 PostCSS / @tailwindcss/vite：
 * 本仓库的 CSS 通道是自实现的虚拟模块（见 tsdown.config.ts 的 cssChannels），
 * 引入完整工具链只会和它打架。这里只用 tailwindcss 的官方 compile() API，
 * 自己实现 loadStylesheet，把「本地 @import」和「包内 @import」都解析掉。
 *
 * candidate 列表：app.css 里所有样式都通过 @apply 收敛到语义类，不使用散落的
 * 原子类，因此候选集为空即可 —— 产物只包含组件层，绝不会向宿主泄漏未加前缀的
 * utility。若将来确实需要原子类，把需要的类名加进 CANDIDATES 即可。
 */

import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, isAbsolute, resolve as resolvePath } from 'node:path'
import { compile } from 'tailwindcss'

/** 额外需要的原子类候选（前缀由 prefix(tm) 统一加，这里写不带前缀的名字）。 */
const CANDIDATES: string[] = []

const TAILWIND_SCOPE = 'tailwindcss'

/**
 * 解析 @import：tailwindcss/* 走包内文件，其余按相对路径解析。
 * 包内文件用 Node 的模块解析定位，不能手动拼路径 —— 依赖被 pnpm 放在 .pnpm 下的
 * 真实位置，拼 node_modules/tailwindcss 会找不到。
 */
function createStyleLoader() {
  const require = createRequire(import.meta.url)
  const tailwindRoot = dirname(require.resolve(`${TAILWIND_SCOPE}/package.json`))

  return async function loadStylesheet(id: string, base: string) {
    if (id === TAILWIND_SCOPE || id.startsWith(`${TAILWIND_SCOPE}/`)) {
      const rest = id.slice(TAILWIND_SCOPE.length).replace(/^\//, '')
      // tailwindcss 的包入口是目录，对应 index.css
      const target = resolvePath(tailwindRoot, rest === '' ? 'index.css' : rest)
      const file = target.endsWith('.css') ? target : resolvePath(target, 'index.css')
      return { content: await readFile(file, 'utf8'), base: dirname(file) }
    }

    const target = isAbsolute(id) ? id : resolvePath(base, id)
    return { content: await readFile(target, 'utf8'), base: dirname(target) }
  }
}

/**
 * 把入口 CSS 编译成最终样式字符串。
 * 返回已去掉 Tailwind 许可证注释的 CSS —— 产物头部由 tsdown 的构建横幅统一负责，
 * 两处都打一次会让同一段许可证在 client.js 里出现两遍。
 */
export async function compileClientStyles(entryFile: string): Promise<string> {
  const source = await readFile(entryFile, 'utf8')
  const compiled = await compile(source, {
    base: dirname(entryFile),
    loadStylesheet: createStyleLoader(),
  })

  return compiled
    .build(CANDIDATES)
    .replace(/^\/\*![\s\S]*?\*\/\n?/, '')
    .trim()
}
