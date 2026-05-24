/**
 * Next.js Middleware — 未登录时重定向到 /login
 * frontend/middleware.ts
 *
 * 注意：middleware 跑在 Edge Runtime，无法直接访问 zustand store（它在浏览器端）。
 * 改为读取 localStorage 中 zustand persist 写入的 thesis-auth Cookie（由客户端同步写入）。
 * 若 Cookie 不存在则重定向到 /login。
 */
import { NextRequest, NextResponse } from "next/server";

const PROTECTED = ["/", "/review", "/done"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 只保护需要登录的路径
  const needsAuth = PROTECTED.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  if (!needsAuth) return NextResponse.next();

  // 读取客户端同步过来的 auth cookie
  const authCookie = req.cookies.get("thesis-auth-token")?.value;
  if (!authCookie) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/review/:path*", "/done/:path*"],
};
