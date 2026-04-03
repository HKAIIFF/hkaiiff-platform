# HKAIIFF 批片發行重構 + 安全修復 — Cursor 指令集

> ⚠️ 以下指令按優先級排序，每組指令為一個獨立的 Cursor Composer 任務。
> 請按順序逐組執行，每組執行完畢後 `git add -A && git commit -m "描述"` 再進入下一組。

---

## 第一組：🔴 修復批片發行用戶名 Bug + 合併 CSV 模板為單表

### 背景
當前批片發行有兩個 CSV 模板（users-template.csv 和 films-template.csv），用 email 關聯。存在以下問題：
1. `process-item` 創建用戶時只設了 `name`，沒設 `display_name`，導致前端顯示 email 而非真實姓名
2. 兩張表操作繁瑣，需合併為一張包含用戶信息+影片信息的單表
3. 影片上傳按順序匹配（第1個視頻文件對應表格第1行），不依賴文件名精確匹配

### 指令 1.1：新建合併版 CSV 模板

在 `public/templates/` 目錄下創建新的合併模板 `batch-release-template.csv`，內容如下：

```csv
verification_name,email,role,bio,about_studio,tech_stack,project_title,conductor_studio,film_tech_stack,ai_contribution_ratio,synopsis,core_cast,region,country,language,year,lbs_festival_royalty,contact_email
張三,zhangsan@example.com,creator,AI電影導演,張三工作室,Sora/Runway,我的AI電影,張三工作室,Sora + Runway Gen-3,85,一部探索AI與人類關係的電影,張三/李四,亞洲,中國,中文,2026,5,zhangsan@example.com
```

第一行為表頭，第二行為示例數據。保留舊模板文件（users-template.csv 和 films-template.csv）以便向後兼容，但在 UI 上不再主要推薦。

### 指令 1.2：修改後端 API — `app/api/admin/batch-release/route.ts`

在 `process-item` action 中，修改用戶創建邏輯，**同時設置 `name` 和 `display_name`**：

找到這段代碼：
```typescript
// 建立用戶記錄
const { error: userErr } = await db.from('users').insert({
  id: userId,
  email: userInfo.email,
  name: userInfo.verification_name,
  last_sign_in_at: new Date().toISOString(),
  verification_status: 'approved',
  verification_type: verificationType,
  portfolio: userInfo.bio ?? null,
});
```

替換為：
```typescript
// 建立用戶記錄 — 同時設 name + display_name，確保前端所有頁面都能正確顯示姓名
const { error: userErr } = await db.from('users').insert({
  id: userId,
  email: userInfo.email,
  name: userInfo.verification_name,
  display_name: userInfo.verification_name,   // ← 關鍵修復：前端優先讀 display_name
  last_sign_in_at: new Date().toISOString(),
  verification_status: 'approved',
  verification_type: verificationType,
  verified_identities: [verificationType],     // ← 新增：直接寫入已認證身份數組，Feed 頁面會讀此字段顯示認證徽章
  portfolio: userInfo.bio ?? null,
  bio: userInfo.bio ?? null,                   // ← 新增：bio 字段也寫入，/me 頁面和 creator 頁面讀此字段
  about_studio: userInfo.about_studio ?? null, // ← 新增：工作室簡介
  tech_stack: userInfo.tech_stack ?? null,     // ← 新增：技術棧
  username_locked: true,                       // ← 新增：鎖定用戶名，防止被修改
});
```

同時修改 `process-item` 的 TypeScript 接口，在 `userInfo` 中新增可選字段：
```typescript
userInfo: {
  email: string;
  verification_name: string;
  role?: string;
  bio?: string;
  about_studio?: string;   // ← 新增
  tech_stack?: string;     // ← 新增
};
```

### 指令 1.3：修改影片創建邏輯 — 補充更多字段

在同一個 `process-item` 中，修改影片插入邏輯，增加 `country`、`language`、`year` 字段：

