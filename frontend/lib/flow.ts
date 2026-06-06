/**
 * 模块间「软串联」流转
 * frontend/lib/flow.ts
 *
 * 文档解析一次后，模块之间跳转直接复用共享缓存，不让用户重新上传：
 *   - 进入在线编辑(润色)：复用缓存 docx，调用 import（非 AI，仅顺序抽段）
 *   - 进入格式化确认页：复用缓存的带类型段落，零 AI、零重新上传
 *   - 从润色去格式化：若该文件尚未解析则补一次解析（命中缓存即免费）
 *
 * 仅当用户从首页三个模块卡片进入时，才会走各自的「上传主页面」。
 */
import { useThesisStore } from "./store";
import { usePolishStore } from "./polish-store";
import {
  ensureDocParsed,
  getActiveDocModel,
  base64ToFile,
  setActiveDoc,
  type DocModel,
} from "./doc-store";
import { importPolishDocx } from "./polish-api";

/** 把一份 DocModel 灌进格式化 store（确认页 /review 直接可用）。 */
function hydrateThesis(doc: DocModel): void {
  useThesisStore.getState().setSource(doc.fileName, doc.docxBase64, doc.paragraphs);
}

/**
 * 进入格式化确认页所需的数据准备。
 * 优先复用当前活动文档的缓存解析；若没有（例如体检时 AI 解析失败、未落库），
 * 则用调用方持有的原始文件兜底解析一次，保证按钮不会“点了没反应”。
 * 返回 true 表示已就绪，调用方负责 router.push("/review")。
 */
export async function prepareFormatFromActive(fallbackFile?: File): Promise<boolean> {
  let doc = await getActiveDocModel();
  if (!doc && fallbackFile) {
    doc = await ensureDocParsed(fallbackFile, { tier: "standard" });
  }
  if (!doc) return false;
  hydrateThesis(doc);
  return true;
}

/**
 * 进入在线编辑(润色)所需的数据准备。
 * 优先用活动文档缓存的 docx 字节；缺失时回退到调用方持有的原始文件。
 * import 是非 AI 调用，不消耗模型次数，也不需要用户重新上传。
 */
export async function preparePolishFromActive(fallbackFile?: File): Promise<boolean> {
  const doc = await getActiveDocModel();
  let file: File | null = null;
  if (doc) {
    file = base64ToFile(doc.docxBase64, doc.fileName);
  } else if (fallbackFile) {
    file = fallbackFile;
  }
  if (!file) return false;
  const data = await importPolishDocx(file);
  usePolishStore.getState().setSource(data.file_name, data.docx_base64, data.blocks);
  return true;
}

/**
 * 从润色界面去格式化确认页。
 * 当前润色文档可能还没被解析过（场景：用户直接从 /polish 上传进入），
 * 这里用 ensureDocParsed 兜底：命中缓存即免费，未命中才解析一次。
 */
export async function prepareFormatFromPolish(): Promise<boolean> {
  const { fileName, docxBase64 } = usePolishStore.getState();
  if (!docxBase64) return false;
  const file = base64ToFile(docxBase64, fileName || "document.docx");
  const doc = await ensureDocParsed(file, { tier: "standard" });
  setActiveDoc(doc.fileHash);
  hydrateThesis(doc);
  return true;
}
