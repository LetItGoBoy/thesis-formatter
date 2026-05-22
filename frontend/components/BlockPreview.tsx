"use client";

import type { CSSProperties } from "react";
import type { Paragraph } from "@/lib/api";
import type { BlockKey } from "@/lib/store";

/**
 * 重构预览：按当前段落类型，把每一段渲染成接近最终 Word 输出的样式。
 *
 * 字符级中英文字体：通过 CSS font fallback 模拟——
 *   font-family: "Times New Roman", <中文字体>, serif;
 * 浏览器会优先用 Times New Roman 渲染 ASCII，剩下的中文 fallback 到指定字体。
 */

const CN_FONT_CSS: Record<string, string> = {
  宋体: '"SimSun", "Songti SC", serif',
  黑体: '"SimHei", "Heiti SC", sans-serif',
  仿宋: '"FangSong", "STFangsong", serif',
  "Times New Roman": '"Times New Roman", serif',
};

// 类型 → 渲染样式描述
interface RenderStyle {
  chineseFont: string;
  ptSize: number;
  bold?: boolean;
  align?: "left" | "center" | "right" | "justify";
  indent?: number; // first-line indent in chars
  leftIndent?: number; // left indent in chars (whole paragraph)
  spaceAfterPt?: number; // bottom margin in pt
  spaceBeforePt?: number; // top margin in pt
  leadingFullWidthSpaces?: number;
  block?: BlockKey;
  fixed?: string;
  isKeywords?: boolean;
  keywordPrefix?: string;
  capitalizeWords?: boolean;
  isChapterTitle?: boolean;
  pageBreakBefore?: boolean;
}

export const STYLES: Record<string, RenderStyle> = {
  // toc
  toc_title: { chineseFont: "黑体", ptSize: 16, bold: true, align: "center", fixed: "目　　录" },
  toc_h1: { chineseFont: "宋体", ptSize: 12, align: "left" },
  toc_h2: { chineseFont: "宋体", ptSize: 12, align: "left", leadingFullWidthSpaces: 2 },
  toc_h3: { chineseFont: "宋体", ptSize: 12, align: "left", leadingFullWidthSpaces: 4 },

  // abstract
  paper_title: { chineseFont: "宋体", ptSize: 18, bold: true, align: "center", spaceAfterPt: 18 },
  author_line: { chineseFont: "仿宋", ptSize: 12, align: "center" },
  instructor: { chineseFont: "仿宋", ptSize: 12, align: "center" },
  abstract_title_cn: { chineseFont: "仿宋", ptSize: 12, bold: true, align: "left", fixed: "摘要" },
  abstract_body_cn: { chineseFont: "仿宋", ptSize: 12, align: "justify", indent: 2 },
  keywords_cn: { chineseFont: "仿宋", ptSize: 12, bold: true, align: "left", isKeywords: true, keywordPrefix: "关键词：" },
  abstract_title_en: { chineseFont: "Times New Roman", ptSize: 12, bold: true, align: "left", fixed: "Abstract", pageBreakBefore: true, spaceBeforePt: 18 },
  abstract_body_en: { chineseFont: "Times New Roman", ptSize: 12, align: "justify", indent: 2 },
  keywords_en: { chineseFont: "Times New Roman", ptSize: 12, bold: true, align: "left", isKeywords: true, keywordPrefix: "Keywords:", capitalizeWords: true },

  // body
  h1: { chineseFont: "宋体", ptSize: 15, bold: true, align: "center", isChapterTitle: true, spaceAfterPt: 18 },
  h2: { chineseFont: "宋体", ptSize: 14, bold: true, align: "left" },
  h3: { chineseFont: "宋体", ptSize: 12, bold: true, align: "left" },
  body: { chineseFont: "宋体", ptSize: 12, align: "justify", indent: 2 },
  numbered_item: { chineseFont: "宋体", ptSize: 12, align: "justify", indent: 2 },
  table_caption: { chineseFont: "宋体", ptSize: 10.5, align: "center" },
  table: { chineseFont: "宋体", ptSize: 10.5, align: "center" },
  formula: { chineseFont: "Times New Roman", ptSize: 10.5, align: "center" },
  formula_number: { chineseFont: "Times New Roman", ptSize: 10.5, align: "right" },
  figure_caption: { chineseFont: "宋体", ptSize: 10.5, align: "center" },
  caption: { chineseFont: "宋体", ptSize: 10.5, align: "center" },

  // conclusion
  conclusion_title: { chineseFont: "宋体", ptSize: 15, bold: true, align: "center", fixed: "总　　结" },
  conclusion_body: { chineseFont: "宋体", ptSize: 12, align: "justify", indent: 2 },

  // references
  references_title: { chineseFont: "宋体", ptSize: 14, bold: true, align: "center", fixed: "参考文献" },
  reference_item: { chineseFont: "仿宋", ptSize: 12, align: "left" },
  ref: { chineseFont: "仿宋", ptSize: 12, align: "left" },

  // 旧版兼容
  cover: { chineseFont: "宋体", ptSize: 14, align: "center" },
  future_work: { chineseFont: "宋体", ptSize: 12, align: "justify", indent: 2 },
};