找到影片插入代碼（`db.from('films').insert({...})`），在插入對象中添加：
```typescript
const { data: film, error: filmErr } = await db
  .from('films')
  .insert({
    user_id: userId,
    title: filmInfo.project_title,
    studio: filmInfo.conductor_studio ?? null,
    tech_stack: filmInfo.film_tech_stack ?? null,
    ai_ratio: filmInfo.ai_contribution_ratio ?? 75,
    description: filmInfo.synopsis ?? null,
    synopsis: filmInfo.synopsis ?? null,        // ← 新增：部分前端頁面讀 synopsis 而非 description
    core_cast: filmInfo.core_cast ?? null,
    region: filmInfo.region ?? null,
    lbs_royalty: filmInfo.lbs_festival_royalty ?? 5,
    poster_url: filmInfo.poster_url,
    trailer_url: filmInfo.trailer_url,
    contact_email: filmInfo.contact_email ?? userInfo.email,
    status: 'approved',
    is_feed_published: true,
    is_main_published: true,                    // ← 新增：同時上架到主頁
    payment_status: 'paid',                     // ← 新增：標記為已支付（官方發行無需付費）
    payment_method: 'official',                 // ← 新增：支付方式標記為官方
  })
  .select()
  .single();
```

同時擴展 `filmInfo` 接口：
```typescript
filmInfo: {
  project_title: string;
  conductor_studio?: string;
  film_tech_stack?: string;
  ai_contribution_ratio?: number;
  synopsis?: string;
  core_cast?: string;
  region?: string;
  lbs_festival_royalty?: number;
  contact_email?: string;
  poster_url: string;
  trailer_url: string;
  country?: string;      // ← 新增
  language?: string;     // ← 新增
  year?: number;         // ← 新增
};
```

### 指令 1.4：重構前端 BatchReleaseTab — 合併為兩步流程

**完全重寫 `app/admin/BatchReleaseTab.tsx`**，從三步（用戶CSV → 影片CSV → 上傳視頻）改為兩步（合併CSV → 上傳視頻）。

核心改動：

**1) 類型定義**：刪除 `UserRow` 和 `FilmRow` 兩個分離的接口，替換為合併的 `BatchItemRow`：

```typescript
interface BatchItemRow {
  // 用戶信息
  verification_name: string;
  email: string;
  role?: string;
  bio?: string;
  about_studio?: string;
  tech_stack?: string;
  // 影片信息
  project_title: string;
  conductor_studio?: string;
  film_tech_stack?: string;
  ai_contribution_ratio?: string | number;
  synopsis?: string;
  core_cast?: string;
  region?: string;
  country?: string;
  language?: string;
  year?: string | number;
  lbs_festival_royalty?: string | number;
  contact_email?: string;
}
```

**2) 狀態變量**：刪除 `usersData`、`filmsData` 兩個 state，替換為：
```typescript
const [items, setItems] = useState<BatchItemRow[]>([]);
```

**3) StepIndicator**：從三步改為兩步：
```typescript
const steps = ["信息表格", "上傳影片"];
```

**4) Step 1 — 合併的 CSV 上傳**：

只有一個文件上傳區域，解析後填入 `items` state。解析邏輯：
```typescript
function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  if (!file) return;
  setError("");
  parseSpreadsheet(file).then((rows) => {
    // 校驗必填字段
    const valid = rows.filter(
      (r: Record<string, string>) => r.verification_name && r.email && r.project_title
    );
    if (valid.length === 0) {
      setError("表格中無有效數據，請確認包含 verification_name、email、project_title 列");
      return;
    }
    setItems(valid.map((r: Record<string, string>) => ({
      verification_name: r.verification_name?.trim() || "",
      email: r.email?.trim() || "",
      role: r.role?.trim() || "creator",
      bio: r.bio?.trim() || "",
      about_studio: r.about_studio?.trim() || "",
      tech_stack: r.tech_stack?.trim() || "",
      project_title: r.project_title?.trim() || "",
      conductor_studio: r.conductor_studio?.trim() || "",
      film_tech_stack: r.film_tech_stack?.trim() || "",
      ai_contribution_ratio: r.ai_contribution_ratio || "75",
      synopsis: r.synopsis?.trim() || "",
      core_cast: r.core_cast?.trim() || "",
      region: r.region?.trim() || "",
      country: r.country?.trim() || "",
      language: r.language?.trim() || "",
      year: r.year || "2026",
      lbs_festival_royalty: r.lbs_festival_royalty || "5",
      contact_email: r.contact_email?.trim() || r.email?.trim() || "",
    })));
  }).catch((err) => setError(err.message));
}
```

