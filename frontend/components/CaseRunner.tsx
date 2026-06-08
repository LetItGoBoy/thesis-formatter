"use client";

/**
 * 案件运行器
 * frontend/components/CaseRunner.tsx
 *
 * 渲染任意一个 DetectiveCase：开场指引 → 逐关写 SQL 查证 → 线索校验解锁 → 指认真凶。
 * 浏览器内置 SQLite（sql.js）执行真实 SQL，纯前端，无后端。
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Database,
  CheckCircle2,
  Lock,
  Lightbulb,
  Fingerprint,
  Table2,
  Skull,
  RotateCcw,
  BookOpen,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { SqlConsole } from "@/components/SqlConsole";
import { useCaseDb } from "@/lib/sqljs";
import type { DetectiveCase, QueryResult } from "@/lib/db-detective";

export function CaseRunner({ caseData }: { caseData: DetectiveCase }) {
  const router = useRouter();
  const { meta, seedSql, levels, schema, culprit, accusation } = caseData;
  const { ready, loadError, run } = useCaseDb(seedSql);

  const [solved, setSolved] = useState<boolean[]>(() => levels.map(() => false));
  const [active, setActive] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [feedback, setFeedback] = useState<"idle" | "near" | "hit">("idle");

  const [accuse, setAccuse] = useState("");
  const [accuseState, setAccuseState] = useState<"idle" | "wrong" | "win">("idle");

  const [prefill, setPrefill] = useState<{ sql: string; nonce: number }>({ sql: "", nonce: 0 });
  function previewTable(name: string) {
    setPrefill((p) => ({ sql: `SELECT * FROM ${name};`, nonce: p.nonce + 1 }));
  }
  const [showHelp, setShowHelp] = useState(true);
  const [showBrief, setShowBrief] = useState(true);

  const solvedCount = solved.filter(Boolean).length;
  const allSolved = solvedCount === levels.length;
  const level = levels[active];

  function unlocked(i: number) {
    return i === 0 || solved[i - 1];
  }

  function handleResult(res: QueryResult) {
    if (level.validate(res)) {
      setFeedback("hit");
      setSolved((prev) => {
        if (prev[active]) return prev;
        const next = [...prev];
        next[active] = true;
        return next;
      });
    } else {
      setFeedback("near");
    }
  }

  function goLevel(i: number) {
    if (!unlocked(i)) return;
    setActive(i);
    setShowHint(false);
    setFeedback("idle");
  }

  function submitAccusation() {
    setAccuseState(accuse.trim() === culprit ? "win" : "wrong");
  }

  function restart() {
    setSolved(levels.map(() => false));
    setActive(0);
    setShowHint(false);
    setFeedback("idle");
    setAccuse("");
    setAccuseState("idle");
  }

  const steps = useMemo(
    () => [...levels.map((l) => ({ badge: l.badge, title: l.title })), { badge: "结案", title: "指认真凶" }],
    [levels]
  );
  const accuseActive = active === levels.length;

  return (
    <main className="min-h-screen bg-[#0f1320] text-slate-100">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <button
          type="button"
          onClick={() => router.push("/quest/database")}
          className="inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-sm font-medium text-slate-300 ring-1 ring-white/10 transition hover:text-white"
        >
          <ArrowLeft size={16} />
          返回探案集
        </button>
      </nav>

      {/* 头部 */}
      <section className="mx-auto max-w-6xl px-5 pt-4">
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-1.5 text-sm font-semibold text-emerald-300 ring-1 ring-emerald-500/20">
          <Database size={15} />
          {meta.subtitle}
        </div>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-5xl">{meta.title}</h1>
        <p className="mt-4 max-w-2xl text-base leading-8 text-slate-400">{meta.intro}</p>
        <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-slate-400">
          <span className="rounded-full bg-white/5 px-3 py-1 ring-1 ring-white/10">
            案件进度 {solvedCount} / {levels.length}
          </span>
          {allSolved && (
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-emerald-300 ring-1 ring-emerald-500/30">
              线索集齐，可以指认了
            </span>
          )}
        </div>
        {loadError && (
          <div className="mt-4 rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-300 ring-1 ring-red-500/20">
            数据库加载失败：{loadError}
          </div>
        )}
      </section>

      {/* 案前简报 · 本案概念预习（先故事、后定义；可折叠，不剧透） */}
      <section className="mx-auto max-w-6xl px-5 pt-6">
        <div className="rounded-2xl bg-indigo-500/5 p-5 ring-1 ring-indigo-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-indigo-300">
              <BookOpen size={16} />
              案前简报 · 本案要用到的概念
            </div>
            <button
              type="button"
              onClick={() => setShowBrief((v) => !v)}
              className="text-xs text-slate-400 transition hover:text-indigo-300"
            >
              {showBrief ? "收起" : "展开"}
            </button>
          </div>
          {showBrief && (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {caseData.briefing.map((b) => (
                <div key={b.term} className="rounded-xl bg-slate-900/40 p-4 ring-1 ring-white/5">
                  <div className="text-sm font-semibold text-indigo-200">{b.term}</div>
                  <p className="mt-1.5 text-sm leading-6 text-slate-300">{b.story}</p>
                  <div className="mt-2 rounded-lg bg-white/5 px-3 py-2 text-xs leading-5 text-slate-400">
                    <span className="font-semibold text-slate-300">定义　</span>
                    {b.definition}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 怎么玩 · 侦探入门 */}
      <section className="mx-auto max-w-6xl px-5 pt-6">
        <div className="rounded-2xl bg-emerald-500/5 p-5 ring-1 ring-emerald-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
              <Lightbulb size={16} />
              怎么玩 · 侦探入门
            </div>
            <button
              type="button"
              onClick={() => setShowHelp((v) => !v)}
              className="text-xs text-slate-400 transition hover:text-emerald-300"
            >
              {showHelp ? "收起" : "展开"}
            </button>
          </div>

          {showHelp && (
            <div className="mt-4 grid gap-5 md:grid-cols-2">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">三步破案</div>
                <ol className="mt-2 space-y-2 text-sm leading-6 text-slate-300">
                  <li>
                    <span className="mr-1.5 font-semibold text-emerald-300">1.</span>
                    你是查档侦探，所有线索都藏在右侧「案件数据库」的表里。
                  </li>
                  <li>
                    <span className="mr-1.5 font-semibold text-emerald-300">2.</span>
                    在黑色框里写一句 <span className="font-mono text-emerald-300">SQL</span>，点「运行查询」就能向数据库提问、看结果。
                  </li>
                  <li>
                    <span className="mr-1.5 font-semibold text-emerald-300">3.</span>
                    照每关的「查询任务」写查询，命中关键线索就解锁下一关；线索集齐后指认真凶结案。
                  </li>
                </ol>
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  没写过 SQL？点右侧表名可一键预览数据；每关都有「看提示」，再卡可展开参考答案。放心试，写错不扣分。
                </p>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">SQL 速查（够用版）</div>
                <div className="mt-2 space-y-1.5 font-mono text-[12px] leading-5">
                  {[
                    ["看一张表的全部数据", "SELECT * FROM people;"],
                    ["加条件筛选", "SELECT * FROM people WHERE job = '记者';"],
                    ["分组统计", "SELECT a, COUNT(*) FROM t GROUP BY a;"],
                    ["分组后过滤", "GROUP BY a HAVING COUNT(*) >= 5"],
                    ["连接两张表", "FROM a JOIN b ON a.person_id = b.id"],
                  ].map(([label, code]) => (
                    <div key={code} className="rounded-md bg-slate-900/70 px-3 py-1.5 ring-1 ring-white/5">
                      <div className="text-[11px] text-slate-500">{label}</div>
                      <code className="text-emerald-200">{code}</code>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-5 py-8 lg:grid-cols-[1fr_19rem]">
        {/* 主区 */}
        <div className="rounded-3xl bg-[#161b2c] p-6 ring-1 ring-white/10 md:p-8">
          {!accuseActive ? (
            <>
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
                <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 ring-1 ring-emerald-500/20">
                  {level.badge}
                </span>
                <span className="text-slate-400">知识点 · {level.concept}</span>
              </div>
              <h2 className="mt-3 text-2xl font-semibold">{level.title}</h2>
              <p className="mt-3 leading-7 text-slate-300">{level.story}</p>

              <div className="mt-5 rounded-xl bg-amber-400/5 px-4 py-3 ring-1 ring-amber-400/20">
                <div className="text-sm font-semibold text-amber-300">🔎 查询任务</div>
                <p className="mt-1 text-sm leading-6 text-slate-300">{level.task}</p>
              </div>

              <div className="mt-5">
                <SqlConsole
                  key={level.id}
                  run={run}
                  ready={ready}
                  onResult={handleResult}
                  prefill={prefill}
                />
              </div>

              {feedback === "hit" && (
                <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300 ring-1 ring-emerald-500/20">
                  <CheckCircle2 size={16} />
                  线索吻合！这一步锁定了关键信息。
                </div>
              )}
              {feedback === "near" && (
                <div className="mt-4 rounded-xl bg-white/5 px-4 py-3 text-sm text-slate-300 ring-1 ring-white/10">
                  查询跑通了，但还没命中本关要找的关键线索。对照「查询任务」再调整试试。
                </div>
              )}

              <div className="mt-4 flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setShowHint((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition hover:text-amber-300"
                >
                  <Lightbulb size={15} />
                  {showHint ? "收起提示" : "卡住了？看提示"}
                </button>
              </div>
              {showHint && (
                <div className="mt-2 space-y-2">
                  {/* 第一层：文字思路 */}
                  <div className="rounded-lg bg-white/5 px-4 py-3 text-sm leading-6 text-slate-300 ring-1 ring-white/10">
                    💡 {level.hint}
                  </div>
                  {/* 第二层：语句骨架（再点一下才显示，输入框本身不提示） */}
                  <details className="rounded-lg bg-white/5 px-4 py-3 ring-1 ring-white/10">
                    <summary className="cursor-pointer text-sm text-slate-400 transition hover:text-amber-300">
                      还不会写？看语句骨架（把空格 ___ 填上）
                    </summary>
                    <pre className="mt-2 overflow-auto rounded bg-slate-900 px-3 py-2 font-mono text-xs text-emerald-200">
                      {level.skeleton}
                    </pre>
                  </details>
                </div>
              )}

              {solved[active] && (
                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={() => goLevel(active + 1)}
                    className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-emerald-400"
                  >
                    {active + 1 < levels.length ? "进入下一条线索" : "线索集齐，去指认真凶"}
                    <Fingerprint size={16} />
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm font-semibold text-rose-300">
                <Skull size={16} />
                结案 · 指认真凶
              </div>
              <h2 className="mt-3 text-2xl font-semibold">谁是真凶？</h2>
              <p className="mt-3 leading-7 text-slate-300">{accusation.prompt}</p>

              {accuseState !== "win" ? (
                <div className="mt-6 max-w-sm">
                  <input
                    value={accuse}
                    onChange={(e) => {
                      setAccuse(e.target.value);
                      setAccuseState("idle");
                    }}
                    placeholder="输入凶手姓名"
                    className="w-full rounded-xl bg-slate-900 px-4 py-3 text-slate-100 ring-1 ring-white/10 placeholder:text-slate-500 focus:outline-none focus:ring-emerald-500/50"
                  />
                  {accuseState === "wrong" && (
                    <p className="mt-2 text-sm text-rose-300">证据对不上，再回去核对线索。</p>
                  )}
                  <button
                    type="button"
                    onClick={submitAccusation}
                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-400"
                  >
                    <Fingerprint size={16} />
                    正式指认
                  </button>
                </div>
              ) : (
                <div className="mt-6 rounded-2xl bg-emerald-500/10 p-6 ring-1 ring-emerald-500/30">
                  <div className="flex items-center gap-2 text-lg font-semibold text-emerald-300">
                    <CheckCircle2 size={20} />
                    结案！真凶是「{culprit}」
                  </div>
                  <p className="mt-2 text-sm leading-7 text-slate-300">{accusation.winNote}</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => router.push("/quest/database")}
                      className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-emerald-400"
                    >
                      回探案集，接下一案
                      <Fingerprint size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={restart}
                      className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/20"
                    >
                      <RotateCcw size={15} />
                      重玩本案
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* 侧栏 */}
        <aside className="space-y-5">
          <div className="rounded-2xl bg-[#161b2c] p-5 ring-1 ring-white/10">
            <div className="text-sm font-semibold text-slate-300">侦破步骤</div>
            <ol className="mt-3 space-y-1.5">
              {steps.map((s, i) => {
                const isAccuse = i === levels.length;
                const open = isAccuse ? allSolved : unlocked(i);
                const done = isAccuse ? accuseState === "win" : solved[i];
                const isActive = active === i;
                return (
                  <li key={i}>
                    <button
                      type="button"
                      disabled={!open}
                      onClick={() => (isAccuse ? open && setActive(levels.length) : goLevel(i))}
                      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                        isActive
                          ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/30"
                          : open
                          ? "text-slate-300 hover:bg-white/5"
                          : "cursor-not-allowed text-slate-600"
                      }`}
                    >
                      {done ? (
                        <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />
                      ) : open ? (
                        <span className="grid size-[15px] shrink-0 place-items-center rounded-full text-[10px] ring-1 ring-current">
                          {i + 1}
                        </span>
                      ) : (
                        <Lock size={15} className="shrink-0" />
                      )}
                      <span>
                        <span className="text-xs text-slate-500">{s.badge}</span>
                        <br />
                        {s.title}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="rounded-2xl bg-[#161b2c] p-5 ring-1 ring-white/10">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-300">
              <Table2 size={15} />
              案件数据库
            </div>
            <p className="mt-1 text-xs text-slate-500">这些就是你能查询的全部表。点表名可一键预览它的全部数据。</p>
            <div className="mt-3 space-y-3">
              {schema.map((t) => (
                <div key={t.name} className="rounded-lg bg-slate-900/60 p-3 ring-1 ring-white/5">
                  <button
                    type="button"
                    onClick={() => previewTable(t.name)}
                    title={`预览 ${t.name} 的全部数据`}
                    className="font-mono text-[13px] text-emerald-300 underline-offset-2 hover:underline"
                  >
                    {t.name}
                  </button>
                  <div className="text-[11px] text-slate-500">{t.comment}</div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {t.columns.map((c) => (
                      <span
                        key={c.name}
                        title={c.note || c.type}
                        className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[11px] text-slate-400"
                      >
                        {c.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
