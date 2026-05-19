"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  useThesisStore,
  PARAGRAPH_TYPES,
  TYPE_LABEL,
} from "@/lib/store";
import { formatDocx } from "@/lib/api";

type FilterMode = "all" | "pending" | "low" | "confirmed";

const LOW_CONFIDENCE = 0.7;

export default function ReviewPage() {
  const router = useRouter();
  const {
    fileName,
    docxBase64,
    paragraphs,
    updateParagraph,
    confirmParagraph,
    unconfirmParagraph,
    confirmMany,
    setTypeMany,
    setOutput,
  } = useThesisStore();

  const [filter, setFilter] = useState<FilterMode>("all");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [batchType, setBatchType] = useState<string>("body");
  const [formatting, setFormatting] = useState(false);
  const [error, setError] = useState("");
  const firstLowRef = useRef<HTMLDivElement | null>(null);

  // 无数据回到首页
  useEffect(() => {
    if (paragraphs.length === 0) {
      router.replace("/");
    }
  }, [paragraphs.length, router]);

  // 首次加载滚动到第一个低置信段落
  useEffect(() => {
    if (paragraphs.length > 0 && firstLowRef.current) {
      firstLowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paragraphs.length]);

  const total = paragraphs.length;
  const confirmedCount = paragraphs.filter((p) => p.confirmed).length;
  const lowCount = paragraphs.filter(
    (p) => !p.confirmed && p.confidence < LOW_CONFIDENCE
  ).length;
  const pendingCount = paragraphs.filter((p) => !p.confirmed).length;
  const allConfirmed = total > 0 && confirmedCount === total;

  const filtered = useMemo(() => {
    switch (filter) {
      case "pending":
        return paragraphs.filter((p) => !p.confirmed);
      case "low":
        return paragraphs.filter(
          (p) => !p.confirmed && p.confidence < LOW_CONFIDENCE
        );
      case "confirmed":
        return paragraphs.filter((p) => p.confirmed);
      default:
        return paragraphs;
    }
  }, [filter, paragraphs]);

  let firstLowSeen = false;
  function isFirstLow(p: { confirmed?: boolean; confidence: number }) {
    if (firstLowSeen) return false;
    if (!p.confirmed && p.confidence < LOW_CONFIDENCE) {
      firstLowSeen = true;
      return true;
    }
    return false;
  }

  function toggleSelect(index: number, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(index);
      else next.delete(index);
      return next;
    });
  }

  function selectAllVisible() {
    setSelected(new Set(filtered.map((p) => p.index)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function batchSetType() {
    if (selected.size === 0) return;
    setTypeMany(Array.from(selected), batchType);
  }

  function batchConfirm() {
    if (selected.size === 0) return;
    confirmMany(Array.from(selected));
    clearSelection();
  }

  async function handleFormat() {
    if (!allConfirmed) return;
    setFormatting(true);
    setError("");
    try {
      const blob = await formatDocx(paragraphs, "hulunbeier_univ", docxBase64);
      setOutput(blob);
      router.push("/done");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setFormatting(false);
    }
  }

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* 顶部：标题 + 进度 */}
        <header className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur py-4 mb-4 border-b">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <h1 className="text-xl font-bold">逐段确认</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                文件：{fileName || "（未命名）"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/")}
              >
                重新上传
              </Button>
              {/* 格式化按钮：所有段落 confirmed=true 之前永远禁用 */}
              <Button
                size="md"
                disabled={!allConfirmed || formatting}
                onClick={handleFormat}
              >
                {formatting
                  ? "格式化中..."
                  : allConfirmed
                  ? "✅ 格式化并下载"
                  : `🔒 请先确认全部 (${confirmedCount}/${total})`}
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="flex justify-between text-xs text-slate-600 mb-1">
                <span>
                  已确认 <strong>{confirmedCount}</strong> / {total} 段
                </span>
                <span>
                  待确认 {pendingCount} · 低置信 {lowCount}
                </span>
              </div>
              <Progress value={total ? (confirmedCount / total) * 100 : 0} />
            </div>
          </div>

          {/* 筛选 + 批量 */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="flex gap-1 rounded-md bg-slate-200 p-0.5">
              {(
                [
                  ["all", `全部 ${total}`],
                  ["pending", `待确认 ${pendingCount}`],
                  ["low", `低置信 ${lowCount}`],
                  ["confirmed", `已确认 ${confirmedCount}`],
                ] as [FilterMode, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`px-3 py-1 text-xs rounded ${
                    filter === key
                      ? "bg-white shadow text-slate-900"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-slate-500">
                已选 {selected.size} 段
              </span>
              <Button size="sm" variant="outline" onClick={selectAllVisible}>
                全选当前
              </Button>
              <Button size="sm" variant="ghost" onClick={clearSelection}>
                清空
              </Button>
              <Select
                value={batchType}
                onChange={(e) => setBatchType(e.target.value)}
              >
                {PARAGRAPH_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
              <Button
                size="sm"
                variant="outline"
                disabled={selected.size === 0}
                onClick={batchSetType}
              >
                批量改类型
              </Button>
              <Button
                size="sm"
                disabled={selected.size === 0}
                onClick={batchConfirm}
              >
                批量确认
              </Button>
            </div>
          </div>
        </header>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            ⚠️ {error}
          </div>
        )}

        {/* 段落列表 */}
        <div className="space-y-3">
          {filtered.map((p, displayIdx) => {
            const isLow = !p.confirmed && p.confidence < LOW_CONFIDENCE;
            const isFirstLowParagraph = isFirstLow(p);
            return (
              <div
                key={p.index}
                ref={isFirstLowParagraph ? firstLowRef : undefined}
                className={`
                  rounded-lg border bg-white p-4 transition
                  ${p.confirmed ? "border-green-200 bg-green-50/30" : "border-slate-200"}
                  ${isLow ? "border-l-4 border-l-orange-400" : ""}
                `}
              >
                {isLow && (
                  <div className="mb-2 text-xs text-orange-600">
                    ⚠️ AI识别置信度低，请仔细核对
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={selected.has(p.index)}
                    onChange={(e) => toggleSelect(p.index, e.target.checked)}
                    className="mt-1"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <Badge variant="muted">
                        # {p.index + 1}
                      </Badge>
                      <Select
                        value={p.type}
                        onChange={(e) =>
                          updateParagraph(p.index, { type: e.target.value })
                        }
                        disabled={p.confirmed}
                      >
                        {PARAGRAPH_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </Select>

                      <div className="flex items-center gap-2 min-w-[140px]">
                        <Progress
                          value={p.confidence * 100}
                          className="w-24"
                          barClassName={
                            p.confidence >= 0.85
                              ? "bg-green-500"
                              : p.confidence >= LOW_CONFIDENCE
                              ? "bg-blue-500"
                              : "bg-orange-500"
                          }
                        />
                        <span className="text-xs text-slate-500 tabular-nums">
                          {(p.confidence * 100).toFixed(0)}%
                        </span>
                      </div>

                      {p.confirmed ? (
                        <Badge variant="success">已确认</Badge>
                      ) : (
                        <Badge variant={isLow ? "warning" : "default"}>
                          {TYPE_LABEL[p.type] || p.type}
                        </Badge>
                      )}

                      {p.reason && (
                        <span
                          className="text-xs text-slate-400 truncate max-w-xs"
                          title={p.reason}
                        >
                          {p.reason}
                        </span>
                      )}
                    </div>

                    <Textarea
                      value={p.text}
                      onChange={(e) =>
                        updateParagraph(p.index, { text: e.target.value })
                      }
                      disabled={p.confirmed}
                      rows={Math.min(8, Math.max(2, Math.ceil(p.text.length / 60) || 2))}
                      className="font-mono text-sm"
                    />

                    <div className="mt-2 flex justify-end gap-2">
                      {p.confirmed ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => unconfirmParagraph(p.index)}
                        >
                          撤销确认
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => confirmParagraph(p.index)}
                        >
                          ✓ 确认本段
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="rounded-lg bg-white p-12 text-center text-slate-500">
              当前筛选下没有段落
            </div>
          )}
        </div>

        {/* 底部固定栏：再放一个格式化按钮便于操作 */}
        <div className="mt-8 pb-8 flex justify-end">
          <Button
            size="lg"
            disabled={!allConfirmed || formatting}
            onClick={handleFormat}
          >
            {formatting
              ? "格式化中..."
              : allConfirmed
              ? "✅ 格式化并下载"
              : `🔒 请先确认全部 (${confirmedCount}/${total})`}
          </Button>
        </div>
      </div>
    </main>
  );
}