預覽表格顯示的列：`#`, `姓名`, `郵箱`, `角色`, `影片標題`, `Studio`, `AI比例`, `地區`

下載模板按鈕指向新模板：
```html
<a href="/templates/batch-release-template.csv" download>
  📥 下載批片發行模板 (CSV)
</a>
```

**5) Step 2 — 上傳視頻**：基本保持不變，但匹配邏輯從 `filmsData` 改為 `items`。

**6) 發布邏輯 `handlePublish`**：修改為從 `items` 構造 API 請求：

```typescript
const apiItems = items.map((item) => ({
  user_email: item.email,
  user_password: "HKaiiff2026!@",
  role: item.role ?? "creator",
  verification_name: item.verification_name,
  bio: item.bio ?? null,
  about_studio: item.about_studio ?? null,
  profile_tech_stack: item.tech_stack ?? null,
  project_title: item.project_title,
  conductor_studio: item.conductor_studio ?? null,
  film_tech_stack: item.film_tech_stack ?? null,
  ai_contribution_ratio: Number(item.ai_contribution_ratio) || 75,
  synopsis: item.synopsis ?? null,
  core_cast: item.core_cast ?? null,
  region: item.region ?? null,
  country: item.country ?? null,
  language: item.language ?? null,
  year: Number(item.year) || 2026,
  lbs_festival_royalty: Number(item.lbs_festival_royalty) || 5,
  contact_email: item.contact_email ?? item.email,
}));
```

`process-item` 的調用保持不變，只是 `userInfo` 和 `filmInfo` 的數據來源從兩個 state 改為單一的 `items[i]`：
```typescript
userInfo: {
  email: item.email,
  verification_name: item.verification_name,
  role: item.role ?? "creator",
  bio: item.bio,
  about_studio: item.about_studio,
  tech_stack: item.tech_stack,
},
filmInfo: {
  project_title: item.project_title,
  conductor_studio: item.conductor_studio,
  film_tech_stack: item.film_tech_stack,
  ai_contribution_ratio: Number(item.ai_contribution_ratio) || 75,
  synopsis: item.synopsis,
  core_cast: item.core_cast,
  region: item.region,
  lbs_festival_royalty: Number(item.lbs_festival_royalty) || 5,
  contact_email: item.contact_email ?? item.email,
  poster_url: posterUrl,
  trailer_url: videoUrl,
},
```

**7) 進度條 `ItemProgress`**：`name` 字段使用 `item.verification_name`（不再回退到 email）：
```typescript
const initial: ItemProgress[] = items.map((item, i) => ({
  index: i,
  title: item.project_title,
  name: item.verification_name,   // ← 直接用姓名，不再 fallback 到 email
  steps: { createUser: "pending", uploadPoster: "pending", uploadVideo: "pending", createFilm: "pending" },
}));
```

### 指令 1.5：修復已有批片發行用戶的 display_name

在 Supabase SQL Editor 中執行以下 SQL，修復之前已創建但缺少 `display_name` 的批片用戶：

```sql
-- 修復批片發行用戶：將 name 同步到 display_name（如果 display_name 為空）
UPDATE public.users
SET display_name = name
WHERE id LIKE 'batch-%'
  AND display_name IS NULL
  AND name IS NOT NULL
  AND name != 'New Agent';

-- 驗證修復結果
SELECT id, name, display_name, email, verification_status
FROM public.users
WHERE id LIKE 'batch-%'
ORDER BY created_at DESC;
```

