/**
 * 浏览器内 SQLite（sql.js）封装
 * frontend/lib/sqljs.ts
 *
 * 纯前端运行真实 SQL：动态加载 sql.js（WASM 从自托管 /sql/sql-wasm.wasm 读取，
 * 不依赖外部 CDN），用案件种子建库，对外暴露 run(sql)。无后端、无网络往返。
 */
"use client";

import { useEffect, useRef, useState } from "react";
import type { Database } from "sql.js";
import type { QueryResult } from "./db-detective";

export type RunFn = (sql: string) => QueryResult;

export function useCaseDb(seedSql: string) {
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const dbRef = useRef<Database | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const initSqlJs = (await import("sql.js")).default;
        const SQL = await initSqlJs({ locateFile: () => "/sql/sql-wasm.wasm" });
        if (cancelled) return;
        const db = new SQL.Database();
        db.run(seedSql);
        dbRef.current = db;
        setReady(true);
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
      dbRef.current?.close();
      dbRef.current = null;
    };
  }, [seedSql]);

  function run(sql: string): QueryResult {
    const db = dbRef.current;
    if (!db) throw new Error("数据库尚未就绪");
    const res = db.exec(sql);
    if (!res.length) return { columns: [], rows: [] };
    return { columns: res[0].columns, rows: res[0].values as QueryResult["rows"] };
  }

  return { ready, loadError, run };
}
