"use client";

import { useState, useRef, useEffect, DragEvent, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Logo } from "@/components/Logo";
import { MusicPlayer } from "@/components/MusicPlayer";
import { CheckCircle2, ClipboardCheck, FileText, ListChecks } from "lucide-react";
import { useThesisStore, MODEL_TIERS } from "@/lib/store";
import { parseDocx } from "@/lib/api";
import { maskPhone, useAuthStore } from "@/lib/auth-store";

// 学院 → 格式模板。后续接入其他学院时在此追加 available 项。
const COLLEGES = [
  { value: "hulunbeier_univ", label: "呼伦贝尔学院 · 工学院", available: true },
];
const COMING_SOON = ["文学院", "经济管理学院", "教育科学学院", "美术学院"];

const PAPER_TOOL_MODULES = [
  {
    title: "提交前体检",
    status: "规划中",
    desc: "先识别结构、摘要、关键词与规范风险。",
    icon: ClipboardCheck,
  },
  {
    title: "AI 表达优化",
    status: "规划中",
    desc: "降低模板化表达，让语言更自然具体。",
    icon: ListChecks,
  },
  {
    title: "格式对齐",
    status: "已开放",
    desc: "最后统一版式、段落、目录与导出规则。",
    icon: FileText,
  },
];

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
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function startCreep() {
    // AI 是一次批量调用、时长不定（约 20~90s），用渐近曲线逼近 90%，
    // 完成时再补到 100%，给用户真实的进度感。
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
    <main className="relative min-h-screen overflow-x-hidden bg-gradient-to-br from-slate-50 via-indigo-50 to-cyan-50">
      {/* 顶栏品牌 */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 md:px-10">
        <Logo />
        <div className="flex items-center gap-3 md:gap-4">
          <button
            onClick={() => router.push("/")}
            className="rounded-xl border border-slate-200 bg-white/80 px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-white md:text-base"
          >
            返回首页
          </button>
          {phone ? (
            <>
              <button
                onClick={() => router.push("/dashboard")}
                className="rounded-xl border border-cyan-200 bg-white/80 px-4 py-2.5 text-sm font-semibold text-cyan-700 shadow-sm transition hover:bg-cyan-50 md:text-base"
              >
                我的工作台
              </button>
              <span className="hidden text-sm font-medium text-slate-500 sm:block md:text-base">
                {maskPhone(phone)}
              </span>
              <button
                onClick={() => logout()}
                className="rounded-xl border border-slate-200 bg-white/80 px-4 py-2.5 text-sm font-semibold text-slate-500 shadow-sm transition hover:border-red-200 hover:text-red-500 md:text-base"
              >
                退出登录
              </button>
            </>
          ) : (
            <button
              onClick={() => router.push("/login")}
              className="rounded-xl border border-indigo-200 bg-white/80 px-4 py-2.5 text-sm font-semibold text-indigo-600 shadow-sm transition hover:bg-indigo-50 md:text-base"
            >
              登录 / 注册
            </button>
          )}
        </div>
      </nav>

      <div className="relative z-10 flex flex-col items-center px-6 pb-16 pt-6 md:pt-12">
        <div className="w-full max-w-2xl">
          <header className="mb-8 text-center">
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-indigo-600 shadow-sm ring-1 ring-indigo-100">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              论文相关工具 · 无需登录
            </div>
            <h1 className="bg-gradient-to-r from-indigo-600 to-cyan-500 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent">
              论文工具空间
            </h1>
            <p className="mt-3 text-slate-500">
              提交前体检 → AI 表达优化 → 格式对齐。当前先开放格式对齐，后续模块会继续接入。
            </p>
          </header>

          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            {PAPER_TOOL_MODULES.map((tool) => {
              const Icon = tool.icon;
              const active = tool.status === "已开放";
              return (
                <div
                  key={tool.title}
                  className={`rounded-2xl border bg-white/75 p-4 shadow-sm backdrop-blur ${
                    active ? "border-indigo-200" : "border-slate-200 opacity-75"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-white">
                      <Icon size={18} />
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                      {active && <CheckCircle2 size={12} />}
                      {tool.status}
                    </span>
                  </div>
                  <div className="mt-3 text-sm font-semibold text-slate-800">{tool.title}</div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{tool.desc}</p>
                </div>
              );
            })}
          </div>

          {/* 学院选择 */}
          <div className="mb-4 flex items-center justify-center gap-3">
            <label className="text-sm font-medium text-slate-600">论文标准</label>
            <Select
              value={template}
              disabled={loading}
              onChange={(e) => setTemplate(e.target.value)}
              className="h-10 min-w-[15rem]"
            >
              <optgroup label="现行可用">
                {COLLEGES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="陆续接入（敬请期待）">
                {COMING_SOON.map((c) => (
                  <option key={c} value={c} disabled>
                    呼伦贝尔学院 · {c}
                  </option>
                ))}
              </optgroup>
            </Select>
          </div>

          {/* 识别模型档位（价格仅展示，暂不扣费） */}
          <div className="mb-5">
            <div className="mb-2 flex items-center justify-center gap-2 text-sm font-medium text-slate-600">
              识别模型
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-normal text-slate-400">
                选择档位后付费使用
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
                      relative rounded-2xl border-2 p-3 text-left transition
                      ${active
                        ? "border-indigo-500 bg-indigo-50/80 shadow-sm"
                        : "border-slate-200 bg-white/70 hover:border-indigo-300"}
                      ${loading ? "cursor-not-allowed opacity-60" : "cursor-pointer"}
                    `}
                  >
                    {m.recommended && (
                      <span className="absolute -top-2 right-3 rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow">
                        推荐
                      </span>
                    )}
                    {m.value === "economy" && (
                      <span className="absolute -top-2 right-3 rounded-full bg-orange-400 px-2 py-0.5 text-[10px] font-semibold text-white shadow">
                        低精度
                      </span>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-700">{m.label}</span>
                      <span className={`text-xs font-medium ${active ? "text-indigo-600" : "text-slate-400"}`}>
                        {m.price}
                      </span>
                    </div>
                    <div className="mt-1 text-xs leading-snug text-slate-400">{m.desc}</div>
                  </button>
                );
              })}
            </div>
            {tier === "economy" && (
              <div className="mt-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-700">
                ⚠️ 经济版使用规则识别，无需联网，但识别率约 70%，需在确认页面较多手动纠错。
                如论文排版复杂，建议改用标准版或旗舰版。
              </div>
            )}
          </div>

          {/* 上传区 */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              if (!loading) setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => !loading && inputRef.current?.click()}
            className={`
              group cursor-pointer rounded-3xl border-2 border-dashed bg-white/80 p-14 text-center shadow-sm backdrop-blur transition
              ${dragOver ? "border-indigo-500 bg-indigo-50/80 scale-[1.01]" : "border-slate-300 hover:border-indigo-400 hover:bg-white"}
              ${loading ? "pointer-events-none opacity-60" : ""}
            `}
          >
            <input ref={inputRef} type="file" accept=".docx" className="hidden" onChange={onChange} />
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500 text-3xl shadow-lg shadow-indigo-200 transition group-hover:scale-105">
              📄
            </div>
            <p className="mb-1 text-lg font-semibold text-slate-700">
              点击或拖拽上传 .docx 论文文件
            </p>
            <p className="text-sm text-slate-400">
              文件仅用于本次格式化，处理后不长期保存
            </p>
          </div>

          {/* AI 进度条 */}
          {loading && (
            <div className="mt-6 rounded-2xl border border-indigo-100 bg-white/90 p-5 shadow-sm">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="flex items-center font-medium text-indigo-700">
                  <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent align-middle" />
                  {progressText || "处理中..."}
                </span>
                <span className="tabular-nums text-slate-400">{Math.round(progress)}%</span>
              </div>
              <Progress
                value={progress}
                barClassName="bg-gradient-to-r from-indigo-500 to-cyan-500"
              />
            </div>
          )}

          {error && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
              ⚠️ {error}
            </div>
          )}

          {!loading && (
            <div className="mt-8 text-center">
              <Button variant="outline" onClick={() => inputRef.current?.click()}>
                选择文件
              </Button>
            </div>
          )}

          {/* 特性 */}
          <div className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { t: "AI 智能分块", d: "通读全文识别五大块与段落类型" },
              { t: "逐段可控", d: "分块确认 · 增删段落 · A4 实时预览" },
              { t: "规范导出", d: "中英混排 · 三线表 · 分页 · 导航目录" },
            ].map((f) => (
              <div
                key={f.t}
                className="rounded-2xl border border-white bg-white/70 p-4 text-center shadow-sm backdrop-blur"
              >
                <div className="text-sm font-semibold text-slate-700">{f.t}</div>
                <div className="mt-1 text-xs text-slate-400">{f.d}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <footer className="relative z-10 pb-8 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} 同乐科技 · TONGLE TECH · 论文格式自动化
      </footer>
      <MusicPlayer />
    </main>
  );
}