提交：`git add -A && git commit -m "feat: 批片發行重構 — 合併CSV模板為單表 + 修復display_name Bug"`

---

## 第二組：🔴 安全漏洞修復

### 指令 2.1：Admin API 缺少身份驗證 — 最嚴重

以下 Admin API **完全沒有身份驗證**，任何人都可以直接調用：

| API 路由 | 風險等級 | 問題 |
|---------|---------|------|
| `GET /api/admin/users` | 🔴 極高 | 返回所有用戶數據，無任何鑒權 |
| `GET /api/admin/user-profile` | 🔴 極高 | 可查詢任意用戶的完整資料 |
| `GET /api/admin/verifications` | 🔴 高 | 暴露身份認證申請記錄 |
| `POST /api/admin/verifications/review` | 🔴 極高 | 可通過/拒絕任何身份認證 |
| `GET/POST/PATCH/DELETE /api/admin/rbac` | 🔴 極高 | 可修改所有角色權限 |
| `GET/POST/PATCH /api/admin/products` | 🟠 高 | 可修改產品定價 |
| `GET /api/admin/messages/history` | 🟠 中 | 暴露消息歷史 |
| `POST /api/admin/fix-feed` | 🟠 中 | 可批量修改影片上架狀態 |
| `GET/POST /api/admin/batch-release` | 🟠 高 | 可批量創建用戶和影片 |
| `GET /api/admin/finance/ledger` | 🔴 高 | 暴露所有財務流水 |
| `GET /api/admin/treasury/stats` | 🔴 高 | 暴露錢包地址和餘額 |
| `POST /api/admin/treasury/sweep` | 🔴 極高 | 可觸發資金歸集操作 |
| `POST /api/admin/treasury/sweep-dust` | 🔴 極高 | 可觸發 SOL 回收操作 |
| `GET/POST /api/admin/treasury/config` | 🔴 極高 | 可查看/修改金庫配置 |

**修復方案**：創建一個統一的 Admin 鑒權工具函數。

在 `lib/` 下新建 `lib/admin-auth.ts`：

```typescript
import { PrivyClient } from '@privy-io/server-auth';

const privyClient = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!,
);

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/**
 * 驗證請求是否來自 Admin 用戶。
 * 流程：提取 Bearer token → Privy 驗證 → 查 userId 對應的 email → 比對白名單
 * 返回 { authorized: true, userId } 或 { authorized: false, error, status }
 */
export async function verifyAdmin(req: Request): Promise<
  | { authorized: true; userId: string }
  | { authorized: false; error: string; status: number }
> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { authorized: false, error: 'Missing Authorization header', status: 401 };
  }

  let userId: string;
  try {
    const claims = await privyClient.verifyAuthToken(authHeader.slice(7));
    userId = claims.userId;
  } catch {
    return { authorized: false, error: 'Invalid or expired auth token', status: 401 };
  }

  // 通過 Privy API 獲取用戶信息以驗證 email
  try {
    const privyUser = await privyClient.getUser(userId);
    const email = privyUser?.email?.address?.toLowerCase();
    if (!email || !ADMIN_EMAILS.includes(email)) {
      return { authorized: false, error: 'Insufficient permissions', status: 403 };
    }
  } catch {
    return { authorized: false, error: 'Failed to verify user identity', status: 500 };
  }

  return { authorized: true, userId };
}
```

然後在每個 Admin API 的 handler 頂部加入：
```typescript
import { verifyAdmin } from '@/lib/admin-auth';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const auth = await verifyAdmin(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  // ... 原有邏輯
}
```

