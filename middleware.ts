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
 * 注意：這是一道路由層硬攔截，防止直接輸入 URL 訪問受保護頁面。
 * 頁面組件本身也應有自己的 client-side 鑒權邏輯（如 usePrivy）作為第二道防線。
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
    // 精確匹配無尾斜線的路徑
    "/upload",
    "/me",
    "/admin",
    "/messages",
    "/creator/edit",
  ],
};