// 文本归一化（与 backend formatter._normalize_text_for_type 对齐）
function normalizeText(text: string, type: string): string {
  const st = STYLES[type];
  if (!st) return text;

  // 固定文字
  if (st.fixed) {
    const bare = text.replace(/\s+/g, "");
    if (bare === st.fixed.replace(/\s+/g, "")) return st.fixed;
  }

  // 关键词清理：所有分隔符 → 全角空格；英文关键词首字母大写
  if (st.isKeywords) {
    let body = text;
    const prefixes = [st.keywordPrefix, st.keywordPrefix?.replace(/[:：]/, ":"), st.keywordPrefix?.replace(/[:：]/, "：")];
    for (const p of prefixes) {
      if (p && body.startsWith(p)) {
        body = body.slice(p.length);
        break;
      }
    }
    body = body.trim().replace(/[。.]+$/, "");
    let parts: string[];
    if (st.capitalizeWords) {
      // 英文：仅按标点切分（保留词内空格），每词首字母大写
      parts = body.split(/[;；,，、]+/).map((w) => w.trim()).filter(Boolean);
      parts = parts.map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w));
    } else {
      parts = body.split(/[;；,，、\s]+/).filter(Boolean);
    }
    const joined = parts.join("　");
    return st.keywordPrefix ? `${st.keywordPrefix}　${joined}` : joined;
  }

  // 作者行：补全角空格使"作　　者"与"指导教师"等宽，居中时视觉对齐
  if (type === "author_line") {
    return text.replace(/^(作)\s*(者)/, "作　　者");
  }

  // 数字序号 1、 → 1.
  if (type === "numbered_item") {
    text = text.replace(/^(\s*\d+)\s*[、,，]\s*/, "$1. ");
  }

  // h1 章号两个全角空格
  if (st.isChapterTitle) {
    const m = text.match(/^(第[一二三四五六七八九十百零\d]+章)\s*(.*)$/);
    if (m && m[2]) text = `${m[1]}　　${m[2]}`;
  }

  // toc 前导全角空格
  if (st.leadingFullWidthSpaces) {
    const stripped = text.replace(/^[\s　]+/, "");
    text = "　".repeat(st.leadingFullWidthSpaces) + stripped;
  }

  return text;
}

