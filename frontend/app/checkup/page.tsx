"use client";

import { useRef, useState, ChangeEvent, DragEvent } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Info,
  Loader2,
  Pencil,
  RotateCcw,
  Upload,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { MusicPlayer } from "@/components/MusicPlayer";
import {
  runCheckup,
  runCheckupTyped,
  type CheckupIssue,
  type CheckupResponse,
  type CheckupSeverity,
} from "@/lib/api";
import { ensureDocParsed } from "@/lib/doc-store";
import { prepareFormatFromActive, preparePolishFromActive } from "@/lib/flow";

const SEVERITY_META: Record<
  CheckupSeverity,
  { label: string; chip: string; border: string; dot: string; icon: typeof AlertTriangle }
> = {
  high: {
    label: "高优先级",
    chip: "bg-red-50 text-red-600 ring-1 ring-red-100",
    border: "border-l-red-400",
    dot: "bg-red-500",
    icon: AlertTriangle,
  },
  medium: {
    label: "中优先级",
    chip: "bg-amber-50 text-amber-600 ring-1 ring-amber-100",
    border: "border-l-amber-400",
    dot: "bg-amber-500",
    icon: Info,
  },
  low: {
    label: "低优先级",
    chip: "bg-sky-50 text-sky-600 ring-1 ring-sky-100",
    border: "border-l-sky-400",
    dot: "bg-sky-500",
    icon: Info,
  },
};

type Filter = "all" | CheckupSeverity;

function scoreColor(score: number): { ring: string; text: string; label: string } {
  if (score >= 85) return { ring: "#16a34a", text: "text-green-600", label: "状态良好" };
  if (score >= 60) return { ring: "#d97706", text: "text-amber-600", label: "需要修改" };
  return { ring: "#dc2626", text: "text-red-600", label: "建议重点修改" };
}

