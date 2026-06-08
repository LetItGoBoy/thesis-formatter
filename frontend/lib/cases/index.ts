/**
 * 案件注册表 + 季度路线图
 * frontend/lib/cases/index.ts
 *
 * 已实现的案件放进 CASES（按 order 排序）；SEASON_PLAN 是完整 8 案蓝图，
 * 用于 hub 展示「已开放 / 敬请期待」。新增一案 = 写一个 case 文件 + 在此登记。
 */
import type { DetectiveCase } from "../db-detective";
import { caseBackAlley } from "./case-01-backalley";
import { caseShadow } from "./case-02-shadow";
import { caseNetwork } from "./case-03-network";
import { caseNestedLies } from "./case-04-nested-lies";
import { caseTampered } from "./case-05-tampered";
import { caseNormalForm } from "./case-06-normal-form";
import { caseInvisibleTransfer } from "./case-07-invisible-transfer";
import { caseLogNeverLies } from "./case-08-log-never-lies";

export const CASES: DetectiveCase[] = [
  caseBackAlley,
  caseShadow,
  caseNetwork,
  caseNestedLies,
  caseTampered,
  caseNormalForm,
  caseInvisibleTransfer,
  caseLogNeverLies,
];

export function getCase(id: string): DetectiveCase | undefined {
  return CASES.find((c) => c.id === id);
}

export interface SeasonEntry {
  order: number;
  title: string;
  concepts: string;
  /** 已实现的案件有 id；未实现为 null */
  id: string | null;
}

/** 完整一季 8 案蓝图（校对者 ROLLBACK 主线） */
export const SEASON_PLAN: SeasonEntry[] = [
  { order: 1, title: "后巷的打卡记录", concepts: "SELECT · WHERE · LIKE · JOIN", id: caseBackAlley.id },
  { order: 2, title: "高频的影子", concepts: "聚合 · GROUP BY · HAVING · ORDER BY", id: caseShadow.id },
  { order: 3, title: "错综的关系网", concepts: "内/外连接 · 自连接 · IS NULL", id: caseNetwork.id },
  { order: 4, title: "嵌套的谎言", concepts: "子查询 · EXISTS · 集合运算", id: caseNestedLies.id },
  { order: 5, title: "被篡改的档案", concepts: "INSERT/UPDATE/DELETE · 视图 · 完整性约束", id: caseTampered.id },
  { order: 6, title: "范式的裂缝", concepts: "函数依赖 · 范式 · 数据冗余异常", id: caseNormalForm.id },
  { order: 7, title: "看不见的转账", concepts: "事务 ACID · 并发控制 · 隔离级别", id: caseInvisibleTransfer.id },
  { order: 8, title: "日志不会说谎", concepts: "恢复(redo/undo) · 权限安全 · 综合", id: caseLogNeverLies.id },
];

export const SEASON_META = {
  title: "雾港档案 · SQL 探案集",
  subtitle: "数据库原理 · SQL 侦探",
  villain:
    "雾港城市档案库正被一个化名「校对者 ROLLBACK」的人悄悄篡改。每破一案，你都离这个幕后黑手更近一步——直到揭穿 TA 的真实身份。",
};
