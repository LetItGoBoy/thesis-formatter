/**
 * 后端API封装
 * frontend/lib/api.ts
 * 后端地址从环境变量 NEXT_PUBLIC_API_URL 读取。
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export interface Paragraph {
  index: number;
  text: string;
  type: string;
  confidence: number;
  reason?: string;
  confirmed?: boolean;
  block?: string;
}

export interface ParseResponse {
  paragraphs: Paragraph[];
}

export async function parseDocx(file: File): Promise<ParseResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/api/parse`, { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `解析失败 (HTTP ${res.status})`);
  }
  return res.json();
}

export async function formatDocx(
  paragraphs: Paragraph[],
  template = "hulunbeier_univ",
  docxBase64?: string
): Promise<Blob> {
  const res = await fetch(`${API_BASE}/api/format`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      paragraphs: paragraphs.map((p) => ({
        index: p.index,
        type: p.type,
        text: p.text,
      })),
      template,
      docx_base64: docxBase64,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `格式化失败 (HTTP ${res.status})`);
  }
  return res.blob();
}

export async function checkHealth(): Promise<{ status: string; ai_provider: string }> {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error("后端不可用");
  return res.json();
}
