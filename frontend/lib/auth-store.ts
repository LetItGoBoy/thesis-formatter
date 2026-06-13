/**
 * 认证状态（持久化到 localStorage）
 * frontend/lib/auth-store.ts
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

// Cookie 辅助（仅浏览器端执行）—— middleware 读该 cookie 做服务端重定向
const COOKIE_NAME = "thesis-auth-token";
function _setCookie(value: string, days = 7) {
  if (typeof document === "undefined") return;
  const exp = new Date(Date.now() + days * 86400000).toUTCString();
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(value)}; expires=${exp}; path=/; SameSite=Lax`;
}
function _deleteCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

interface AuthState {
  token: string | null;
  phone: string | null;
  nickname: string | null;
  isAdmin: boolean;
  setAuth: (token: string, phone: string, opts?: { nickname?: string; isAdmin?: boolean }) => void;
  setNickname: (nickname: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      phone: null,
      nickname: null,
      isAdmin: false,
      setAuth: (token, phone, opts) => {
        _setCookie(token);
        set({ token, phone, nickname: opts?.nickname ?? null, isAdmin: !!opts?.isAdmin });
      },
      setNickname: (nickname) => set({ nickname }),
      logout: () => {
        _deleteCookie();
        set({ token: null, phone: null, nickname: null, isAdmin: false });
      },
    }),
    { name: "thesis-auth" }
  )
);

/** 在 React 组件外（如 api.ts）读取当前 token */
export function getToken(): string | null {
  return useAuthStore.getState().token;
}

/**
 * 页面加载后调用（useEffect），把 localStorage 里恢复的 token 同步到 cookie，
 * 确保 Next.js middleware 能正确读到认证状态。
 */
export function syncAuthCookie(): void {
  const token = useAuthStore.getState().token;
  if (token) _setCookie(token);
}

/** 格式化手机号显示：138****5678 */
export function maskPhone(phone: string): string {
  if (phone.length !== 11) return phone;
  return `${phone.slice(0, 3)}****${phone.slice(7)}`;
}