export default function CheckupPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CheckupResponse | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [statusText, setStatusText] = useState("");
  // 记住本次上传的原始文件：体检时若 AI 解析失败未落库，跳转模块时用它兜底
  const [lastFile, setLastFile] = useState<File | null>(null);
  // 跳转反馈："polish" | "format" | null，避免按钮点了无任何提示
  const [navTarget, setNavTarget] = useState<"polish" | "format" | null>(null);

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".docx")) {
      setError("仅支持 .docx 文件");
      return;
    }
    setError("");
    setLoading(true);
    setResult(null);
    setFileName(file.name);
    setLastFile(file);
    try {
      // 复用「解析一次」的共享缓存：命中即零 AI，未命中则 AI 解析并落库，
      // 这份解析后续格式化/优化都能直接复用。
      let res: CheckupResponse;
      try {
        const doc = await ensureDocParsed(file, {
          tier: "standard",
          onCacheHit: () => setStatusText("已复用此前的识别结果，正在体检..."),
          onParseStart: () => setStatusText("AI 正在通读全文、识别章节结构..."),
        });
        setStatusText("正在按章节逐项体检...");
        res = await runCheckupTyped(doc.paragraphs);
      } catch (parseErr) {
        // AI 解析不可用时降级为正则结构检测（精度较低但可离线）
        setStatusText("AI 解析不可用，改用基础规则体检...");
        res = await runCheckup(file);
      }
      setResult(res);
      setFilter("all");
    } catch (e) {
      setError(e instanceof Error ? e.message : "体检失败");
    } finally {
      setLoading(false);
      setStatusText("");
    }
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = "";
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }

  function reset() {
    setResult(null);
    setFileName("");
    setError("");
  }

  // 软串联：优先复用刚解析的缓存，缺失时用本次上传的文件兜底，直接进入目标模块
  async function goPolish() {
    if (navTarget) return;
    setError("");
    setNavTarget("polish");
    try {
      const ok = await preparePolishFromActive(lastFile ?? undefined);
      if (!ok) {
        setError("没有可用的文档，请重新上传");
        return;
      }
      router.push("/polish");
    } catch (e) {
      setError(e instanceof Error ? e.message : "进入在线编辑失败");
    } finally {
      setNavTarget(null);
    }
  }

  async function goFormat() {
    if (navTarget) return;
    setError("");
    setNavTarget("format");
    try {
      const ok = await prepareFormatFromActive(lastFile ?? undefined);
      if (!ok) {
        setError("没有可用的文档，请重新上传");
        return;
      }
      router.push("/review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "进入格式对齐失败");
    } finally {
      setNavTarget(null);
    }
  }

  const issues = result?.issues ?? [];
  const shown = filter === "all" ? issues : issues.filter((i) => i.severity === filter);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {/* 顶栏 */}
      <nav className="sticky top-0 z-30 border-b border-slate-100 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3.5">
          <button onClick={() => router.push("/")} className="transition hover:opacity-80">
            <Logo />
          </button>
          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={() => router.push("/polish")}
              className="rounded-md px-3 py-2 font-medium text-slate-600 transition hover:text-blue-600"
            >
              AI 表达优化
            </button>
            <button
              onClick={() => router.push("/tools")}
              className="rounded-md px-3 py-2 font-medium text-slate-600 transition hover:text-blue-600"
            >
              格式对齐
            </button>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-5xl px-5 py-10">
        {/* 标题区 */}
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white">
            <ClipboardCheck size={22} />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">提交前体检</h1>
            <p className="text-sm text-slate-500">
              上传论文，先看清结构、摘要、关键词、引用与表达层面的问题，明确修改优先级。
            </p>
          </div>
        </div>

        {/* 上传区 / 结果区 */}
        {!result ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`mt-8 rounded-2xl border-2 border-dashed bg-white p-12 text-center transition ${
              dragOver ? "border-blue-400 bg-blue-50/40" : "border-slate-200"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".docx"
              onChange={onInputChange}
              className="hidden"
            />
            {loading ? (
              <div className="flex flex-col items-center gap-3 text-slate-500">
                <Loader2 className="animate-spin" size={32} />
                <p className="text-sm">{statusText || "正在体检"}：{fileName}</p>
              </div>
            ) : (
              <>
                <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                  <Upload size={26} />
                </span>
                <p className="mt-4 text-base font-semibold">拖入或选择 .docx 论文文件</p>
                <p className="mt-1 text-sm text-slate-500">
                  首次会用 AI 识别章节结构，这份解析后续对齐格式、优化表达都能直接复用，不再重复解析，也不改动你的文档。
                </p>
                <button
                  onClick={() => inputRef.current?.click()}
                  className="mt-5 inline-flex items-center gap-2 rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                >
                  <FileText size={16} />
                  选择文件
                </button>
                {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
              </>
            )}
          </div>
        ) : (
          <ResultView
            result={result}
            fileName={fileName}
            filter={filter}
            setFilter={setFilter}
            shown={shown}
            onReset={reset}
            onGoFormat={goFormat}
            onGoPolish={goPolish}
            navTarget={navTarget}
            navError={error}
          />
        )}
      </div>
      <MusicPlayer />
    </main>
  );
}

function ResultView({
  result,
  fileName,
  filter,
  setFilter,
  shown,
  onReset,
  onGoFormat,
  onGoPolish,
  navTarget,
  navError,
}: {
  result: CheckupResponse;
  fileName: string;
  filter: Filter;
  setFilter: (f: Filter) => void;
  shown: CheckupIssue[];
  onReset: () => void;
  onGoFormat: () => void;
  onGoPolish: () => void;
  navTarget: "polish" | "format" | null;
  navError: string;
}) {
  const { summary } = result;
  const sc = scoreColor(summary.score);
  const ov = summary.structure_overview;

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "全部", count: summary.total },
    { key: "high", label: "高", count: summary.by_severity.high },
    { key: "medium", label: "中", count: summary.by_severity.medium },
    { key: "low", label: "低", count: summary.by_severity.low },
  ];

  const overview: { label: string; value: string; ok: boolean }[] = [
    { label: "中文摘要", value: `${ov.abstract_cn_chars} 字`, ok: ov.abstract_cn_chars >= 200 },
    { label: "中文关键词", value: `${ov.keywords_cn_count} 个`, ok: ov.keywords_cn_count >= 3 },
    { label: "章节数", value: `${ov.chapter_count} 章`, ok: ov.chapter_count > 0 },
    { label: "参考文献", value: `${ov.reference_count} 条`, ok: ov.reference_count >= 8 },
    { label: "图 / 表", value: `${ov.figure_count} / ${ov.table_count}`, ok: true },
    { label: "英文摘要", value: ov.has_abstract_en ? "有" : "无", ok: ov.has_abstract_en },
    { label: "目录", value: ov.has_toc ? "有" : "无", ok: ov.has_toc },
    { label: "总结", value: ov.has_conclusion ? "有" : "无", ok: ov.has_conclusion },
  ];

  return (
    <div className="mt-8 space-y-6">
      {/* 概览卡 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-center">
          {/* 评分环 */}
          <div className="flex items-center gap-5">
            <ScoreRing score={summary.score} color={sc.ring} />
            <div>
              <p className={`text-lg font-bold ${sc.text}`}>{sc.label}</p>
              <p className="mt-0.5 text-sm text-slate-500">
                共 {summary.total} 项建议
                <span className="mx-1 text-slate-300">·</span>
                <span className="text-red-500">高 {summary.by_severity.high}</span>
                <span className="mx-1 text-slate-300">/</span>
                <span className="text-amber-500">中 {summary.by_severity.medium}</span>
                <span className="mx-1 text-slate-300">/</span>
                <span className="text-sky-500">低 {summary.by_severity.low}</span>
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
                <FileText size={13} />
                {fileName}
              </p>
            </div>
          </div>

          {/* 结构总览 */}
          <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4 md:border-l md:border-slate-100 md:pl-6">
            {overview.map((o) => (
              <div key={o.label} className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500">{o.label}</span>
                <span
                  className={`text-sm font-semibold ${o.ok ? "text-slate-700" : "text-amber-600"}`}
                >
                  {o.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 操作 */}
        <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-100 pt-5">
          <button
            onClick={onGoPolish}
            disabled={navTarget !== null}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {navTarget === "polish" ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Pencil size={15} />
            )}
            {navTarget === "polish" ? "正在打开编辑器…" : "在线编辑"}
            {navTarget !== "polish" && <ArrowRight size={15} />}
          </button>
          <button
            onClick={onGoFormat}
            disabled={navTarget !== null}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {navTarget === "format" && <Loader2 size={15} className="animate-spin" />}
            {navTarget === "format" ? "正在准备…" : "去对齐格式"}
          </button>
          <button
            onClick={onReset}
            disabled={navTarget !== null}
            className="ml-auto inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-slate-500 transition hover:text-slate-700 disabled:opacity-60"
          >
            <RotateCcw size={15} />
            换一份
          </button>
        </div>
        {navError && (
          <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 ring-1 ring-red-100">
            {navError}
          </div>
        )}
      </div>

      {/* 过滤器 */}
      <div className="flex flex-wrap items-center gap-2">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              filter === f.key
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-slate-300"
            }`}
          >
            {f.label}
            <span className="ml-1.5 opacity-70">{f.count}</span>
          </button>
        ))}
      </div>

      {/* 问题清单 */}
      {summary.total === 0 ? (
        <div className="rounded-2xl border border-green-200 bg-green-50/50 p-10 text-center">
          <CheckCircle2 className="mx-auto text-green-500" size={40} />
          <p className="mt-3 text-base font-semibold text-green-700">没有检测到明显问题</p>
          <p className="mt-1 text-sm text-slate-500">
            体检只覆盖内容与结构层面的常见问题，最终仍以学校评阅要求为准。
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((issue, i) => (
            <IssueCard key={issue.id + i} issue={issue} />
          ))}
        </div>
      )}
    </div>
  );
}

