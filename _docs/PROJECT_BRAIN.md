# 🧠 HKAIIFF Platform — PROJECT BRAIN
> **Cursor 每次开发前必须完整阅读此文件**
> 最后更新：2026-03-24 | 版本：v2.0

---

## ⚡ 快速状态面板（每次开发先看这里）

```
项目状态：🟢 系统稳定，主要Bug已修复
当前阶段：按需优化
最新commit：bdfc801
上次完成：阶段五UX修复全部完成（认证状态实时同步、登录交互优化）
下次任务：按需
```

---

## 1. 项目概述

**HKAIIFF**（香港AI国际电影节）平台 — 全栈 Next.js 应用

| 项目 | 详情 |
|------|------|
| 框架 | Next.js 16.1.6（App Router + React 19） |
| 数据库 | Supabase（PostgreSQL）+ RLS |
| 认证 | Privy（Wallet/Email/Google/Twitter/Discord） |
| 存储 | Cloudflare R2（图片）+ Bunny Stream（视频） |
| 支付 | Stripe（法币 USD）+ Solana AIF Token（加密货币） |
| 链上 | Solana Web3.js + HD Wallet（BIP39/ED25519） |
| 部署 | Vercel |

---

## 2. 核心业务流程（必须理解）

```
流程1：用户注册
  Privy认证 → /api/sync-user（已加Token验证）→ 写入 users 表

流程2：影片投稿
  上传R2/Bunny → /api/upload-film → 写入films表 → 等待Admin审核

流程3：身份认证
  Stripe/AIF支付 → /api/verification/submit → 写入creator_applications → Admin审核

流程4：AIF充值
  用户生成充值地址 → 链上转账 → Helius Webhook推送
  → /api/webhook/solana（已加幂等性保护）→ 入账

流程5：Admin后台
  影片审核 / 批量发行 / 金库管理 / 用户管理 / RBAC权限
  所有Admin API已加 checkAdminAuth 保护
```

---

## 3. 目录结构（关键路径）

```
hkaiiff-platform/
├── _docs/                  ← ⭐ 开发文档（本文件夹）
│   ├── PROJECT_BRAIN.md    ← 项目大脑（本文件）
│   ├── BUG_TRACKER.md      ← Bug追踪
│   ├── CURSOR_RULES.md     ← Cursor行为规范
│   ├── DEV_GUIDE.md        ← 开发指导手册
│   └── CODE_REVIEW_REPORT.md ← 审查报告
├── app/
│   ├── api/
│   │   ├── admin/          ← 18个Admin API【全部已加checkAdminAuth保护✅】
│   │   │   ├── dashboard/stats/  ← 新建，Dashboard统计
│   │   │   ├── treasury/         ← 金库管理（4个子路由）
│   │   │   ├── rbac/             ← 权限管理
│   │   │   ├── verifications/    ← 身份审核
│   │   │   ├── users/            ← 用户管理
│   │   │   ├── products/         ← 产品管理
│   │   │   ├── finance/ledger/   ← 财务流水
│   │   │   ├── messages/history/ ← 消息记录
│   │   │   ├── batch-release/    ← 批量发行
│   │   │   ├── fix-feed/         ← Feed修复
│   │   │   ├── send-otp/         ← OTP发送
│   │   │   ├── sync-stripe/      ← Stripe同步
│   │   │   └── user-profile/     ← 用户详情
│   │   ├── feed/           ← 公开影片Feed（读 is_feed_published）
│   │   ├── sync-user/      ← 用户同步【已加Token验证✅】
│   │   ├── webhook/
│   │   │   ├── stripe/     ← Stripe Webhook
│   │   │   └── solana/     ← Solana Webhook【已加幂等性保护✅】
│   │   └── ...
│   ├── admin/
│   │   └── page.tsx        ← 管理后台【已用adminFetch携带Token✅】
│   └── [pages]/
├── lib/
│   ├── auth/
│   │   └── adminAuth.ts    ← ⭐ Admin统一认证函数【新建✅】
│   ├── supabase.ts         ← 客户端（anon key）
│   ├── solana/hdWallet.ts  ← HD钱包派生
│   └── utils/encryption.ts ← 加密工具
├── middleware.ts            ← 路由保护（Cookie检测）
└── supabase/
    ├── migrations/         ← 15个迁移文件
    └── [processed_webhook_sigs表已在Supabase直接创建]
```

---

## 4. 核心数据表

