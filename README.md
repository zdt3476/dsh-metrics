# DSH Metrics

<p align="center">
  <strong>DeepSeek Harness 全局模型 Token 用量与缓存效率监控看板</strong>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/node-%5E22.19%20%7C%7C%20%3E%3D24-brightgreen.svg?style=flat-square" alt="Node Version">
  <img src="https://img.shields.io/badge/TypeScript-Strict-blue.svg?style=flat-square" alt="TypeScript">
  <img src="https://img.shields.io/badge/bundle-tsdown-purple.svg?style=flat-square" alt="tsdown">
</p>

<p align="center">
  <strong>中文</strong> | <a href="README.en.md">English</a>
</p>

---

## 📖 简介

**dsh-metrics** 是专为 [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness) 打造的轻量级、高可靠模型 Token 用量分析插件。

它通过捕获 DSH 宿主内部的所有模型调用事件，将消耗实时聚合并在 Web 侧边栏提供功能完备的交互式看板。不论是日常对话、子代理（Subagent）委派、Workflow 编排还是上下文压缩，每一枚 Token 都有据可查。

![DSH Metrics 监控面板](docs/images/panel.png)

---

## ✨ 核心特性

- 🎯 **全量调用追踪**：双通路捕获，覆盖所有 `assistant/message` 会话事件，并通过 waterfall 补齐会话标题生成、记忆压缩等独立调用的 Token 消耗。
- 📊 **多维切片透视**：支持在看板中按**模型 (Model)**、**供应商 (Provider)**、**工作区项目 (Project)** 与 **会话 (Session)** 自由切换与排序下钻，长列表支持容器内滚动与表头吸顶。
- 🧮 **指标卡组**：请求总数（含成功率 / 成功 / 失败）与 Token 总数（构成内联）两张主卡，配合 RPM、TPM、缓存率、成本四张卡，每张卡都叠加迷你趋势线；支持 今天 / 24 小时 / 3 天 / 7 天 / 30 天 / 全部 六档时间范围。
- 💵 **成本核算（OpenRouter 单价）**：自动拉取 OpenRouter 公开价目表并缓存 24 小时，按输入 / 输出 / 缓存读 / 缓存写 / 推理分别计价；缺价格的模型会显式提示而不是按 0 计算。
- ⏱️ **真实 RPM / TPM**：账本内置最近 90 分钟的分钟级计数，RPM / TPM 为最近 60 分钟的实际墙钟速率。
- 🗓️ **Token 活动热力图**：以「星期 × 自然周」排布，顶部标注月份，一眼看出每周的使用规律。
- 🏢 **供应商明细**：按供应商列出请求数、Token、成本与占比条。
- 🍩 **模型用量环形图**：环形占比 + 右侧图例榜（模型、用量、占比），支持在「按用量 / 按调用」两种口径间切换。
- 📈 **多模型趋势图**：单张折线图按模型分组，配图例与悬停明细，时间轴自动稀疏刻度避免拥挤。
- ⚡ **缓存命中率审计**：精准统计 `cacheRead` 与新输入的配比，清晰呈现 Prompt 缓存命中效果，辅助评估上下文优化策略。
- 🔄 **离线日志自动回扫**：首次安装或数据重建时，支持通过原生 `zstd` 解压磁盘会话历史（`.jsonl.zstd`），即使离线或无持久化服务也能完整恢复历史统计。
- 💳 **账户余额实时展示**：无缝打通 DeepSeek 账户服务，在面板顶部实时展示当前登录用户余额与代金券赠金，支持直达官方用量页面。
- 🛡️ **轻量安全与原子存储**：
  - 本地存储采用写入防抖与临时文件原子重命名机制，避免 I/O 阻塞并防止半写入损坏。
  - 纯本地运行，不携带凭据，绝不向第三方上传任何数据。
- 🚀 **现代化工程体系**：参考 `dsh-context` 全面采用 TypeScript 模块化重构，支持 `tsdown` 快速打包输出与 `vitest` 毫秒级单元测试。

---

## 📦 安装与启用

### 方式一：命令行一键安装（推荐）

```bash
dsh plugin --profile web add @zdt3476/dsh-metrics
```