function TablePreview({ p }: { p: Paragraph }) {
  const cells = p.cells || [];
  const fontFamily = `"Times New Roman", ${CN_FONT_CSS["宋体"]}`;
  const thick = "2px solid #000";
  const thin = "1px solid #000";
  return (
    <table
      style={{
        borderCollapse: "collapse",
        margin: "0 auto",
        fontFamily,
        fontSize: "10.5pt",
        lineHeight: 1.5,
      }}
    >
      <tbody>
        {cells.map((row, r) => {
          // 三线表：首行上边线 + 表头下边线（1pt），末行下边线（1.5pt），无竖线/内线
          const isFirst = r === 0;
          const isLast = r === cells.length - 1;
          return (
            <tr key={r}>
              {row.map((cell, c) => (
                <td
                  key={c}
                  style={{
                    borderTop: isFirst ? thick : undefined,
                    borderBottom: isFirst ? thin : isLast ? thick : undefined,
                    padding: "3px 10px",
                    textAlign: "center",
                    verticalAlign: "middle",
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// 目录条目：分离标题与页码（与后端 _split_toc_entry 的正则对齐）
const TOC_ENTRY_RE = /^(.+?)[\s.·]+(\d{1,4})$/;

function TocLine({ p }: { p: Paragraph }) {
  const st = STYLES[p.type] || STYLES.body;
  const fontFamily = `"Times New Roman", ${CN_FONT_CSS[st.chineseFont] || "serif"}`;
  const lead = st.leadingFullWidthSpaces ? "　".repeat(st.leadingFullWidthSpaces) : "";
  const m = p.text.trim().match(TOC_ENTRY_RE);

  // 无页码（或匹配失败）退化为普通行，避免误吞内容
  if (!m || !m[1].trim()) return <ParagraphLine p={p} />;

  const title = m[1].trim();
  const page = m[2];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        fontFamily,
        fontSize: `${st.ptSize}pt`,
        fontWeight: st.bold ? 700 : 400,
        lineHeight: 1.7,
      }}
    >
      <span style={{ whiteSpace: "pre", flexShrink: 0 }}>
        {lead}
        {title}
      </span>
      <span
        style={{
          flex: 1,
          margin: "0 4px",
          marginBottom: "0.32em",
          borderBottom: "1px dotted #000",
        }}
      />
      <span style={{ flexShrink: 0 }}>{page}</span>
    </div>
  );
}

function ParagraphLine({ p }: { p: Paragraph }) {
  const st = STYLES[p.type] || STYLES.body;
  const text = normalizeText(p.text, p.type);
  const fontFamily = `"Times New Roman", ${CN_FONT_CSS[st.chineseFont] || "serif"}`;
  return (
    <div
      style={{
        fontFamily,
        fontSize: `${st.ptSize}pt`,
        fontWeight: st.bold ? 700 : 400,
        textAlign: st.align || "left",
        textIndent: st.indent ? `${st.indent * st.ptSize}pt` : 0,
        marginLeft: st.leftIndent ? `${st.leftIndent * st.ptSize}pt` : undefined,
        marginTop: st.spaceBeforePt ? `${st.spaceBeforePt}pt` : undefined,
        marginBottom: st.spaceAfterPt ? `${st.spaceAfterPt}pt` : undefined,
        lineHeight: 1.7,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      {text || <span className="text-slate-300">（空段）</span>}
    </div>
  );
}

/** 单段格式化预览：按类型分派到 图片 / 表格 / 目录条目 / 普通段落 渲染。 */
export function FormattedParagraph({ p }: { p: Paragraph }) {
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
  if (p.type === "table" && p.cells) return <TablePreview p={p} />;
  if (p.type === "toc_h1" || p.type === "toc_h2" || p.type === "toc_h3") return <TocLine p={p} />;
  return <ParagraphLine p={p} />;
}

interface Props {
  block: BlockKey;
  paragraphs: Paragraph[]; // 该大块的段落（已按 index 升序）
  selectedIndex?: number | null;
  onSelect?: (index: number) => void;
}

const BLOCK_TITLES: Record<BlockKey, string> = {
  toc: "目录重构预览",
  abstract: "摘要重构预览",
  body: "正文重构预览",
  conclusion: "总结重构预览",
  references: "参考文献重构预览",
};

// A4 内边距 = 页面边距，百分比相对「页面宽度21cm」折算（padding-% 始终相对宽度）：
// 上2.5cm→11.9%，下2cm→9.52%，左3cm→14.29%，右2cm→9.52%
const A4_PADDING: CSSProperties = {
  paddingTop: "11.9%",
  paddingBottom: "9.52%",
  paddingLeft: "14.29%",
  paddingRight: "9.52%",
};

// 严格 A4 矩形：宽度撑满预览列，高度 = 宽度 × 297/210，内容在页内滚动，
// 页面比例恒为 A4，不会因内容多而被拉长变窄。
const A4_PAGE: CSSProperties = {
  width: "100%",
  aspectRatio: "210 / 297",
  background: "white",
  boxShadow: "0 1px 6px rgba(0,0,0,0.18)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

export function BlockPreview({ block, paragraphs, selectedIndex, onSelect }: Props) {
  return (
    <div className="rounded-lg border border-slate-300 bg-white shadow-sm">
      <div className="border-b border-dashed border-orange-300 bg-orange-50 px-4 py-2 text-xs text-orange-700 flex items-center justify-between">
        <span>↳ 新一页（{BLOCK_TITLES[block]}）· A4 比例 · 点击任意段落可跳到左侧确认区</span>
        <span className="text-slate-400">
          ASCII / 数字 → Times New Roman · 中文按段落类型字体
        </span>
      </div>
      <div className="bg-slate-200 p-4">
        <div style={A4_PAGE}>
          <div style={{ ...A4_PADDING, flex: 1, minHeight: 0, overflowY: "auto" }}>
            {paragraphs.length === 0 ? (
              <div className="text-center text-slate-400 text-sm">本块暂无段落</div>
            ) : (
              <div className="space-y-2">
                {paragraphs.map((p) => {
                  // 正文大块内 h1 视觉提示"另起一页"
                  const isH1Break = block === "body" && p.type === "h1";
                  const isPageBreak = (STYLES[p.type] as RenderStyle | undefined)?.pageBreakBefore;
                  const isSelected = selectedIndex === p.index;
                  return (
                    <div key={p.index}>
                      {isPageBreak && (
                        <div className="my-3 border-t border-dashed border-blue-300 text-xs text-blue-600 text-center bg-blue-50 py-1">
                          ↳ 另起一页（英文摘要）
                        </div>
                      )}
                      {isH1Break && (
                        <div className="my-3 border-t border-dashed border-orange-300 text-xs text-orange-600 text-center bg-orange-50 py-1">
                          ↳ 一级标题另起一页
                        </div>
                      )}
                      <div
                        onClick={() => onSelect?.(p.index)}
                        className={`cursor-pointer rounded transition ${
                          isSelected
                            ? "ring-2 ring-indigo-400 bg-indigo-50/60"
                            : "hover:bg-indigo-50/40"
                        }`}
                      >
                        <FormattedParagraph p={p} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
