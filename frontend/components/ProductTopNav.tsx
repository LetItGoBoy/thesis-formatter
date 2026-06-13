"use client";

/**
 * 产品内页统一顶栏（与首页 / 产品页风格一致）
 * components/ProductTopNav.tsx
 *
 * 白底中性灰导航条 + 衬线品牌名 + 三个产品切换 + 返回产品。
 */
import { useRouter } from "next/navigation";
import { LogoMark } from "@/components/Logo";

const ITEMS = [
  { key: "checkup", label: "提交前体检", href: "/checkup" },
  { key: "polish", label: "AI 表达优化", href: "/polish" },
  { key: "tools", label: "格式对齐", href: "/tools" },
] as const;

export function ProductTopNav({ current }: { current?: "checkup" | "polish" | "tools" }) {
  const router = useRouter();
  return (
    <nav className="sticky top-0 z-30 border-b border-stone-200 bg-stone-100/90 shadow-sm backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 md:px-10">
        <button onClick={() => router.push("/products")} className="flex items-center gap-2.5">
          <LogoMark size={26} />
          <span className="font-display text-lg tracking-tight text-stone-900">同乐科技</span>
        </button>
        <div className="flex items-center gap-1 text-sm">
          {ITEMS.map((it) => (
            <button
              key={it.key}
              onClick={() => router.push(it.href)}
              className={`hidden rounded-full px-3.5 py-2 transition sm:inline-flex ${
                current === it.key
                  ? "font-medium text-stone-900"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              {it.label}
            </button>
          ))}
          <button
            onClick={() => router.push("/products")}
            className="ml-2 rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-900/[0.04]"
          >
            ← 产品
          </button>
        </div>
      </div>
    </nav>
  );
}
