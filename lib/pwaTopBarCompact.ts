/**
 * 與節慶指南彈層（圖8）對齊的「抬高」頂欄路由：僅這些路徑在移動端使用
 * 1rem + safe-area；其餘路由維持原 3rem + safe-area 頂欄基線。
 */
export function isPwaTopBarCompactPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname === "/" ||
    pathname === "/me" ||
    pathname === "/discover" ||
    pathname === "/messages" ||
    pathname === "/upload" ||
    pathname === "/awards" ||
    pathname.startsWith("/creator/") ||
    pathname.startsWith("/user/")
  );
}
