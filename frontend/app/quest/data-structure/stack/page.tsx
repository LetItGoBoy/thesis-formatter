"use client";

/**
 * 霓虹栈城 2.0 · 货运塔（栈）城区 —— 可玩原型
 * app/quest/data-structure/stack/page.tsx
 *
 * 玩法：点击传送带最前面的货箱「入塔」，点击塔顶货箱「装车」，
 * 按订单顺序完成交付。LIFO 靠手感学会，不靠背定义。
 */
import { useState } from "react";
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
import { STACK_BRIEFING, STACK_LEVELS } from "@/lib/stack-quest";

// 每个货箱编号一个霓虹色相
const HUES = [0, 190, 320, 45, 265, 145, 15];

function boxStyle(n: number, dim = false) {
  const h = HUES[n % HUES.length];
  return {
    background: `linear-gradient(160deg, hsl(${h} 85% ${dim ? 18 : 26}%), hsl(${h} 80% ${dim ? 10 : 14}%))`,
    boxShadow: dim ? "none" : `0 0 14px hsl(${h} 90% 50% / 0.35), inset 0 0 0 1px hsl(${h} 90% 65% / 0.5)`,
    color: `hsl(${h} 95% ${dim ? 55 : 78}%)`,
  };
}

type Status = "playing" | "won" | "collapsed";

