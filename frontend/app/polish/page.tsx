"use client";

import { useState, useRef, useEffect, useCallback, ChangeEvent, CSSProperties, DragEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Logo } from "@/components/Logo";
import { MusicPlayer } from "@/components/MusicPlayer";
import { CheckCircle2, Download, FileText, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { usePolishStore, type PolishSelection } from "@/lib/polish-store";
import {
  importPolishDocx,
  rewritePolishText,
  exportPolishedDocx,
  POLISH_ACTIONS,
  type PolishAction,
} from "@/lib/polish-api";

// 计算 (node, offset) 相对某个块元素起点的字符下标（兼容多文本节点）
function offsetWithin(blockEl: Element, node: Node, offset: number): number {
  const range = document.createRange();
  range.selectNodeContents(blockEl);
  range.setEnd(node, offset);
  return range.toString().length;
}

function closestBlock(node: Node | null): HTMLElement | null {
  let el: Node | null = node;
  while (el && el !== document.body) {
    if (el instanceof HTMLElement && el.dataset.blockId) return el;
    el = el.parentNode;
  }
  return null;
}

export default function PolishPage() {
  const router = useRouter();
  const {
    fileName,
    docxBase64,
    blocks,
    selection,
    pendingRewrite,
    rewriteLoading,
    rewriteError,
    setSource,
    setSelection,
    setRewriteLoading,
    setRewriteError,
    setPendingRewrite,
    applyRewrite,
    restoreBlock,
  } = usePolishStore();

  const inputRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLDivElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastAction, setLastAction] = useState<PolishAction | null>(null);
  const [toolbar, setToolbar] = useState<{ top: number; left: number } | null>(null);

  const hasDoc = blocks.length > 0;
  const changedCount = blocks.filter((b) => b.changed).length;
  const selectedBlock = selection ? blocks.find((b) => b.id === selection.blockId) : null;

  // ---------------- 选区捕获 ----------------
  const captureSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !docRef.current) return;
    const range = sel.getRangeAt(0);
    const startEl = closestBlock(range.startContainer);
    if (!startEl || !docRef.current.contains(startEl)) {
      return; // 选区不在文档内，保持当前状态
    }
    const blockId = startEl.dataset.blockId!;
    const editable = startEl.dataset.editable === "true";

    // 折叠（单击）：选中整段
    if (sel.isCollapsed) {
      if (!editable) {
        setSelection(null);
        setToolbar(null);
        return;
      }
      const text = startEl.textContent ?? "";
      setSelection({ blockId, start: 0, end: text.length, text, whole: true });
      setToolbar(null);
      return;
    }

    const endEl = closestBlock(range.endContainer);
    if (endEl !== startEl) {
      setSelection(null);
      setToolbar(null);
      setRewriteError("暂只支持在同一段落内选择文字，请缩小选择范围");
      return;
    }
    if (!editable) {
      setSelection(null);
      setToolbar(null);
      return;
    }
    const start = offsetWithin(startEl, range.startContainer, range.startOffset);
    const end = offsetWithin(startEl, range.endContainer, range.endOffset);
    const full = startEl.textContent ?? "";
    const text = full.slice(start, end);
    if (!text.trim()) {
      setToolbar(null);
      return;
    }
    setSelection({ blockId, start, end, text, whole: false });

    // 浮动工具条定位在选区上方
    const rect = range.getBoundingClientRect();
    const top = rect.top > 60 ? rect.top - 48 : rect.bottom + 8;
    const left = Math.min(Math.max(rect.left, 12), window.innerWidth - 360);
    setToolbar({ top, left });
  }, [setSelection, setRewriteError]);

  // 滚动时隐藏浮动工具条（fixed 定位会错位）
  useEffect(() => {
    if (!toolbar) return;
    const onScroll = () => setToolbar(null);
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [toolbar]);

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

  async function runRewrite(action: PolishAction, sel: PolishSelection | null) {
    if (!sel || !sel.text.trim()) return;
    setLastAction(action);
    setToolbar(null);
    setRewriteError("");
    setPendingRewrite(null);
    setRewriteLoading(true);
    try {
      const res = await rewritePolishText(sel.text, action);
      setPendingRewrite({
        ...res,
        blockId: sel.blockId,
        start: sel.start,
        end: sel.end,
        selectedText: sel.text,
      });
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
                论文表达润色 · 选中即改
              </div>
              <h1 className="bg-gradient-to-r from-indigo-600 to-cyan-500 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent">
                论文表达润色
              </h1>
              <p className="mt-3 text-slate-500">
                上传 Word 论文，像在线文档一样阅读全文，选中任意文字进行学术润色、压缩、扩写和逻辑优化，确认后导出 Word。
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
  // 编辑页：左侧连续文档 + 右侧结果栏 + 浮动工具条
  // ============================================================
  return (
    <main className="relative min-h-screen bg-slate-100">
      <nav className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur md:px-8">
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

      <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[1fr_360px] lg:px-8">
        {/* 左侧：连续文档（A4 纸张观感） */}
        <div className="flex justify-center">
          <div
            ref={docRef}
            onMouseUp={captureSelection}
            className="w-full max-w-[820px] rounded-sm bg-white px-[8%] py-16 shadow-md"
            style={{ fontFamily: '"Songti SC", "SimSun", "Noto Serif SC", serif' }}
          >
            {blocks.map((b) => {
              if (b.kind === "table") {
                return (
                  <div key={b.id} className="my-4 select-none">
                    {b.cells && b.cells.length > 0 ? (
                      <table className="w-full border-collapse text-[13px] text-slate-600">
                        <tbody>
                          {b.cells.map((row, ri) => (
                            <tr key={ri}>
                              {row.map((c, ci) => (
                                <td
                                  key={ci}
                                  className="border border-slate-300 px-2 py-1 align-middle"
                                >
                                  {c}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="rounded border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-center text-xs text-slate-400">
                        ［表格］
                      </div>
                    )}
                    <div className="mt-1 text-center text-[11px] text-slate-300">
                      表格不参与在线润色，导出时原样保留
                    </div>
                  </div>
                );
              }

              // 用原始段落样式还原 Word 观感（对齐/加粗/字号/缩进）
              const st = b.style;
              const sizePt = st?.size_pt ?? 12;
              const pstyle: CSSProperties = {
                textAlign: (st?.align || "left") as CSSProperties["textAlign"],
                fontWeight: st?.bold ? 700 : 400,
                fontSize: `${sizePt}pt`,
                textIndent: st?.first_line_cm ? `${st.first_line_cm}cm` : 0,
                marginLeft: st?.left_cm ? `${st.left_cm}cm` : 0,
                lineHeight: 1.7,
                marginBottom: "0.35em",
              };

              if (!b.text) {
                // 空段落：呈现为空行（按本段字号占位），不可选
                return <p key={b.id} style={{ fontSize: `${sizePt}pt`, lineHeight: 1.7 }}>&nbsp;</p>;
              }

              const isSel = selection?.blockId === b.id;
              return (
                <p
                  key={b.id}
                  data-block-id={b.id}
                  data-editable="true"
                  className={`whitespace-pre-wrap text-slate-800 transition-colors ${
                    b.changed ? "bg-emerald-50" : ""
                  } ${isSel ? "rounded-sm ring-1 ring-indigo-200" : ""}`}
                  style={pstyle}
                >
                  {b.text}
                </p>
              );
            })}
          </div>
        </div>

        {/* 右侧：结果 / 操作栏 */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            {!selection ? (
              <div className="py-12 text-center text-sm leading-relaxed text-slate-400">
                <Sparkles className="mx-auto mb-3 text-slate-300" size={24} />
                用鼠标选中文档里的任意文字，
                <br />
                即可对选中部分进行润色。
                <br />
                <span className="text-xs text-slate-300">（单击某段可选中整段）</span>
              </div>
            ) : (
              <>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {selection.whole ? "当前整段" : "选中的文字"}
                  </span>
                  <span className="text-xs text-slate-300">{selection.text.length} 字</span>
                </div>
                <div className="mb-4 max-h-32 overflow-y-auto rounded-lg bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-600">
                  {selection.text}
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
                      onClick={() => runRewrite(a.value, selection)}
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

                {pendingRewrite && !rewriteLoading && (
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
                        onClick={() =>
                          applyRewrite(
                            pendingRewrite.blockId,
                            pendingRewrite.start,
                            pendingRewrite.end,
                            pendingRewrite.rewritten_text
                          )
                        }
                      >
                        <CheckCircle2 className="mr-1.5" size={15} /> 接受修改
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => runRewrite(pendingRewrite.action, selection)}
                      >
                        <RotateCcw className="mr-1.5" size={15} /> 重新生成
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setPendingRewrite(null)}>
                        取消
                      </Button>
                    </div>
                  </div>
                )}

                {selectedBlock?.changed && (
                  <div className="mt-4 border-t border-slate-100 pt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => restoreBlock(selection.blockId)}
                    >
                      <RotateCcw className="mr-1.5" size={15} /> 还原本段原文
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* 浮动工具条：拖选文字后出现 */}
      {toolbar && selection && !selection.whole && (
        <div
          className="fixed z-40 flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
          style={{ top: toolbar.top, left: toolbar.left }}
          onMouseDown={(e) => e.preventDefault()} // 防止点击按钮时清空选区
        >
          {POLISH_ACTIONS.map((a) => (
            <button
              key={a.value}
              type="button"
              title={a.desc}
              onClick={() => runRewrite(a.value, selection)}
              className="whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-indigo-50 hover:text-indigo-600"
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
      <MusicPlayer />
    </main>
  );
}
