# 身份認證流程修復 + 完整性校對 — Cursor 指令

## 問題根因

/me 頁面的認證按鈕沒有鎖定（仍顯示「立即認證」而非「認證中」），原因是：

1. **`refreshUserData` 只在掛載時執行一次**（依賴 `[pathname, authenticated, user?.id]`），用戶從 `/verification` 支付成功跳回 `/me` 時，這三個依賴都沒變，不會重新拉取 `creator_applications` 數據
2. **Realtime 訂閱只監聽 `users` 表**，不監聯 `creator_applications` 表。`creator_applications.status` 從 `awaiting_payment` 改為 `pending` 時，/me 頁面無法感知
3. **結果**：`identityApplications` state 保留的是上次掛載時的舊數據，`isVerifyLocked` 為 false，按鈕不鎖定

## 指令 1：修復 /me 頁面認證狀態不刷新

文件：`app/me/page.tsx`

### 1.1 添加強制刷新觸發器

找到 `refreshUserData` 所在的 `useEffect`，在依賴數組中添加一個可控觸發器：

在 state 聲明區域（`isVerifyLocked` 附近）添加：
```typescript
const [refreshTrigger, setRefreshTrigger] = useState(0);
```

修改 `refreshUserData` 的 useEffect 依賴：
```typescript
// 原來
}, [pathname, authenticated, user?.id]);

// 改為
}, [pathname, authenticated, user?.id, refreshTrigger]);
```

### 1.2 頁面可見性變化時刷新

在 /me 頁面組件中添加一個新的 useEffect，監聽頁面可見性變化（用戶從其他頁面切回 /me 時觸發）：

```typescript
// 頁面重新可見時刷新認證狀態（解決從 verification 頁支付後跳回 /me 不刷新的問題）
useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      setRefreshTrigger((prev) => prev + 1);
    }
  };
  // 同時監聯 Next.js 的路由變化導致的 focus
  const handleFocus = () => {
    setRefreshTrigger((prev) => prev + 1);
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('focus', handleFocus);
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('focus', handleFocus);
  };
}, []);
```

### 1.3 路由回退時也觸發刷新

找到 /me 頁面中 `useEffect` 依賴 `pathname` 的地方。由於 Next.js App Router 的 SPA 導航中 `/me → /verification → /me` 的 pathname 始終是 `/me`（第二次不會觸發），需要額外的方式。

在 `/verification` 頁面的支付成功回調中，通過 URL 參數標記已支付：

文件：`app/verification/page.tsx`

找到 AIF 支付成功的回調（`UniversalCheckout` 的 `onSuccess`）：
```typescript
onSuccess={async () => {
  localStorage.removeItem("pending_verification");
  setPageState("B");
  showToast(
    lang === "zh"
      ? "支付成功！認證申請已提交，請等待審核。"
      : "Payment successful! Application submitted.",
    "success"
  );
}}
```

在 `setPageState("B")` 之後添加延遲跳轉到 /me（帶標記）：
```typescript
onSuccess={async () => {
  localStorage.removeItem("pending_verification");
  setPageState("B");
  showToast(
    lang === "zh"
      ? "支付成功！認證申請已提交，請等待審核。"
      : "Payment successful! Application submitted.",
    "success"
  );
  // 2秒後自動跳轉 /me，帶上 verified 標記觸發刷新
  setTimeout(() => {
    router.push("/me?verified=1");
  }, 2000);
}}
```

同樣找到 Stripe fiat 支付成功的回調（`submitVerification` 函數末尾或 Stripe 成功回調），也加上跳轉。

然後在 /me 頁面中：

文件：`app/me/page.tsx`

在 `refreshUserData` 的 useEffect 中，添加 URL 參數監聯：

```typescript
import { useSearchParams } from 'next/navigation';

// 在組件頂部
const searchParams = useSearchParams();
const verifiedParam = searchParams.get('verified');

// 修改 refreshUserData 的依賴
}, [pathname, authenticated, user?.id, refreshTrigger, verifiedParam]);
```

並在 effect 內部（`refreshUserData()` 調用後）清除 URL 參數：
```typescript
refreshUserData();
// 清除 URL 標記，避免重複觸發
if (verifiedParam) {
  router.replace('/me', { scroll: false });
}
```

## 指令 2：完整流程校對 + 缺失環節補充

以下是身份認證的完整生命週期，逐步校對每個環節：

### 流程 1：首次認證申請

| 步驟 | 頁面/API | 狀態 | 校對結果 |
|------|---------|------|---------|
| 用戶進入 /verification | verification page | pageState = "A" | ✅ 正常 |
| 選擇身份類型 + 填寫信息 | Step 1 | — | ✅ 有唯一性校驗 |
| 進入 Step 2（自動保存草稿） | `/api/verification/submit` | `creator_applications.status = 'awaiting_payment'` | ✅ 正常 |
| 支付（Stripe 或 AIF） | UniversalCheckout | — | ✅ 有雙軌支付 |
| AIF 支付成功 | `/api/pay/verify-aif` | `status → 'pending'` | ✅ 正常 |
| Stripe 支付成功 | Stripe Webhook → `submitVerification()` | `status → 'pending'` | ✅ 正常 |
| /me 頁面顯示「認證中」 | /me | `isVerifyLocked = true` | ❌ **不刷新！** |

### 流程 2：Admin 審核

