/**
 * 全局状态
 * frontend/lib/store.ts
 *
 * v2：分块（toc/abstract/body/conclusion/references）。
 * - 不在正文下拉框显示 cover
 * - 不在总结下拉框显示 future_work
 * - 提供 block 推导和 per-block 视图
 */
import { create } from "zustand";
import type { Paragraph } from "./api";

// ============================================================
// 大块定义（与 hulunbeier_univ.json 一致）
// ============================================================
export type BlockKey = "toc" | "abstract" | "body" | "conclusion" | "references";

export interface BlockDef {
  key: BlockKey;
  label: string;
  order: number;
}

export const BLOCKS: BlockDef[] = [
  { key: "toc", label: "目录大块", order: 1 },
  { key: "abstract", label: "摘要大块", order: 2 },
  { key: "body", label: "正文大块", order: 3 },
  { key: "conclusion", label: "总结大块", order: 4 },
  { key: "references", label: "参考文献大块", order: 5 },
];

export interface TypeOption {
  value: string;
  label: string;
  legacy?: boolean; // 仅显示但标注为旧版兼容
}

// 每个大块自己的下拉选项
// 正文模块不含 cover；总结模块不含 future_work
export const TYPES_BY_BLOCK: Record<BlockKey, TypeOption[]> = {
  toc: [
    { value: "toc_title", label: "目录标题" },
    { value: "toc_h1", label: "一级目录" },
    { value: "toc_h2", label: "二级目录" },
    { value: "toc_h3", label: "三级目录" },
  ],
  abstract: [
    { value: "paper_title", label: "论文题目" },
    { value: "author_line", label: "作者" },
    { value: "instructor", label: "指导老师" },
    { value: "abstract_title_cn", label: "摘要标题（中文）" },
    { value: "abstract_body_cn", label: "摘要正文（中文）" },
    { value: "keywords_cn", label: "关键词（中文）" },
    { value: "abstract_title_en", label: "Abstract标题" },
    { value: "abstract_body_en", label: "摘要正文（英文）" },
    { value: "keywords_en", label: "关键词（英文）" },
  ],
  body: [
    { value: "h1", label: "一级标题" },
    { value: "h2", label: "二级标题" },
    { value: "h3", label: "三级标题" },
    { value: "body", label: "正文" },
    { value: "numbered_item", label: "数字序号" },
    { value: "table_caption", label: "表说明" },
    { value: "table", label: "表" },
    { value: "formula", label: "公式" },
    { value: "formula_number", label: "公式序号" },
    { value: "figure_caption", label: "图说明" },
    { value: "caption", label: "图表题注", legacy: true },
  ],
  conclusion: [
    { value: "conclusion_title", label: "总结标题" },
    { value: "conclusion_body", label: "总结正文" },
  ],
  references: [
    { value: "references_title", label: "参考文献标题" },
    { value: "reference_item", label: "参考文献正文" },
    { value: "ref", label: "参考文献（兼容）", legacy: true },
  ],
};

// 反向映射：type → block
export const TYPE_TO_BLOCK: Record<string, BlockKey> = (() => {
  const m: Record<string, BlockKey> = {};
  (Object.entries(TYPES_BY_BLOCK) as Array<[BlockKey, TypeOption[]]>).forEach(
    ([blk, opts]) => opts.forEach((o) => (m[o.value] = blk))
  );
  // 旧版兼容（不显示但需要可识别）
  m["cover"] = "abstract";
  m["future_work"] = "conclusion";
  return m;
})();

export const TYPE_LABEL: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  Object.values(TYPES_BY_BLOCK).forEach((opts) =>
    opts.forEach((o) => (m[o.value] = o.label))
  );
  m["cover"] = "封面（旧版兼容）";
  m["future_work"] = "展望内容（旧版兼容）";
  return m;
})();

export function blockOf(type: string): BlockKey {
  return TYPE_TO_BLOCK[type] || "body";
}

// ============================================================
// Zustand store
// ============================================================
interface ThesisState {
  fileName: string;
  docxBase64: string;
  paragraphs: Paragraph[];
  outputBlob: Blob | null;

  setSource: (fileName: string, docxBase64: string, paragraphs: Paragraph[]) => void;
  updateParagraph: (index: number, patch: Partial<Paragraph>) => void;
  confirmParagraph: (index: number) => void;
  unconfirmParagraph: (index: number) => void;
  confirmBlock: (block: BlockKey) => void;
  setTypeMany: (indices: number[], type: string) => void;
  setOutput: (blob: Blob) => void;
  reset: () => void;
}

export const useThesisStore = create<ThesisState>((set) => ({
  fileName: "",
  docxBase64: "",
  paragraphs: [],
  outputBlob: null,

  setSource: (fileName, docxBase64, paragraphs) =>
    set({
      fileName,
      docxBase64,
      paragraphs: paragraphs.map((p) => ({
        ...p,
        confirmed: false,
        block: p.block || blockOf(p.type),
      })),
      outputBlob: null,
    }),

  updateParagraph: (index, patch) =>
    set((s) => ({
      paragraphs: s.paragraphs.map((p) => {
        if (p.index !== index) return p;
        const next = { ...p, ...patch };
        // 改了 type 则同步重算 block
        if (patch.type !== undefined) {
          next.block = blockOf(patch.type);
        }
        return next;
      }),
    })),

  confirmParagraph: (index) =>
    set((s) => ({
      paragraphs: s.paragraphs.map((p) =>
        p.index === index ? { ...p, confirmed: true } : p
      ),
    })),

  unconfirmParagraph: (index) =>
    set((s) => ({
      paragraphs: s.paragraphs.map((p) =>
        p.index === index ? { ...p, confirmed: false } : p
      ),
    })),

  confirmBlock: (block) =>
    set((s) => ({
      paragraphs: s.paragraphs.map((p) =>
        (p.block || blockOf(p.type)) === block ? { ...p, confirmed: true } : p
      ),
    })),

  setTypeMany: (indices, type) =>
    set((s) => {
      const idxSet = new Set(indices);
      const newBlock = blockOf(type);
      return {
        paragraphs: s.paragraphs.map((p) =>
          idxSet.has(p.index) ? { ...p, type, block: newBlock } : p
        ),
      };
    }),

  setOutput: (blob) => set({ outputBlob: blob }),

  reset: () =>
    set({ fileName: "", docxBase64: "", paragraphs: [], outputBlob: null }),
}));