需要修改的文件清單（所有 `app/api/admin/` 下的路由）：
- `app/api/admin/users/route.ts`
- `app/api/admin/user-profile/route.ts`
- `app/api/admin/verifications/route.ts`
- `app/api/admin/verifications/review/route.ts`
- `app/api/admin/rbac/route.ts`
- `app/api/admin/products/route.ts`
- `app/api/admin/messages/history/route.ts`
- `app/api/admin/fix-feed/route.ts`
- `app/api/admin/batch-release/route.ts`
- `app/api/admin/finance/ledger/route.ts`
- `app/api/admin/treasury/stats/route.ts`
- `app/api/admin/treasury/sweep/route.ts`
- `app/api/admin/treasury/sweep-dust/route.ts`
- `app/api/admin/treasury/config/route.ts` (POST 方法已有 OTP 驗證，但 GET 沒有)
- `app/api/admin/send-otp/route.ts` (已有白名單校驗，但要加 rate limit)

**注意**：前端 Admin 頁面也需要在調用這些 API 時攜帶 Privy token。在 Admin 前端頁面中，使用 Privy 的 `getAccessToken()` 獲取 token：

```typescript
import { usePrivy } from '@privy-io/react-auth';

// 在組件中
const { getAccessToken } = usePrivy();

// 在 fetch 調用中
const token = await getAccessToken();
const res = await fetch('/api/admin/xxx', {
  headers: { Authorization: `Bearer ${token}` },
});
```

提交：`git add -A && git commit -m "security: 為所有 Admin API 添加服務端身份驗證"`

### 指令 2.2：修復非 Admin API 的鑒權漏洞

以下用戶 API 也缺少身份驗證或存在越權風險：

**`/api/sync-user` — 無鑒權**：任何人可以偽造 user 對象調用此 API 插入或更新用戶記錄。

修復：在 `app/api/sync-user/route.ts` 頂部加入 Privy token 驗證。只允許已登錄用戶同步自己的數據：

```typescript
// 在 POST handler 開頭加入
const authHeader = req.headers.get('authorization');
if (!authHeader?.startsWith('Bearer ')) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
let verifiedUserId: string;
try {
  const privyClient = new PrivyClient(
    process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
    process.env.PRIVY_APP_SECRET!,
  );
  const claims = await privyClient.verifyAuthToken(authHeader.slice(7));
  verifiedUserId = claims.userId;
} catch {
  return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
}

// 確保只能同步自己的數據
if (user.id !== verifiedUserId) {
  return NextResponse.json({ error: 'Cannot sync other user data' }, { status: 403 });
}
```

**`/api/user-films` — 可查詢任意用戶的影片**：
通過 `?userId=xxx` 即可查到任何用戶的影片列表，無需登錄。

修復：要求 Bearer token，並且只允許查詢自己的影片（除非是 Admin）。

**`/api/messages` — GET 可查詢任意用戶消息**：
通過 `?userId=xxx` 可讀取任何人的消息。

修復：同上，加 Privy 驗證，只允許查詢自己的消息。

**`/api/lbs/screenings` — userId 來自客戶端**：
`POST` 和 `DELETE` 方法信任客戶端傳入的 `userId`，未做服務端驗證。

修復：從 Bearer token 中提取 userId，忽略客戶端傳入的值。

提交：`git add -A && git commit -m "security: 修復用戶 API 鑒權漏洞"`

### 指令 2.3：其他安全問題

**`batch_release_items.user_password` 明文存儲**：
數據庫中直接存儲密碼 `HKaiiff2026!@`。

修復方案：由於批片用戶使用 Privy 認證（非密碼登錄），此字段本就不應存在。
1. 從 `batch_release_items` 表中移除 `user_password` 字段（或設為 null）
2. 從前端的 `apiItems` 構造中移除 `user_password`
3. SQL: `ALTER TABLE public.batch_release_items DROP COLUMN IF EXISTS user_password;`

**`bodySizeLimit: '500mb'` DoS 風險**：
降低到合理值，視頻上傳應通過分片或直傳 R2/Bunny：
```typescript
experimental: {
  serverActions: {
    bodySizeLimit: '50mb',  // 降低到 50MB，大文件走客戶端直傳
  },
},
```

**`middleware.ts` Cookie 檢測可繞過**：
只檢查 Cookie 名稱是否存在，不驗證 token 有效性。可以通過手動設置一個名為 `privy-token` 值為任意字符串的 Cookie 繞過。

