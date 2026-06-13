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

/** 复用路径（推荐）：把已解析的带类型段落送去体检，边界可靠、零重复解析。 */
export async function runCheckupTyped(paragraphs: Paragraph[]): Promise<CheckupResponse> {
  const res = await fetch(`${API_BASE}/api/checkup`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify({
      paragraphs: paragraphs.map((p) => ({
        index: p.index,
        text: p.text,
        type: p.type,
        block: p.block,
      })),
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `体检失败 (HTTP ${res.status})`);
  }
  return res.json();
}

/** 兜底路径：直接上传 .docx，后端走正则结构检测（无 AI 解析时使用）。 */
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

async function _authPost(path: string, body: object): Promise<any> {
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

export interface AuthResult {
  token: string;
  phone: string;
  nickname?: string;
  is_admin?: boolean;
}

export async function registerUser(
  phone: string,
  password: string,
  nickname?: string
): Promise<AuthResult> {
  return _authPost("/api/auth/register", { phone, password, nickname });
}

export async function loginUser(phone: string, password: string): Promise<AuthResult> {
  return _authPost("/api/auth/login", { phone, password });
}

// ============================================================
// 成长系统
// ============================================================
export interface ClearResult {
  gained: number;
  first_time: boolean;
  xp: number;
  level: number;
  title: string;
  streak: number;
  cleared_count: number;
  perfect_count: number;
}

/** 上报一次通关（best-effort，未登录或失败时静默返回 null） */
export async function reportClear(
  course: string,
  levelId: string,
  mistakes: number,
  perfect: boolean
): Promise<ClearResult | null> {
  if (!getToken()) return null;
  try {
    const res = await fetch(`${API_BASE}/api/progress/clear`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify({ course, level_id: levelId, mistakes, perfect }),
    });
    if (!res.ok) return null;
    return (await res.json()) as ClearResult;
  } catch {
    return null;
  }
}

export interface Profile {
  phone: string;
  nickname: string;
  xp: number;
  level: number;
  xp_into_level: number;
  xp_to_next: number;
  title: string;
  streak: number;
  cleared_count: number;
  perfect_count: number;
  mistakes_total: number;
  last_active: string | null;
  per_course: Record<string, { cleared: number; perfect: number; total: number }>;
  recent: { course: string; level_id: string; best_mistakes: number; perfect: number; last_at: string }[];
  is_admin: boolean;
}

export async function getProfile(): Promise<Profile> {
  const res = await fetch(`${API_BASE}/api/profile`, { headers: { ...authHeader() } });
  const data = await res.json().catch(() => ({ error: res.statusText }));
  if (!res.ok) throw new Error(data.error || "获取失败");
  return data as Profile;
}

export interface StudentRow {
  id: number;
  phone: string;
  nickname: string;
  xp: number;
  level: number;
  title: string;
  streak: number;
  cleared_count: number;
  total_levels: number;
  perfect_count: number;
  mistakes_total: number;
  last_active: string | null;
  created_at: string;
}

export async function updateNickname(nickname: string): Promise<void> {
  if (!getToken()) return;
  try {
    await fetch(`${API_BASE}/api/profile/nickname`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify({ nickname }),
    });
  } catch {
    /* best-effort */
  }
}

export async function getAdminStudents(): Promise<StudentRow[]> {
  const res = await fetch(`${API_BASE}/api/admin/students`, { headers: { ...authHeader() } });
  const data = await res.json().catch(() => ({ error: res.statusText }));
  if (!res.ok) throw new Error(data.error || "获取失败");
  return (data.students || []) as StudentRow[];
}
