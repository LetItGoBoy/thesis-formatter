/**
 * 论文表达润色 - API 封装
 * frontend/lib/polish-api.ts
 *
 * 独立于格式化工具的 api.ts：调用 /api/polish/* 三个接口。
 */
import { getToken } from "./auth-store";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

function authHeader(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export type PolishAction =
  | "academic_polish"
  | "make_specific"
  | "shorten"
  | "expand"
  | "logic_optimize";

export interface PolishBlock {
  id: string;
  index: number;
  kind: "paragraph" | "table" | "image" | "other";
  text: string;
  original_text?: string;
  html?: string;
  editable: boolean;
  changed?: boolean;
}

export interface PolishStats {
  paragraph_count: number;
  editable_count: number;
  table_count: number;
}

export interface PolishImportResponse {
  docx_base64: string;
  file_name: string;
  blocks: PolishBlock[];
  stats: PolishStats;
}

export interface PolishRewriteResponse {
  rewritten_text: string;
  reason: string;
  action: PolishAction;
}

export async function importPolishDocx(file: File): Promise<PolishImportResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/api/polish/import`, {
    method: "POST",
    headers: authHeader(),
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `解析失败 (HTTP ${res.status})`);
  }
  return res.json();
}

export async function rewritePolishText(
  text: string,
  action: PolishAction
): Promise<PolishRewriteResponse> {
  const res = await fetch(`${API_BASE}/api/polish/rewrite`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify({ text, action }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `润色失败 (HTTP ${res.status})`);
  }
  return res.json();
}

export async function exportPolishedDocx(
  docxBase64: string,
  blocks: PolishBlock[]
): Promise<Blob> {
  const res = await fetch(`${API_BASE}/api/polish/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify({
      docx_base64: docxBase64,
      blocks: blocks.map((b) => ({
        id: b.id,
        index: b.index,
        kind: b.kind,
        text: b.text,
        original_text: b.original_text,
        changed: !!b.changed,
      })),
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `导出失败 (HTTP ${res.status})`);
  }
  return res.blob();
}

export const POLISH_ACTIONS: { value: PolishAction; label: string; desc: string }[] = [
  { value: "academic_polish", label: "学术润色", desc: "修复病句与口语化，调整为学术表达" },
  { value: "make_specific", label: "表达更具体", desc: "减少空泛，让表述更清晰具体" },
  { value: "shorten", label: "压缩精简", desc: "删除冗余，保留核心意思" },
  { value: "expand", label: "适当扩写", desc: "围绕原文已有信息合理展开" },
  { value: "logic_optimize", label: "逻辑优化", desc: "优化句子顺序与衔接连贯性" },
];