也可以直接装源码（无需 NPM）：

```bash
dsh plugin --profile web add github:zdt3476/dsh-metrics
```

### 方式二：通过 DSH 插件管理器

在 DSH 控制台中直接执行：

```bash
plugin_manager install_bundle @zdt3476/dsh-metrics
```

### 方式三：手动配置 Profile

在你的 DSH Profile（如 `~/.dsh/profiles/web/package.json`）中添加依赖：

```json
{
  "dsh": {
    "profile": {
      "bundles": ["@zdt3476/dsh-metrics"]
    }
  },
  "dependencies": {
    "@zdt3476/dsh-metrics": "^1.0.0"
  }
}
```

并在当前 Profile 的 `cordis.patch.yml` 中声明加载：

```yaml
- insert:
    - id: dsh-metrics
      name: '@zdt3476/dsh-metrics'
```

重启 DSH 后，侧边栏左侧工具栏即会出现 **用量监控** 图标。首次载入看板会自动执行历史会话日志回扫，无感补齐过往全部调用数据。

---

## 📐 统计口径与计算公式

| 指标字段 | 含义 | 说明 / 计算公式 |
| :--- | :--- | :--- |
| **调用次数 (Calls)** | 模型请求总次数 | 按 `(sessionId, turn, step)` 严格去重累加 |
| **输入 (Input Tokens)** | 未命中缓存的新输入量 | 模型消耗的新上下文 Token 数 |
| **缓存读 (Cache Read)** | 命中缓存的输入量 | 上下文 Prompt 缓存成功复用的 Token 数 |
| **缓存写 (Cache Write)** | 写入缓存的输入量 | 首次加载写入缓存的 Token 数 |
| **输出 (Output Tokens)** | 模型最终生成的回复 Token | 包括代码、思考内容与最终文本 |
| **推理 (Reasoning)** | 深度思考/推导 Token | 具备推理能力模型（如 R1）的思维链 Token 消耗 |
| **总量 (Total Tokens)** | 单次调用涉及的所有 Token | 适配器上报值或各项 Token 之和 |
| **缓存命中率 (Hit Rate)** | 输入层缓存复用效率 | `CacheRead / (CacheRead + Input)` |

---

## ⚙️ 配置说明

插件所有配置均开箱即用。若需自定义，可在 `cordis.patch.yml` 中覆盖：

```yaml
- id: dsh-metrics
  config:
    flushDelayMs: 2000        # 磁盘写入防抖延迟（毫秒）
    snapshotCacheMs: 3000     # 聚合快照缓存时间（毫秒）
    retentionDays: 400        # 历史按天分桶保留天数（0 为不裁剪）
    maxSessions: 500          # 会话明细最大保留记录数
    maxTrendSeries: 6         # 趋势图展示的前 N 大模型曲线数
    trackAccount: true        # 是否读取登录账号余额（只读）
    autoUpdate: true          # 是否装配自更新检查
    watchFiles: false         # 开发环境文件变动热重载
```

---

## 🔌 HTTP 服务接口

插件在宿主 Web 服务中内置了只读接口与管理通道：

| 请求方法 | 接口路径 | 功能说明 |
| :--- | :--- | :--- |
| `GET` | `/api/dsh-metrics/summary` | 获取最新多维聚合快照（前端看板数据源） |
| `GET` | `/api/dsh-metrics/flush` | 立即强制执行防抖落盘，并返回最新快照 |
| `GET` | `/api/dsh-metrics/version` | 查看当前运行版本、构建标识与仓库信息 |
| `GET` | `/api/dsh-metrics/update/check` | 检查 GitHub Release 最新版本状态 |
| `POST` | `/api/dsh-metrics/reload` | 触发插件进程内热重载（重新加载磁盘代码） |

---

## 🛠️ 本地开发与测试

本项目采用现代 TypeScript 开发流程：

```bash
# 1. 安装依赖
pnpm install

# 2. 执行静态类型检查与全量单元测试
pnpm test

# 3. 运行构建（输出至 lib/）
pnpm run build

# 4. 监听测试
pnpm run test:watch
```

---

## 📄 开源许可

本项目基于 [MIT License](LICENSE) 开源发布。
