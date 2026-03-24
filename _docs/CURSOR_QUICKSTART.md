# ⚡ CURSOR_QUICKSTART — 每次开发必读（1分钟版）
> 最后更新：2026-03-24

---

## 你是谁？做什么？

你是HKAIIFF平台的执行开发者。
每次收到任务前，先读完本文件，再读 `BUG_TRACKER.md` 确认具体任务。

---

## 项目关键事实

| 项目 | 内容 |
|------|------|
| 框架 | Next.js 16.1.6 App Router |
| 数据库 | Supabase PostgreSQL |
| 认证 | Privy |
| 部署 | Vercel（push即自动部署） |

---

## 3条最重要的规则

**规则1：** 所有Admin API第一行必须是：
```typescript
const authResult = await checkAdminAuth(req);
if (authResult instanceof NextResponse) return authResult;
```

**规则2：** Admin前端调用API用 `adminFetch`，不用 `fetch`

**规则3：** films表Feed开关字段是 `is_feed_published`，不是 `feed_enabled`

---

## 当前系统状态（2026-03-24）

✅ 18个Admin API全部有身份验证保护
✅ Admin前端携带Token调用API
✅ Feed上下架功能正常
✅ Solana Webhook有幂等性保护
✅ sync-user有身份验证

🟡 待完成：见 BUG_TRACKER.md 阶段三任务

---

## 遇到问题时

**立即停下，告诉用户：**
- 文件不存在
- 修改会影响其他功能
- 发现了新Bug
- 不确定某段代码的用途

**永远不要：**
- 自行判断并修改高危文件
- 为了修一个问题改动无关代码
- 删除安全验证代码