修復建議：這是 Middleware 的已知限制（Edge Runtime 下無法做完整 token 驗證）。確保每個 API route 和頁面組件都有獨立的 Privy 鑒權作為第二道防線即可，不需要改 middleware。

提交：`git add -A && git commit -m "security: 移除明文密碼字段 + 降低 bodySizeLimit"`

---

## 第三組：🟡 前端樣式一致性修復

### 指令 3.1：統一全局樣式變量

檢查並確保以下樣式在整個項目中保持一致：

**品牌藍色**：全局統一使用 `#1a73e8`（出現在 BatchReleaseTab、Admin 頁面等），不要出現其他藍色值作為主色。

**圓角**：
- 卡片容器：`rounded-2xl`（目前一致）
- 按鈕：`rounded-full`（目前一致）
- 輸入框：`rounded-xl`（需要檢查統一）

**字體大小層級**：
- 頁面標題：`text-lg font-bold` 或 `text-xl font-bold`
- 卡片標題：`text-sm font-semibold`
- 正文：`text-sm`
- 標籤/輔助文字：`text-xs`
- 微型標籤：`text-[10px]`

### 指令 3.2：Feed 頁面用戶名顯示修復

在 `app/components/FeedView.tsx`（或包含 Feed 卡片的組件）中，找到顯示用戶名的地方：

```typescript
<span className="...">{film.user_display_name ?? film.studio ?? "ANONYMOUS"}</span>
```

確認此處的 fallback 鏈正確。由於後端 `/api/feed` 已經返回 `user_display_name`（從 `users.display_name` 讀取），修復後端 `display_name` 後此處應能正確顯示。

但需要確保 fallback 順序：
```typescript
film.user_display_name ?? film.studio ?? "Unknown Creator"
```

### 指令 3.3：Creator 頁面自適應修復

在 `app/creator/[id]/page.tsx` 或相關組件中，確保：

1. **移動端適配**：確認使用了 `md:` 前綴做響應式斷點
2. **頭像大小**：移動端 `w-14 h-14`，桌面端 `md:w-16 md:h-16`（當前一致）
3. **文字截斷**：長用戶名使用 `truncate` 或 `line-clamp-1`

### 指令 3.4：/me 頁面 Profile 顯示名修復

在 `app/me/page.tsx` 中，profile 名稱顯示邏輯（約第4494行）：
```typescript
const nameValue = dbProfile?.display_name
  || (dbProfile?.name && dbProfile.name !== 'New Agent' ? dbProfile.name : '')
  || dbProfile?.agent_id
  || '';
```

這個 fallback 邏輯是正確的，但需要確認：
1. 當 `display_name` 為一個 email 地址時（老數據），應該顯示 `name` 作為 fallback
2. 在 profile 編輯模態框中，已認證用戶的名稱應標記為不可修改

找到 profile 編輯保存邏輯（約第4560行）：
```typescript
// 已認證或審核中時，嚴禁覆寫 display_name（後端由 verification_name 管理）
```

確認此邏輯正確工作，如果用戶的 `username_locked` 為 true，前端應禁用名稱輸入框。

### 指令 3.5：Admin 管理後台樣式統一

在 `app/admin/page.tsx` 中：

1. **側邊欄寬度**：確認 `w-56` 在所有分辨率下表現正常，移動端需要可收合
2. **內容區 padding**：統一使用 `p-6` 或 `p-8`
3. **表格樣式**：所有 Admin 子模塊的表格都應使用相同的 `TH`/`TD` 常量

特別檢查 `dist:official`（官方發行）頁面的表格列寬是否使用了硬編碼的 `gridTemplateColumns`：
```typescript
style={{ gridTemplateColumns: "1fr 1fr 80px 100px 110px" }}
```

這在窄屏下可能溢出，建議改為 `overflow-x-auto` 外包裹（當前已有），但列寬可以調整為更靈活的比例。

提交：`git add -A && git commit -m "style: 統一前端樣式和自適應修復"`

