
import { Context } from "@deepseek-ai/cordis";
//#region node_modules/.pnpm/@deepseek-ai+cosmokit@1.8.6/node_modules/@deepseek-ai/cosmokit/lib/types/types.d.ts
declare function isArrayBufferLike(value: any): value is ArrayBufferLike;
declare function isArrayBufferSource(value: any): value is Binary.Source;
/** Binary source detection and base64/hex conversion helpers. */
declare namespace Binary {
  type Source<T extends ArrayBufferLike = ArrayBufferLike> = T | ArrayBufferView<T>;
  const is: typeof isArrayBufferLike;
  const isSource: typeof isArrayBufferSource;
  function fromSource<T extends ArrayBufferLike>(source: Source<T>): T;
  function toBase64(source: Source): string;
  function fromBase64(source: string): ArrayBuffer | Uint8Array<ArrayBuffer>;
  function toHex(source: Source): string;
  function fromHex(source: string): ArrayBuffer;
}
//#endregion
//#region node_modules/.pnpm/@deepseek-ai+cosmokit@1.8.6/node_modules/@deepseek-ai/cosmokit/lib/types/misc.d.ts
/** String/symbol keyed dictionary type. */
type Dict<T = any, K extends string | symbol = string> = { [key in K]: T; };
//#endregion
//#region node_modules/.pnpm/@deepseek-ai+cosmokit@1.8.6/node_modules/@deepseek-ai/cosmokit/lib/types/volatile.d.ts
/** Shared config references used by schema validators and plugin runtimes. */
/** Recursively readonly data returned by a volatile config reference. */
type VolatileSnapshot<T> = T extends object ? { readonly [K in keyof T]: VolatileSnapshot<T[K]>; } : T;
/** A stable reference; keep the reference, or capture its value for one operation only. */
interface Volatile<T> {
  /** @returns the current immutable snapshot, including undefined for an absent value. */
  get(): VolatileSnapshot<T>;
}
//#endregion
//#region node_modules/.pnpm/@standard-schema+spec@1.1.0/node_modules/@standard-schema/spec/dist/index.d.ts
/** The Standard Typed interface. This is a base type extended by other specs. */
interface StandardTypedV1<Input = unknown, Output = Input> {
  /** The Standard properties. */
  readonly "~standard": StandardTypedV1.Props<Input, Output>;
}
declare namespace StandardTypedV1 {
  /** The Standard Typed properties interface. */
  interface Props<Input = unknown, Output = Input> {
    /** The version number of the standard. */
    readonly version: 1;
    /** The vendor name of the schema library. */
    readonly vendor: string;
    /** Inferred types associated with the schema. */
    readonly types?: Types<Input, Output> | undefined;
  }
  /** The Standard Typed types interface. */
  interface Types<Input = unknown, Output = Input> {
    /** The input type of the schema. */
    readonly input: Input;
    /** The output type of the schema. */
    readonly output: Output;
  }
  /** Infers the input type of a Standard Typed. */
  type InferInput<Schema extends StandardTypedV1> = NonNullable<Schema["~standard"]["types"]>["input"];
  /** Infers the output type of a Standard Typed. */
  type InferOutput<Schema extends StandardTypedV1> = NonNullable<Schema["~standard"]["types"]>["output"];
}
/** The Standard Schema interface. */
interface StandardSchemaV1<Input = unknown, Output = Input> {
  /** The Standard Schema properties. */
  readonly "~standard": StandardSchemaV1.Props<Input, Output>;
}
declare namespace StandardSchemaV1 {
  /** The Standard Schema properties interface. */
  interface Props<Input = unknown, Output = Input> extends StandardTypedV1.Props<Input, Output> {
    /** Validates unknown input values. */
    readonly validate: (value: unknown, options?: StandardSchemaV1.Options | undefined) => Result<Output> | Promise<Result<Output>>;
  }
  /** The result interface of the validate function. */
  type Result<Output> = SuccessResult<Output> | FailureResult;
  /** The result interface if validation succeeds. */
  interface SuccessResult<Output> {
    /** The typed output value. */
    readonly value: Output;
    /** A falsy value for `issues` indicates success. */
    readonly issues?: undefined;
  }
  interface Options {
    /** Explicit support for additional vendor-specific parameters, if needed. */
    readonly libraryOptions?: Record<string, unknown> | undefined;
  }
  /** The result interface if validation fails. */
  interface FailureResult {
    /** The issues of failed validation. */
    readonly issues: ReadonlyArray<Issue>;
  }
  /** The issue interface of the failure output. */
  interface Issue {
    /** The error message of the issue. */
    readonly message: string;
    /** The path of the issue, if any. */
    readonly path?: ReadonlyArray<PropertyKey | PathSegment> | undefined;
  }
  /** The path segment interface of the issue. */
  interface PathSegment {
    /** The key representing a path segment. */
    readonly key: PropertyKey;
  }
  /** The Standard types interface. */
  interface Types<Input = unknown, Output = Input> extends StandardTypedV1.Types<Input, Output> {}
  /** Infers the input type of a Standard. */
  type InferInput<Schema extends StandardTypedV1> = StandardTypedV1.InferInput<Schema>;
  /** Infers the output type of a Standard. */
  type InferOutput<Schema extends StandardTypedV1> = StandardTypedV1.InferOutput<Schema>;
}
//#endregion
//#region node_modules/.pnpm/@deepseek-ai+schemastery@3.18.5/node_modules/@deepseek-ai/schemastery/lib/types/index.d.ts
declare const kSchema: unique symbol;
declare global {
  namespace Schemastery {
    /** Convert primitive constructors, constants, and existing schemas into a schema type. */
    type From<X> = X extends string | number | boolean ? Schema<X> : X extends Schema<any, any, SchemaMode> ? X : X extends typeof String ? Schema<string> : X extends typeof Number ? Schema<number> : X extends typeof Boolean ? Schema<boolean> : X extends typeof Function ? Schema<Function, (...args: any[]) => any> : X extends Constructor<infer S> ? Schema<S> : never;
    type TypeS1<X> = X extends Schema<infer S, infer _T, infer _M> ? S : never;
    type Inverse<X> = X extends Schema<infer _S, infer T, infer M> ? (arg: SchemaOutput<T, M>) => void : never;
    /** Input type accepted by a schema-like value. */
    type TypeS<X> = TypeS1<From<X>>;
    /** Output type returned by a schema-like value after validation. */
    type TypeT<X> = ReturnType<From<X>>;
    /** Resolver callback used by custom schema types registered with `Schema.extend()`. */
    type Resolve = (data: any, schema: Schema, options: Options, strict?: boolean) => [any, any?];
    /** Input type accepted by one schema in an intersection. */
    type IntersectS<X> = From<X> extends Schema<infer S, infer _T, infer _M> ? S : never;
    /** Output type returned by one schema in an intersection. */
    type IntersectT<X> = Inverse<From<X>> extends ((arg: infer T) => void) ? T : never;
    type TupleS<X extends readonly any[]> = X extends readonly [infer L, ...infer R] ? [TypeS<L>?, ...TupleS<R>] : any[];
    type TupleT<X extends readonly any[]> = X extends readonly [infer L, ...infer R] ? [TypeT<L>?, ...TupleT<R>] : any[];
    type ObjectS<X extends Dict> = { [K in keyof X]?: TypeS<X[K]> | null; } & Dict;
    type ObjectT<X extends Dict> = { [K in keyof X]: TypeT<X[K]>; } & Dict;
    type Constructor<T = any> = new (...args: any[]) => T;
    /** Static constructor and factory methods exposed by the default `Schema` export. */
    interface Static {
      <T = any>(options: Partial<Schema<T>>): Schema<T>;
      new <T = any>(options: Partial<Schema<T>>): Schema<T>;
      prototype: Schema;
      /** Validate a value against a schema node and return `[output, adaptedInput?]`. */
      resolve: Resolve;
      /** Infer a schema from a primitive value, constructor, or existing schema. */
      from<X = any>(source?: X): From<X>;
      /** Register a resolver for a custom schema `type`. */
      extend(type: string, resolve: Resolve): void;
      /** Accept any value without validation. */
      any<T = any>(): Schema<T>;
      /** Accept only nullable input. */
      never(): Schema<never>;
      /** Accept exactly one constant value. */
      const<const T>(value: T): Schema<T>;
      /** Accept strings, with optional metadata constraints added by instance methods. */
      string(): Schema<string>;
      /** Accept numbers, with optional range and step constraints. */
      number(): Schema<number>;
      /** Accept non-negative integer numbers. */
      natural(): Schema<number>;
      /** Accept a number between 0 and 1 and mark it as a slider. */
      percent(): Schema<number>;
      /** Accept booleans. */
      boolean(): Schema<boolean>;
      /** Accept `Date` instances or parse datetime strings into `Date` objects. */
      date(): Schema<string | Date, Date>;
      /** Accept `RegExp` instances or parse strings into regular expressions. */
      regExp(flag?: string): Schema<string | RegExp, RegExp>;
      /** Accept binary sources and normalize them to `ArrayBufferLike`. */
      arrayBuffer(): Schema<Binary.Source, ArrayBufferLike>;
      arrayBuffer(encoding: 'hex' | 'base64'): Schema<Binary.Source | string, ArrayBufferLike>;
      /** Accept a numeric bitset or string keys and normalize to a number. */
      bitset<K extends string>(bits: Partial<Record<K, number>>): Schema<number | readonly K[], number>;
      /** Accept functions. */
      function(): Schema<Function, (...args: any[]) => any>;
      /** Accept instances of a constructor or objects whose constructor name matches. */
      is(constructor: string): Schema;
      is<T>(constructor: Constructor<T>): Schema<T>;
      /** Accept arrays whose elements match `inner`. */
      array<X>(inner: X): Schema<TypeS<X>[], TypeT<X>[]>;
      /** Accept plain objects with values matching `inner` and optional key schema. */
      dict<X, Y extends Schema<any, string> = Schema<string>>(inner: X, sKey?: Y): Schema<Dict<TypeS<X>, TypeS<Y>>, Dict<TypeT<X>, TypeT<Y>>>;
      /** Accept tuple arrays where each index matches the corresponding schema. */
      tuple<const X extends readonly any[]>(list: X): Schema<TupleS<X>, TupleT<X>>;
      /** Accept plain objects; infer fields from the dictionary, not the enclosing schema's output type. */
      object<X extends Dict>(dict: X): Schema<ObjectS<NoInfer<X>>, ObjectT<NoInfer<X>>>;
      /** Accept values matching at least one schema in `list`. */
      union<const X>(list: readonly X[]): Schema<TypeS<X>, TypeT<X>>;
      /** Accept values matching every schema in `list`, merging object outputs. */
      intersect<const X>(list: readonly X[]): Schema<IntersectS<X>, IntersectT<X>>;
      /** Validate with `inner`, then convert the result with `callback`. */
      transform<X, T>(inner: X, callback: (value: TypeS<X>, options: Schemastery.Options) => T, preserve?: boolean): Schema<TypeS<X>, T>;
      /** Defer construction of a recursive schema until validation or serialization. */
      lazy<X extends Schema<any, any, SchemaMode>>(callback: () => X): X;
      ValidationError: typeof ValidationError;
    }
    /** Runtime validation options shared by all schema calls. */
    interface Options {
      /** Remove invalid object properties instead of throwing when possible. */
      autofix?: boolean;
      /** Skip validation for selected values and schema nodes. */
      ignore?(data: any, schema: Schema): boolean;
      /** Path used to format nested validation errors. */
      path?: (keyof any)[];
    }
    /** UI and validation metadata attached by schema builder methods. */
    interface Meta<T = any> {
      default?: T extends {} ? Partial<T> : T;
      required?: boolean;
      /** Parse this node as a stable config reference; its type and UI metadata remain unchanged. */
      volatile?: boolean;
      disabled?: boolean;
      collapse?: boolean;
      badges?: {
        text: string;
        type: string;
      }[];
      hidden?: boolean;
      loose?: boolean;
      role?: string;
      extra?: any;
      link?: string;
      description?: string | Dict<string>;
      comment?: string;
      pattern?: {
        source: string;
        flags?: string;
      };
      max?: number;
      min?: number;
      step?: number;
    }
  }
  /** Callable schema instance that validates input and returns normalized output. */
  interface Schemastery<S = any, T = S, Mode extends SchemaMode = 'plain'> {
    (data?: S | null, options?: Schemastery.Options): SchemaOutput<T, Mode>;
    new (data?: S | null, options?: Schemastery.Options): SchemaOutput<T, Mode>;
    [kSchema]: true;
    uid: number;
    meta: Schemastery.Meta<T>;
    type: string;
    sKey?: Schema;
    inner?: Schema;
    list?: Schema[];
    dict?: Dict<Schema>;
    bits?: Dict<number>;
    callback?: Function;
    constructor?: string | Function;
    builder?: Function;
    value?: T;
    refs?: Dict<Schema>;
    preserve?: boolean;
    '~standard': StandardSchemaV1.Props;
    /** Format this schema as a compact TypeScript-like type string. */
    toString(inline?: boolean): string;
    /** Serialize this schema, preserving shared and recursive references. */
    toJSON(): Schema<S, T, Mode>;
    /** Mark nullable input as invalid unless a default supplies a fallback. */
    required<R extends boolean = true>(value?: R): Schema<S, T, SetRequired<Mode, R>>;
    /**
     * Parse this config field as a stable reference containing immutable data.
     * @returns a schema whose output supports get(), including when the field is absent.
     */
    volatile(): Schema<NoInfer<S>, NoInfer<T>, Mode extends 'defined' | 'volatile-defined' ? 'volatile-defined' : 'volatile'>;
    /** Hide this schema node from UI renderers. */
    hidden(value?: boolean): Schema<S, T, Mode>;
    /** Return the default value instead of throwing when validation fails. */
    loose(value?: boolean): Schema<S, T, Mode>;
    /** Attach a renderer role and optional role-specific metadata. */
    role(text: string, extra?: any): Schema<S, T, Mode>;
    /** Attach an external documentation link. */
    link(link: string): Schema<S, T, Mode>;
    /** Set the fallback value used for nullable input. */
    default(value: T | NoInfer<Partial<S>>): Schema<S, T, SetRequired<Mode, true>>;
    /** Attach an auxiliary comment for documentation or form UIs. */
    comment(text: string): Schema<S, T, Mode>;
    /** Attach a localized or plain description for documentation or form UIs. */
    description(text: string): Schema<S, T, Mode>;
    /** Mark this schema node as disabled for form UIs. */
    disabled(value?: boolean): Schema<S, T, Mode>;
    /** Request collapsed rendering for nested form UIs. */
    collapse(value?: boolean): Schema<S, T, Mode>;
    /** Add a deprecated badge to this schema node. */
    deprecated(): Schema<S, T, Mode>;
    /** Add an experimental badge to this schema node. */
    experimental(): Schema<S, T, Mode>;
    /** Require strings to match a regular expression. */
    pattern(regexp: RegExp): Schema<S, T, Mode>;
    /** Set an inclusive maximum for numbers or collection lengths. */
    max(value: number): Schema<S, T, Mode>;
    /** Set an inclusive minimum for numbers or collection lengths. */
    min(value: number): Schema<S, T, Mode>;
    /** Set the numeric increment constraint. */
    step(value: number): Schema<S, T, Mode>;
    /** Add or replace an object property schema. */
    set(key: string, value: Schema): Schema<S, T, Mode>;
    /** Append a tuple, union, or intersection member schema. */
    push(value: Schema): Schema<S, T, Mode>;
    /** Remove values equal to schema defaults from normalized output. */
    simplify(value?: any): any;
    /** Return a schema clone with descriptions merged from locale messages. */
    i18n(messages: Dict): Schema<S, T, Mode>;
    /** Attach arbitrary metadata consumed by form renderers and downstream tools. */
    extra<K extends keyof Schemastery.Meta>(key: K, value: Schemastery.Meta[K]): Schema<S, T, Mode>;
  }
}
declare class ValidationError extends TypeError {
  options: Schemastery.Options;
  name: string;
  constructor(message: string, options: Schemastery.Options);
  static is(error: any): error is ValidationError;
}
type SchemaMode = 'plain' | 'defined' | 'volatile' | 'volatile-defined';
type SchemaOutput<T, M extends SchemaMode> = M extends 'volatile' ? Volatile<T | undefined> : M extends 'volatile-defined' ? Volatile<T> : T;
type SetRequired<M extends SchemaMode, R extends boolean> = M extends 'volatile' | 'volatile-defined' ? R extends true ? 'volatile-defined' : 'volatile' : R extends true ? 'defined' : 'plain';
type Schema<S = any, T = S, Mode extends SchemaMode = 'plain'> = Schemastery<S, T, Mode>;
declare const Schema: Schemastery.Static;
//#endregion
//#region src/shared/types.d.ts
/**
 * Token 用量统计 — 跨端共享类型定义。
 *
 * 宿主（Host）与客户端（Client）对齐使用本协议，避免隐式字段偏差与契约漂移。
 */
