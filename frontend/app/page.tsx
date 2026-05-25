"use client";

import { useState, useRef, useEffect, DragEvent, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Progress } from "@/components/ui/progress";
import { Logo } from "@/components/Logo";
import { useThesisStore, MODEL_TIERS } from "@/lib/store";
import { parseDocx } from "@/lib/api";
import { useAuthStore, maskPhone } from "@/lib/auth-store";

const COLLEGES = [
  { value: "hulunbeier_univ", label: "呼伦贝尔学院 · 工学院", available: true },
];
const COMING_SOON = ["文学院", "经济管理学院", "教育科学学院", "美术学院"];

function AuroraBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="aurora-orb aurora-orb-1" />
      <div className="aurora-orb aurora-orb-2" />
      <div className="aurora-orb aurora-orb-3" />
      <div className="aurora-orb aurora-orb-4" />
      <div className="aurora-grid absolute inset-0" />
    </div>
  );
}

export default function UploadPage() {
  const router = useRouter();
  const { phone, logout } = useAuthStore();
  const setSource = useThesisStore((s) => s.setSource);
  const template = useThesisStore((s) => s.template);
  const setTemplate = useThesisStore((s) => s.setTemplate);
  const tier = useThesisStore((s) => s.tier);
  const setTier = useThesisStore((s) => s.setTier);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [progressText, setProgressText] = useState("");
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  function startCreep() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setProgress((p) => (p >= 90 ? p : p + Math.max(0.5, (90 - p) * 0.05)));
    }, 500);
  }

  async function handleFile(file: File) {
    setError("");
    if (!file.name.toLowerCase().endsWith(".docx")) {
      setError("仅支持 .docx 文件");
      return;
    }
    setLoading(true);
    setProgress(6);
    setProgressText("正在读取文件...");
    try {
      const buf = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buf).reduce((acc, b) => acc + String.fromCharCode(b), "")
      );
      setProgress(18);
      setProgressText("AI 正在通读全文，批量识别每段类型...");
      startCreep();
      const data = await parseDocx(file, tier);
      if (timerRef.current) clearInterval(timerRef.current);
      setProgress(100);
      setProgressText("识别完成，正在进入分块确认...");
      setSource(file.name, base64, data.paragraphs);
      router.push("/review");
    } catch (e: unknown) {
      if (timerRef.current) clearInterval(timerRef.current);
      setError(e instanceof Error ? e.message : String(e));
      setLoading(false);
      setProgress(0);
      setProgressText("");
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (loading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#060614] text-white">
      <AuroraBackground />

      <div className="relative z-10">
        {/* Nav */}
        <nav className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4 backdrop-blur-sm md:px-10">
          <Logo />
          <div className="flex items-center gap-3">
            {phone ? (
              <>
                <span className="hidden text-xs text-slate-400 sm:block">{maskPhone(phone)}</span>
                <button
                  onClick={() => logout()}
                  className="rounded-lg border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs text-slate-400 transition hover:border-red-500/30 hover:text-red-400"
                >
                  退出登录
                </button>
              </>
            ) : (
              <button
                onClick={() => router.push("/login")}
                className="rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-3 py-1.5 text-xs text-indigo-300 transition hover:bg-indigo-500/20"
              >
                登录 / 注册
              </button>
            )}
          </div>
        </nav>

        <div className="flex flex-col items-center px-6 pb-16 pt-6 md:pt-12">
          <div className="w-full max-w-2xl">

            {/* Hero */}
            <header className="mb-10 text-center">
              <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-indigo-500/25 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
                一键对齐高校论文格式标准
              </div>
              <h1 className="bg-gradient-to-r from-indigo-300 via-white to-cyan-300 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent md:text-5xl">
                论文格式化工具
              </h1>
              <p className="mt-3 text-slate-400">
                上传 .docx → AI 批量识别分块 → 逐段确认 → 一键导出规范论文
              </p>
            </header>

            {/* 学院选择 */}
            <div className="mb-4 flex items-center justify-center gap-3">
              <label className="text-sm font-medium text-slate-400">论文标准</label>
              <select
                value={template}
                disabled={loading}
                onChange={(e) => setTemplate(e.target.value)}
                className="h-10 min-w-[15rem] rounded-xl border border-white/10 bg-white/[0.06] px-3 text-sm text-slate-200 backdrop-blur-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/50 disabled:opacity-50"
              >
                <optgroup label="现行可用">
                  {COLLEGES.map((c) => (
                    <option key={c.value} value={c.value} className="bg-slate-900">{c.label}</option>
                  ))}
                </optgroup>
                <optgroup label="陆续接入（敬请期待）">
                  {COMING_SOON.map((c) => (
                    <option key={c} value={c} disabled className="bg-slate-900">呼伦贝尔学院 · {c}</option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* 模型档位 */}
            <div className="mb-5">
              <div className="mb-2 flex items-center justify-center gap-2 text-sm font-medium text-slate-400">
                识别模型
                <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-xs font-normal text-slate-500">
                  价格仅展示，当前免费试用
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {MODEL_TIERS.map((m) => {
                  const active = tier === m.value;
                  return (
                    <button
                      key={m.value}
                      type="button"
                      disabled={loading}
                      onClick={() => setTier(m.value)}
                      className={`
                        relative rounded-2xl border-2 p-3 text-left transition duration-200
                        ${active
                          ? "border-indigo-500/60 bg-indigo-500/10 shadow-[0_0_24px_rgba(99,102,241,0.18)]"
                          : "border-white/[0.07] bg-white/[0.03] hover:border-white/[0.18] hover:bg-white/[0.07]"}
                        ${loading ? "cursor-not-allowed opacity-50" : "cursor-pointer"}
                      `}
                    >
                      {m.recommended && (
                        <span className="absolute -top-2 right-3 rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow">
                          推荐
                        </span>
                      )}
                      {m.value === "economy" && (
                        <span className="absolute -top-2 right-3 rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow">
                          低精度
                        </span>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-200">{m.label}</span>
                        <span className={`text-xs font-medium ${active ? "text-indigo-400" : "text-slate-500"}`}>
                          {m.price}
                        </span>
                      </div>
                      <div className="mt-1 text-xs leading-snug text-slate-500">{m.desc}</div>
                    </button>
                  );
                })}
              </div>
              {tier === "economy" && (
                <div className="mt-2 rounded-xl border border-orange-500/20 bg-orange-500/10 px-3 py-2 text-xs text-orange-300">
                  ⚠️ 经济版使用规则识别，无需联网，但识别率约 70%，需在确认页面较多手动纠错。如论文排版复杂，建议改用标准版或旗舰版。
                </div>
              )}
            </div>

            {/* 上传区 */}
            <div
              onDragOver={(e) => { e.preventDefault(); if (!loading) setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => !loading && inputRef.current?.click()}
              className={`
                group cursor-pointer rounded-3xl border-2 border-dashed p-14 text-center backdrop-blur-sm transition duration-300
                ${dragOver
                  ? "border-indigo-400/70 bg-indigo-500/10 shadow-[0_0_50px_rgba(99,102,241,0.25)]"
                  : "border-white/[0.10] bg-white/[0.03] hover:border-indigo-400/50 hover:bg-white/[0.06] hover:shadow-[0_0_40px_rgba(99,102,241,0.15)]"}
                ${loading ? "pointer-events-none opacity-50" : ""}
              `}
            >
              <input ref={inputRef} type="file" accept=".docx" className="hidden" onChange={onChange} />
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500 text-3xl shadow-lg shadow-indigo-500/30 transition duration-300 group-hover:scale-110 group-hover:shadow-[0_8px_30px_rgba(99,102,241,0.5)]">
                📄
              </div>
              <p className="mb-1 text-lg font-semibold text-slate-200">
                点击或拖拽上传 .docx 论文文件
              </p>
              <p className="text-sm text-slate-500">
                文件仅用于本次格式化，处理后不长期保存
              </p>
            </div>

            {/* 进度条 */}
            {loading && (
              <div className="mt-6 rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.07] p-5">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="flex items-center font-medium text-indigo-300">
                    <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
                    {progressText || "处理中..."}
                  </span>
                  <span className="tabular-nums text-slate-500">{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} barClassName="bg-gradient-to-r from-indigo-500 to-cyan-500" />
              </div>
            )}

            {error && (
              <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-400">
                ⚠️ {error}
              </div>
            )}

            {!loading && (
              <div className="mt-8 text-center">
                <button
                  onClick={() => inputRef.current?.click()}
                  className="rounded-xl border border-white/10 bg-white/[0.06] px-5 py-2 text-sm text-slate-300 transition hover:border-white/20 hover:bg-white/[0.10]"
                >
                  选择文件
                </button>
              </div>
            )}

            {/* 特性卡 */}
            <div className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { t: "AI 智能分块", d: "通读全文识别五大块与段落类型" },
                { t: "逐段可控", d: "分块确认 · 增删段落 · A4 实时预览" },
                { t: "规范导出", d: "中英混排 · 三线表 · 分页 · 导航目录" },
              ].map((f) => (
                <div
                  key={f.t}
                  className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 text-center backdrop-blur-sm transition hover:border-white/[0.10] hover:bg-white/[0.05]"
                >
                  <div className="text-sm font-semibold text-slate-200">{f.t}</div>
                  <div className="mt-1 text-xs text-slate-500">{f.d}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <footer className="pb-8 text-center text-xs text-slate-600">
          © {new Date().getFullYear()} 同乐科技 · TONGLE TECH · 论文格式自动化
        </footer>
      </div>
    </main>
  );
}
