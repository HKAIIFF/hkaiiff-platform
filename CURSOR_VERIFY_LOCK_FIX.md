# 身份認證按鈕不鎖定 — 根因修復 Cursor 指令

## 根因分析

有兩個獨立的 Bug 導致問題：

### Bug 1：Stripe 支付後跳轉到了錯誤的頁面

`app/verification/page.tsx` 中 `UniversalCheckout` 的 `successUrl` 設為空字符串 `""`。
後端 `product-checkout` API 遇到空 successUrl 時 fallback 到 `${siteUrl}/me?payment=success&product=identity_verify`。
所以 Stripe 支付成功後跳轉到了 `/me`（甚至 feed 頁），而不是 `/verification?stripe_success=1`。
`/verification` 頁面的 `stripe_success` 處理邏輯根本沒有被觸發。

### Bug 2：/me 頁面只在首次掛載時讀取 creator_applications

`refreshUserData` 的依賴是 `[pathname, authenticated, user?.id]`。
SPA 導航到 `/me` 時如果這三個值都沒變（通常都不會變），就不會重新拉取 `creator_applications` 表。
所以 `isVerifyLocked` 保持舊值 false，按鈕不鎖定。

## 修復方案

### 修復 1：Stripe successUrl 指向正確頁面

文件：`app/verification/page.tsx`

找到 `UniversalCheckout` 組件調用：
```tsx
<UniversalCheckout
  productCode="identity_verify"
  ...
  successUrl=""
  ...
/>
```

將 `successUrl` 修改為：
```tsx
successUrl={typeof window !== 'undefined' 
  ? `${window.location.origin}/verification?stripe_success=1` 
  : '/verification?stripe_success=1'}
```

### 修復 2：/me 頁面每次掛載都刷新認證狀態

文件：`app/me/page.tsx`

**方案：用一個自增計數器強制觸發刷新。**

找到 state 聲明區域（`isVerifyLocked` 附近），添加：
```typescript
const [refreshKey, setRefreshKey] = useState(0);
```

找到 `refreshUserData` 所在的 useEffect，修改其依賴數組：
```typescript
// 原來
}, [pathname, authenticated, user?.id]);

// 改為
}, [pathname, authenticated, user?.id, refreshKey]);
```

然後添加三個觸發刷新的機制（覆蓋全端：移動端 / Web / PWA）：

```typescript
// ── 認證狀態刷新（覆蓋 Web/PWA/移動端全場景）──────────────────────────────
useEffect(() => {
  // 1. 頁面可見性變化（PWA 從後台切回、移動端 Tab 切換）
  const onVisible = () => {
    if (document.visibilityState === 'visible') {
      setRefreshKey(k => k + 1);
    }
  };
  document.addEventListener('visibilitychange', onVisible);

  // 2. 窗口獲得焦點（桌面端切換窗口/Tab）
  const onFocus = () => setRefreshKey(k => k + 1);
  window.addEventListener('focus', onFocus);

  // 3. PWA 專用：pageshow 事件（iOS Safari 從 bfcache 恢復時觸發）
  const onPageShow = (e: PageTransitionEvent) => {
    if (e.persisted) setRefreshKey(k => k + 1);
  };
  window.addEventListener('pageshow', onPageShow);

  return () => {
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('focus', onFocus);
    window.removeEventListener('pageshow', onPageShow);
  };
}, []);
```

### 修復 3：URL 參數觸發刷新（Stripe 回調兜底）

文件：`app/me/page.tsx`

在組件頂部添加（如果還沒有）：
```typescript
import { useSearchParams } from 'next/navigation';
```

在組件中：
```typescript
const searchParams = useSearchParams();
```

在 `refreshUserData` 的 useEffect 依賴中再加上 searchParams 的關鍵參數：
```typescript
const paymentParam = searchParams.get('payment');
const verifiedParam = searchParams.get('verified');
```

修改依賴：
```typescript
}, [pathname, authenticated, user?.id, refreshKey, paymentParam, verifiedParam]);
```

在 effect 內部 `refreshUserData()` 調用後清除 URL 參數：
```typescript
refreshUserData().then(() => {
  // 清除 URL 參數避免重複觸發
  if (paymentParam || verifiedParam) {
    router.replace('/me', { scroll: false });
  }
});
```

### 修復 4：AIF 支付成功後也跳轉 /me 並帶標記

文件：`app/verification/page.tsx`

找到 `UniversalCheckout` 的 `onSuccess` 回調：
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

