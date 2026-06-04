/**
 * 论文表达润色 - 独立状态
 * frontend/lib/polish-store.ts
 *
 * 完全独立于 thesis store（lib/store.ts），避免影响格式化工具。
 * 选区以「段落 + 字符区间 [start,end)」表示，支持对鼠标选中的局部文字润色，
 * 接受时把改写结果拼回该段落的对应区间。
 */
import { create } from "zustand";
import type { PolishBlock, PolishRewriteResponse } from "./polish-api";

export interface PolishSelection {
  blockId: string;
  start: number; // 段落文本中的起始字符下标
  end: number; // 结束下标（不含）
  text: string; // 选中的文字（start..end）
  whole: boolean; // 是否为整段（点击段落而非拖选）
}

interface PendingRewrite extends PolishRewriteResponse {
  blockId: string;
  start: number;
  end: number;
  selectedText: string;
}

interface PolishState {
  fileName: string;
  docxBase64: string;
  blocks: PolishBlock[];
  selection: PolishSelection | null;
  pendingRewrite: PendingRewrite | null;
  rewriteLoading: boolean;
  rewriteError: string;

  setSource: (fileName: string, docxBase64: string, blocks: PolishBlock[]) => void;
  setSelection: (sel: PolishSelection | null) => void;
  setRewriteLoading: (loading: boolean) => void;
  setRewriteError: (msg: string) => void;
  setPendingRewrite: (p: PendingRewrite | null) => void;
  applyRewrite: (blockId: string, start: number, end: number, rewritten: string) => void;
  restoreBlock: (id: string) => void;
  updateBlockText: (id: string, text: string) => void;
  reset: () => void;
}

export const usePolishStore = create<PolishState>((set) => ({
  fileName: "",
  docxBase64: "",
  blocks: [],
  selection: null,
  pendingRewrite: null,
  rewriteLoading: false,
  rewriteError: "",

  setSource: (fileName, docxBase64, blocks) =>
    set({
      fileName,
      docxBase64,
      blocks: blocks.map((b) => ({
        ...b,
        original_text: b.text,
        changed: false,
      })),
      selection: null,
      pendingRewrite: null,
      rewriteError: "",
    }),

  // 选区变化时清空上一次的待确认结果与错误
  setSelection: (selection) =>
    set({ selection, pendingRewrite: null, rewriteError: "" }),

  setRewriteLoading: (rewriteLoading) => set({ rewriteLoading }),
  setRewriteError: (rewriteError) => set({ rewriteError }),
  setPendingRewrite: (pendingRewrite) => set({ pendingRewrite }),

  // 接受改写：把 rewritten 拼回 [start,end) 区间
  applyRewrite: (blockId, start, end, rewritten) =>
    set((s) => ({
      blocks: s.blocks.map((b) => {
        if (b.id !== blockId) return b;
        const cur = b.text;
        const next = cur.slice(0, start) + rewritten + cur.slice(end);
        return { ...b, text: next, changed: next !== (b.original_text ?? "") };
      }),
      pendingRewrite: null,
      rewriteError: "",
      selection: null,
    })),

  // 还原原文
  restoreBlock: (id) =>
    set((s) => ({
      blocks: s.blocks.map((b) =>
        b.id === id ? { ...b, text: b.original_text ?? "", changed: false } : b
      ),
      pendingRewrite: null,
      rewriteError: "",
      selection: null,
    })),

  // 手动编辑段落文本
  updateBlockText: (id, text) =>
    set((s) => ({
      blocks: s.blocks.map((b) =>
        b.id === id
          ? { ...b, text, changed: text !== (b.original_text ?? "") }
          : b
      ),
    })),

  reset: () =>
    set({
      fileName: "",
      docxBase64: "",
      blocks: [],
      selection: null,
      pendingRewrite: null,
      rewriteLoading: false,
      rewriteError: "",
    }),
}));
