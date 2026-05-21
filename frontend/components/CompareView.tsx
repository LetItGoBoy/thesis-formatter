"use client";

import { useRef } from "react";
import type { CSSProperties } from "react";
import type { Paragraph } from "@/lib/api";
import { blockOf, type BlockKey } from "@/lib/store";
import { FormattedParagraph } from "./BlockPreview";

/**
 * 前后对比预览：左「上传原文」（解析后的朴素文本）、右「格式化结果」（重构排版），
 * 两侧按比例联动滚动，便于一眼核对内容是否丢失、样式是否套对。
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

// 左侧「原文」：按原始 Word 格式属性渲染，还原上传时的样式
function PlainParagraph({ p }: { p: Paragraph }) {
  if (p.type === "figure" && p.image_b64) {
    return (
      <div style={{ textAlign: "center", padding: "4px 0" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={p.image_b64}
          alt="图片"
          style={{ maxWidth: "100%", maxHeight: "200px", display: "inline-block", objectFit: "contain" }}
        />
      </div>
    );
  }
  if (p.type === "table" && p.cells) {
    return (
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "10.5pt" }}>
        <tbody>
          {p.cells.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td key={c} style={{ border: "1px solid #cbd5e1", padding: "2px 6px" }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  const s = p.orig_style;
  // 1cm ≈ 37.8px（96dpi）
  const CM = 37.8;
  const textStyle: CSSProperties = {
    fontFamily: '"Times New Roman", "SimSun", "Songti SC", serif',
    fontSize: s ? `${s.font_size_pt}pt` : "12pt",
    fontWeight: s?.is_bold ? "bold" : "normal",
    textAlign: (s?.alignment ?? "left") as CSSProperties["textAlign"],
    paddingLeft: s && s.indent_cm > 0 ? `${s.indent_cm * CM}px` : undefined,
    textIndent: s && s.first_line_cm > 0 ? `${s.first_line_cm * CM}px` : undefined,
    lineHeight: 1.7,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  };
  return (
    <div style={textStyle}>
      {p.text || <span style={{ color: "#cbd5e1" }}>（空段）</span>}
    </div>
  );
}

interface Props {
  paragraphs: Paragraph[]; // 已按 index 升序
  onClose: () => void;
}

export function CompareView({ paragraphs, onClose }: Props) {
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);

  // 按比例联动：源侧滚动比例 → 目标侧 scrollTop（两侧高度不同也能对齐）
  function sync(from: "l" | "r") {
    const src = from === "l" ? leftRef.current : rightRef.current;
    const dst = from === "l" ? rightRef.current : leftRef.current;
    if (!src || !dst || syncing.current) return;
    syncing.current = true;
    const denom = src.scrollHeight - src.clientHeight;
    const ratio = denom > 0 ? src.scrollTop / denom : 0;
    dst.scrollTop = ratio * (dst.scrollHeight - dst.clientHeight);
    requestAnimationFrame(() => {
      syncing.current = false;
    });
  }

  // 渲染时插入大块分隔（右侧体现「另起一页」）
  let prevBlock: BlockKey | null = null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex flex-col p-3 md:p-6">
      <div className="flex items-center justify-between mb-3 text-white">
        <div>
          <h2 className="text-lg font-bold">前后对比预览</h2>
          <p className="text-xs text-slate-300 mt-0.5">
            左右联动滚动 · 核对内容是否完整、样式是否正确（最终以下载的 Word 为准）
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
        {/* 左：上传原文 */}
        <div className="flex flex-col min-h-0 rounded-xl bg-white overflow-hidden shadow-lg">
          <div className="border-b bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 shrink-0">
            上传原文（解析后的文本）
          </div>
          <div
            ref={leftRef}
            onScroll={() => sync("l")}
            className="flex-1 min-h-0 overflow-y-auto bg-slate-200 p-4"
          >
            <div style={{ ...A4_PADDING, background: "white", minHeight: "100%" }}>
              <div className="space-y-2">
                {paragraphs.map((p) => (
                  <PlainParagraph key={p.index} p={p} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 右：格式化结果 */}
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
