"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import type { Paragraph } from "@/lib/api";
import { blockOf, type BlockKey, useThesisStore } from "@/lib/store";
import { FormattedParagraph } from "./BlockPreview";

/**
 * 前后对比预览
 * 左侧：docx-preview 高保真渲染原始 Word 文档（直接还原上传时的排版）
 * 右侧：格式化结果（本系统重构后的排版，FormattedParagraph）
 * 两侧按比例联动滚动
 */

const BLOCK_LABEL: Record<BlockKey, string> = {
  toc: "目录",
  abstract: "摘要",
  body: "正文",
  conclusion: "总结",
  references: "参考文献",
};

const A4_PADDING: CSSProperties = {
  paddingTop: "8%",
  paddingBottom: "8%",
  paddingLeft: "12%",
  paddingRight: "9%",
};

interface Props {
  paragraphs: Paragraph[]; // 已按 index 升序，用于右侧格式化预览
  onClose: () => void;
}

export function CompareView({ paragraphs, onClose }: Props) {
  const docxBase64 = useThesisStore((s) => s.docxBase64);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const docxContainerRef = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);

  // 用 docx-preview 在左侧高保真渲染原始 Word 文档
  useEffect(() => {
    const container = docxContainerRef.current;
    if (!docxBase64 || !container) return;

    // base64 → ArrayBuffer
    const binary = atob(docxBase64);
    const buf = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);

    import("docx-preview")
      .then(({ renderAsync }) =>
        renderAsync(buf.buffer, container, undefined, {
          inWrapper: true,       // 带页面阴影边框
          ignoreWidth: false,    // 按原始纸张宽度渲染
          ignoreHeight: true,    // 高度连续滚动，不截断成独立页
          renderHeaders: false,
          renderFooters: false,
          renderFootnotes: false,
          debug: false,
        })
      )
      .catch((err) => {
        if (container) container.innerHTML = `<p style="color:#ef4444;padding:16px">原文渲染失败：${err}</p>`;
      });
  }, [docxBase64]);

  // 按比例联动：源侧滚动比例 → 目标侧 scrollTop（两侧高度不同也能对齐）
  function sync(from: "l" | "r") {
    const src = from === "l" ? leftRef.current : rightRef.current;
    const dst = from === "l" ? rightRef.current : leftRef.current;
    if (!src || !dst || syncing.current) return;
    syncing.current = true;
    const denom = src.scrollHeight - src.clientHeight;
    const ratio = denom > 0 ? src.scrollTop / denom : 0;
    dst.scrollTop = ratio * (dst.scrollHeight - dst.clientHeight);
    requestAnimationFrame(() => { syncing.current = false; });
  }

  // 渲染时插入大块分隔（右侧体现「另起一页」）
  let prevBlock: BlockKey | null = null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex flex-col p-3 md:p-6">
      <div className="flex items-center justify-between mb-3 text-white">
        <div>
          <h2 className="text-lg font-bold">前后对比预览</h2>
          <p className="text-xs text-slate-300 mt-0.5">
            左：原始Word排版 · 右：格式化结果 · 左右联动滚动（最终以下载的 Word 为准）
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-md bg-white/10 hover:bg-white/20 px-4 py-2 text-sm font-medium transition"
        >
          关闭
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">
        {/* 左：原始 Word 文档（docx-preview 高保真渲染） */}
        <div className="flex flex-col min-h-0 rounded-xl bg-white overflow-hidden shadow-lg">
          <div className="border-b bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 shrink-0">
            上传原文（原始排版）
          </div>
          <div
            ref={leftRef}
            onScroll={() => sync("l")}
            className="flex-1 min-h-0 overflow-y-auto bg-slate-200 p-2"
          >
            <div
              ref={docxContainerRef}
              className="bg-white min-h-full"
              style={{ fontSize: "11pt" }}
            />
          </div>
        </div>

        {/* 右：格式化结果（FormattedParagraph） */}
        <div className="flex flex-col min-h-0 rounded-xl bg-white overflow-hidden shadow-lg">
          <div className="border-b bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 shrink-0">
            格式化结果（重构排版）
          </div>
          <div
            ref={rightRef}
            onScroll={() => sync("r")}
            className="flex-1 min-h-0 overflow-y-auto bg-slate-200 p-4"
          >
            <div style={{ ...A4_PADDING, background: "white", minHeight: "100%" }}>
              <div className="space-y-2">
                {paragraphs.map((p) => {
                  const blk = (p.block as BlockKey) || blockOf(p.type);
                  const isNewBlock = prevBlock !== null && blk !== prevBlock;
                  prevBlock = blk;
                  return (
                    <div key={p.index}>
                      {isNewBlock && (
                        <div className="my-3 border-t border-dashed border-orange-300 text-xs text-orange-600 text-center bg-orange-50 py-1">
                          ↳ 另起一页（{BLOCK_LABEL[blk]}）
                        </div>
                      )}
                      <FormattedParagraph p={p} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
