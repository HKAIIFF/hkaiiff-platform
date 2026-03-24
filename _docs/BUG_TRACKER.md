# 🐛 HKAIIFF — BUG TRACKER & 修复进度
> Cursor每次工作前必须查看此文件
> 最后更新：2026-03-24 | 当前版本：v2.0

---

## 📊 总进度

| 阶段 | 内容 | 状态 |
|------|------|------|
| 阶段一 | 紧急功能修复 | ✅ 全部完成已上线 |
| 阶段二 | 安全加固 | ✅ 全部完成已上线 |
| 阶段三 | 功能优化 | ✅ 全部完成已上线 |
| 阶段四 | Admin登录修复 | ✅ 全部完成已上线 |
| 阶段五 | 前端UX修复 | ✅ 全部完成已上线 |

---

## ✅ 已完成（已上线）

### Commit 5930471
| ID | 内容 | 文件 |
|----|------|------|
| FIXED-001 | Feed上下架字段统一为 `is_feed_published` | `app/admin/page.tsx` |
| FIXED-002 | send-otp空白名单漏洞修复 | `app/api/admin/send-otp/route.ts` 第31行 |
| FIXED-003 | Dashboard接入真实数据API | `app/admin/page.tsx` + 新建`app/api/admin/dashboard/stats/route.ts` |
| FIXED-004 | 创建Admin统一认证函数 | 新建 `lib/auth/adminAuth.ts` |

### Commit cef0ae9
| ID | 内容 | 文件 |
|----|------|------|
| FIXED-005 | 全部18个Admin API添加checkAdminAuth | 见下方文件清单 |

**已加认证的18个Admin API：**
- `admin/treasury/config` — GET、POST
- `admin/rbac` — GET、POST、PATCH、DELETE
- `admin/verifications/review` — POST
- `admin/users` — GET
- `admin/treasury/sweep` — POST
- `admin/treasury/sweep-dust` — GET、POST
- `admin/treasury/stats` — GET
- `admin/treasury/ledger` — GET
- `admin/verifications` — GET
- `admin/batch-release` — GET、POST
- `admin/finance/ledger` — GET
- `admin/user-profile` — GET
- `admin/products` — GET、POST、PATCH
- `admin/messages/history` — GET
- `admin/fix-feed` — GET、POST
- `admin/sync-stripe` — POST（同时删除旧的isAdminAuthorized冲突）
- `admin/send-otp` — POST
- `admin/dashboard/stats` — GET

### Commit 806e15d
| ID | 内容 | 文件 |
|----|------|------|
| FIXED-006 | Admin前端24处fetch替换为adminFetch（携带Auth Token） | `app/admin/page.tsx` |

### Commit 7c02d72
| ID | 内容 | 文件 |
|----|------|------|
| FIXED-007 | sync-user添加Privy Token验证防伪造 | `app/api/sync-user/route.ts` |
| FIXED-008 | Solana Webhook添加幂等性保护防重复入账 | `app/api/webhook/solana/route.ts` |

### Supabase直接操作
| ID | 内容 |
|----|------|
| FIXED-009 | 创建 `processed_webhook_sigs` 表（Webhook幂等去重） |
| FIXED-010 | Vercel配置 `ADMIN_EMAILS` 环境变量 |

---

## ✅ 阶段三 — 全部完成（功能优化）

### [P1-001] ✅ 已修复 — AIF余额更新竞态条件（commit 25ddad5）

**文件：** `app/api/wallet/sync-balance/route.ts`
**问题：** read-then-write模式，并发时可能丢失更新
**修复方案：** 改用Supabase RPC `increment_aif_balance`（参考webhook/solana中已有的正确实现）
**预计工时：** 30分钟

---

### [P1-002] ✅ 已修复 — 财务金额单位不一致（commit 25ddad5）

**文件：** `app/api/admin/treasury/sweep/route.ts`
**问题：** 第1704行 `amount: Number(userAifAmount)` 使用链上最小单位，展示时应除以10^9
**修复方案：** 改为 `amount: Number(userAifAmount) / Math.pow(10, 9)`
**预计工时：** 10分钟

