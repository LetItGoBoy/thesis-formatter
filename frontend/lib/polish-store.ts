/**
 * 论文表达润色 - 独立状态
 * frontend/lib/polish-store.ts
 *
 * 完全独立于 thesis store（lib/store.ts），避免影响格式化工具。
 */
import { create } from "zustand";
import type { PolishBlock, PolishRewriteResponse } from "./polish-api";

interface PendingRewrite extends PolishRewriteResponse {
  blockId: string;
}

interface PolishState {
  fileName: string;
  docxBase64: string;
  blocks: PolishBlock[];
  selectedBlockId: string | null;
  pendingRewrite: PendingRewrite | null;
  rewriteLoading: boolean;
  rewriteError: string;

  setSource: (fileName: string, docxBase64: string, blocks: PolishBlock[]) => void;
  selectBlock: (id: string | null) => void;
  setRewriteLoading: (loading: boolean) => void;
  setRewriteError: (msg: string) => void;
  setPendingRewrite: (p: PendingRewrite | null) => void;
  applyRewrite: (id: string, text: string) => void;
  restoreBlock: (id: string) => void;
  updateBlockText: (id: string, text: string) => void;
  reset: () => void;
}

export const usePolishStore = create<PolishState>((set) => ({
  fileName: "",
  docxBase64: "",
  blocks: [],
  selectedBlockId: null,
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
      selectedBlockId: null,
      pendingRewrite: null,
      rewriteError: "",
    }),

  selectBlock: (id) =>
    set({ selectedBlockId: id, pendingRewrite: null, rewriteError: "" }),

  setRewriteLoading: (rewriteLoading) => set({ rewriteLoading }),
  setRewriteError: (rewriteError) => set({ rewriteError }),
  setPendingRewrite: (pendingRewrite) => set({ pendingRewrite }),

  // 用户点「接受修改」：把 block.text 更新为改写结果，changed=true
  applyRewrite: (id, text) =>
    set((s) => ({
      blocks: s.blocks.map((b) =>
        b.id === id
          ? { ...b, text, changed: text !== (b.original_text ?? "") }
          : b
      ),
      pendingRewrite: null,
      rewriteError: "",
    })),

  // 用户点「还原原文」：恢复 original_text，changed=false
  restoreBlock: (id) =>
    set((s) => ({
      blocks: s.blocks.map((b) =>
        b.id === id ? { ...b, text: b.original_text ?? "", changed: false } : b
      ),
      pendingRewrite: null,
      rewriteError: "",
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
      selectedBlockId: null,
      pendingRewrite: null,
      rewriteLoading: false,
      rewriteError: "",
    }),
}));
