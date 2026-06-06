/**
 * 共享文档缓存（DocModel）——三模块复用的地基
 * frontend/lib/doc-store.ts
 *
 * 核心思想：整篇文档的「结构识别」(parse) 是唯一昂贵的 AI 操作，
 * 把它的结果按「文件内容指纹」缓存到 IndexedDB，让体检 / 格式化 / 润色
 * 谁先解析谁触发，其余命中即免费，全程只解析一次。
 *
 * - key：文件字节的 SHA-256（同一文件跨模块、跨页面都命中）
 * - 存：docxBase64 + 带类型的段落表 + 解析档位 + 时间戳
 * - 纯前端：后端保持无状态，不引入会话存储
 * - LRU：只保留最近 N 个文件，超出按时间淘汰，避免撑爆 IndexedDB
 */
import type { Paragraph } from "./api";
import { parseDocx } from "./api";

export interface DocModel {
  fileHash: string;
  fileName: string;
  docxBase64: string;
  paragraphs: Paragraph[];
  tier: string;
  parsedAt: number;
  /** 最近一次被任意模块读取的时间，用于 LRU 淘汰 */
  lastUsedAt: number;
}

const DB_NAME = "thesis-doc-cache";
const STORE = "docs";
const DB_VERSION = 1;
/** 最多缓存的文件数（docxBase64 可达数 MB，控制总占用） */
const MAX_ENTRIES = 5;

const hasIDB = () => typeof window !== "undefined" && "indexedDB" in window;

// ============================================================
// 文件内容指纹
// ============================================================
export async function hashFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  return hashBytes(buf);
}

export async function hashBytes(buf: ArrayBuffer): Promise<string> {
  // 优先 SubtleCrypto（需安全上下文）；降级为轻量 FNV-1a，保证总能产出 key
  if (typeof crypto !== "undefined" && crypto.subtle) {
    try {
      const digest = await crypto.subtle.digest("SHA-256", buf);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    } catch {
      /* 非安全上下文等情况下降级 */
    }
  }
  return "fnv" + fnv1a(new Uint8Array(buf));
}

function fnv1a(bytes: Uint8Array): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, "0") + "_" + bytes.length;
}

// ============================================================
// IndexedDB 封装（Promise 化，SSR 安全）
// ============================================================
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!hasIDB()) {
      reject(new Error("IndexedDB 不可用"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "fileHash" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      })
  );
}

export async function getCachedDoc(fileHash: string): Promise<DocModel | null> {
  if (!hasIDB()) return null;
  try {
    const doc = await tx<DocModel | undefined>("readonly", (s) => s.get(fileHash));
    if (!doc) return null;
    // 更新 lastUsedAt（不阻塞返回）
    doc.lastUsedAt = Date.now();
    tx("readwrite", (s) => s.put(doc)).catch(() => {});
    return doc;
  } catch {
    return null;
  }
}

export async function putCachedDoc(model: DocModel): Promise<void> {
  if (!hasIDB()) return;
  try {
    await tx("readwrite", (s) => s.put(model));
    await evictToLimit();
  } catch {
    /* 缓存失败不影响主流程 */
  }
}

export async function listCachedDocs(): Promise<DocModel[]> {
  if (!hasIDB()) return [];
  try {
    const all = await tx<DocModel[]>("readonly", (s) => s.getAll());
    return all.sort((a, b) => b.lastUsedAt - a.lastUsedAt);
  } catch {
    return [];
  }
}

export async function deleteCachedDoc(fileHash: string): Promise<void> {
  if (!hasIDB()) return;
  try {
    await tx("readwrite", (s) => s.delete(fileHash));
  } catch {
    /* 忽略 */
  }
}

async function evictToLimit(): Promise<void> {
  const all = await listCachedDocs(); // 已按 lastUsedAt 倒序
  for (const doc of all.slice(MAX_ENTRIES)) {
    await deleteCachedDoc(doc.fileHash);
  }
}

// ============================================================
// 高层编排：确保文档已解析（命中缓存则零 AI）
// ============================================================
export interface EnsureOptions {
  tier?: string;
  /** 强制重新解析（如用户切换了档位、或润色改动后内容已变） */
  force?: boolean;
  /** 命中缓存时回调（用于 UI 提示「秒开 / 已复用解析」） */
  onCacheHit?: (doc: DocModel) => void;
  /** 即将调用 AI 解析时回调（用于 UI 显示进度） */
  onParseStart?: () => void;
}

/**
 * 上传文件 → 算指纹 → 查缓存 → 命中即返回，否则解析并落库。
 * 返回可直接喂给各模块的 DocModel。
 */
export async function ensureDocParsed(file: File, opts: EnsureOptions = {}): Promise<DocModel> {
  const tier = opts.tier || "standard";
  const fileHash = await hashFile(file);

  if (!opts.force) {
    const cached = await getCachedDoc(fileHash);
    if (cached) {
      opts.onCacheHit?.(cached);
      return cached;
    }
  }

  opts.onParseStart?.();
  const buf = await file.arrayBuffer();
  const docxBase64 = bytesToBase64(new Uint8Array(buf));
  const data = await parseDocx(file, tier);

  const model: DocModel = {
    fileHash,
    fileName: file.name,
    docxBase64,
    paragraphs: data.paragraphs,
    tier,
    parsedAt: Date.now(),
    lastUsedAt: Date.now(),
  };
  await putCachedDoc(model);
  return model;
}

// 与各上传页一致的 base64 编码（分块避免大文件爆栈）
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}