export default function StackDepotPage() {
  const router = useRouter();

  const [levelIdx, setLevelIdx] = useState(0);
  const [maxCleared, setMaxCleared] = useState(0); // 已通关数（顺序解锁）
  const level = STACK_LEVELS[levelIdx];

  const [conveyor, setConveyor] = useState<number[]>(STACK_LEVELS[0].input);
  const [tower, setTower] = useState<number[]>([]);
  const [truck, setTruck] = useState<number[]>([]);
  const [status, setStatus] = useState<Status>("playing");
  const [wonByReport, setWonByReport] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [shakeTick, setShakeTick] = useState(0);
  const [reportMsg, setReportMsg] = useState("");
  const [hintTier, setHintTier] = useState(0);
  const [briefOpen, setBriefOpen] = useState(false);

  function loadLevel(idx: number) {
    const lv = STACK_LEVELS[idx];
    setLevelIdx(idx);
    setConveyor(lv.input);
    setTower([]);
    setTruck([]);
    setStatus("playing");
    setWonByReport(false);
    setMistakes(0);
    setLog([]);
    setReportMsg("");
    setHintTier(0);
  }

  function push() {
    if (status !== "playing" || conveyor.length === 0) return;
    setReportMsg("");
    const box = conveyor[0];
    if (level.capacity && tower.length >= level.capacity) {
      // 超过限高：塔倾倒
      setTower((t) => [...t, box]);
      setConveyor((c) => c.slice(1));
      setStatus("collapsed");
      setLog((l) => [...l, `入塔 ${box}`, "⚠ 超过限高，塔体倾倒"]);
      return;
    }
    setConveyor((c) => c.slice(1));
    setTower((t) => [...t, box]);
    setLog((l) => [...l, `入塔 ${box}`]);
  }

  function pop() {
    if (status !== "playing" || tower.length === 0) return;
    setReportMsg("");
    const top = tower[tower.length - 1];
    const need = level.target[truck.length];
    if (top === need) {
      const nextTruck = [...truck, top];
      setTower((t) => t.slice(0, -1));
      setTruck(nextTruck);
      setLog((l) => [...l, `装车 ${top}`]);
      if (nextTruck.length === level.target.length) {
        setStatus("won");
        setMaxCleared((m) => Math.max(m, levelIdx + 1));
      }
    } else {
      // 拒收：货箱退回塔顶
      setMistakes((m) => m + 1);
      setShakeTick((s) => s + 1);
      setLog((l) => [...l, `拒收 ${top}`]);
    }
  }

  function report() {
    if (status !== "playing") return;
    if (level.impossible) {
      setStatus("won");
      setWonByReport(true);
      setMaxCleared((m) => Math.max(m, levelIdx + 1));
      setLog((l) => [...l, "✓ 上报订单不可行"]);
    } else {
      setMistakes((m) => m + 1);
      setReportMsg("调度中心核查：该订单可以完成，请继续作业。");
      setLog((l) => [...l, "✗ 误报不可行"]);
    }
  }

  const nextNeed = level.target[truck.length];
  const towerSlots = level.capacity ?? Math.max(level.input.length, 4);
  const allCleared = maxCleared >= STACK_LEVELS.length;

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
            返回霓虹栈城
          </button>
          <div className="flex items-center gap-3 text-sm">
            <span className="font-mono text-xs tracking-widest text-cyan-600">
              STACK DEPOT
            </span>
            <span className="rounded-full bg-slate-50 px-3 py-1 text-xs text-slate-600 ring-1 ring-slate-200">
              已通关 {maxCleared} / {STACK_LEVELS.length}
            </span>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-6xl px-5 pb-20 pt-8">
        {/* 标题 */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="font-mono text-[11px] tracking-[0.3em] text-fuchsia-600">
              NEON STACK CITY · 城区 01
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">
              货运塔 <span className="text-cyan-600">· 栈</span>
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
              全城货物都要经过这座只有塔顶一个口的高塔。你是新上岗的塔吊手——
              客户的订单千奇百怪，而塔的规矩只有一条：后进，先出。
            </p>
          </div>
          {allCleared && (
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/15 px-4 py-2 text-sm font-semibold text-amber-600 ring-1 ring-amber-500/25">
              <Trophy size={16} />
              城区通关 · 栈已点亮
            </div>
          )}
        </div>

        {/* 案前简报 */}
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
              {STACK_BRIEFING.map((b) => (
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
          {STACK_LEVELS.map((lv, i) => {
            const locked = i > maxCleared;
            const cleared = i < maxCleared;
            const active = i === levelIdx;
            return (
              <button
                key={lv.id}
                type="button"
                disabled={locked}
                onClick={() => loadLevel(i)}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition ${
                  active
                    ? "bg-cyan-400 text-slate-950"
                    : locked
                      ? "cursor-not-allowed bg-white text-slate-600 ring-1 ring-slate-200"
                      : "bg-slate-50 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
                }`}
              >
                {locked ? <Lock size={12} /> : cleared ? <CheckCircle2 size={12} className={active ? "" : "text-emerald-600"} /> : null}
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
            {level.capacity && (
              <span className="inline-flex items-center gap-1 rounded-md bg-red-500/15 px-2 py-0.5 text-[11px] text-red-600 ring-1 ring-red-500/25">
                <Siren size={11} />
                限高 {level.capacity} 层
              </span>
            )}
          </div>
          <p className="mt-3 text-sm leading-7 text-slate-600">{level.story}</p>
          <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-800 ring-1 ring-slate-200">
            🎯 {level.task}
          </p>
        </div>

        {/* ============ 游戏区 ============ */}
        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_15rem]">
          <div
            className={`relative overflow-hidden rounded-3xl border bg-white p-6 transition ${
              status === "collapsed" ? "border-red-500/40" : "border-slate-200"
            }`}
          >
            <div className="scanlines pointer-events-none absolute inset-0 opacity-20" />

            {/* 传送带 */}
            <div className="relative">
              <div className="mb-2 flex items-center justify-between font-mono text-[11px] tracking-widest text-slate-600">
                <span>INBOUND · 传送带（到货顺序，只能取最前一件）</span>
                <span>{conveyor.length} 件待入塔</span>
              </div>
              <div className="flex min-h-[3.5rem] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
                {conveyor.length === 0 && (
                  <span className="px-2 text-xs text-slate-600">传送带已清空</span>
                )}
                {conveyor.map((n, i) => (
                  <button
                    key={`${n}-${i}`}
                    type="button"
                    disabled={i !== 0 || status !== "playing"}
                    onClick={push}
                    style={boxStyle(n, i !== 0)}
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-lg font-black transition ${
                      i === 0 && status === "playing"
                        ? "cursor-pointer ring-2 ring-cyan-300/70 hover:scale-105"
                        : "opacity-70"
                    }`}
                    title={i === 0 ? "点击入塔" : "还没轮到这件"}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* 塔 + 订单 */}
            <div className="relative mt-6 grid gap-6 sm:grid-cols-[10rem_1fr]">
              {/* 货运塔 */}
              <div>
                <div className="mb-2 font-mono text-[11px] tracking-widest text-slate-600">
                  TOWER · 货运塔
                </div>
                <div
                  className={`relative mx-auto flex w-28 flex-col-reverse gap-1.5 rounded-xl border-x-2 border-b-2 p-2 transition-all duration-500 ${
                    status === "collapsed"
                      ? "translate-y-3 rotate-12 border-red-500/60 opacity-70"
                      : "border-cyan-400/30"
                  }`}
                  style={{ minHeight: `${towerSlots * 3.2 + 1}rem` }}
                >
                  {/* 限高警戒线 */}
                  {level.capacity && (
                    <div
                      className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-dashed border-red-500/60"
                      style={{ bottom: `${level.capacity * 3.2 + 0.4}rem` }}
                    >
                      <span className="absolute -top-4 right-0 font-mono text-[11px] text-red-600">
                        限高线
                      </span>
                    </div>
                  )}
                  {tower.length === 0 && (
                    <span className="pb-1 text-center text-[11px] text-slate-600">塔内为空</span>
                  )}
                  {tower.map((n, i) => {
                    const isTop = i === tower.length - 1;
                    return (
                      <button
                        key={`${n}-${i}-${isTop ? shakeTick : 0}`}
                        type="button"
                        disabled={!isTop || status !== "playing"}
                        onClick={pop}
                        style={boxStyle(n, !isTop)}
                        className={`flex h-11 w-full items-center justify-center rounded-lg text-lg font-black transition ${
                          isTop && status === "playing"
                            ? `cursor-pointer ring-2 ring-fuchsia-300/70 hover:scale-105 ${
                                shakeTick > 0 ? "animate-shake" : ""
                              }`
                            : ""
                        }`}
                        title={isTop ? "点击装车（出塔）" : "被压住了，取不到"}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2 text-center text-[11px] text-slate-600">
                  {status === "collapsed" ? (
                    <span className="font-semibold text-red-600">塔体倾倒！</span>
                  ) : (
                    <>塔顶在上 · 只能动最上面一件</>
                  )}
                </div>
              </div>

              {/* 订单 / 货车 */}
              <div>
                <div className="mb-2 font-mono text-[11px] tracking-widest text-slate-600">
                  ORDER · 客户订单（按从左到右的顺序装车）
                </div>
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  {level.target.map((n, i) => {
                    const delivered = i < truck.length;
                    const isNext = i === truck.length && status === "playing";
                    return (
                      <div
                        key={i}
                        style={delivered ? boxStyle(n) : undefined}
                        className={`flex h-11 w-11 items-center justify-center rounded-lg text-lg font-black ${
                          delivered
                            ? ""
                            : isNext
                              ? "border-2 border-dashed border-cyan-300/70 text-cyan-600"
                              : "border border-dashed border-slate-200 text-slate-600"
                        }`}
                      >
                        {n}
                      </div>
                    );
                  })}
                </div>
                {status === "playing" && (
                  <p className="mt-2 text-xs text-slate-600">
                    下一件该装：<span className="font-bold text-cyan-600">{nextNeed} 号</span>
                    {tower.length > 0 && tower[tower.length - 1] !== nextNeed && (
                      <>
                        ，但塔顶是{" "}
                        <span className="font-bold text-fuchsia-600">
                          {tower[tower.length - 1]} 号
                        </span>
                        —— 想想怎么办
                      </>
                    )}
                  </p>
                )}

                {/* 操作记录 */}
                <div className="mt-4">
                  <div className="mb-1 font-mono text-[11px] tracking-widest text-slate-600">
                    OPS LOG · 操作记录
                  </div>
                  <div className="min-h-[2.2rem] rounded-lg bg-slate-50 p-2 font-mono text-[11px] leading-5 text-slate-600 ring-1 ring-slate-200">
                    {log.length === 0 ? "（尚未操作）" : log.slice(-14).join(" → ")}
                  </div>
                </div>
              </div>
            </div>

            {/* 结果横幅 */}
            {status === "won" && (
              <div className="relative mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
                <div className="flex items-center gap-2 text-base font-bold text-emerald-600">
                  <Sparkles size={18} />
                  {wonByReport ? "上报正确 · 任务完成" : "订单交付 · 任务完成"}
                  {mistakes === 0 && (
                    <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] text-amber-600 ring-1 ring-amber-500/25">
                      ★ 完美调度 · 零失误
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm leading-6 text-emerald-700">{level.winNote}</p>
                <div className="mt-4 flex gap-3">
                  {levelIdx + 1 < STACK_LEVELS.length ? (
                    <button
                      type="button"
                      onClick={() => loadLevel(levelIdx + 1)}
                      className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-emerald-300"
                    >
                      下一个任务
                      <ArrowRight size={15} />
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/15 px-5 py-2.5 text-sm font-bold text-amber-600 ring-1 ring-amber-500/25">
                      <Trophy size={15} />
                      货运塔全部通关！下一站：环线地铁（队列）
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => loadLevel(levelIdx)}
                    className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-5 py-2.5 text-sm text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-100"
                  >
                    <RotateCcw size={14} />
                    再玩一次
                  </button>
                </div>
              </div>
            )}

            {status === "collapsed" && (
              <div className="relative mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
                <div className="flex items-center gap-2 text-base font-bold text-red-600">
                  <AlertTriangle size={18} />
                  栈溢出！货箱超过限高，塔倾倒了
                </div>
                <p className="mt-2 text-sm leading-6 text-red-700">
                  塔内已有 {level.capacity} 件时再入塔，就是「栈溢出」。
                  重整旗鼓：把订单拆成不超过限高的小批次处理。
                </p>
                <button
                  type="button"
                  onClick={() => loadLevel(levelIdx)}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-red-400 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-red-300"
                >
                  <RotateCcw size={14} />
                  重建货运塔
                </button>
              </div>
            )}
          </div>

          {/* 侧栏：操作与提示 */}
          <aside className="space-y-3 self-start">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="font-mono text-[11px] tracking-widest text-slate-600">CONSOLE</div>
              <div className="mt-3 space-y-2">
                <button
                  type="button"
                  onClick={push}
                  disabled={status !== "playing" || conveyor.length === 0}
                  className="w-full rounded-xl bg-cyan-400/90 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-600"
                >
                  入塔 PUSH{conveyor.length > 0 ? ` · ${conveyor[0]} 号` : ""}
                </button>
                <button
                  type="button"
                  onClick={pop}
                  disabled={status !== "playing" || tower.length === 0}
                  className="w-full rounded-xl bg-fuchsia-400/90 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-fuchsia-300 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-600"
                >
                  装车 POP{tower.length > 0 ? ` · ${tower[tower.length - 1]} 号` : ""}
                </button>
                <button
                  type="button"
                  onClick={() => loadLevel(levelIdx)}
                  className="w-full rounded-xl bg-slate-50 px-4 py-2 text-xs text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-100"
                >
                  重置本关
                </button>
                <button
                  type="button"
                  onClick={report}
                  disabled={status !== "playing"}
                  className="w-full rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-600 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  上报：订单不可行
                </button>
              </div>
              {reportMsg && (
                <p className="mt-3 rounded-lg bg-amber-500/10 p-2.5 text-[11px] leading-5 text-amber-700">
                  {reportMsg}
                </p>
              )}
              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-600">
                <span>失误（拒收/误报）</span>
                <span className={mistakes > 0 ? "font-bold text-amber-600" : "text-slate-600"}>
                  {mistakes}
                </span>
              </div>
            </div>

            {/* 两层提示 */}
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
