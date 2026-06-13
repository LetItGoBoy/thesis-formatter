"use client";

/**
 * 首页 · 导航门户（World Labs 风格）
 * frontend/app/page.tsx
 *
 * 极简：左侧站点主题大标题，右侧动态点阵球动画，整体居中、大量留白。
 * 首页只承担导航职能，不再展示个人信息。
 * 导航：关于 / 产品 / 课程 / 科研 / 登录注册。
 */
import { useRouter } from "next/navigation";
import { LogoMark } from "@/components/Logo";
import { HeroOrbit } from "@/components/HeroOrbit";
import { useAuthStore } from "@/lib/auth-store";

const BRAND = "同乐科技";

// 导航项（href 为路由；# 表示规划中、暂未接入页面）
const NAV = [
  { label: "关于", href: "#" },
  { label: "产品", href: "/thesis" },
  { label: "课程", href: "/course-spaces" },
  { label: "科研", href: "#" },
];

export default function HomePage() {
  const router = useRouter();
  const { token } = useAuthStore();

  function go(href: string) {
    if (href === "#") return;
    router.push(href);
  }

  return (
    <main className="relative flex min-h-screen flex-col bg-[#f4f1ea] text-stone-900 selection:bg-stone-900/10">
      {/* ================= 顶栏 ================= */}
      <nav className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 md:px-10">
          <button onClick={() => router.push("/")} className="flex items-center gap-2.5">
            <LogoMark size={28} />
            <span className="font-display text-xl tracking-tight">{BRAND}</span>
          </button>
          <div className="flex items-center gap-1.5 text-sm">
            {NAV.map((n) => (
              <button
                key={n.label}
                onClick={() => go(n.href)}
                className="hidden rounded-full px-4 py-2 text-stone-600 transition hover:text-stone-900 sm:inline-flex"
              >
                {n.label}
              </button>
            ))}
            <button
              onClick={() => router.push(token ? "/dashboard" : "/login")}
              className="ml-2 rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-[#f4f1ea] transition hover:bg-stone-700"
            >
              {token ? "工作台" : "登录 / 注册"}
            </button>
          </div>
        </div>
      </nav>

      {/* ================= 主区：左文字 · 右动画 ================= */}
      <section className="flex flex-1 items-center px-6 md:px-10">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-12 py-28 lg:grid-cols-2 lg:gap-8">
          {/* 左：站点主题 */}
          <div className="order-2 lg:order-1">
            <h1 className="font-display text-6xl leading-[0.98] tracking-tight text-stone-900 md:text-7xl">
              {BRAND}
            </h1>
            <p className="font-display mt-1 text-4xl leading-tight tracking-tight text-stone-400 md:text-5xl">
              把知识做成可以亲手玩的东西
            </p>
            <p className="mt-7 max-w-md text-[15px] leading-7 text-stone-500">
              一站式教学与研究平台——论文助手、沉浸式课程游戏、与高光谱 AI 研究。
              让抽象的概念，变成可以上手操作的体验。
            </p>
          </div>

          {/* 右：动态点阵球 */}
          <div className="order-1 lg:order-2">
            <HeroOrbit className="mx-auto block aspect-square w-full max-w-[560px] cursor-crosshair" />
          </div>
        </div>
      </section>
    </main>
  );
}
