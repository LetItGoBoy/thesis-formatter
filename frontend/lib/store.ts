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
  commonMistakes: string[]; // 常犯错误自查清单
}

export const BLOCKS: BlockDef[] = [
  {
    key: "toc",
    label: "目录 · Contents",
    order: 1,
    commonMistakes: [
      "目录标题应为黑体、三号、加粗、居中，常被误设为宋体或忘记加粗",
      "标题「目　　　录」用全角空格，不要用半角空格（间距会随网格变化）",
      "一级/二级/三级目录缩进层级写反：二级前空 2 格、三级前空 4 格",
      "标题与页码之间应有点线（……）引导，不要手动敲点或省略",
      "目录条目字号应为小四（12pt），常误用其他字号",
      "目录第一个一级标题通常是「摘　　要」（两个全角空格），不要写成「摘要」",
      "英文摘要（Abstract）不写入目录，若有请删除此条目",
      "致谢不写入目录，若有「致谢」条目请删除",
      "目录最后一个一级标题通常是「附录」",
      "章节标题格式：「第*章 标题」，「章」字后留一个空格再写标题，不能紧连",
    ],
  },
  {
    key: "abstract",
    label: "摘要 · Abstract",
    order: 2,
    commonMistakes: [
      "中文摘要正文应为仿宋，常被误设为宋体",
      "关键词之间必须用空格分隔，禁止用分号（；）或顿号（、）",
      "论文题目应为小二（18pt）、加粗、居中",
      "中英文摘要标题（摘要 / Abstract）应顶格、加粗",
      "英文摘要与英文关键词须为 Times New Roman",
    ],
  },
  {
    key: "body",
    label: "正文 · Body",
    order: 3,
    commonMistakes: [
      "每个一级标题（章）必须另起一页，常忘记分页",
      "正文首行须缩进 2 字符，不要用空格代替缩进",
      "数字序号用英文点号（1.），禁止中文顿号（1、）",
      "数字和英文字母须为 Times New Roman，中文用宋体",
      "表格须为三线表，且整表不能跨页",
    ],
  },
  {
    key: "conclusion",
    label: "结论 · Conclusion",
    order: 4,
    commonMistakes: [
      "标题固定为「总　　结」（两个全角空格），字号小三（15pt）加粗居中",
      "本块必须另起一页",
      "总结正文首行须缩进 2 字符",
    ],
  },
  {
    key: "references",
    label: "参考文献 · References",
    order: 5,
    commonMistakes: [
      "标题「参考文献」应为四号、加粗、居中，本块另起一页",
      "著录格式应符合 GB/T 7714 标准",
      "英文与数字须为 Times New Roman",
      "参考文献正文不加首行缩进，常误加缩进",
    ],
  },
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

const blockOrder = (b: BlockKey) => BLOCKS.find((x) => x.key === b)?.order ?? 99;

// 为「在某大块末尾新增段落」计算一个保持全局顺序的索引（支持小数，后端只按 index 排序）
function nextIndexForBlock(paragraphs: Paragraph[], block: BlockKey): number {
  const blkOf = (p: Paragraph) => ((p.block as BlockKey) || blockOf(p.type));
  const inBlock = paragraphs.filter((p) => blkOf(p) === block);
  if (inBlock.length > 0) {
    const lastIdx = Math.max(...inBlock.map((p) => p.index));
    const after = paragraphs
      .map((p) => p.index)
      .filter((i) => i > lastIdx)
      .sort((a, b) => a - b)[0];
    return after !== undefined ? (lastIdx + after) / 2 : lastIdx + 1;
  }
  // 空块：按大块顺序插到前一块之后、后一块之前
  const target = blockOrder(block);
  const before = paragraphs.filter((p) => blockOrder(blkOf(p)) < target).map((p) => p.index);
  const after = paragraphs.filter((p) => blockOrder(blkOf(p)) > target).map((p) => p.index);
  const beforeMax = before.length ? Math.max(...before) : null;
  const afterMin = after.length ? Math.min(...after) : null;
  if (beforeMax !== null && afterMin !== null) return (beforeMax + afterMin) / 2;
  if (beforeMax !== null) return beforeMax + 1;
  if (afterMin !== null) return afterMin - 1;
  return 0;
}

// ============================================================
// Zustand store
// ============================================================
interface ThesisState {
  fileName: string;
  docxBase64: string;
  paragraphs: Paragraph[];
  outputBlob: Blob | null;
  template: string;

  setTemplate: (template: string) => void;
  setSource: (fileName: string, docxBase64: string, paragraphs: Paragraph[]) => void;
  updateParagraph: (index: number, patch: Partial<Paragraph>) => void;
  confirmParagraph: (index: number) => void;
  unconfirmParagraph: (index: number) => void;
  confirmBlock: (block: BlockKey) => void;
  setTypeMany: (indices: number[], type: string) => void;
  deleteParagraph: (index: number) => void;
  addParagraph: (block: BlockKey) => void;
  setOutput: (blob: Blob) => void;
  reset: () => void;
}

export const useThesisStore = create<ThesisState>((set) => ({
  fileName: "",
  docxBase64: "",
  paragraphs: [],
  outputBlob: null,
  template: "hulunbeier_univ",

  setTemplate: (template) => set({ template }),

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

  deleteParagraph: (index) =>
    set((s) => ({
      paragraphs: s.paragraphs.filter((p) => p.index !== index),
    })),

  addParagraph: (block) =>
    set((s) => {
      const type = TYPES_BY_BLOCK[block][0].value; // 默认本块第一个类型，用户可改
      const newPara: Paragraph = {
        index: nextIndexForBlock(s.paragraphs, block),
        text: "",
        type,
        confidence: 1,
        confirmed: false,
        block,
      };
      return { paragraphs: [...s.paragraphs, newPara] };
    }),

  setOutput: (blob) => set({ outputBlob: blob }),

  reset: () =>
    set({ fileName: "", docxBase64: "", paragraphs: [], outputBlob: null }),
}));
