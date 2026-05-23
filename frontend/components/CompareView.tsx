"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import type { Paragraph } from "@/lib/api";
import { blockOf, type BlockKey, useThesisStore } from "@/lib/store";
import { FormattedParagraph, AuthorInstructorBlock, groupAuthor } from "./BlockPreview";

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
  extra: "致谢/附录",
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
    const leftPanel = leftRef.current;
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
        }).then(() => {
          // 等待浏览器完成 layout reflow 后再读坐标
          requestAnimationFrame(() => {
            if (!leftPanel) return;
            const sorted = [...paragraphs].sort((a, b) => a.index - b.index);
            // 找前5段中长度 ≥ 4 字的第一段作为锚点
            const firstPara = sorted.find((p) => p.text.trim().replace(/\s+/g, "").length >= 4);
            let scrolled = false;

            if (firstPara) {
              const needle = firstPara.text.trim().replace(/\s+/g, "").slice(0, 6);
              const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
              let node: Node | null;
              while ((node = walker.nextNode())) {
                const txt = ((node as Text).textContent || "").replace(/\s+/g, "");
                if (txt.includes(needle)) {
                  const el = (node as Text).parentElement;
                  if (el) {
                    const panelRect = leftPanel.getBoundingClientRect();
                    const elRect = el.getBoundingClientRect();
                    leftPanel.scrollTop = Math.max(0, leftPanel.scrollTop + elRect.top - panelRect.top - 24);
                    scrolled = true;
                  }
                  break;
                }
              }
            }

            // 兜底：找 docx-preview 渲染的 section 页面，跳过前两页（封面+声明）
            if (!scrolled) {
              const sections = container.querySelectorAll("section");
              const target = sections.length >= 3 ? sections[2] : sections[sections.length - 1];
              if (target) {
                const panelRect = leftPanel.getBoundingClientRect();
                const elRect = (target as HTMLElement).getBoundingClientRect();
                leftPanel.scrollTop = Math.max(0, leftPanel.scrollTop + elRect.top - panelRect.top - 24);
              }
            }
          });
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

  // 渲染时插入分隔标记：大块切换 + 正文内每个 h1 各自另起一页
  let prevBlock: BlockKey | null = null;
  let prevType: string | null = null;

  // 参考文献序号：检测是否需要自动注入 [n]
  const _refTypes = new Set(["reference_item", "ref"]);
  const _reRefs = /^\s*\[\d+\]/;
  const _refItems = paragraphs.filter((p) => _refTypes.has(p.type));
  const _alreadyNum = _refItems.filter((p) => _reRefs.test(p.text)).length;
  const _autoNumRefs = _refItems.length > 0 && _alreadyNum < _refItems.length / 2;
  let refSeq = 0;

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
          <div className="border-b bg-slate-100 px-4 py-2 shrink-0">
            <div className="text-sm font-semibold text-slate-600">上传原文（原始排版）</div>
            <div className="text-xs text-amber-600 mt-0.5">
              ⚠ 网页渲染约 90% 还原原文排版，字体/行距/分页可能与 Word/WPS 略有差异，仅供参考
            </div>
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
                {groupAuthor(
                  // pre-apply ref numbers before grouping
                  paragraphs.map((p) => {
                    const isRef = _refTypes.has(p.type);
                    if (isRef && _autoNumRefs) { refSeq++; return { ...p, text: `[${refSeq}] ${p.text}` }; }
                    return p;
                  })
                ).map((g, gi) => {
                  if (g.kind === "author") {
                    const blk = "abstract" as BlockKey;
                    const isNewBlock = prevBlock !== null && blk !== prevBlock;
                    prevBlock = blk;
                    prevType = g.ps[g.ps.length - 1].type;
                    return (
                      <div key={g.ps[0].index}>
                        {isNewBlock && (
                          <div className="my-3 border-t border-dashed border-orange-300 text-xs text-orange-600 text-center bg-orange-50 py-1">
                            ↳ 另起一页（{BLOCK_LABEL[blk]}）
                          </div>
                        )}
                        <AuthorInstructorBlock ps={g.ps} />
                      </div>
                    );
                  }
                  const p = g.p;
                  const blk = (p.block as BlockKey) || blockOf(p.type);
                  const isNewBlock = prevBlock !== null && blk !== prevBlock;
                  const isH1Break = p.type === "h1" && !isNewBlock && prevType !== null;
                  prevBlock = blk;
                  prevType = p.type;
                  return (
                    <div key={p.index}>
                      {isNewBlock && (
                        <div className="my-3 border-t border-dashed border-orange-300 text-xs text-orange-600 text-center bg-orange-50 py-1">
                          ↳ 另起一页（{BLOCK_LABEL[blk]}）
                        </div>
                      )}
                      {isH1Break && (
                        <div className="my-3 border-t border-dashed border-sky-300 text-xs text-sky-600 text-center bg-sky-50 py-1">
                          ↳ 另起一页（一级标题）
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
