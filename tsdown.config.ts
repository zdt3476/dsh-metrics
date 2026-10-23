import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { isBuiltin } from 'node:module'
import { basename, dirname, join, resolve as resolvePath } from 'node:path'
import { transform } from 'lightningcss'
import { defineConfig } from 'tsdown'

const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'))

/**
 * 构建横幅只保留与构建环境无关的静态信息（名称 / 版本 / 描述 / 许可证）。
 * 时间戳与 git 状态会让同一份源码产生不同产物，破坏可复现构建，
 * 也会让 CI 的「lib 与源码一致」闸门永远无法通过；版本与出处由 package.json 和 git 标签承担。
 */
function artifactBanner(): string {
  const lines = [
    ` * ${pkg.name} v${pkg.version}`,
    ` * ${pkg.description}`,
    ` * @author ${pkg.author}`,
    ` * @license ${pkg.license}`,
  ]
  return ['/**', ...lines, ' */', ''].join('\n')
}

const PLATFORM_MODULES = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  '@deepseek-ai/dsh-client-ui-primitives',
]

const requested = new Set([
  ...PLATFORM_MODULES,
  ...(pkg.dsh?.client?.external ?? []),
])
const isRequested = (specifier: string): boolean => requested.has(specifier)

const productionDeps = new Set([
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
  ...Object.keys(pkg.optionalDependencies ?? {}),
])
const escapeSpecifier = (name: string): string => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const productionPatterns = [...productionDeps].map(name => new RegExp(`^${escapeSpecifier(name)}(/|$)`))
const isProductionDependency = (specifier: string): boolean =>
  productionPatterns.some(pattern => pattern.test(specifier))

const NODE_ENV = process.env.NODE_ENV ?? 'production'

const CSS_VIRTUAL_PREFIX = '\0dsh-css:'
const GLOBAL_CSS_VIRTUAL_PREFIX = '\0dsh-global-css:'
const CSS_VIRTUAL_SUFFIX = '.mjs'

function styleInjectionModule(
  id: string,
  fileId: string,
  css: string,
  classMap?: Readonly<Record<string, string>>,
): string {
  const source = [
    `const css = ${JSON.stringify(css)};`,
    `const tagId = ${JSON.stringify(`${id}/${basename(fileId)}`)};`,
    'if (typeof document !== \'undefined\' && document.querySelector(\'style[data-plugin-css=\' + JSON.stringify(tagId) + \']\') === null) {',
    '  const tag = document.createElement(\'style\');',
    `  tag.dataset.plugin = ${JSON.stringify(id)};`,
    '  tag.dataset.pluginCss = tagId;',
    '  tag.textContent = css;',
    '  document.head.appendChild(tag);',
    '}',
  ]
  source.push(classMap === undefined ? 'export {};' : `export default ${JSON.stringify(classMap)};`)
  return source.join('\n')
}

function sourceAssetPath(source: string, importer: string): string {
  return resolvePath(dirname(importer), source)
}

function cssChannels(id: string) {
  return [
    {
      name: 'dsh-css-modules-inline',
      resolveId(source: string, importer: string | undefined) {
        if (!source.endsWith('.module.css')) return null
        const abs = importer !== undefined ? sourceAssetPath(source, importer) : source
        return CSS_VIRTUAL_PREFIX + abs + CSS_VIRTUAL_SUFFIX
      },
      async load(this: { addWatchFile(file: string): void }, virtualId: string) {
        if (!virtualId.startsWith(CSS_VIRTUAL_PREFIX)) return null
        const fileId = virtualId.slice(CSS_VIRTUAL_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length)
        this.addWatchFile(fileId)
        const source = await readFile(fileId)
        const { code, exports: cssExports } = transform({
          filename: fileId,
          code: source,
          cssModules: { pattern: '[hash]_[local]' },
          minify: true,
        })
        const classMap: Record<string, string> = {}
        const exportEntries = Object.entries(cssExports ?? {})
          .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        for (const [local, exp] of exportEntries) classMap[local] = exp.name
        return styleInjectionModule(id, fileId, code.toString(), classMap)
      },
    },
    {
      name: 'dsh-css-global-inline',
      resolveId(source: string, importer: string | undefined) {
        if (!source.endsWith('.css') || source.endsWith('.module.css')) return null
        const abs = importer !== undefined ? sourceAssetPath(source, importer) : source
        return GLOBAL_CSS_VIRTUAL_PREFIX + abs + CSS_VIRTUAL_SUFFIX
      },
      async load(this: { addWatchFile(file: string): void }, virtualId: string) {
        if (!virtualId.startsWith(GLOBAL_CSS_VIRTUAL_PREFIX)) return null
        const fileId = virtualId.slice(GLOBAL_CSS_VIRTUAL_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length)
        this.addWatchFile(fileId)
        const raw = await readFile(fileId)
        const { code: css } = transform({ filename: fileId, code: raw, minify: true })
        return styleInjectionModule(id, fileId, css.toString())
      },
    },
  ]
}

const OUTPUT_COMMENTS = { legal: true, annotation: false, jsdoc: false } as const

export default defineConfig([
  {
    name: pkg.name,
    entry: { index: 'src/host/index.ts' },
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    minify: true,
    sourcemap: true,
    dts: true,
    clean: true,
    banner: () => ({ js: artifactBanner() }),
    outputOptions: { comments: OUTPUT_COMMENTS },
    deps: {
      neverBundle: isProductionDependency,
      alwaysBundle: (specifier: string) => !isBuiltin(specifier) && !isProductionDependency(specifier),
    },
  },
  {
    name: `${pkg.name}/client`,
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    target: 'es2024',
    dts: false,
    sourcemap: true,
    clean: false,
    minify: true,
    deps: {
      neverBundle: isRequested,
      alwaysBundle: (specifier: string) => !isRequested(specifier),
    },
    define: {
      'process.env': '{}',
      'process.env.NODE_ENV': JSON.stringify(NODE_ENV),
      'import.meta.env.MODE': JSON.stringify(NODE_ENV),
      'import.meta.env': JSON.stringify({ MODE: NODE_ENV }),
      __DSH_METRICS_VERSION__: JSON.stringify(pkg.version),
      __DSH_METRICS_REPO__: JSON.stringify(
        String((pkg.repository && pkg.repository.url) || '').replace(/^git\+/, '').replace(/\.git$/, ''),
      ),
    },
    banner: () => ({ js: artifactBanner() }),
    plugins: [
      {
        name: 'dsh-svg-raw',
        resolveId(source: string, importer: string | undefined) {
          if (!source.endsWith('.svg?raw')) return null
          const target = source.slice(0, -'?raw'.length)
          return importer === undefined ? target : resolvePath(dirname(importer), target) + '?raw'
        },
        load(id: string) {
          if (!id.endsWith('.svg?raw')) return null
          const markup = readFileSync(id.slice(0, -'?raw'.length), 'utf8').trim().replace(/>\s+</g, '><')
          return `export default ${JSON.stringify(markup)}`
        },
      },
      ...cssChannels(pkg.name),
    ],
    outputOptions: {
      comments: OUTPUT_COMMENTS,
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(pkg.name)}, factory: (require) => {`,
      intro: 'var module = { exports: {} }; var exports = module.exports;',
      footer: 'return module.exports; } });',
    },
  },
])