function IssueCard({ issue }: { issue: CheckupIssue }) {
  const meta = SEVERITY_META[issue.severity];
  const Icon = meta.icon;
  return (
    <div className={`rounded-xl border border-slate-200 border-l-4 bg-white p-5 ${meta.border}`}>
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${meta.chip}`}>
          <Icon size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold">{issue.title}</h3>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.chip}`}>
              {meta.label}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
              {issue.category_label}
            </span>
          </div>
          <p className="mt-1.5 text-sm leading-6 text-slate-600">{issue.detail}</p>
          <p className="mt-2 flex items-start gap-1.5 text-sm leading-6 text-slate-500">
            <ArrowRight size={15} className="mt-1 shrink-0 text-slate-400" />
            <span>
              <span className="font-medium text-slate-600">建议：</span>
              {issue.suggestion}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.max(0, Math.min(100, score)) / 100);
  return (
    <div className="relative h-[88px] w-[88px]">
      <svg width="88" height="88" className="-rotate-90">
        <circle cx="44" cy="44" r={r} fill="none" stroke="#e2e8f0" strokeWidth="8" />
        <circle
          cx="44"
          cy="44"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold" style={{ color }}>
          {score}
        </span>
        <span className="text-[10px] text-slate-400">健康度</span>
      </div>
    </div>
  );
}
