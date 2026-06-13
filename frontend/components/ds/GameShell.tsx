"use client";

/**
 * 霓虹栈城 · 城区小游戏共享外壳
 * components/ds/GameShell.tsx
 *
 * 统一的城区游戏框架：顶栏 / 上岗简报（故事→定义）/ 任务选择 /
 * 任务简报 / 两层提示 / 失误计数 / 通关与失败横幅。
 * 各城区只需提供棋盘（children）与专属操作台（consoleSlot）。
 */
import { type ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Lock,
  RotateCcw,
  Siren,
  Sparkles,
  Trophy,
} from "lucide-react";

export interface DsBrief {
  term: string;
  story: string;
  definition: string;
}

export interface DsLevelMeta {
  badge: string;
  title: string;
  concept: string;
  story: string;
  task: string;
  /** 红色警示标签（如限高/限流） */
  alert?: string;
  hint: string;
  skeleton: string;
  winNote: string;
}

export type DsStatus = "playing" | "won" | "failed";

export function GameShell({
  code,
  name,
  structure,
  hue,
  districtNo,
  flavor,
  briefing,
  levels,
  levelIdx,
  maxCleared,
  onSelectLevel,
  status,
  mistakes,
  wonByAlt,
  altWinTitle,
  failTitle,
  failNote,
  onRetry,
  onNext,
  completionText,
  consoleSlot,
  children,
}: {
  code: string;
  name: string;
  structure: string;
  hue: number;
  districtNo: string;
  flavor: string;
  briefing: DsBrief[];
  levels: DsLevelMeta[];
  levelIdx: number;
  maxCleared: number;
  onSelectLevel: (i: number) => void;
  status: DsStatus;
  mistakes: number;
  /** 用特殊方式（上报/判定）通关时的标题替换 */
  wonByAlt?: boolean;
  altWinTitle?: string;
  failTitle?: string;
  failNote?: string;
  onRetry: () => void;
  onNext: () => void;
  completionText: string;
  consoleSlot?: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  const level = levels[levelIdx];
  const [briefOpen, setBriefOpen] = useState(false);
  const [hintTier, setHintTier] = useState(0);

  useEffect(() => {
    setHintTier(0);
  }, [levelIdx]);

  return (
    <main className="min-h-screen bg-[#eef1f8] text-slate-900 selection:bg-fuchsia-500/30">
      {/* 顶栏 */}
      <nav className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <button
            type="button"
            onClick={() => router.push("/quest/data-structure")}
            className="inline-flex items-center gap-2 text-sm text-slate-600 transition hover:text-slate-900"
          >
            <ArrowLeft size={16} />
            返回城市地图
          </button>
          <div className="flex items-center gap-3 text-sm">
            <span className="font-mono text-xs tracking-widest" style={{ color: `hsl(${hue} 80% 65%)` }}>
              {code}
            </span>
            <span className="rounded-full bg-slate-50 px-3 py-1 text-xs text-slate-600 ring-1 ring-slate-200">
              已通关 {maxCleared} / {levels.length}
            </span>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-6xl px-5 pb-20 pt-8">
        {/* 标题 */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="font-mono text-[11px] tracking-[0.3em] text-fuchsia-600">
              NEON STACK CITY · {districtNo}
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">
              {name}{" "}
              <span style={{ color: `hsl(${hue} 80% 65%)` }}>· {structure}</span>
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">{flavor}</p>
          </div>
          {maxCleared >= levels.length && (
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/15 px-4 py-2 text-sm font-semibold text-amber-600 ring-1 ring-amber-500/25">
              <Trophy size={16} />
              城区通关
            </div>
          )}
        </div>

        {/* 上岗简报 */}
        <div className="mt-6 rounded-2xl border border-indigo-400/20 bg-indigo-500/[0.06]">
          <button
            type="button"
            onClick={() => setBriefOpen((o) => !o)}
            className="flex w-full items-center justify-between px-5 py-3.5 text-left"
          >
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600">
              <BookOpen size={16} />
              上岗简报 · 本城区的概念与原理
            </span>
            {briefOpen ? (
              <ChevronUp size={16} className="text-indigo-600" />
            ) : (
              <ChevronDown size={16} className="text-indigo-600" />
            )}
          </button>
          {briefOpen && (
            <div className="grid gap-3 px-5 pb-5 md:grid-cols-2">
              {briefing.map((b) => (
                <div key={b.term} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-sm font-semibold text-slate-900">{b.term}</div>
                  <p className="mt-2 text-[13px] leading-6 text-slate-600">{b.story}</p>
                  <p className="mt-2 rounded-lg bg-indigo-500/10 p-2.5 text-[12px] leading-5 text-indigo-700">
                    {b.definition}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 任务选择 */}
        <div className="mt-6 flex flex-wrap gap-2">
          {levels.map((lv, i) => {
            const locked = i > maxCleared;
            const cleared = i < maxCleared;
            const active = i === levelIdx;
            return (
              <button
                key={lv.badge}
                type="button"
                disabled={locked}
                onClick={() => onSelectLevel(i)}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition ${
                  active
                    ? "bg-cyan-400 text-slate-950"
                    : locked
                      ? "cursor-not-allowed bg-white text-slate-600 ring-1 ring-slate-200"
                      : "bg-slate-50 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
                }`}
              >
                {locked ? (
                  <Lock size={12} />
                ) : cleared ? (
                  <CheckCircle2 size={12} className={active ? "" : "text-emerald-600"} />
                ) : null}
                {lv.badge} {lv.title}
              </button>
            );
          })}
        </div>

        {/* 任务简报 */}
        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-fuchsia-500/15 px-2 py-0.5 text-[11px] font-semibold text-fuchsia-600 ring-1 ring-fuchsia-500/25">
              {level.badge}
            </span>
            <span className="text-base font-bold text-slate-900">{level.title}</span>
            <span className="rounded-md bg-slate-50 px-2 py-0.5 text-[11px] text-cyan-600 ring-1 ring-slate-200">
              知识点 · {level.concept}
            </span>
            {level.alert && (
              <span className="inline-flex items-center gap-1 rounded-md bg-red-500/15 px-2 py-0.5 text-[11px] text-red-600 ring-1 ring-red-500/25">
                <Siren size={11} />
                {level.alert}
              </span>
            )}
          </div>
          <p className="mt-3 text-sm leading-7 text-slate-600">{level.story}</p>
          <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-800 ring-1 ring-slate-200">
            🎯 {level.task}
          </p>
        </div>

        {/* 游戏区 */}
        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_15rem]">
          <div
            className={`relative overflow-hidden rounded-3xl border bg-white p-6 transition ${
              status === "failed" ? "border-red-500/40" : "border-slate-200"
            }`}
          >
            <div className="scanlines pointer-events-none absolute inset-0 opacity-20" />
            <div className="relative">{children}</div>

            {status === "won" && (
              <div className="relative mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
                <div className="flex flex-wrap items-center gap-2 text-base font-bold text-emerald-600">
                  <Sparkles size={18} />
                  {wonByAlt && altWinTitle ? altWinTitle : "任务完成"}
                  {mistakes === 0 && (
                    <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] text-amber-600 ring-1 ring-amber-500/25">
                      ★ 完美作业 · 零失误
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm leading-6 text-emerald-700">{level.winNote}</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  {levelIdx + 1 < levels.length ? (
                    <button
                      type="button"
                      onClick={onNext}
                      className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-emerald-300"
                    >
                      下一个任务
                      <ArrowRight size={15} />
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/15 px-5 py-2.5 text-sm font-bold text-amber-600 ring-1 ring-amber-500/25">
                      <Trophy size={15} />
                      {completionText}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={onRetry}
                    className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-5 py-2.5 text-sm text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-100"
                  >
                    <RotateCcw size={14} />
                    再玩一次
                  </button>
                </div>
              </div>
            )}

            {status === "failed" && (
              <div className="relative mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
                <div className="flex items-center gap-2 text-base font-bold text-red-600">
                  <AlertTriangle size={18} />
                  {failTitle ?? "作业失败"}
                </div>
                <p className="mt-2 text-sm leading-6 text-red-700">{failNote}</p>
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-red-400 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-red-300"
                >
                  <RotateCcw size={14} />
                  重新开始
                </button>
              </div>
            )}
          </div>

          {/* 侧栏 */}
          <aside className="space-y-3 self-start">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="font-mono text-[11px] tracking-widest text-slate-600">CONSOLE</div>
              <div className="mt-3 space-y-2">
                {consoleSlot}
                <button
                  type="button"
                  onClick={onRetry}
                  className="w-full rounded-xl bg-slate-50 px-4 py-2 text-xs text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-100"
                >
                  重置本关
                </button>
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-600">
                <span>失误</span>
                <span className={mistakes > 0 ? "font-bold text-amber-600" : "text-slate-600"}>
                  {mistakes}
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-1.5 font-mono text-[11px] tracking-widest text-slate-600">
                <Lightbulb size={12} />
                HINTS · 卡住了再点
              </div>
              {hintTier === 0 && (
                <button
                  type="button"
                  onClick={() => setHintTier(1)}
                  className="mt-3 w-full rounded-xl bg-slate-50 px-4 py-2 text-xs text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-100"
                >
                  看思路提示
                </button>
              )}
              {hintTier >= 1 && (
                <p className="mt-3 rounded-lg bg-slate-50 p-3 text-[12px] leading-5 text-slate-600 ring-1 ring-slate-200">
                  💡 {level.hint}
                </p>
              )}
              {hintTier === 1 && (
                <button
                  type="button"
                  onClick={() => setHintTier(2)}
                  className="mt-2 w-full rounded-xl bg-slate-50 px-4 py-2 text-xs text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-100"
                >
                  还是不行？看操作骨架
                </button>
              )}
              {hintTier >= 2 && (
                <p className="mt-2 rounded-lg bg-indigo-500/10 p-3 font-mono text-[11px] leading-5 text-indigo-700 ring-1 ring-indigo-400/20">
                  {level.skeleton}
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
