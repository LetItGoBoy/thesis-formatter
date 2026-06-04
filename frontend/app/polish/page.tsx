"use client";

import { useState, useRef, ChangeEvent, DragEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Logo } from "@/components/Logo";
import { MusicPlayer } from "@/components/MusicPlayer";
import { CheckCircle2, Download, FileText, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { usePolishStore } from "@/lib/polish-store";
import {
  importPolishDocx,
  rewritePolishText,
  exportPolishedDocx,
  POLISH_ACTIONS,
  type PolishAction,
} from "@/lib/polish-api";

export default function PolishPage() {
  const router = useRouter();
  const {
    fileName,
    docxBase64,
    blocks,
    selectedBlockId,
    pendingRewrite,
    rewriteLoading,
    rewriteError,
    setSource,
    selectBlock,
    setRewriteLoading,
    setRewriteError,
    setPendingRewrite,
    applyRewrite,
    restoreBlock,
  } = usePolishStore();

  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastAction, setLastAction] = useState<PolishAction | null>(null);

  const hasDoc = blocks.length > 0;
  const selected = blocks.find((b) => b.id === selectedBlockId) || null;
  const changedCount = blocks.filter((b) => b.changed).length;

  async function handleFile(file: File) {
    setUploadError("");
    if (!file.name.toLowerCase().endsWith(".docx")) {
      setUploadError("仅支持 .docx 文件");
      return;
    }
    setUploading(true);
    try {
      const data = await importPolishDocx(file);
      setSource(data.file_name, data.docx_base64, data.blocks);
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  async function runRewrite(action: PolishAction) {
    if (!selected) return;
    setLastAction(action);
    setRewriteError("");
    setPendingRewrite(null);
    setRewriteLoading(true);
    try {
      const res = await rewritePolishText(selected.text, action);
      setPendingRewrite({ ...res, blockId: selected.id });
    } catch (e: unknown) {
      setRewriteError(e instanceof Error ? e.message : String(e));
    } finally {
      setRewriteLoading(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const blob = await exportPolishedDocx(docxBase64, blocks);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "polished.docx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  }

  // ============================================================
  // 上传页
  // ============================================================
  if (!hasDoc) {
    return (
      <main className="relative min-h-screen overflow-x-hidden bg-gradient-to-br from-slate-50 via-indigo-50 to-cyan-50">
        <nav className="relative z-10 flex items-center justify-between px-6 py-4 md:px-10">
          <Logo />
          <button
            onClick={() => router.push("/tools")}
            className="rounded-xl border border-slate-200 bg-white/80 px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-white"
          >
            返回工具空间
          </button>
        </nav>

        <div className="relative z-10 flex flex-col items-center px-6 pb-16 pt-6 md:pt-12">
          <div className="w-full max-w-2xl">
            <header className="mb-8 text-center">
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-indigo-600 shadow-sm ring-1 ring-indigo-100">
                <Sparkles size={14} />
                论文表达润色 · 逐段可控
              </div>
              <h1 className="bg-gradient-to-r from-indigo-600 to-cyan-500 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent">
                论文表达润色
              </h1>
              <p className="mt-3 text-slate-500">
                上传 Word 论文，按段落进行学术润色、压缩、扩写和逻辑优化，支持修改前后确认并导出 Word。
              </p>
            </header>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                if (!uploading) setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => !uploading && inputRef.current?.click()}
              className={`group cursor-pointer rounded-3xl border-2 border-dashed bg-white/80 p-14 text-center shadow-sm backdrop-blur transition ${
                dragOver
                  ? "border-indigo-500 bg-indigo-50/80 scale-[1.01]"
                  : "border-slate-300 hover:border-indigo-400 hover:bg-white"
              } ${uploading ? "pointer-events-none opacity-60" : ""}`}
            >
              <input ref={inputRef} type="file" accept=".docx" className="hidden" onChange={onChange} />
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500 text-3xl shadow-lg shadow-indigo-200 transition group-hover:scale-105">
                {uploading ? <Loader2 className="animate-spin text-white" size={28} /> : "✍️"}
              </div>
              <p className="mb-1 text-lg font-semibold text-slate-700">
                {uploading ? "正在解析文档..." : "点击或拖拽上传 .docx 论文文件"}
              </p>
              <p className="text-sm text-slate-400">上传后只做基础解析，不会自动调用 AI</p>
            </div>

            {uploadError && (
              <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
                ⚠️ {uploadError}
              </div>
            )}

            {!uploading && (
              <div className="mt-8 text-center">
                <Button variant="outline" onClick={() => inputRef.current?.click()}>
                  上传论文开始润色
                </Button>
              </div>
            )}
          </div>
        </div>
        <MusicPlayer />
      </main>
    );
  }

  // ============================================================
  // 编辑页
  // ============================================================
  return (
    <main className="relative min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-cyan-50">
      <nav className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur md:px-8">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="hidden items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-600 md:inline-flex">
            <FileText size={13} />
            {fileName}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">
            已修改 <span className="font-semibold text-indigo-600">{changedCount}</span> 段
          </span>
          <Button onClick={handleExport} disabled={exporting}>
            {exporting ? (
              <Loader2 className="mr-1.5 animate-spin" size={16} />
            ) : (
              <Download className="mr-1.5" size={16} />
            )}
            导出 Word
          </Button>
        </div>
      </nav>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 py-6 md:grid-cols-[1fr_400px] md:px-8">
        {/* 左侧：全文 blocks */}
        <div className="space-y-3">
          {blocks.map((b) => {
            if (b.kind === "table") {
              return (
                <div
                  key={b.id}
                  className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-400"
                >
                  📊 表格内容暂不支持在线润色，导出时会保留原表格
                </div>
              );
            }
            const isSelected = b.id === selectedBlockId;
            const isEmpty = !b.text;
            return (
              <div
                key={b.id}
                onClick={() => b.editable && selectBlock(b.id)}
                className={`rounded-xl border bg-white px-4 py-3 text-sm leading-relaxed shadow-sm transition ${
                  isEmpty
                    ? "cursor-default border-slate-100 text-slate-300"
                    : "cursor-pointer text-slate-700"
                } ${
                  isSelected
                    ? "border-indigo-400 ring-2 ring-indigo-200"
                    : b.editable
                    ? "border-slate-200 hover:border-indigo-300"
                    : ""
                } ${b.changed ? "border-l-4 border-l-emerald-400" : ""}`}
              >
                {isEmpty ? (
                  <span className="italic">（空段落）</span>
                ) : (
                  <>
                    <div className="whitespace-pre-wrap">{b.text}</div>
                    {b.changed && (
                      <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600">
                        <CheckCircle2 size={12} /> 已修改
                      </span>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* 右侧：操作面板 */}
        <div className="md:sticky md:top-20 md:self-start">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            {!selected ? (
              <div className="py-12 text-center text-sm text-slate-400">
                ← 点击左侧任意段落开始润色
              </div>
            ) : (
              <>
                <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  当前段落原文
                </div>
                <div className="mb-4 max-h-40 overflow-y-auto rounded-lg bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-600">
                  {selected.text}
                </div>

                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  选择润色方式
                </div>
                <div className="mb-4 grid grid-cols-2 gap-2">
                  {POLISH_ACTIONS.map((a) => (
                    <button
                      key={a.value}
                      type="button"
                      disabled={rewriteLoading}
                      onClick={() => runRewrite(a.value)}
                      title={a.desc}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition disabled:opacity-50 ${
                        lastAction === a.value && rewriteLoading
                          ? "border-indigo-400 bg-indigo-50 text-indigo-600"
                          : "border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50/50"
                      }`}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>

                {rewriteLoading && (
                  <div className="flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-600">
                    <Loader2 className="animate-spin" size={16} /> AI 正在改写...
                  </div>
                )}

                {rewriteError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                    ⚠️ {rewriteError}
                  </div>
                )}

                {pendingRewrite && pendingRewrite.blockId === selected.id && !rewriteLoading && (
                  <div className="mt-1 space-y-3">
                    <div>
                      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        改写结果
                      </div>
                      <Textarea
                        value={pendingRewrite.rewritten_text}
                        onChange={(e) =>
                          setPendingRewrite({ ...pendingRewrite, rewritten_text: e.target.value })
                        }
                        rows={6}
                      />
                    </div>
                    {pendingRewrite.reason && (
                      <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                        <span className="font-semibold">修改原因：</span>
                        {pendingRewrite.reason}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => applyRewrite(selected.id, pendingRewrite.rewritten_text)}
                      >
                        <CheckCircle2 className="mr-1.5" size={15} /> 接受修改
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => runRewrite(pendingRewrite.action)}
                      >
                        <RotateCcw className="mr-1.5" size={15} /> 重新生成
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setPendingRewrite(null)}
                      >
                        取消
                      </Button>
                    </div>
                  </div>
                )}

                {selected.changed && (
                  <div className="mt-4 border-t border-slate-100 pt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => restoreBlock(selected.id)}
                    >
                      <RotateCcw className="mr-1.5" size={15} /> 还原原文
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      <MusicPlayer />
    </main>
  );
}
