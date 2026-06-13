"use client";

/**
 * 课程空间 · Medium 博客式布局
 * frontend/app/course-spaces/page.tsx
 *
 * 左：课程列表（每门课 = 一个沉浸式闯关游戏，可独立进入）。
 * 右：课程空间信息卡 + 空间功能清单。
 * 风格与产品页统一：白底、衬线大标题、中性灰导航、发丝分隔线。
 */
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Database,
  Boxes,
  FolderOpen,
  PlayCircle,
  Code2,
  Sparkles,
} from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { SiteNav } from "@/components/SiteNav";

const COURSES = [
  {
    icon: Boxes,
    tag: "可玩 · 8 城区",
    title: "数据结构 · 霓虹栈城",
    en: "Neon Stack City",
    desc: "一座由数据结构驱动的失控城市：货运塔（栈）、环线地铁（队列）、管道区（链表）、档案塔（BST）、倾斜高塔（AVL）、中央邮局（哈希）、城市电网（图）、分拣厂（排序）。每个城区都亲手操作，把抽象概念玩进手感里。",
    href: "/quest/data-structure",
    hue: 265,
  },
  {
    icon: Database,
    tag: "可玩 · 8 案",
    title: "数据库原理 · 雾港档案",
    en: "Foggy Harbor Files",
    desc: "在浏览器里写真实 SQL 逐步破案：从 WHERE、JOIN、GROUP BY 到子查询与窗口函数，八桩命案层层递进，边推理边掌握数据库查询。",
    href: "/quest/database",
    hue: 175,
  },
];

const FEATURES = [
  { icon: FolderOpen, title: "课程资料", desc: "课件、重点笔记、实验要求与复习提纲。" },
  { icon: PlayCircle, title: "推荐视频", desc: "按章节筛选适合补基础的视频资源。" },
  { icon: Code2, title: "练习与代码", desc: "配套题目、示例代码与常见错误提醒。" },
];

export default function CourseSpacesPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-white text-stone-900 selection:bg-indigo-500/10">
      <SiteNav active="courses" />

      <div className="mx-auto max-w-6xl px-6 py-12 md:px-10 md:py-16">
        <div className="grid gap-12 lg:grid-cols-[1fr_300px] lg:gap-16">
          {/* 左：课程列表 */}
          <div className="min-w-0">
            <h1 className="font-display text-5xl tracking-tight text-stone-900 md:text-6xl">
              课程空间
            </h1>
            <div className="mt-7 flex items-center gap-6 border-b border-stone-200 text-sm">
              <span className="-mb-px border-b-2 border-stone-900 pb-3 font-medium text-stone-900">
                全部课程
              </span>
              <span className="pb-3 text-stone-400">边玩边学 · 均可独立进入</span>
            </div>

            <div className="divide-y divide-stone-200">
              {COURSES.map((c) => {
                const Icon = c.icon;
                return (
                  <article
                    key={c.title}
                    onClick={() => router.push(c.href)}
                    className="group flex cursor-pointer items-start gap-6 py-8"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-[13px] text-stone-500">
                        <span
                          className="inline-flex size-5 items-center justify-center rounded-full text-white"
                          style={{ background: `hsl(${c.hue} 60% 48%)` }}
                        >
                          <LogoMark size={12} />
                        </span>
                        <span className="font-medium text-stone-700">同乐科技</span>
                        <span>·</span>
                        <span>{c.tag}</span>
                      </div>
                      <h2 className="mt-3 text-xl font-bold leading-snug tracking-tight text-stone-900 md:text-2xl">
                        {c.title}
                      </h2>
                      <p className="mt-2 text-[15px] leading-7 text-stone-600">{c.desc}</p>
                      <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-stone-900 opacity-0 transition group-hover:opacity-100">
                        进入课程
                        <ArrowUpRight size={15} />
                      </div>
                    </div>
                    <div
                      className="grid size-24 shrink-0 place-items-center rounded-xl md:size-28"
                      style={{
                        background: `linear-gradient(150deg, hsl(${c.hue} 70% 92%), hsl(${c.hue} 65% 82%))`,
                      }}
                    >
                      <Icon size={34} style={{ color: `hsl(${c.hue} 55% 36%)` }} />
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          {/* 右：课程空间信息卡 */}
          <aside className="lg:border-l lg:border-stone-200 lg:pl-12">
            <div className="lg:sticky lg:top-28">
              <div className="grid size-20 place-items-center rounded-full bg-gradient-to-br from-emerald-100 to-cyan-100 ring-1 ring-stone-200">
                <LogoMark size={36} />
              </div>
              <h3 className="mt-5 text-lg font-bold tracking-tight text-stone-900">课程空间</h3>
              <p className="mt-1 text-sm text-stone-500">2 门课程 · 沉浸式闯关</p>
              <p className="mt-4 text-sm leading-7 text-stone-600">
                把枯燥的课程做成能亲手玩的闯关游戏——在故事与操作中理解概念、记住原理。
                课件、视频与练习也在这里逐步沉淀。
              </p>

              <div className="mt-6">
                <button
                  onClick={() => router.push("/curriculum")}
                  className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-stone-700"
                >
                  <Sparkles size={15} />
                  培养方案 · 课程地图
                </button>
              </div>

              <div className="mt-8 border-t border-stone-200 pt-6">
                <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-stone-400">
                  空间功能
                </div>
                <ul className="mt-4 space-y-4">
                  {FEATURES.map((f) => {
                    const Icon = f.icon;
                    return (
                      <li key={f.title} className="flex gap-3">
                        <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-stone-50 text-stone-600">
                          <Icon size={16} />
                        </span>
                        <div>
                          <div className="text-sm font-medium text-stone-800">{f.title}</div>
                          <div className="mt-0.5 text-[13px] leading-5 text-stone-500">{f.desc}</div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
