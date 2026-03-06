import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * 受保護的路由前綴列表。
 * 任何以這些路徑開頭的請求，在未持有 Privy auth token 的情況下將被重定向到首頁。
 */
const PROTECTED_PREFIXES = [
  "/upload",
  "/me",
  "/admin",
  "/messages",
  "/creator/edit",
];

/**
 * Privy 在瀏覽器端會將 auth token 存儲在 Cookie 中。
 * 不同版本/平台可能使用不同的 Cookie 名稱，此處多重檢測確保覆蓋所有情況。
 *
 * 這是第一道防線（路由層硬攔截），防止未登錄用戶直接在地址欄輸入受保護 URL。
 * 各頁面組件內的 usePrivy() 鑒權是第二道防線。
 */
function hasPrivyToken(request: NextRequest): boolean {
  return !!(
    request.cookies.get("privy-token")?.value ||
    request.cookies.get("privy:token")?.value ||
    request.cookies.get("privy-id-token")?.value
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  if (hasPrivyToken(request)) {
    return NextResponse.next();
  }

  // 未登錄：重定向到首頁，並附帶查詢參數以便首頁觸發登錄提示
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = "/";
  redirectUrl.searchParams.set("authRequired", "1");
  return NextResponse.redirect(redirectUrl);
}

/**
 * matcher 中 /:path* 已覆蓋精確路徑（零個或多個後綴段），
 * 排除靜態資源、_next 內部路由和 API 路由。
 */
export const config = {
  matcher: [
    "/upload/:path*",
    "/me/:path*",
    "/admin/:path*",
    "/messages/:path*",
    "/creator/edit/:path*",
  ],
};