---

## 第四組：🟡 性能和代碼質量

### 指令 4.1：修復 `ignoreBuildErrors: true`

在 `next.config.ts` 中：
```typescript
typescript: {
  ignoreBuildErrors: true,  // ← 這會隱藏所有 TypeScript 錯誤
},
```

**不建議立即移除**（可能導致構建失敗），但應逐步修復類型錯誤：
1. 先在本地運行 `npx tsc --noEmit` 查看所有類型錯誤
2. 逐步修復後，最終移除此配置

### 指令 4.2：Supabase 客戶端創建方式統一

目前有多種創建方式：
- 模塊頂層 `const supabase = createClient(...)` — 大部分 API 使用
- 函數內 `function getAdminClient() { return createClient(...) }` — 部分 API 使用
- `import { supabase } from '@/lib/supabase'` — 部分前端頁面使用

建議統一為 `lib/supabase-admin.ts`：
```typescript
import { createClient } from '@supabase/supabase-js';

let _client: ReturnType<typeof createClient> | null = null;

export function getSupabaseAdmin() {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Missing Supabase env vars');
    _client = createClient(url, key, { auth: { persistSession: false } });
  }
  return _client;
}
```

### 指令 4.3：`batch_release_items` RLS 過於寬鬆

當前：
```sql
CREATE POLICY "batch_release_items: select all"
  ON public.batch_release_items FOR SELECT USING (true);
```

這允許任何人（包括使用 anon key 的前端）讀取所有批片發行項目。雖然 Admin 後台使用 service role key 繞過 RLS，但 anon key 也能讀到這些數據（包括 `user_email`、`user_password`）。

修復 SQL：
```sql
-- 先移除舊策略
DROP POLICY IF EXISTS "batch_release_items: select all" ON public.batch_release_items;
DROP POLICY IF EXISTS "batch_releases: select all" ON public.batch_releases;

-- 不添加任何 SELECT 策略 = 只有 service_role 可讀
-- 如果需要讓 Admin 前端用 anon key 讀取，改為基於角色的策略
```

提交：`git add -A && git commit -m "perf: 統一 Supabase 客戶端 + 收緊 RLS 策略"`

---

## 附錄：值得肯定的設計

1. **Privy 認證 + Service Role Key 分離**：用戶鑒權走 Privy，數據庫操作走 Service Role Key，架構清晰
2. **HD 錢包安全設計**：index 0 保留為 funding wallet、派生地址校驗、助記詞加密存儲
3. **Stripe Webhook 幂等性**：`stripe_events` 表的 `event_id` 去重機制
4. **消息系統軟刪除**：`deleted_at` 字段 + 查詢時 `is(deleted_at, null)`
5. **批量操作的進度追蹤**：`batch_releases` + `batch_release_items` 的狀態機設計
6. **Contact Email 隱私隔離**：明確排除在公共查詢之外
7. **Admin 回讀驗證**：`adminUpdateFilmStatus` 更新後回讀確認，防止靜默失敗
8. **Treasury Config 的雙重安全**：OTP + BIP39 校驗

---

## 執行優先級總結

| 優先級 | 任務 | 影響 |
|--------|------|------|
| P0 🔴 | Admin API 加鑒權（指令 2.1） | **所有 Admin 數據可被未授權訪問** |
| P0 🔴 | 修復 batch display_name Bug（指令 1.2, 1.5） | 前端用戶名顯示錯誤 |
| P0 🔴 | 移除明文密碼字段（指令 2.3） | 數據庫安全 |
| P1 🟠 | 合併批片發行 CSV 模板（指令 1.3, 1.4） | 運營效率 |
| P1 🟠 | 用戶 API 鑒權修復（指令 2.2） | 用戶數據越權訪問 |
| P2 🟡 | 前端樣式一致性（指令 3.x） | 用戶體驗 |
| P2 🟡 | RLS 策略收緊（指令 4.3） | 數據安全 |
| P3 🔵 | 代碼質量統一（指令 4.x） | 維護性 |