| 步驟 | 頁面/API | 狀態 | 校對結果 |
|------|---------|------|---------|
| Admin 點擊「通過」 | `/api/admin/verifications/review` | `status → 'approved'`, `expires_at = now + 1 year` | ✅ 正常 |
| `verified_identities` 數組更新 | 同上 | `users.verified_identities += [identity_type]` | ✅ 正常 |
| `display_name` 覆寫 | 同上 | `users.display_name = verification_name` | ✅ 正常 |
| `username_locked = true` | 同上 | 鎖定用戶名 | ✅ 正常 |
| 發送站內通知 | `sendMessage()` | 系統消息 | ✅ 正常 |
| /me 頁面 Realtime 更新 | Supabase Realtime | `verified_identities` 更新 | ✅ 正常（監聽 users 表）|
| /verification 頁面顯示 State C | verification page | `pageState = "C"` | ✅ 正常 |
| 有效期 365 天 | DB `expires_at` | `now + 1 year` | ✅ 正常 |

### 流程 3：Admin 退回

| 步驟 | 頁面/API | 狀態 | 校對結果 |
|------|---------|------|---------|
| Admin 點擊「退回」 | `/api/admin/verifications/review` | `status → 'rejected'` | ✅ 正常 |
| 退回原因記錄 | 同上 | `rejection_reason = '侵權風險'` 等 | ✅ 有校驗（3 種原因） |
| 從 verified_identities 移除 | 同上 | `users.verified_identities -= [identity_type]` | ✅ 正常 |
| `username_locked = false` | 同上 | 解鎖用戶名 | ✅ 正常 |
| 發送退回通知 | `sendMessage()` | 系統消息 | ✅ 正常 |
| /me 頁面顯示退回原因 | /me | 紅色提示框 | ✅ 正常 |

### 流程 4：重新提交（被退回後）

| 步驟 | 頁面/API | 狀態 | 校對結果 |
|------|---------|------|---------|
| /verification 頁面恢復 State A | verification page | pageState = "A" | ⚠️ **需校驗** |
| 重新提交是否需要付費 | — | — | ⚠️ **當前未做區分** |
| 重新提交二次確認 | — | — | ✅ 有 `showResubmitWarning` |

### 流程 5：認證過期

| 步驟 | 頁面/API | 狀態 | 校對結果 |
|------|---------|------|---------|
| 365 天後 expires_at 過期 | — | `expires_at < now` | ⚠️ **前端有判斷但無提醒** |
| /me 頁面解鎖認證按鈕 | /me | `isVerifyLocked = false` | ✅ 邏輯正確 |
| /verification 恢復 State A | verification page | `pageState = "A"` | ✅ 邏輯正確 |
| 續期是否需要付費 | — | — | ❌ **無續期流程** |

## 發現的問題清單

### ❌ P0：/me 頁面支付後不刷新認證狀態（指令 1 已修復）

### ⚠️ P1：重新提交（被退回）是否需要付費

當前代碼中，被退回後重新進入 /verification：
- `blockedTypes` 只包含 `pending` 和 `approved` 狀態的身份類型
- `rejected` 不在 blocked 列表中，所以用戶可以重新申請
- **但重新申請會再次進入支付流程**（Step 2 → UniversalCheckout）

**這是否是預期行為？** 如果是，目前邏輯正確。如果退回後重新提交應免費，則需要在 `/api/verification/submit` 中添加豁免邏輯。

**建議**：保持當前行為（退回後重新申請需付費），但在 /verification 頁面添加明確提示：

文件：`app/verification/page.tsx`

在 State A 的表單頂部，如果用戶有被退回的申請記錄，顯示提示：

```typescript
{statusApps.some((a) => a.status === 'rejected') && (
  <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 mb-4 text-sm text-amber-300">
    <i className="fas fa-exclamation-triangle mr-2" />
    {lang === 'zh' 
      ? '您的上次認證申請被退回，修改後可重新提交。重新提交需要再次支付認證費用。'
      : 'Your previous application was rejected. You may resubmit after making changes. Resubmission requires a new payment.'}
  </div>
)}
```

### ⚠️ P2：認證過期無提醒和續期入口

當 `expires_at` 接近到期時（比如最後 30 天），/me 頁面和消息中心都沒有提醒。

**建議**：在 /me 頁面的認證徽章旁，添加到期倒計時：

文件：`app/me/page.tsx`

在顯示認證徽章的地方（`dbProfile?.verified_identities?.map(...)` 循環內），為有 `expires_at` 的已通過申請添加到期提示：

```typescript
{/* 在認證徽章後面添加 */}
{identityApplications
  .filter((a) => a.status === 'approved' && a.expires_at)
  .map((app) => {
    const daysLeft = Math.ceil(
      (new Date(app.expires_at!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (daysLeft <= 30 && daysLeft > 0) {
      return (
        <span key={`expire-${app.id}`} className="text-[8px] text-amber-400 font-mono">
          {daysLeft} {lang === 'zh' ? '天後到期' : 'days left'}
        </span>
      );
    }
    return null;
  })}
```

### ✅ 已完整的環節

- 身份類型選擇（creator / institution / curator）✅
- 認證名稱全平台唯一性校驗 ✅
- display_name 同步 + username_locked ✅
- 多重身份認證（一個用戶可認證多種身份）✅ 設計存在但 blockedTypes 會鎖定所有類型
- AIF / Stripe 雙軌支付 ✅
- Admin 審核通過 + 退回 + 退回原因 ✅
- 有效期 365 天 ✅
- Realtime 同步 users 表變更 ✅

## 提交

完成後執行：
```bash
git add -A && git commit -m "fix: 修復 /me 頁面認證狀態不刷新 + 補充到期提醒"
```
