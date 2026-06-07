/**
 * 数据库侦探游戏 · 核心类型与通用工具
 * frontend/lib/db-detective.ts
 *
 * 季播单元剧：每个案件是一个自洽的 DetectiveCase（独立的浏览器内 SQLite 库 +
 * 若干关卡 + 指认环节），统一由 CaseRunner 渲染。具体案件见 lib/cases/。
 *
 * 校验原则：玩家查询结果命中关键行即通关，不强求写法一致（宽松防劝退）。
 */

export interface QueryResult {
  columns: string[];
  rows: (string | number | null)[][];
}

export interface DetectiveLevel {
  id: string;
  /** 关卡序号标签，如「线索 01」 */
  badge: string;
  title: string;
  /** 对应 SQL 知识点 */
  concept: string;
  /** 剧情开场 */
  story: string;
  /** 给玩家的查询任务 */
  task: string;
  /** SQL 输入框占位提示 */
  placeholder: string;
  /** 卡住时可展开的提示 */
  hint: string;
  /** 参考答案（仅作「查看答案」用，不参与判定） */
  solution: string;
  /** 结果校验：命中关键行即通过 */
  validate: (res: QueryResult) => boolean;
}

export interface SchemaTable {
  name: string;
  comment: string;
  columns: { name: string; type: string; note?: string }[];
}

export interface CaseMeta {
  /** 案件代号，如「雾港谜案」 */
  codename: string;
  /** 顶部小标签 */
  subtitle: string;
  /** 案件标题 */
  title: string;
  /** 案情引子 */
  intro: string;
  /** 与季度主线（校对者 ROLLBACK）的勾连，一句话 */
  arc: string;
}

export interface CaseAccusation {
  /** 指认环节的引导语 */
  prompt: string;
  /** 结案后的复盘语（点题本案知识点） */
  winNote: string;
}

export interface DetectiveCase {
  id: string;
  /** 在季里的序号，从 1 开始 */
  order: number;
  /** 本案主打的知识点群（用于 hub 展示） */
  concepts: string;
  meta: CaseMeta;
  /** 案件数据库种子：schema + 数据 */
  seedSql: string;
  schema: SchemaTable[];
  levels: DetectiveLevel[];
  /** 真凶姓名（指认答案） */
  culprit: string;
  accusation: CaseAccusation;
}

// ============================================================
// 通用结果校验工具（供各案件 validate 复用）
// ============================================================

/** 把结果所有单元格拍平成字符串 */
export function flatten(res: QueryResult): string[] {
  return res.rows.flat().map((c) => (c === null ? "" : String(c)));
}

/** 结果里是否存在「精确等于」这些值的单元格（每个都要有） */
export function includesAll(res: QueryResult, needles: string[]): boolean {
  const set = new Set(flatten(res));
  return needles.every((n) => set.has(n));
}

/** 是否存在「包含」该子串的单元格（用于长文本线索） */
export function anyCellContains(res: QueryResult, sub: string): boolean {
  return flatten(res).some((c) => c.includes(sub));
}

/** 是否存在「某一行」同时包含这些精确值（用于校验聚合/分组结果的成对出现） */
export function rowSetContains(res: QueryResult, needles: string[]): boolean {
  return res.rows.some((row) => {
    const set = new Set(row.map((c) => (c === null ? "" : String(c))));
    return needles.every((n) => set.has(n));
  });
}