/** 单位：美元 / token（OpenRouter 原始口径）。 */
interface ModelPrice {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  reasoning: number;
}
/** 归一化模型名 → 单价。 */
type PricingTable = Record<string, ModelPrice>;
/** 最近一分钟粒度的速率快照。 */
interface RateSnapshot {
  windowMinutes: number;
  calls: number;
  tokens: number;
}
interface TokenCounters {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  reasoningTokens: number;
  totalTokens: number;
}
interface TokenCountersWithRate extends TokenCounters {
  cacheHitRate: number;
}
interface RawTokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  reasoningTokens?: number;
  totalTokens?: number;
}
interface SessionEventRecordInput {
  sessionId?: string;
  provider?: string;
  model?: string;
  turn?: number;
  step?: number;
  usage?: RawTokenUsage;
  time?: number;
  parentSession?: string;
  cwd?: string;
  origin?: string;
  delegationDepth?: number;
  purpose?: string;
}
interface AccountWallet {
  currency: string;
  balance: string;
}
interface AccountSnapshot {
  id: string;
  name: string | null;
  balance: AccountWallet[] | null;
  bonus: AccountWallet[] | null;
  usageUrl: string | null;
  topUpUrl: string | null;
  refreshedAt: number;
}
interface SessionSummaryItem {
  id: string;
  title?: string;
  provider?: string;
  model?: string;
  parentSession?: string;
  cwd?: string;
  origin?: string;
  delegationDepth?: number;
  firstAt?: number;
  lastAt?: number;
  counters: TokenCounters;
}
interface TrendSeries {
  key: string;
  label: string;
  values: Record<string, number>;
}
interface ModelTrend {
  days: string[];
  series: TrendSeries[];
}
interface ScanProgress {
  active: boolean;
  done: number;
  total: number;
  startedAt: number;
  finishedAt: number;
}
interface IntegrityCheck {
  seenKeys: number;
  totalCalls: number;
  consistent: boolean;
}
interface FailedAttemptsRecord {
  count: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  billable: number;
}
interface PluginConfig {
  flushDelayMs: number;
  snapshotCacheMs: number;
  retentionDays: number;
  maxSessions: number;
  maxTrendSeries: number;
  maxSeenEntries: number;
  trackFailedAttempts: boolean;
  trackAccount: boolean;
  autoUpdate: boolean;
  watchFiles: boolean;
  updateRoutes?: boolean;
}
interface MetricsSnapshot {
  generatedAt: number;
  today: string;
  totals: {
    all: TokenCountersWithRate;
    today: TokenCountersWithRate;
    week: TokenCountersWithRate;
  };
  trend: Record<string, TokenCountersWithRate>;
  config: {
    trackFailedAttempts: boolean;
    snapshotCacheMs: number;
    retentionDays: number;
    maxTrendSeries: number;
  };
  byDay: Record<string, TokenCounters>;
  byModelDay: Record<string, Record<string, TokenCountersWithRate>>;
  modelTrend: ModelTrend;
  byProvider: Record<string, TokenCounters>;
  byModel: Record<string, TokenCounters>;
  byModelName: Record<string, TokenCountersWithRate>;
  byProject: Record<string, TokenCountersWithRate>;
  byOrigin: Record<string, TokenCountersWithRate>;
  byHour?: Record<number, TokenCounters>;
  /** 模型单价表；为空表示尚未取到价格，前端据此隐藏成本。 */
  pricing: PricingTable;
  pricingFetchedAt: number | null;
  /** 最近一分钟粒度的速率，用于真实的 RPM / TPM。 */
  rate: RateSnapshot;
  failedAttempts: FailedAttemptsRecord | null;
  accounts: Record<string, TokenCountersWithRate>;
  currentAccount: AccountSnapshot | null;
  bySession: Record<string, SessionSummaryItem>;
  sessionCount: number;
  scannedCount: number;
  scan: ScanProgress;
  buildId: string;
  integrity: IntegrityCheck;
  storePath: string;
  repositoryUrl: string;
}
interface StoreData {
  version: number;
  buildId: string;
  needsRebuild: boolean;
  createdAt: number;
  updatedAt: number;
  seen: Record<string, number>;
  total: TokenCounters;
  byDay: Record<string, TokenCounters>;
  byProvider: Record<string, TokenCounters>;
  byModel: Record<string, TokenCounters>;
  byModelName: Record<string, TokenCounters>;
  byDayModel: Record<string, Record<string, TokenCounters>>;
  byDayModelName: Record<string, Record<string, TokenCounters>>;
  bySession: Record<string, {
    counters: TokenCounters;
    provider?: string;
    model?: string;
    title?: string;
    parentSession?: string;
    cwd?: string;
    origin?: string;
    delegationDepth?: number;
    firstAt?: number;
    lastAt?: number;
  }>;
  byProject: Record<string, TokenCounters>;
  byOrigin: Record<string, TokenCounters>;
  byHour?: Record<number, TokenCounters>;
  /** 最近若干分钟的调用与 Token 数，用于真实 RPM/TPM。 */
  recentMinutes?: Array<{
    minute: number;
    calls: number;
    tokens: number;
  }>;
  failedAttempts: FailedAttemptsRecord;
  accounts: Record<string, TokenCounters>;
  currentAccount: AccountSnapshot | null;
  scanned: Record<string, number>;
}
interface UpdateCheckResult {
  ok: boolean;
  hasUpdate?: boolean;
  currentVersion?: string;
  latestVersion?: string;
  releaseUrl?: string;
  releaseNotes?: string;
  publishedAt?: string;
  error?: string;
}
//#endregion
//#region src/host/config.d.ts
export declare const Config: Schema<Schemastery.ObjectS<NoInfer<{
  flushDelayMs: Schema<number, number, "defined">;
  snapshotCacheMs: Schema<number, number, "defined">;
  retentionDays: Schema<number, number, "defined">;
  maxSessions: Schema<number, number, "defined">;
  maxTrendSeries: Schema<number, number, "defined">;
  maxSeenEntries: Schema<number, number, "defined">;
  trackFailedAttempts: Schema<boolean, boolean, "defined">;
  trackAccount: Schema<boolean, boolean, "defined">;
  autoUpdate: Schema<boolean, boolean, "defined">;
  watchFiles: Schema<boolean, boolean, "defined">;
  updateRoutes: Schema<boolean, boolean, "defined">;
}>>, Schemastery.ObjectT<NoInfer<{
  flushDelayMs: Schema<number, number, "defined">;
  snapshotCacheMs: Schema<number, number, "defined">;
  retentionDays: Schema<number, number, "defined">;
  maxSessions: Schema<number, number, "defined">;
  maxTrendSeries: Schema<number, number, "defined">;
  maxSeenEntries: Schema<number, number, "defined">;
  trackFailedAttempts: Schema<boolean, boolean, "defined">;
  trackAccount: Schema<boolean, boolean, "defined">;
  autoUpdate: Schema<boolean, boolean, "defined">;
  watchFiles: Schema<boolean, boolean, "defined">;
  updateRoutes: Schema<boolean, boolean, "defined">;
}>>, "plain">;
export type Config = typeof Config extends Schema<infer T> ? T : PluginConfig;
//#endregion
//#region src/host/tracker.d.ts
interface LoggerLike {
  info?: (msg: string) => void;
  warn?: (msg: string) => void;
  error?: (msg: string) => void;
}
export declare class TokenTracker {
  store: StoreData;
  config: PluginConfig;
  logger?: LoggerLike;
  buildId: string;
  home?: string;
  dirty: boolean;
  flushTimer?: NodeJS.Timeout;
  storeRevision: number;
  cachedSnapshot?: MetricsSnapshot;
  cachedSnapshotAt: number;
  cachedSnapshotRevision: number;
  scan: {
    active: boolean;
    done: number;
    total: number;
    startedAt: number;
    finishedAt: number;
  };
  constructor(options: {
    logger?: LoggerLike;
    buildId: string;
    config: PluginConfig;
    home?: string;
    store?: StoreData;
  });
  private pricing;
  private pricingFetchedAt;
  /** 价格表由宿主异步拉取后注入；未拿到时成本相关展示自动隐藏。 */
  setPricing(pricing: PricingTable, fetchedAt: number | null): void;
  private buildRate;
  updateConfig(config: PluginConfig): void;
  private invalidateCache;
  private dedupKey;
  record(input: SessionEventRecordInput): boolean;
  recordFailedAttempt(usage?: Partial<RawTokenUsage>, dedupKey?: string): void;
  setTitle(sessionId: string, title?: string): void;
  setCurrentAccount(account: AccountSnapshot | null): void;
  private capSeen;
  beginScan(total: number): void;
  advanceScan(): void;
  endScan(): void;
  markDirty(): void;
  reset(): void;
  pruneOldDays(now?: number): void;
  scheduleFlush(): void;
  flush(): void;
  snapshot(): MetricsSnapshot;
  private buildSnapshot;
}
declare global {
  var __DSH_METRICS_TRACKER__: {
    buildId: string;
    tracker: TokenTracker;
  } | undefined;
}
//#endregion
//#region src/host/index.d.ts
export declare const name = "dsh-metrics";
export declare const version = "0.6.0";
export declare function apply(ctx: Context, rawConfig?: unknown): void;
//#endregion
export type { AccountSnapshot, AccountWallet, FailedAttemptsRecord, IntegrityCheck, MetricsSnapshot, ModelTrend, PluginConfig, RawTokenUsage, ScanProgress, SessionEventRecordInput, SessionSummaryItem, StoreData, TokenCounters, TokenCountersWithRate, TrendSeries, UpdateCheckResult };
//# sourceMappingURL=index.d.ts.map