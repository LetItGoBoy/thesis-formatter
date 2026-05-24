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
export type BlockKey = "toc" | "abstract" | "body" | "conclusion" | "references" | "extra";

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
      "目录第一个一级标题通常是「摘要」，最后一个通常是「附录」",
      "英文摘要（Abstract）不写入目录，若有请删除该条目",
      "致谢不写入目录，若有「致谢」条目请删除",
      "目录中的页码要与正文实际页码一致（系统不自动校正页码）",
    ],
  },
  {
    key: "abstract",
    label: "摘要 · Abstract",
    order: 2,
    commonMistakes: [
      "中文摘要篇幅建议 200-400 字，不宜过短或写成背景介绍",
      "摘要应概括全文的目的、方法与结论，不要写成引言",
      "关键词一般 3-5 个，中、英文关键词应一一对应",
      "英文摘要内容应与中文摘要对应，不能是机器直译的残句",
    ],
  },
  {
    key: "body",
    label: "正文 · Body",
    order: 3,
    commonMistakes: [
      "图、表题注编号必须用短横线，格式为 图2-1、表3-2，不能写成 图2.1、表3.2",
      "图、表、公式都要有题注，且正文中要有引用（如「如图2-1所示」）",
      "图片必须清晰，不能模糊；图中文字标注不得有错误或缺失",
      "章节层级要完整，出现 1.1 就应有 1.2，不要只有单个子节",
      "图表不能孤立出现，前后必须有正文说明",
    ],
  },
  {
    key: "conclusion",
    label: "结论 · Conclusion",
    order: 4,
    commonMistakes: [
      "结论应概括全文工作与成果，不要引入新内容或新数据",
      "结论要与摘要、正文中的结论保持一致",
    ],
  },
  {
    key: "references",
    label: "参考文献 · References",
    order: 5,
    commonMistakes: [
      "参考文献数量不少于 10 篇",
      "学位论文、期刊等文献一般应为近五年内发表",
      "参考文献著录顺序：序号、著者、书名、版本、出版社、出版年等",
      "列出的文献都应在正文中有对应的引用标注",
    ],
  },
  {
    key: "extra",
    label: "致谢 / 附录 · Extra",
    order: 6,
    commonMistakes: [
      "致谢、附录保持原文排版（系统不重排），仅核对内容是否正确",
      "若此处误收了正文内容，请改回对应类型移回正文块",
    ],
  },
];

// ============================================================
// 模型档位（首页选择，价格仅展示，暂不实际扣费）
// value 需与后端 ai_client.MODEL_TIERS 的 key 一致
// ============================================================
export interface ModelTier {
  value: string;
  label: string;
  price: string;
  desc: string;
  recommended?: boolean;
}

export const MODEL_TIERS: ModelTier[] = [
  {
    value: "economy",
    label: "经济版",
    price: "免费",
    desc: "规则识别 · 速度极快，识别率约70%，需手动纠错较多",
  },
  {
    value: "standard",
    label: "标准版",
    price: "¥0.05/篇",
    desc: "Moonshot · 识别率约90%，推荐多数论文",
    recommended: true,
  },
  {
    value: "flagship",
    label: "旗舰版",
    price: "¥0.20/篇",
    desc: "豆包 · 识别率约95%，复杂排版最稳",
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
    { value: "table_caption", label: "表题注" },
    { value: "table", label: "表" },
    { value: "formula", label: "公式" },
    { value: "formula_number", label: "公式序号" },
    { value: "caption", label: "图题注" },
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
  extra: [
    { value: "passthrough", label: "原样保留（不重排）" },
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
  m["figure_caption"] = "body";  // 已从下拉框移除，但AI识别结果仍需正确归块
  m["figure"] = "body"; // 解析阶段识别的图片段落
  m["passthrough"] = "extra"; // V2：致谢/附录原样保留
  return m;
})();

export const TYPE_LABEL: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  Object.values(TYPES_BY_BLOCK).forEach((opts) =>
    opts.forEach((o) => (m[o.value] = o.label))
  );
  m["cover"] = "封面（旧版兼容）";
  m["future_work"] = "展望内容（旧版兼容）";
  m["figure_caption"] = "图题注";
  m["figure"] = "图片";
  m["passthrough"] = "原样保留（不重排）";
  return m;
})();

export function blockOf(type: string): BlockKey {
  return TYPE_TO_BLOCK[type] || "body";
}

// 后端 block 字段 → 前端有效 BlockKey（V2 的 acknowledgement/appendix 归到 extra）
const _VALID_BLOCKS = new Set<BlockKey>([
  "toc", "abstract", "body", "conclusion", "references", "extra",
]);
export function toBlockKey(block: string | undefined, type: string): BlockKey {
  if (block === "acknowledgement" || block === "appendix") return "extra";
  if (block && _VALID_BLOCKS.has(block as BlockKey)) return block as BlockKey;
  return blockOf(type);
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
  tier: string;

  setTemplate: (template: string) => void;
  setTier: (tier: string) => void;
  setSource: (fileName: string, docxBase64: string, paragraphs: Paragraph[]) => void;
  updateParagraph: (index: number, patch: Partial<Paragraph>) => void;
  confirmParagraph: (index: number) => void;
  unconfirmParagraph: (index: number) => void;
  confirmBlock: (block: BlockKey) => void;
  setTypeMany: (indices: number[], type: string) => void;
  deleteParagraph: (index: number) => void;
  addParagraph: (block: BlockKey) => void;
  addParagraphAfter: (afterIndex: number) => void;
  setOutput: (blob: Blob) => void;
  reset: () => void;
}

export const useThesisStore = create<ThesisState>((set) => ({
  fileName: "",
  docxBase64: "",
  paragraphs: [],
  outputBlob: null,
  template: "hulunbeier_univ",
  tier: "standard",

  setTemplate: (template) => set({ template }),
  setTier: (tier) => set({ tier }),

  setSource: (fileName, docxBase64, paragraphs) =>
    set({
      fileName,
      docxBase64,
      paragraphs: paragraphs.map((p) => ({
        ...p,
        confirmed: false,
        block: toBlockKey(p.block, p.type),
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

  addParagraphAfter: (afterIndex) =>
    set((s) => {
      const sorted = [...s.paragraphs].sort((a, b) => a.index - b.index);
      const pos = sorted.findIndex((p) => p.index === afterIndex);
      if (pos === -1) return {};
      const cur = sorted[pos];
      const block = (cur.block as BlockKey) || blockOf(cur.type);
      const next = sorted[pos + 1];
      // 与「下一段」取中点，保持全局顺序；若已是最后一段则 +1
      const newIndex = next ? (cur.index + next.index) / 2 : cur.index + 1;
      const type = TYPES_BY_BLOCK[block][0].value;
      const newPara: Paragraph = {
        index: newIndex,
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