| 表名 | 用途 | 关键字段 |
|------|------|---------|
| `users` | 用户主表 | id(text/Privy DID), email, aif_balance, verified_identities[], deposit_address, wallet_index |
| `films` | 影片投稿 | id, user_id, status, payment_status, **is_feed_published**（Feed开关字段） |
| `creator_applications` | 身份认证申请 | id, user_id, identity_type, status, payment_method |
| `batch_releases` | 批量发行任务 | id, status |
| `messages` | 站内消息 | id, user_id, type, title, body |
| `stripe_events` | Webhook幂等 | id（Stripe event_id） |
| `transactions` | 交易流水 | id, user_id, amount, currency, tx_type, status |
| `processed_webhook_sigs` | Solana Webhook幂等 | signature（唯一）【新建✅】 |
| `rbac_roles` | 角色权限 | id, name, permissions[], is_system |
| `rbac_user_roles` | 用户角色绑定 | id, account, role_id |
| `rbac_api_keys` | API密钥 | id, key_hash（SHA256） |
| `system_configs` | 系统配置 | id=1, treasury_wallet_address, funding_wallet_seed_encrypted |

---

## 5. 环境变量清单

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL          # 公开
NEXT_PUBLIC_SUPABASE_ANON_KEY     # 公开，受RLS保护
SUPABASE_SERVICE_ROLE_KEY         # ⚠️ 绝密！只能服务端

# Privy
NEXT_PUBLIC_PRIVY_APP_ID          # 公开
PRIVY_APP_SECRET                  # ⚠️ 绝密！

# Solana
MASTER_SEED_PHRASE                # ⚠️ 极度敏感！
FEE_PAYER_PRIVATE_KEY             # ⚠️ 绝密！
NEXT_PUBLIC_TREASURY_WALLET       # 公开
NEXT_PUBLIC_AIF_MINT_ADDRESS      # 公开

# Stripe
STRIPE_SECRET_KEY                 # ⚠️ 绝密！
STRIPE_WEBHOOK_SECRET             # ⚠️ 绝密！
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY # 公开

# Admin
ADMIN_EMAILS                      # ✅ 已配置！管理员邮箱白名单（服务端）
DB_ENCRYPTION_KEY                 # 助记词加密密钥
HELIUS_WEBHOOK_SECRET             # Solana Webhook验签
```

---

## 6. 认证架构（当前状态）

### Admin API保护（已完成）
```typescript
// lib/auth/adminAuth.ts
// 验证流程：Bearer Token → Privy验证 → 查users表邮箱 → 对比ADMIN_EMAILS
export async function checkAdminAuth(req): Promise<{ userId } | NextResponse>

// 所有18个Admin API第一行都是：
const authResult = await checkAdminAuth(req);
if (authResult instanceof NextResponse) return authResult;
```

### Admin前端调用（已完成）
```typescript
// app/admin/page.tsx
// 统一fetch函数，自动携带Privy Token
const adminFetch = useCallback(async (url, options = {}) => {
  const token = await getAccessToken();
  return fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers }
  });
}, [getAccessToken]);
```

### 用户API保护
```typescript
// 标准模式（update-profile、pay/aif等已实现）
const claims = await privyClient.verifyAuthToken(authHeader.slice(7));
const userId = claims.userId;
```

---

## 7. 开发铁律（Cursor必须遵守）

### 🔴 绝对禁止
1. 修改已有的 `checkAdminAuth` 函数逻辑
2. 修改已有的 `adminFetch` 函数
3. 将 `SUPABASE_SERVICE_ROLE_KEY` 用在前端
4. 删除任何安全验证代码
5. 修改数据库迁移文件（只能新增）
6. 在修复一个Bug时改动无关文件

### 🟢 必须遵守
1. 每次开发前读 `BUG_TRACKER.md` 确认任务
2. 新增Admin API必须第一行调用 `checkAdminAuth`
3. films表的Feed开关字段用 `is_feed_published`（不是feed_enabled）
4. 修改完成后报告改了哪些行

### ⚠️ 高危文件（改动前必须得到明确指令）
| 文件 | 风险 |
|------|------|
| `lib/auth/adminAuth.ts` | 影响所有Admin API安全 |
| `lib/solana/hdWallet.ts` | 影响所有用户钱包 |
| `app/api/webhook/solana/route.ts` | 涉及真实资金入账 |
| `app/api/pay/aif/route.ts` | 涉及余额扣减 |
| `app/api/webhook/stripe/route.ts` | 涉及支付确认 |
| `middleware.ts` | 影响整个路由保护 |

---

## 8. 协作方式

```
用户描述问题
    ↓
Claude分析 → 给出精确指令（指定文件+行号+内容）
    ↓
用户把指令复制给Cursor
    ↓
Cursor执行 → 报告改了哪些行
    ↓
用户把结果发给Claude确认
    ↓
Claude更新BUG_TRACKER.md
```
