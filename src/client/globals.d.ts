declare function require(id: string): unknown
declare let module: { exports: Record<string, unknown> }
declare let exports: Record<string, unknown>

declare module '*.css'
declare module '*.module.css' {
  const classes: Record<string, string>
  export default classes
}

declare module '*.svg?raw' {
  const markup: string
  export default markup
}
