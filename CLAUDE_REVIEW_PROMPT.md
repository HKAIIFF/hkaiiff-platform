# HKAIIFF Platform — Claude 代码审查请求

## 你的任务

你是一名高级全栈工程师，请对以下 Next.js 全栈应用（HKAIIFF - 香港 AI 国际电影节平台）进行**全面的代码审查**。

## 审查重点（按优先级）

### 🔴 P0 - 安全性（必须审查）
1. **API 路由权限控制**：哪些 API 缺少身份验证？哪些 Admin API 可被普通用户调用？
2. **环境变量泄露**：检查 `NEXT_PUBLIC_` 前缀的变量是否误暴露了敏感信息
3. **Supabase RLS**：哪些表的 RLS 策略存在逻辑漏洞？`auth.uid()` 与 Privy DID 的匹配问题
4. **Stripe Webhook 安全**：签名验证是否正确？幂等性处理是否完整？
5. **Solana 钱包安全**：HD 钱包派生、私钥处理、归集逻辑中是否有资金风险
6. **用户输入验证**：各 API 是否对输入进行了充分的校验和净化

### 🟠 P1 - 功能逻辑
7. **支付流程完整性**：Stripe 和 AIF 支付的状态机是否正确？是否存在支付后未更新数据库的情况？
8. **批量发行功能**：`/api/admin/batch-release` 的流程是否可靠？错误处理是否充分？
9. **消息系统**：V2 重构后是否有字段兼容性问题？`user_id` 与 `receiver_id` 的逻辑是否一致？
10. **身份认证流程**：`creator_applications` 与 `users.verified_identities` 的同步是否正确？

### 🟡 P2 - 性能与架构
11. **数据库查询**：是否有 N+1 查询？是否缺少必要的索引？
12. **API 响应缓存**：哪些 API 应该添加缓存但没有？
13. **Next.js 配置**：`ignoreBuildErrors: true` 的风险、`bodySizeLimit: '500mb'` 的安全影响
14. **Middleware 认证**：Cookie 检测方式是否可靠？是否可以被绕过？

### 🔵 P3 - 代码质量
15. **TypeScript 类型安全**：是否有 `as any`、`as unknown` 等不安全类型断言？
16. **错误处理一致性**：API 路由的错误响应格式是否统一？
17. **代码重复**：Supabase 客户端的创建方式是否有不必要的重复？
18. **死代码/TODO**：是否有未完成的功能或残留的测试代码？

## 请输出格式

```
## 审查报告

### 🔴 安全漏洞
[按严重程度排序，每条包含：文件路径 | 问题描述 | 建议修复方案]

### 🟠 功能 Bug
[每条包含：文件路径 | 问题描述 | 复现条件 | 建议修复方案]

### 🟡 性能问题
[每条包含：文件路径 | 问题描述 | 影响程度 | 建议优化方案]

### 🔵 代码质量
[每条包含：文件路径 | 问题描述 | 改进建议]

### ✅ 值得肯定的设计
[列出代码中设计良好的部分]

### 📋 总结
[优先修复清单，按 P0→P3 排序]
```

---

## 代码包说明

本审查包分为以下文件（按顺序阅读）：
- `REVIEW_PART1_Config_DB.md` — 项目配置 + 15个数据库迁移
- `REVIEW_PART2_API_UserPayment.md` — 用户/上传/支付相关 API（26个）
- `REVIEW_PART3_API_Admin.md` — Admin 管理类 API（17个）+ Admin 后台页面
- `REVIEW_PART4_Lib_Frontend.md` — Library 工具库 + 核心前端页面


---

## 关键环境变量（⚠️ 安全审查参考）

```
SUPABASE_SERVICE_ROLE_KEY    # 绕过 RLS，仅服务端 — 检查是否有 API 未正确使用
MASTER_SEED_PHRASE           # HD 钱包主助记词 — 检查传输/存储安全
FEE_PAYER_PRIVATE_KEY        # Solana 手续费钱包私钥 — 检查泄露风险
STRIPE_WEBHOOK_SECRET        # Webhook 签名验证 — 检查各 Webhook 是否都验证了签名
NEXT_PUBLIC_ADMIN_EMAILS     # Admin 白名单 — 检查是否有后端强校验，不能只靠前端
DB_ENCRYPTION_KEY            # 字段加密密钥 — 检查使用是否正确
```

## 特别关注：已知潜在问题区域

1. **`middleware.ts` 的 Cookie 检测**：只检查 Cookie 名称是否存在，未验证 Token 有效性
2. **Admin API 的权限验证**：部分 Admin API 依赖 `NEXT_PUBLIC_ADMIN_EMAILS` 列表比对，请检查每个 Admin API 是否都有服务端校验
3. **`batch_release_items.user_password` 字段**：明文存储密码 `HKaiiff2026!@`，这是安全风险
4. **`next.config.ts` 中 `ignoreBuildErrors: true`**：可能隐藏类型错误
5. **Solana Webhook 的幂等性**：检查 `/api/webhook/solana` 是否有防重放攻击
6. **`bodySizeLimit: '500mb'`**：检查是否会导致 DoS 风险
