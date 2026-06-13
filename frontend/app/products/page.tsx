"use client";

/**
 * 产品页 · Medium 博客式布局
 * frontend/app/products/page.tsx
 *
 * 左：产品列表（论文助手的三个可独立使用的产品）。
 * 右：机构信息卡（同乐科技）+ B 站链接 + 关注。
 * 风格与首页统一：白底、衬线大标题、中性灰导航、发丝分隔线。
 */
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  ClipboardCheck,
  FileText,
  Sparkles,
  Tv,
  Plus,
} from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { SiteNav } from "@/components/SiteNav";

const BRAND = "同乐科技";
const BILIBILI = "https://space.bilibili.com"; // ← 换成你的 B 站主页

const PRODUCTS = [
  {
    icon: ClipboardCheck,
    tag: "原型",
    title: "提交前体检",
    en: "Pre-submit Checkup",
    desc: "上传论文先做一次全面体检：自动识别章节结构、摘要、关键词与规范风险，给出修改优先级清单，避免临交稿前反复返工。",
    href: "/checkup",
    hue: 210,
  },
  {
    icon: Sparkles,
    tag: "已开放",
    title: "AI 表达优化",
    en: "Writing Polish",
    desc: "像在线文档一样，选中任意段落即可做学术润色、压缩、扩写与逻辑梳理，逐句对照确认后再落笔，语言更严谨流畅。",
    href: "/polish",
    hue: 280,
  },
  {
    icon: FileText,
    tag: "已开放",
    title: "格式对齐",
    en: "Format Aligner",
    desc: "按校本规范一键统一版式、目录、段落、中英混排、三线表与分页，自动取消文档网格，导出可直接提交的标准 Word。",
    href: "/tools",
    hue: 160,
  },
];

export default function ProductsPage() {
  const router = useRouter();

  function go(href: string) {
    if (href !== "#") router.push(href);
  }

  return (
    <main className="min-h-screen bg-white text-stone-900 selection:bg-indigo-500/10">
      <SiteNav active="products" />

      {/* ================= 主体：左列表 · 右机构卡 ================= */}
      <div className="mx-auto max-w-6xl px-6 py-12 md:px-10 md:py-16">
        <div className="grid gap-12 lg:grid-cols-[1fr_300px] lg:gap-16">
          {/* 左：产品列表 */}
          <div className="min-w-0">
            <h1 className="font-display text-5xl tracking-tight text-stone-900 md:text-6xl">
              论文助手
            </h1>
            <div className="mt-7 flex items-center gap-6 border-b border-stone-200 text-sm">
              <span className="-mb-px border-b-2 border-stone-900 pb-3 font-medium text-stone-900">
                全部产品
              </span>
              <span className="pb-3 text-stone-400">三款 · 均可独立使用</span>
            </div>

            <div className="divide-y divide-stone-200">
              {PRODUCTS.map((p) => {
                const Icon = p.icon;
                return (
                  <article
                    key={p.title}
                    onClick={() => go(p.href)}
                    className="group flex cursor-pointer items-start gap-6 py-8"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-[13px] text-stone-500">
                        <span
                          className="inline-flex size-5 items-center justify-center rounded-full text-white"
                          style={{ background: `hsl(${p.hue} 60% 50%)` }}
                        >
                          <LogoMark size={12} />
                        </span>
                        <span className="font-medium text-stone-700">{BRAND}</span>
                        <span>·</span>
                        <span>{p.tag}</span>
                      </div>
                      <h2 className="mt-3 text-xl font-bold leading-snug tracking-tight text-stone-900 md:text-2xl">
                        {p.title}
                      </h2>
                      <p className="mt-2 line-clamp-2 text-[15px] leading-7 text-stone-500">
                        {p.desc}
                      </p>
                      <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-stone-900 opacity-0 transition group-hover:opacity-100">
                        进入产品
                        <ArrowUpRight size={15} />
                      </div>
                    </div>
                    {/* 缩略图：渐变块 + 图标 */}
                    <div
                      className="grid size-24 shrink-0 place-items-center rounded-xl md:size-28"
                      style={{
                        background: `linear-gradient(150deg, hsl(${p.hue} 70% 92%), hsl(${p.hue} 65% 82%))`,
                      }}
                    >
                      <Icon size={34} style={{ color: `hsl(${p.hue} 55% 38%)` }} />
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          {/* 右：机构信息卡 */}
          <aside className="lg:border-l lg:border-stone-200 lg:pl-12">
            <div className="lg:sticky lg:top-28">
              <div className="grid size-20 place-items-center rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 ring-1 ring-stone-200">
                <LogoMark size={36} />
              </div>
              <h3 className="mt-5 text-lg font-bold tracking-tight text-stone-900">{BRAND}</h3>
              <p className="mt-1 text-sm text-stone-500">3 款产品 · 高校学生在用</p>
              <p className="mt-4 text-sm leading-7 text-stone-600">
                同乐科技的使命：用 AI 把论文写作中繁琐的体检、润色与格式工作自动化，
                让学生把时间花在真正重要的研究与表达上。
              </p>

              <div className="mt-6 flex flex-wrap gap-2.5">
                <a
                  href={BILIBILI}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-[#fb7299] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#fb6391]"
                >
                  <Tv size={16} />
                  B 站主页
                </a>
                <button
                  onClick={() => router.push("/login")}
                  className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 px-5 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-900/[0.04]"
                >
                  <Plus size={15} />
                  关注
                </button>
              </div>

              <div className="mt-8 border-t border-stone-200 pt-6">
                <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-stone-400">
                  Links
                </div>
                <ul className="mt-3 space-y-2 text-sm">
                  <li>
                    <button onClick={() => router.push("/course-spaces")} className="text-stone-600 transition hover:text-stone-900">
                      课程空间 →
                    </button>
                  </li>
                  <li>
                    <button onClick={() => router.push("/")} className="text-stone-600 transition hover:text-stone-900">
                      返回首页 →
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
