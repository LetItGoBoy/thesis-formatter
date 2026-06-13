"use client";

/**
 * 站点统一顶栏（首页之外的二级页面用）
 * components/SiteNav.tsx
 *
 * 白底中性灰条 + 衬线品牌 + 关于/产品/课程/科研 + 登录。
 * 通过 active 高亮当前栏目。
 */
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { useAuthStore } from "@/lib/auth-store";

const ITEMS = [
  { key: "about", label: "关于", href: "/about" },
  { key: "products", label: "产品", href: "/products" },
  { key: "courses", label: "课程", href: "/course-spaces" },
  { key: "research", label: "科研", href: "#" },
] as const;

export function SiteNav({ active }: { active?: "about" | "products" | "courses" | "research" }) {
  const router = useRouter();
  const { token, nickname, logout } = useAuthStore();

  function doLogout() {
    logout();
    router.push("/");
  }

  return (
    <nav className="sticky top-0 z-30 border-b border-stone-200 bg-stone-100/90 shadow-sm backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5 md:px-10">
        <button onClick={() => router.push("/")} className="flex items-center gap-2.5">
          <LogoMark size={28} />
          <span className="font-display text-xl tracking-tight text-stone-900">同乐科技</span>
        </button>
        <div className="flex items-center gap-1.5 text-sm">
          {ITEMS.map((it) => (
            <button
              key={it.key}
              onClick={() => it.href !== "#" && router.push(it.href)}
              className={`hidden rounded-full px-4 py-2 transition sm:inline-flex ${
                active === it.key
                  ? "font-medium text-stone-900"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              {it.label}
            </button>
          ))}
          {token ? (
            <div className="ml-2 flex items-center gap-1.5">
              <button
                onClick={() => router.push("/dashboard")}
                className="rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-stone-700"
              >
                {nickname || "工作台"}
              </button>
              <button
                onClick={doLogout}
                title="退出登录 / 切换账户"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-stone-300 text-stone-500 transition hover:border-red-300 hover:text-red-500"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => router.push("/login")}
              className="ml-2 rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-stone-700"
            >
              登录 / 注册
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
