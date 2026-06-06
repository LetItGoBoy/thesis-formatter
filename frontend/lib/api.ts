/**
 * 后端API封装
 * frontend/lib/api.ts
 * 后端地址从环境变量 NEXT_PUBLIC_API_URL 读取。
 */

import { getToken } from "./auth-store";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

function authHeader(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface Paragraph {
  index: number;
  text: string;
  type: string;
  confidence: number;
  reason?: string;
  confirmed?: boolean;
  block?: string;
  cells?: string[][]; // 仅当 type==="table" 时存在：表格单元格网格（行 × 列）
  image_b64?: string; // 仅当 type==="figure" 时存在：base64 data URI，用于预览
  image_index?: number; // 仅当 type==="figure" 时存在：对应 source_bytes 中的图片序号
  orig_style?: {
    alignment: "left" | "center" | "right" | "justify";
    indent_cm: number;
    first_line_cm: number;
    is_bold: boolean;
    font_size_pt: number;
    style_name: string;
  };
}

export interface ParseResponse {
  paragraphs: Paragraph[];
}

export async function parseDocx(file: File, tier?: string): Promise<ParseResponse> {
  const form = new FormData();
  form.append("file", file);
  if (tier) form.append("tier", tier);
  const res = await fetch(`${API_BASE}/api/parse`, {
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

export async function formatDocx(
  paragraphs: Paragraph[],
  template = "hulunbeier_univ",
  docxBase64?: string
): Promise<Blob> {
  const res = await fetch(`${API_BASE}/api/format`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify({
      paragraphs: paragraphs.map((p) => ({
        index: p.index,
        type: p.type,
        text: p.text,
        ...(p.cells ? { cells: p.cells } : {}),
        ...(p.image_index !== undefined ? { image_index: p.image_index } : {}),
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

// ============================================================
// 提交前体检（第三个模块，纯规则、零 AI 调用）
// ============================================================

export type CheckupSeverity = "high" | "medium" | "low";

export interface CheckupIssue {
  id: string;
  category: string;
  category_label: string;
  severity: CheckupSeverity;
  severity_label: string;
  title: string;
  detail: string;
  suggestion: string;
  locations: number[];
}

export interface CheckupSummary {
  score: number;
  total: number;
  by_severity: Record<CheckupSeverity, number>;
  by_category: Record<string, number>;
  structure_overview: {
    abstract_cn_chars: number;
    keywords_cn_count: number;
    chapter_count: number;
    reference_count: number;
    table_count: number;
    figure_count: number;
    has_toc: boolean;
    has_conclusion: boolean;
    has_abstract_en: boolean;
  };
}

export interface CheckupResponse {
  issues: CheckupIssue[];
  summary: CheckupSummary;
}

export async function runCheckup(file: File): Promise<CheckupResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/api/checkup`, {
    method: "POST",
    headers: authHeader(),
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `体检失败 (HTTP ${res.status})`);
  }
  return res.json();
}

export async function checkHealth(): Promise<{ status: string; ai_provider: string }> {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error("后端不可用");
  return res.json();
}

// ============================================================
// 认证接口
// ============================================================

async function _authPost(path: string, body: object): Promise<{ token: string; phone: string }> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({ error: res.statusText }));
  if (!res.ok) throw new Error(data.error || `请求失败 (HTTP ${res.status})`);
  return data;
}

export async function sendCode(phone: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/auth/send-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });
  const data = await res.json().catch(() => ({ error: res.statusText }));
  if (!res.ok) throw new Error(data.error || "发送失败");
}

export async function registerUser(
  phone: string,
  password: string
): Promise<{ token: string; phone: string }> {
  return _authPost("/api/auth/register", { phone, password });
}

export async function loginUser(
  phone: string,
  password: string
): Promise<{ token: string; phone: string }> {
  return _authPost("/api/auth/login", { phone, password });
}
