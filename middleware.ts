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
 * Privy 在瀏覽器端會將 auth token 存儲在名為 `privy-token` 的 Cookie 中。
 * 中間件通過檢查此 Cookie 是否存在來判斷用戶是否已登錄。
 *
 * 這是第一道防線（路由層硬攔截），防止未登錄用戶直接在地址欄輸入受保護 URL。
 * 各頁面組件內的 usePrivy() 鑒權是第二道防線。
 */
function hasPrivyToken(request: NextRequest): boolean {
  const token =
    request.cookies.get("privy-token")?.value ||
    request.cookies.get("privy:token")?.value;
  return !!token;
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

export const config = {
  matcher: [
    "/upload/:path*",
    "/me/:path*",
    "/admin/:path*",
    "/messages/:path*",
    "/creator/edit/:path*",
    "/upload",
    "/me",
    "/admin",
    "/messages",
    "/creator/edit",
  ],
};
