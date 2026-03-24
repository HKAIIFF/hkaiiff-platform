# 📖 DEV_GUIDE — 开发指导手册
> 最后更新：2026-03-24 | v2.0

---

## Part 1：协作工作流

```
用户描述问题
    ↓
Claude分析（读BUG_TRACKER → 分析根因 → 制定精确方案）
    ↓
用户把Claude指令复制给Cursor
（每次都先说：请先读 _docs/PROJECT_BRAIN.md 和 _docs/BUG_TRACKER.md）
    ↓
Cursor执行（只改指定内容，报告行号）
    ↓
用户把结果发给Claude确认
    ↓
Claude更新文档 → 安排下一个任务
```

### 给Cursor的标准开场白
每次开始工作时先说：
> "请先阅读项目 `_docs/PROJECT_BRAIN.md` 和 `_docs/BUG_TRACKER.md`，然后按以下指令操作："

---

## Part 2：代码模板

### 模板A：新建Admin API（含认证）
```typescript
// app/api/admin/[功能]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkAdminAuth } from '@/lib/auth/adminAuth';

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET(req: NextRequest) {
  const authResult = await checkAdminAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const supabase = getAdminSupabase();
    const { data, error } = await supabase.from('表名').select('*');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data: data ?? [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

### 模板B：新建用户API（含Privy验证）
```typescript
// app/api/[功能]/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PrivyClient } from '@privy-io/server-auth';

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const privyClient = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

export async function POST(req: Request) {
  // Step 1: 验证Token
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let verifiedUserId: string;
  try {
    const claims = await privyClient.verifyAuthToken(authHeader.slice(7));
    verifiedUserId = claims.userId;
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  // Step 2: 业务逻辑
  try {
    // ...
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

### 模板C：新建数据库迁移文件
```sql
-- supabase/migrations/20260324XXXXXX_描述.sql
-- 说明：此迁移的目的

CREATE TABLE IF NOT EXISTS public.新表名 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.新表名 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "表名: service only"
  ON public.新表名
  FOR ALL
  USING (auth.role() = 'service_role');
```

### 模板D：Admin前端调用API
```typescript
// 使用adminFetch，不要用fetch
const res = await adminFetch('/api/admin/xxx', {
  method: 'POST',
  body: JSON.stringify({ key: value }),
});
const data = await res.json();
```

---

## Part 3：常见问题

### Q：Admin API返回401怎么办？
检查：
1. Vercel中 `ADMIN_EMAILS` 是否配置了正确的邮箱
2. 前端是否用了 `adminFetch` 而不是 `fetch`
3. `getAccessToken()` 是否返回了有效Token

### Q：films表的Feed开关字段是哪个？
`is_feed_published`（不是 `feed_enabled`）
Admin写入和读取都用 `is_feed_published`。

### Q：新增Admin API需要做什么？
1. 创建文件
2. 第一行加 `checkAdminAuth`
3. 前端调用时用 `adminFetch`
4. 在 `BUG_TRACKER.md` 记录

### Q：AIF余额怎么安全增加？
用Supabase RPC，不要read-then-write：
```typescript
await supabase.rpc('increment_aif_balance', {
  wallet_addr: targetAddress,
  amount_to_add: amount,
});
```

---

## Part 4：上线前检查清单

- [ ] 所有新Admin API有 `checkAdminAuth`
- [ ] 前端新的API调用用了 `adminFetch`
- [ ] 没有硬编码密钥
- [ ] 没有删除安全验证代码
- [ ] Vercel环境变量已配置
- [ ] git commit信息清晰描述改动
