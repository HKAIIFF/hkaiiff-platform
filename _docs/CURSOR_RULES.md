# 📋 CURSOR_RULES — Cursor开发行为规范
> 最后更新：2026-03-24 | v2.0

---

## 🛑 开始任何工作前必须阅读

1. `PROJECT_BRAIN.md` — 项目全貌和架构
2. `BUG_TRACKER.md` — 当前任务和进度
3. 本文件 — 行为规范

---

## 🔴 绝对禁止

### 禁止1：不改与任务无关的代码
修复A问题时，不顺手"优化"B、不重构C、不调整格式。

### 禁止2：不删除任何安全检查
永远不删除：
- `checkAdminAuth` 调用
- `adminFetch` 中的Token逻辑
- Privy Token验证代码
- Stripe Webhook签名验证
- userId一致性检查

### 禁止3：不修改已有迁移文件
`supabase/migrations/` 中的文件只读，需要改数据库时新建迁移文件。

### 禁止4：不硬编码敏感信息
```typescript
// ❌ 禁止
const KEY = "sk_live_xxx";
// ✅ 必须
process.env.VARIABLE_NAME
```

### 禁止5：不在前端用SERVICE_ROLE_KEY
`SUPABASE_SERVICE_ROLE_KEY` 只能在服务端API路由中使用。

---

## 🟢 必须遵守

### 规范1：新建Admin API的标准格式
```typescript
import { checkAdminAuth } from '@/lib/auth/adminAuth';

export async function GET(req: Request) {
  // 第一行必须是认证
  const authResult = await checkAdminAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  // 然后才是业务逻辑
  try {
    // ...
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

### 规范2：Feed开关字段
films表用 `is_feed_published`，不是 `feed_enabled`。

### 规范3：Admin前端调用API
使用 `adminFetch` 而不是 `fetch`，确保携带Token。

### 规范4：完成后必须报告
```
修改了：[文件路径]
改动行：[具体行号]
改动内容：[一句话描述]
其他文件：未做任何改动
```

---

## ⚠️ 高危文件（必须得到明确指令才能修改）

| 文件 | 风险 |
|------|------|
| `lib/auth/adminAuth.ts` | 影响所有Admin API安全 |
| `app/admin/page.tsx` 中的adminFetch | 影响所有Admin操作 |
| `lib/solana/hdWallet.ts` | 影响所有用户钱包 |
| `app/api/webhook/solana/route.ts` | 涉及真实资金 |
| `app/api/pay/aif/route.ts` | 涉及余额扣减 |
| `middleware.ts` | 影响整个路由保护 |

---

## 🆘 遇到以下情况立即停下告知用户

1. 修复一个问题时发现会影响另一个功能
2. 文件路径不存在
3. 需要修改高危文件
4. 发现了新的Bug
5. 代码逻辑与文档描述不一致
