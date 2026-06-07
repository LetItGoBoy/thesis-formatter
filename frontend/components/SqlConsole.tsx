"use client";

/**
 * SQL 控制台
 * frontend/components/SqlConsole.tsx
 *
 * 侦探游戏的核心交互：写 SQL → 运行 → 看结果表。Ctrl/⌘+Enter 快捷运行。
 * 只负责执行与展示，是否"破案成功"由上层关卡的 validate 判定。
 */
import { useState } from "react";
import { Play, Loader2, AlertTriangle } from "lucide-react";
import type { QueryResult } from "@/lib/db-detective";
import type { RunFn } from "@/lib/sqljs";

interface Props {
  run: RunFn;
  ready: boolean;
  placeholder: string;
  onResult: (res: QueryResult) => void;
}

const MAX_ROWS = 50;

export function SqlConsole({ run, ready, placeholder, onResult }: Props) {
  const [sql, setSql] = useState("");
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState("");

  function execute() {
    setError("");
    if (!sql.trim()) return;
    try {
      const res = run(sql);
      setResult(res);
      onResult(res);
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl ring-1 ring-slate-700 bg-slate-900">
        <textarea
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              execute();
            }
          }}
          spellCheck={false}
          placeholder={placeholder}
          className="block h-36 w-full resize-y bg-transparent px-4 py-3 font-mono text-[13px] leading-6 text-emerald-200 placeholder:text-slate-500 focus:outline-none"
        />
        <div className="flex items-center justify-between border-t border-slate-700 px-3 py-2">
          <span className="text-xs text-slate-500">Ctrl / ⌘ + Enter 运行</span>
          <button
            type="button"
            onClick={execute}
            disabled={!ready}
            className="inline-flex items-center gap-2 rounded-md bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-slate-900 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {ready ? <Play size={15} /> : <Loader2 size={15} className="animate-spin" />}
            {ready ? "运行查询" : "加载数据库…"}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 ring-1 ring-red-100">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span className="font-mono">{error}</span>
        </div>
      )}

      {result && !error && (
        <div className="overflow-hidden rounded-xl ring-1 ring-slate-200">
          {result.columns.length === 0 ? (
            <div className="bg-white px-4 py-3 text-sm text-slate-500">查询成功，但没有返回任何行。</div>
          ) : (
            <div className="max-h-72 overflow-auto">
              <table className="w-full border-collapse text-left text-[13px]">
                <thead className="sticky top-0 bg-slate-100">
                  <tr>
                    {result.columns.map((c) => (
                      <th key={c} className="border-b border-slate-200 px-3 py-2 font-semibold text-slate-600">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.slice(0, MAX_ROWS).map((row, ri) => (
                    <tr key={ri} className="odd:bg-white even:bg-slate-50">
                      {row.map((cell, ci) => (
                        <td key={ci} className="border-b border-slate-100 px-3 py-1.5 text-slate-700">
                          {cell === null ? <span className="text-slate-400">NULL</span> : String(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="bg-white px-3 py-1.5 text-xs text-slate-400">
                共 {result.rows.length} 行
                {result.rows.length > MAX_ROWS && `（仅显示前 ${MAX_ROWS} 行）`}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
