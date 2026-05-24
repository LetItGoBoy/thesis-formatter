"use client";
/**
 * 全局挂载一次的透明组件：zustand 持久化恢复后，把 token 同步到 cookie，
 * 确保 Next.js middleware 可以读取认证状态（middleware 跑在 Edge，无法读 localStorage）。
 */
import { useEffect } from "react";
import { syncAuthCookie } from "@/lib/auth-store";

export function AuthSync() {
  useEffect(() => {
    syncAuthCookie();
  }, []);
  return null;
}
