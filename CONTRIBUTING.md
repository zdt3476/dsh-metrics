# 贡献指南 (Contributing Guide)

感谢你关注并参与 **dsh-metrics** 的开发与完善！

---

## 💻 本地开发环境设置

本项目使用 TypeScript 与 pnpm 作为核心工具链，最低要求 Node.js `>=22.19.0` 或 `>=24.0.0`：

```bash
# 1. 克隆代码仓库
git clone git@github.com:zdt3476/dsh-metrics.git
cd dsh-metrics

# 2. 安装项目依赖
pnpm install

# 3. 运行静态类型检查与测试套件
pnpm test

# 4. 构建编译产物
pnpm run build
```

---

## 📐 代码与架构规范

- **工程原则**：优先保持模块职责清晰、单向依赖，前后端通过 `src/shared/types.ts` 定义唯一数据契约。
- **构建规范**：通过 `tsdown` 进行统一编译，宿主端输出 ESM Node 代码，客户端输出标准 CJS 浏览器闭包。
- **测试覆盖**：新增或修改功能时，请在 `tests/` 目录下添加或更新相应的 Vitest 测试用例。
- **提交规范**：Commit Message 请使用语义化中文说明，格式如：
  - `feat(模块): 简述新增特性`
  - `fix(模块): 简述修复问题`
  - `test(模块): 简述测试用例补充`
  - `chore: 工程维护与依赖调整`

---

## 🤝 提交 Pull Request

1. Fork 本仓库并基于 `main` 分支创建特性分支（如 `feature/my-feature`）。
2. 在本地完成编码与测试，确保 `pnpm test` 与 `pnpm run build` 完全通过。
3. 提交 PR 并详细描述改动动机、实现方案与验证结果。
