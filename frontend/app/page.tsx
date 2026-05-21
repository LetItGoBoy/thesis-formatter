"use client";

import { useState, useRef, useEffect, DragEvent, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Logo } from "@/components/Logo";
import { useThesisStore } from "@/lib/store";
import { parseDocx } from "@/lib/api";

// 学院 → 格式模板。后续接入其他学院时在此追加 available 项。
const COLLEGES = [
  { value: "hulunbeier_univ", label: "呼伦贝尔学院 · 工学院", available: true },
];
const COMING_SOON = ["文学院", "经济管理学院", "教育科学学院", "美术学院"];

export default function UploadPage() {
  const router = useRouter();
  const setSource = useThesisStore((s) => s.setSource);
  const template = useThesisStore((s) => s.template);
  const setTemplate = useThesisStore((s) => s.setTemplate);
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
      const data = await parseDocx(file);
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
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-cyan-50">
      {/* 顶栏品牌 */}
      <nav className="flex items-center justify-between px-6 py-4 md:px-10">
        <Logo />
        <span className="hidden text-xs text-slate-400 sm:block">论文格式自动化平台</span>
      </nav>

      <div className="flex flex-col items-center px-6 pb-16 pt-6 md:pt-12">
        <div className="w-full max-w-2xl">
          <header className="mb-8 text-center">
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-indigo-600 shadow-sm ring-1 ring-indigo-100">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              一键对齐高校论文格式标准
            </div>
            <h1 className="bg-gradient-to-r from-indigo-600 to-cyan-500 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent">
              论文格式化工具
            </h1>
            <p className="mt-3 text-slate-500">
              上传 .docx → AI 批量识别分块 → 逐段确认 → 一键导出规范论文
            </p>
          </header>

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

      <footer className="pb-8 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} 同乐科技 · TONGLE TECH · 论文格式自动化
      </footer>
    </main>
  );
}
