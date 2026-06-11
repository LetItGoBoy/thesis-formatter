"use client";

/**
 * 霓虹栈城 · 城市地图（数据结构闯关入口）
 * app/quest/data-structure/page.tsx
 *
 * 去掉了原有声小说/答题模式，改为故事线驱动的闯关地图：
 * 按数据结构知识点顺序排布城区，逐个动手修复，重建「秩序协议」。
 */
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Lock,
  Play,
  Sparkles,
} from "lucide-react";
import { ALL_DISTRICTS, DS_CITY, type District } from "@/lib/ds-city";

export default function NeonStackCityPage() {
  const router = useRouter();

  const playableCount = ALL_DISTRICTS.filter((d) => d.status === "playable").length;
  const total = ALL_DISTRICTS.length;
  // 「秩序协议」恢复度：可玩城区算作已修复
  const progress = Math.round((playableCount / total) * 100);

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#eef1f8] text-slate-900 selection:bg-cyan-400/30">
      {/* 顶栏 */}
      <nav className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <button
            type="button"
            onClick={() => router.push("/course-spaces")}
            className="inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-slate-900"
          >
            <ArrowLeft size={16} />
            返回课程空间
          </button>
          <span className="font-mono text-xs tracking-[0.25em] text-cyan-600">
            {DS_CITY.codename}
          </span>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-slate-200">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(60%_80%_at_80%_15%,rgba(34,211,238,0.14),transparent_60%),radial-gradient(50%_60%_at_15%_90%,rgba(217,70,239,0.12),transparent_60%)]" />
          <div className="absolute inset-0 scanlines opacity-15" />
          <div className="animate-sweep bg-spectrum absolute inset-x-0 h-px opacity-40 blur-[1px]" />
        </div>
        <div className="relative mx-auto max-w-6xl px-5 py-16 md:py-20">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 font-mono text-[11px] tracking-[0.25em] text-cyan-600 backdrop-blur">
            <Cpu size={13} />
            DATA STRUCTURE · 闯关地图
          </div>
          <h1 className="mt-6 text-5xl font-black leading-[0.95] tracking-tight md:text-7xl">
            霓虹<span className="text-cyan-600">栈城</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600">
            {DS_CITY.arc}
          </p>

          {/* 秩序协议进度 */}
          <div className="mt-8 max-w-md">
            <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
              <span className="font-mono tracking-wider">秩序协议 · 恢复度</span>
              <span>
                {playableCount} / {total} 城区在线
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="bg-spectrum h-2 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="mt-8">
            <button
              type="button"
              onClick={() => router.push("/quest/data-structure/stack")}
              className="group inline-flex items-center gap-2 rounded-full bg-cyan-400 px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300"
            >
              <Play size={16} />
              从第一个城区开始
              <ArrowRight size={15} className="transition group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </section>

      {/* 城市地图：按章节（知识点大类）分组 */}
      <section className="mx-auto max-w-6xl px-5 py-14">
        <div className="space-y-14">
          {DS_CITY.chapters.map((chapter, ci) => (
            <div key={chapter.label} className="relative">
              {/* 章节标题 */}
              <div className="flex items-end gap-4">
                <span className="bg-spectrum bg-clip-text font-mono text-4xl font-black text-transparent opacity-90">
                  0{ci + 1}
                </span>
                <div>
                  <div className="font-mono text-[11px] tracking-[0.3em] text-cyan-600">
                    {chapter.label}
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
                    {chapter.title}
                  </h2>
                </div>
              </div>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">{chapter.theme}</p>

              {/* 该章城区 */}
              <div className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {chapter.districts.map((d) => (
                  <DistrictCard key={d.id} d={d} onEnter={() => router.push(`/quest/data-structure/${d.id}`)} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-12 text-center text-xs text-slate-400">
          每个城区都将是一个亲手操作的小游戏 · 按知识点顺序逐步开放
        </p>
      </section>
    </main>
  );
}

function DistrictCard({ d, onEnter }: { d: District; onEnter: () => void }) {
  const playable = d.status === "playable";
  const soon = d.status === "soon";

  return (
    <div
      className={`group relative overflow-hidden rounded-3xl border p-6 transition ${
        playable
          ? "cursor-pointer border-cyan-400/30 bg-white hover:-translate-y-1 hover:border-cyan-300/60"
          : "border-slate-200 bg-white opacity-80"
      }`}
      onClick={playable ? onEnter : undefined}
      style={
        playable
          ? {
              backgroundImage: `radial-gradient(70% 120% at 85% 10%, hsl(${d.hue} 85% 50% / 0.14), transparent 60%)`,
            }
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div
            className="font-mono text-[11px] tracking-[0.25em]"
            style={{ color: `hsl(${d.hue} 80% 65%)` }}
          >
            {d.code}
          </div>
          <h3 className="mt-1.5 text-xl font-bold text-slate-900">{d.name}</h3>
          <div className="mt-0.5 text-sm" style={{ color: `hsl(${d.hue} 70% 70%)` }}>
            · {d.structure}
          </div>
        </div>
        <StatusBadge status={d.status} />
      </div>

      <p className="mt-4 text-sm leading-6 text-slate-500">{d.hook}</p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {d.topics.map((t) => (
          <span
            key={t}
            className="rounded-md bg-slate-50 px-2 py-0.5 text-[11px] text-slate-500 ring-1 ring-slate-200"
          >
            {t}
          </span>
        ))}
      </div>

      <div className="mt-5">
        {playable ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-bold text-cyan-600">
            进入城区
            <ArrowRight size={15} className="transition group-hover:translate-x-0.5" />
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500">
            <Lock size={14} />
            {soon ? "即将开放" : "规划中"}
          </span>
        )}
      </div>

      {/* 底部主题色条 */}
      <div
        className="mt-5 h-0.5 w-full rounded-full opacity-70"
        style={{ background: `linear-gradient(90deg, transparent, hsl(${d.hue} 85% 55%), transparent)` }}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: District["status"] }) {
  if (status === "playable")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-cyan-400/15 px-2.5 py-1 text-[11px] font-semibold text-cyan-600 ring-1 ring-cyan-400/25">
        <Sparkles size={11} />
        可玩
      </span>
    );
  if (status === "soon")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200">
        即将开放
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200">
      规划中
    </span>
  );
}
