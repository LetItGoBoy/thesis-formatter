"use client";

/**
 * 数据库侦探探案集 · 季度 hub
 * frontend/app/quest/database/page.tsx
 *
 * 列出整季 8 案（校对者 ROLLBACK 主线），已开放的可进入，未实现标「敬请期待」。
 */
import { useRouter } from "next/navigation";
import { ArrowLeft, Database, Lock, ArrowRight, Fingerprint } from "lucide-react";
import { Logo } from "@/components/Logo";
import { SEASON_PLAN, SEASON_META } from "@/lib/cases";

export default function DatabaseSeasonHub() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-[#eef1f8] text-slate-900">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <Logo />
        <button
          type="button"
          onClick={() => router.push("/course-spaces")}
          className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600 ring-1 ring-slate-200 transition hover:text-slate-900"
        >
          <ArrowLeft size={16} />
          返回课程空间
        </button>
      </nav>

      <section className="mx-auto max-w-5xl px-5 pt-4">
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-1.5 text-sm font-semibold text-emerald-600 ring-1 ring-emerald-500/20">
          <Database size={15} />
          {SEASON_META.subtitle}
        </div>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-5xl">{SEASON_META.title}</h1>
        <p className="mt-4 max-w-2xl text-base leading-8 text-slate-500">{SEASON_META.villain}</p>
        <p className="mt-3 text-sm text-slate-500">
          一季 8 案，从 SELECT 到事务恢复，覆盖整门《数据库原理》。每一案都用真实 SQL 破案。
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-8">
        <div className="grid gap-3 sm:grid-cols-2">
          {SEASON_PLAN.map((entry) => {
            const ready = entry.id !== null;
            return (
              <button
                key={entry.order}
                type="button"
                disabled={!ready}
                onClick={() => ready && router.push(`/quest/database/${entry.id}`)}
                className={`group flex flex-col items-start gap-2 rounded-2xl p-5 text-left ring-1 transition ${
                  ready
                    ? "bg-white ring-slate-200 hover:ring-emerald-500/40"
                    : "cursor-not-allowed bg-slate-100 ring-slate-200"
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <span
                    className={`grid size-8 place-items-center rounded-lg text-sm font-bold ${
                      ready ? "bg-emerald-500/15 text-emerald-600" : "bg-slate-50 text-slate-600"
                    }`}
                  >
                    {entry.order}
                  </span>
                  {ready ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 ring-1 ring-emerald-500/20">
                      可进入
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-0.5 text-xs text-slate-500">
                      <Lock size={11} />
                      敬请期待
                    </span>
                  )}
                </div>
                <div className={`mt-1 text-lg font-semibold ${ready ? "text-slate-900" : "text-slate-500"}`}>
                  第{entry.order}案 · {entry.title}
                </div>
                <div className="text-xs text-slate-500">{entry.concepts}</div>
                {ready && (
                  <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-emerald-600 opacity-0 transition group-hover:opacity-100">
                    进入侦破 <ArrowRight size={14} />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-8 flex items-start gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500 ring-1 ring-slate-200">
          <Fingerprint size={16} className="mt-0.5 shrink-0 text-emerald-600" />
          建议按顺序破案：每一案的 SQL 难度都接着上一案递进，最终在终章用全部本事揪出「校对者」。
        </div>
      </section>
    </main>
  );
}