---

### [P1-003] ✅ 已修复 — 消息系统字段不统一（commit b8d5736）

**文件：** `lib/actions/message.ts`、相关API
**问题：** `body` vs `content`、`msg_type` vs `type` 混用
**修复：** sync-balance和hdWallet.ts直接insert补齐msg_type/content/status字段

---

### [P2-001] ✅ 已完成 — 空壳菜单处理（commit d827f12）

**文件：** `app/admin/page.tsx`
**问题：** AI相关菜单（ai:models、ai:prompts、ai:assembly）无实际功能
**方案A：** 隐藏这些菜单项
**方案B：** 显示"即将上线"提示
**已选方案B：显示即将上线提示，并删除三个Mock组件**

---

### [P2-002] ✅ 已修复 — creator_applications金额硬编码（commit 8bcf750）

**文件：** `app/api/admin/finance/ledger/route.ts`
**问题：** 第1027行金额用估算值（150 AIF / 30 USD）而非实际金额
**修复方案：** 在creator_applications表添加amount字段，提交时记录实际金额
**预计工时：** 2小时（需建迁移文件）

---

## 📝 操作日志

| 时间 | Commit | 内容 | 状态 |
|------|--------|------|------|
| 2026-03-24 | — | 完整代码审查 | ✅ |
| 2026-03-24 | 5930471 | 阶段一修复 + adminAuth创建 | ✅ 线上 |
| 2026-03-24 | cef0ae9 | 18个Admin API认证 | ✅ 线上 |
| 2026-03-24 | 806e15d | Admin前端Auth Token | ✅ 线上 |
| 2026-03-24 | 7c02d72 | sync-user + Webhook幂等 | ✅ 线上 |
| 2026-03-24 | 25ddad5 | P1-001 AIF余额原子RPC + P1-002 财务金额单位 | ✅ 线上 |
| 2026-03-24 | b8d5736 | P1-003 消息字段统一 | ✅ 线上 |
| 2026-03-24 | d827f12 | P2-001 AI菜单开发中提示 | ✅ 线上 |
| 2026-03-24 | 8bcf750 | P2-002 creator_applications amount字段 | ✅ 线上 |

---

## 🚨 紧急操作说明

**系统被攻击时：**
1. Vercel → 删除/轮换 `SUPABASE_SERVICE_ROLE_KEY`
2. 轮换 `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`
3. 轮换 `MASTER_SEED_PHRASE`（需同步reset所有用户钱包地址）
4. 联系Supabase暂停项目

---

## ✅ 阶段四 — Admin登录修复（2026-03-24）

| Commit | 内容 |
|--------|------|
| `e5dd30d` | Admin登录读取NEXT_PUBLIC_ADMIN_EMAILS，移除硬编码邮箱 |
| `4681b29` | Admin layout防御性解析ADMIN_EMAILS |
| `5e61734` | adminFetch提升为模块级函数，解决运行时崩溃 |

---

## ✅ 阶段五 — 前端用户体验修复（全部完成）

### [UX-001] ✅ 已修复 — 未登录点击直接弹登录框（commit b6fb4a7）
- 现象：已登录用户点击上传影片、Discover等按钮仍弹出登录提示
- 修复：移除 showToast 提示，直接调用 setShowConsent(true) 弹出 Privy 登录框

### [UX-002] ✅ 已修复 — 认证审批后名称实时同步（commit bdfc801）
- 现象：认证名称与用户名不同时，me页面显示用户名，编辑页面才显示认证名称
- 修复：Realtime 回调检测到认证状态变化时，自动重新拉取 creator_applications

### [UX-003] ✅ 已修复 — 认证状态实时更新（commit bdfc801，与UX-002同一修复）
- 现象：Admin已批准认证，但用户页面状态未更新
- 修复：同上，Realtime 回调新增 creator_applications 刷新逻辑
