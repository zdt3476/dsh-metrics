# 安全政策与隐私声明 (Security & Privacy)

## 🛡️ 数据边界与隐私保护

**dsh-metrics** 运行在 DeepSeek Harness 本地宿主进程中，设计上严格遵循**最小权限与本地优先**原则：

| 涉及数据 | 采集用途 | 是否写入磁盘 | 是否通过网络外发 |
| :--- | :--- | :--- | :--- |
| **会话日志 (assistant/message)** | 提取 input/output/cache 等 token 统计指标 | 仅聚合写入本地账本 | **否（绝不外发）** |
| **登录账号概览 (Profile/Balance)** | 在看板顶部展示当前用户身份与余额 | 仅聚合写入本地账本 | **否（绝不外发）** |
| **聚合统计快照 (Snapshot)** | 提供给前端面板渲染图表与表格 | 写入 `$DSH_HOME/dsh-metrics/usage.json` | **否（绝不外发）** |

### 关键安全承诺

1. **从不接触敏感凭据**：插件不读取任何 API Key、Token 或用户认证密码。账号余额等信息仅通过宿主公开的只读服务读取。
2. **零主动外发流量**：在日常监控和看板展示过程中，插件不产生任何出站 HTTP 请求。
3. **唯一的外部通信**：仅在用户主动点击“检查更新”或启用自动更新时，向 GitHub Releases API 发起只读版本比对请求。

---

## 🔒 漏洞报告流程

如果您在本插件中发现了潜在的安全漏洞或隐患，请通过以下方式私下报告，**请勿在公开 Issue 中披露漏洞细节**：

- **GitHub Advisory**：[Report a vulnerability](https://github.com/zdt3476/dsh-metrics/security/advisories/new)
- **直接联系**：发送邮件至维护者邮箱 `zdt3476@gmail.com`

收到报告后，我们将在 48 小时内确认并评估修复方案。
