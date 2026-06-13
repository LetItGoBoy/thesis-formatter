"use client";

/**
 * 站点统一顶栏（首页之外的二级页面用）
 * components/SiteNav.tsx
 *
 * 白底中性灰条 + 衬线品牌 + 关于/产品/课程/科研 + 登录。
 * 通过 active 高亮当前栏目。
 */
import { useRouter } from "next/navigation";
import { LogoMark } from "@/components/Logo";
import { useAuthStore } from "@/lib/auth-store";

const ITEMS = [
  { key: "about", label: "关于", href: "#" },
  { key: "products", label: "产品", href: "/products" },
  { key: "courses", label: "课程", href: "/course-spaces" },
  { key: "research", label: "科研", href: "#" },
] as const;

export function SiteNav({ active }: { active?: "about" | "products" | "courses" | "research" }) {
  const router = useRouter();
  const { token } = useAuthStore();
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
          <button
            onClick={() => router.push(token ? "/dashboard" : "/login")}
            className="ml-2 rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-stone-700"
          >
            {token ? "工作台" : "登录 / 注册"}
          </button>
        </div>
      </div>
    </nav>
  );
}
