/**
 * 全局状态
 * frontend/lib/store.ts
 */
import { create } from "zustand";
import type { Paragraph } from "./api";

interface ThesisState {
  fileName: string;
  docxBase64: string; // 原始docx的base64，格式化时回传后端
  paragraphs: Paragraph[];
  outputBlob: Blob | null;

  setSource: (fileName: string, docxBase64: string, paragraphs: Paragraph[]) => void;
  updateParagraph: (index: number, patch: Partial<Paragraph>) => void;
  confirmParagraph: (index: number) => void;
  unconfirmParagraph: (index: number) => void;
  confirmMany: (indices: number[]) => void;
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
      paragraphs: paragraphs.map((p) => ({ ...p, confirmed: false })),
      outputBlob: null,
    }),

  updateParagraph: (index, patch) =>
    set((s) => ({
      paragraphs: s.paragraphs.map((p) =>
        p.index === index ? { ...p, ...patch } : p
      ),
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

  confirmMany: (indices) =>
    set((s) => {
      const set_ = new Set(indices);
      return {
        paragraphs: s.paragraphs.map((p) =>
          set_.has(p.index) ? { ...p, confirmed: true } : p
        ),
      };
    }),

  setTypeMany: (indices, type) =>
    set((s) => {
      const set_ = new Set(indices);
      return {
        paragraphs: s.paragraphs.map((p) =>
          set_.has(p.index) ? { ...p, type } : p
        ),
      };
    }),

  setOutput: (blob) => set({ outputBlob: blob }),

  reset: () =>
    set({ fileName: "", docxBase64: "", paragraphs: [], outputBlob: null }),
}));

export const PARAGRAPH_TYPES: { value: string; label: string }[] = [
  { value: "h1", label: "一级标题" },
  { value: "h2", label: "二级标题" },
  { value: "h3", label: "三级标题" },
  { value: "abstract", label: "摘要" },
  { value: "body", label: "正文" },
  { value: "ref", label: "参考文献" },
  { value: "caption", label: "图表题注" },
  { value: "cover", label: "封面" },
  { value: "toc", label: "目录" },
  { value: "keywords", label: "关键词" },
  { value: "conclusion", label: "结论" },
];

export const TYPE_LABEL: Record<string, string> = Object.fromEntries(
  PARAGRAPH_TYPES.map((t) => [t.value, t.label])
);
