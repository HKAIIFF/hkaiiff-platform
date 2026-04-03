# 移動端與 PWA 改動歸檔（開發備案與指引）

本文檔歸檔截至倉庫當前主線（參考提交如 `6192d69`、`3ad805e`、`04c469d` 等）與**手機瀏覽器 + PWA** 相關的佈局約定，供後續迭代對齊，避免重複踩坑。

---

## 1. 設計目標（摘要）

- **統一斷點**：寬度 **`< 768px`（`max-width: 767px`）** 視為移動端；樣式以 **手機 Safari 與 PWA 獨立安裝** 行為一致為目標，**不再**僅依 `display-mode: standalone` 分支。
- **頂部**：預留 **`MobileTopBar`（含 safe-area-inset-top）** 的垂直空間；全屏模態、創作者頁頂部控件與其對齊。
- **底部**：固定底欄 + **safe-area-inset-bottom**；主內容使用統一的底部留白類，避免內容被遮擋。
- **桌面**：`md:` 及以上維持原有側欄 + 頂欄佈局；**訊息頁等部分功能僅在移動端疊加 Banner / Footer**，桌面保持簡潔（見第 4 節）。

---

## 2. 全域殼層（必讀）

| 組件 | 路徑 | 職責 |
|------|------|------|
| `ConditionalNav` | `app/components/ConditionalNav.tsx` | 桌面：`DesktopNavbar` + `Sidebar`；移動：`MobileTopBar` + `main` + `BottomNav` + `GlobalModals` |
| `MobileTopBar` | `app/components/MobileTopBar.tsx` | `md:hidden`，`fixed top-0`，`z-30`，`mobile-top-bar-root` 控制頂部內邊距；右側小地球打開語言模態 |
| `BottomNav` | （同目錄） | 固定底欄，配合 `globals.css` 中 `.mobile-bottom-nav-root` |
| `GlobalModals` | `app/components/GlobalModals.tsx` | 全屏 INFO、Creator 模態等；頂欄使用 `.info-modal-top-bar` 與頂欄基線對齊 |

**隱藏頂欄的路由**：`ConditionalNav` 內 `HIDE_MOBILE_TOPBAR_PATHS`（如 LBS 申請）避免與頁內導航重疊。

---

## 3. `globals.css` 約定類（速查表）

以下類名在 **`@media (max-width: 767px)`** 內會疊加 **safe-area**；桌面預設多為固定 `3rem` / `4rem`，與 Tailwind 語意並存。

| 類名 | 用途 |
|------|------|
| `.mobile-top-bar-root` | `MobileTopBar` 根節點 `padding-top`：`3rem + safe-top`（移動） |
| `.mobile-top-bar-root--awards` | 獎項頁：與頁內返回鈕 `1rem + safe-top` 基線一致 |
| `.pb-bottom-nav-safe` | 主內容底部留白，使用 `--pb-bottom-nav-total`（含額外間距與底欄） |
| `.pwa-mobile-content-pt` | 有頂欄時主內容頂部留白（Feed/Discover/Messages 等） |
| `.pwa-me-main-scroll-pt` | `/me` 移動端滾動區頂部留白 |
| `.pwa-clear-globe-r` | 避免內容與右側小地球重疊（如 Messages 頂部區塊） |
| `.creator-pwa-header-y` | 創作者/用戶頁 banner 內**或 fixed 返回鈕**的 `top`，與頂欄對齊 |
| `.info-modal-top-bar` | `GlobalModals` 內 INFO / Creator 模態頂欄的 `padding-top`，與 `.mobile-top-bar-root` 一致 |
| `.awards-mobile-back-top` / `.awards-mobile-hero-spacer` | 獎項頁移動端英雄區與返回鈕間距 |

**CSS 變量**：`:root` 中 `--pb-nav-stack`、`--pb-bottom-nav-total`；移動端在媒體查詢內會覆寫 `--pb-bottom-nav-total`。

---

## 4. 頁面級決策

### 4.1 訊息頁 `app/messages/page.tsx`

- **移動端**：電影節相關全屏 / Banner 與獎項入口等置於 **`block md:hidden`** 區域；**不在**列表下方堆 Logo 牆與版權長 footer（已遷出）。
- **桌面**：維持原 `DesktopMessagesView`，**不**強制與移動端同一套 Banner/Footer。
- **底部版權與 Logo 牆**：抽成 **`components/AssociationCopyrightFooter.tsx`**（`DynamicLogoWall` + 協會/版權），掛在**電影節全屏模態底部**等位置；**獎項頁**底部亦使用該組件。
- **移動端**：已移除 **ALL READ**（若桌面仍保留，以當前代碼為準）。
- 佈局類：`pwa-mobile-content-pt`、`pb-bottom-nav-safe`、`pwa-clear-globe-r` 等與頂欄/地球對齊。

### 4.2 獎項頁 `app/awards/page.tsx`