修改為：
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
  // 延遲跳轉到 /me 並帶上標記，觸發 /me 頁面刷新認證狀態
  setTimeout(() => {
    router.push("/me?verified=1");
  }, 2000);
}}
```

### 修復 5：Stripe 支付成功回調也跳轉 /me

文件：`app/verification/page.tsx`

找到 Stripe 成功回調的 `submitVerification` 調用處（`useEffect` 中處理 `stripe_success` 的部分）：

```typescript
if (stripeSuccess === "1" && authenticated && user?.id) {
  router.replace("/verification", { scroll: false });
  const pending = localStorage.getItem("pending_verification");
  if (pending) {
    localStorage.removeItem("pending_verification");
    showToast(
      lang === "zh" ? "Stripe 支付成功！正在提交認證申請..." : "Payment successful! Submitting your application...",
      "success"
    );
    getAccessToken().then((token) => {
      if (token) submitVerification("fiat", token);
    });
  } else {
    showToast(
      lang === "zh" ? "支付成功！您的認證申請已提交。" : "Payment successful! Your verification has been submitted.",
      "success"
    );
    setPageState("B");
  }
}
```

在 `submitVerification` 函數末尾（`setPageState("B")` 之後），添加延遲跳轉：
```typescript
async function submitVerification(paymentMethod: "fiat" | "aif", token: string) {
  const res = await fetch("/api/verification/submit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      verificationType: form.verificationType,
      verificationName: form.verificationName,
      paymentMethod,
      applicationId: draftApplicationId ?? undefined,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data.message ?? data.error ?? "Submission failed";
    showToast(msg, "error");
    return;
  }
  showToast(t("verify_success"), "success");
  setPageState("B");
  // 跳轉到 /me 並觸發刷新
  setTimeout(() => {
    router.push("/me?verified=1");
  }, 2000);
}
```

同時在 `else` 分支（沒有 localStorage pending 的情況）也添加跳轉：
```typescript
} else {
  showToast(
    lang === "zh" ? "支付成功！您的認證申請已提交。" : "Payment successful! Your verification has been submitted.",
    "success"
  );
  setPageState("B");
  setTimeout(() => {
    router.push("/me?verified=1");
  }, 2000);
}
```

### 修復 6：雙重保險 — Realtime 監聽 creator_applications 表

文件：`app/me/page.tsx`

在現有的 Realtime useEffect 中（監聽 `users` 表的那個），添加對 `creator_applications` 表的監聽：

找到 Realtime channel 的 `.subscribe()` 調用，在 `.on('postgres_changes', ...)` 之後、`.subscribe()` 之前，添加第二個 `.on()`：

```typescript
const channel = supabase
  .channel(channelName)
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'users',
      filter: `id=eq.${user.id}`,
    },
    (payload) => {
      // ... 原有的 users 表更新處理 ...
    }
  )
  // ── 新增：監聽 creator_applications 表變更 ──
  .on(
    'postgres_changes',
    {
      event: '*',  // INSERT, UPDATE, DELETE
      schema: 'public',
      table: 'creator_applications',
      filter: `user_id=eq.${user.id}`,
    },
    () => {
      // 任何變更都觸發刷新
      setRefreshKey(k => k + 1);
    }
  )
  .subscribe((status) => {
    setIsRealtimeConnected(status === 'SUBSCRIBED');
  });
```

注意：`creator_applications` 表需要啟用 Realtime。在 Supabase Dashboard → Database → Replication 中，確認 `creator_applications` 表已開啟 Realtime。如果沒有，在 SQL Editor 執行：

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.creator_applications;
```

## 驗證清單

修復完成後，逐一測試：

1. **Stripe 支付**：/verification → 選擇 Stripe → 支付成功 → 應跳回 /verification（顯示審核中）→ 2秒後跳到 /me → 認證按鈕應顯示「認證中」已鎖定
2. **AIF 支付**：/verification → 選擇 AIF → 支付成功 → 顯示審核中 → 2秒後跳到 /me → 認證按鈕應顯示「認證中」已鎖定
3. **PWA**：從其他頁面切回 /me → 認證按鈕應正確反映當前狀態
4. **移動端 Safari**：同上
5. **直接訪問 /me**：刷新頁面 → 認證按鈕應正確顯示
6. **重複提交**：認證中狀態下點擊「立即認證」→ 應無法點擊（disabled）

## 提交

```bash
git add -A && git commit -m "fix: 修復認證按鈕不鎖定 — successUrl修正 + 多端刷新機制 + Realtime監聽"
```