- 頁底 **`AssociationCopyrightFooter`**，`pb-bottom-nav-safe md:pb-24`。
- 頂欄對齊：`MobileTopBar` 使用 **`mobile-top-bar-root--awards`**（在 `MobileTopBar.tsx` 依 `pathname === "/awards"` 切換）。

### 4.3 Discover `app/discover/page.tsx`

- **已移除**「NODES ACTIVE」類區塊（移動與桌面一致不再展示）。
- 使用 `pwa-mobile-content-pt`、`pb-bottom-nav-safe`。

### 4.4 Feed / 首頁 `app/page.tsx`

- 相關層使用 `pb-bottom-nav-safe` 等與底欄協調。

### 4.5 `/me` `app/me/page.tsx`

- 移動端滾動頂部：`pwa-me-main-scroll-pt`、`pb-bottom-nav-safe md:pb-0`。

---

## 5. 創作者與用戶詳情頁

| 路由 | 文件 | 說明 |
|------|------|------|
| `/creator/[userId]` | `app/creator/[userId]/page.tsx` | 桌面端頭像區返回鈕 **`md:absolute`** 在 banner 內；**移動端 `fixed`** + `creator-pwa-header-y`，捲動時不隨內容移出視窗；`z-40`（移動）避免被內容蓋住 |
| `/user/[id]` | `app/user/[id]/page.tsx` | Feed 頭像等多數連至此；與上者同一套 **fixed / `creator-pwa-header-y`**；標題膠囊使用 **`creator-pwa-header-y`** 對齊垂直基線；`pb-bottom-nav-safe` |

**注意**：`MobileTopBar` 為 `z-30`，頁內 fixed 返回鈕為 **`z-40`**，僅在左側與頂欄錯開，不遮擋右側地球。

---

## 6. `GlobalModals` 全屏層

### 6.1 INFO 模態（影片詳情）

- 頂欄容器類：**`info-modal-top-bar`**（取代單純 `pt-12`），使 **PWA 與手機瀏覽器** 與 `MobileTopBar` 的 **`3rem + safe-top`** 一致。
- 結構：頂欄 **`absolute`** 在 `fixed` 全屏根上；下方 **`overflow-y-auto flex-1`**，頂欄不隨內容捲動。

### 6.2 Creator Profile 模態

- 同樣 **`info-modal-top-bar`**。
- 外層**不再** `overflow-y-auto`；捲動僅在內層 **`overflow-y-auto flex-1 min-h-0`**，避免頂欄被捲走。

### 6.3 與小地球的關係

- 全屏模態 **`z-[200]`**，會蓋住 `MobileTopBar`（`z-30`）。模態內右側若為分享鈕，與 Feed 頁「地球打開語言」是不同場景；若產品要求模態內也要語言入口，需單獨產品與交互設計。

---

## 7. Z-index 參考（避免亂加層級）

| 大致範圍 | 用途 |
|----------|------|
| `z-30` | `MobileTopBar` |
| `z-40` | 創作者/用戶頁移動端 fixed 返回 |
| `z-[200]` 等 | `GlobalModals` 全屏模態 |
| `z-[1000]`+ | 語言等疊加模態（以 `GlobalModals` 內為準） |
| `z-[12000]` 等 | 訊息詳情 overlay（若存在，以 `messages/page.tsx` 為準） |
| `10000` | `.mobile-bottom-nav-root`（底欄） |

---

## 8. 後續開發指引

1. **新增移動端全屏頁或模態頂欄**：優先複用 **`.info-modal-top-bar`** 或與 **`.mobile-top-bar-root`** 同一公式，避免在 TSX 寫死 `pt-12` 而忽略劉海。
2. **新增需頂部按鈕的頁面**：與 **`creator-pwa-header-y`** 對齊；若按鈕需 fixed，使用 **`md:absolute`** 切回桌面 banner 內佈局。
3. **主內容區**：有底欄時使用 **`pb-bottom-nav-safe`**（或與設計約定一致的變量）。
4. **僅影響移動端的營銷區塊**：用 **`md:hidden` / `hidden md:block`** 與桌面隔離，避免再次污染桌面 MSG。
5. **修改 `globals.css` 媒體查詢**：同步檢查 **`MobileTopBar`**、**創作者頁**、**GlobalModals 頂欄** 是否仍對齊。

---

## 9. 相關文件清單（維護時優先打開）

- `app/globals.css` — 全域類與 safe-area
- `app/components/ConditionalNav.tsx`
- `app/components/MobileTopBar.tsx`
- `app/components/GlobalModals.tsx`
- `app/creator/[userId]/page.tsx`、`app/user/[id]/page.tsx`
- `app/messages/page.tsx`、`app/awards/page.tsx`、`app/discover/page.tsx`
- `components/AssociationCopyrightFooter.tsx`

---

*文檔隨架構演進應更新；重大 UI 契約變更請同步修改本檔並在 PR 說明中引用。*
