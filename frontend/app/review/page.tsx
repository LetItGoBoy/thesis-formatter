"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  useThesisStore,
  BLOCKS,
  TYPES_BY_BLOCK,
  TYPE_LABEL,
  blockOf,
  type BlockKey,
} from "@/lib/store";
import { formatDocx } from "@/lib/api";
import type { Paragraph } from "@/lib/api";
import { BlockPreview } from "@/components/BlockPreview";

const LOW_CONFIDENCE = 0.7;

export default function ReviewPage() {
  const router = useRouter();
  const {
    fileName,
    docxBase64,
    paragraphs,
    template,
    updateParagraph,
    confirmParagraph,
    unconfirmParagraph,
    confirmBlock,
    deleteParagraph,
    addParagraph,
    addParagraphAfter,
    setOutput,
  } = useThesisStore();

  const [formatting, setFormatting] = useState(false);
  const [error, setError] = useState("");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [previewBlocks, setPreviewBlocks] = useState<Record<BlockKey, boolean>>({
    toc: true,
    abstract: true,
    body: true,
    conclusion: true,
    references: true,
  });

  // 预览点击 → 高亮并滚动到左侧对应的确认卡片
  function focusParagraph(index: number) {
    setSelectedIndex(index);
    const el = document.getElementById(`para-row-${index}`);
    if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  useEffect(() => {
    if (paragraphs.length === 0) router.replace("/");
  }, [paragraphs.length, router]);

  const grouped = useMemo(() => {
    const g: Record<BlockKey, Paragraph[]> = {
      toc: [],
      abstract: [],
      body: [],
      conclusion: [],
      references: [],
    };
    for (const p of paragraphs) {
      const blk = (p.block as BlockKey) || blockOf(p.type);
      (g[blk] || g.body).push(p);
    }
    for (const k of Object.keys(g) as BlockKey[]) {
      g[k].sort((a, b) => a.index - b.index);
    }
    return g;
  }, [paragraphs]);

  const total = paragraphs.length;
  const confirmedCount = paragraphs.filter((p) => p.confirmed).length;
  const allConfirmed = total > 0 && confirmedCount === total;

  async function handleFormat() {
    if (!allConfirmed) return;
    setFormatting(true);
    setError("");
    try {
      const blob = await formatDocx(paragraphs, template, docxBase64);
      setOutput(blob);
      router.push("/done");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setFormatting(false);
    }
  }

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-[110rem] mx-auto">
        <header className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur py-4 mb-4 border-b">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <h1 className="text-xl font-bold">分块确认与重构预览</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                文件：{fileName || "（未命名）"} · 共 {total} 段，已确认{" "}
                <strong>{confirmedCount}</strong> 段
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => router.push("/")}>
                重新上传
              </Button>
              <Button size="md" disabled={!allConfirmed || formatting} onClick={handleFormat}>
                {formatting
                  ? "格式化中..."
                  : allConfirmed
                  ? "✅ 格式化并下载"
                  : `🔒 请先确认全部 (${confirmedCount}/${total})`}
              </Button>
            </div>
          </div>
          <Progress value={total ? (confirmedCount / total) * 100 : 0} />
        </header>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            ⚠️ {error}
          </div>
        )}

        <div className="space-y-8">
          {BLOCKS.map((blk) => {
            const items = grouped[blk.key];
            const itemConfirmed = items.filter((p) => p.confirmed).length;
            const allBlockConfirmed = items.length > 0 && itemConfirmed === items.length;
            return (
              <section key={blk.key} className="rounded-2xl bg-white border border-slate-200 shadow-sm">
                <header className="p-4 border-b border-slate-200 bg-slate-50 rounded-t-2xl">
                 <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold">
                      {blk.order}. {blk.label}
                    </h2>
                    <p className="text-sm text-slate-500 mt-0.5">
                      共 {items.length} 段，已确认 {itemConfirmed} 段 · 将另起一页
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPreviewBlocks((s) => ({ ...s, [blk.key]: !s[blk.key] }))}
                    >
                      {previewBlocks[blk.key] ? "隐藏预览" : "显示预览"}
                    </Button>
                    <Button
                      size="sm"
                      disabled={items.length === 0 || allBlockConfirmed}
                      onClick={() => confirmBlock(blk.key)}
                    >
                      {allBlockConfirmed ? "✓ 本块已全部确认" : "全部确认本块"}
                    </Button>
                  </div>
                 </div>

                  {blk.commonMistakes.length > 0 && (
                    <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-amber-800">
                        ⚠️ 本块常犯内容错误（请逐条核对，格式已由系统自动对齐）
                      </div>
                      <ul className="mt-1.5 text-sm text-amber-800 space-y-1 list-disc pl-5">
                        {blk.commonMistakes.map((m, i) => (
                          <li key={i}>{m}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </header>

                <div className="grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-6 p-4">
                  <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-2">
                    {items.length === 0 ? (
                      <div className="text-center text-slate-400 text-sm py-8">
                        本块暂无段落（AI 未识别到此类型）
                      </div>
                    ) : (
                      items.map((p) => (
                        <div key={p.index}>
                          <ParagraphRow
                            p={p}
                            blockKey={blk.key}
                            selected={selectedIndex === p.index}
                            onSelect={setSelectedIndex}
                            onUpdate={updateParagraph}
                            onConfirm={confirmParagraph}
                            onUnconfirm={unconfirmParagraph}
                            onDelete={deleteParagraph}
                          />
                          <InsertDivider onClick={() => addParagraphAfter(p.index)} />
                        </div>
                      ))
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full border-dashed"
                      onClick={() => addParagraph(blk.key)}
                    >
                      ＋ 在本块末尾添加段落
                    </Button>
                  </div>

                  {previewBlocks[blk.key] && (
                    <BlockPreview
                      block={blk.key}
                      paragraphs={items}
                      selectedIndex={selectedIndex}
                      onSelect={focusParagraph}
                    />
                  )}
                </div>
              </section>
            );
          })}
        </div>

        <div className="mt-8 pb-12 flex justify-end">
          <Button size="lg" disabled={!allConfirmed || formatting} onClick={handleFormat}>
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

function InsertDivider({ onClick }: { onClick: () => void }) {
  return (
    <div className="group relative h-3 my-0.5 flex items-center justify-center">
      <button
        type="button"
        onClick={onClick}
        className="opacity-0 group-hover:opacity-100 transition flex items-center gap-1 rounded-full border border-dashed border-indigo-300 bg-white px-2 py-0.5 text-xs text-indigo-600 hover:bg-indigo-50"
      >
        ＋ 在此插入段落
      </button>
      <div className="absolute inset-x-0 top-1/2 -z-0 border-t border-dashed border-transparent group-hover:border-indigo-200" />
    </div>
  );
}

function ParagraphRow({
  p,
  blockKey,
  selected,
  onSelect,
  onUpdate,
  onConfirm,
  onUnconfirm,
  onDelete,
}: {
  p: Paragraph;
  blockKey: BlockKey;
  selected: boolean;
  onSelect: (i: number) => void;
  onUpdate: (i: number, patch: Partial<Paragraph>) => void;
  onConfirm: (i: number) => void;
  onUnconfirm: (i: number) => void;
  onDelete: (i: number) => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const isLow = !p.confirmed && p.confidence < LOW_CONFIDENCE;
  const currentBlock = (p.block as BlockKey) || blockOf(p.type);
  const movedFromOriginal = currentBlock !== blockKey;

  return (
    <div
      id={`para-row-${p.index}`}
      onMouseDown={() => onSelect(p.index)}
      className={`
        rounded-lg border p-3 scroll-mt-4
        ${p.confirmed ? "border-green-200 bg-green-50/30" : "border-slate-200 bg-white"}
        ${isLow ? "border-l-4 border-l-orange-400" : ""}
        ${selected ? "ring-2 ring-indigo-400 border-indigo-300" : ""}
      `}
    >
      {isLow && <div className="mb-2 text-sm text-orange-600">⚠️ 置信度低，请仔细核对</div>}

      <div className="flex flex-wrap items-center gap-2 mb-2">
        <Badge variant="muted">#{p.index + 1}</Badge>

        <Select
          value={p.type}
          onChange={(e) => onUpdate(p.index, { type: e.target.value })}
          disabled={p.confirmed}
        >
          <optgroup label={`${blockKey} · 本块类型`}>
            {TYPES_BY_BLOCK[blockKey].map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="── 移到其他大块 ──">
            {(Object.keys(TYPES_BY_BLOCK) as BlockKey[])
              .filter((k) => k !== blockKey)
              .flatMap((k) =>
                TYPES_BY_BLOCK[k].map((t) => (
                  <option key={`${k}_${t.value}`} value={t.value}>
                    [{k}] {t.label}
                  </option>
                ))
              )}
          </optgroup>
        </Select>

        <div className="flex items-center gap-1 min-w-[110px]">
          <Progress
            value={p.confidence * 100}
            className="w-16"
            barClassName={
              p.confidence >= 0.85
                ? "bg-green-500"
                : p.confidence >= LOW_CONFIDENCE
                ? "bg-blue-500"
                : "bg-orange-500"
            }
          />
          <span className="text-sm text-slate-500 tabular-nums">
            {(p.confidence * 100).toFixed(0)}%
          </span>
        </div>

        {p.confirmed ? (
          <Badge variant="success">已确认</Badge>
        ) : (
          <Badge variant={isLow ? "warning" : "default"}>{TYPE_LABEL[p.type] || p.type}</Badge>
        )}

        {movedFromOriginal && <Badge variant="warning">已移块</Badge>}
      </div>

      {p.type === "table" && p.cells ? (
        <TableEditor
          cells={p.cells}
          disabled={p.confirmed}
          onChange={(cells) => onUpdate(p.index, { cells })}
        />
      ) : (
        <Textarea
          value={p.text}
          onChange={(e) => onUpdate(p.index, { text: e.target.value })}
          disabled={p.confirmed}
          rows={Math.min(6, Math.max(2, Math.ceil(p.text.length / 60) || 2))}
          className="text-base leading-relaxed"
        />
      )}

      <div className="mt-2 flex justify-end gap-2">
        {confirmingDelete ? (
          <>
            <span className="text-xs text-red-600 self-center mr-auto">确认删除本段？</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmingDelete(false)}
            >
              取消
            </Button>
            <Button
              size="sm"
              className="bg-red-600 hover:bg-red-700"
              onClick={() => onDelete(p.index)}
            >
              删除
            </Button>
          </>
        ) : (
          <>
            <Button
              size="sm"
              variant="outline"
              className="mr-auto text-red-600 hover:bg-red-50"
              onClick={() => setConfirmingDelete(true)}
            >
              🗑 删除
            </Button>
            {p.confirmed ? (
              <Button size="sm" variant="outline" onClick={() => onUnconfirm(p.index)}>
                撤销确认
              </Button>
            ) : (
              <Button size="sm" onClick={() => onConfirm(p.index)}>
                ✓ 确认本段
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TableEditor({
  cells,
  disabled,
  onChange,
}: {
  cells: string[][];
  disabled?: boolean;
  onChange: (cells: string[][]) => void;
}) {
  function setCell(r: number, c: number, value: string) {
    const next = cells.map((row) => row.slice());
    next[r][c] = value;
    onChange(next);
  }
  return (
    <div className="overflow-x-auto rounded-md border border-slate-200">
      <table className="w-full border-collapse text-sm">
        <tbody>
          {cells.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td key={c} className="border border-slate-200 p-0">
                  <input
                    value={cell}
                    disabled={disabled}
                    onChange={(e) => setCell(r, c, e.target.value)}
                    className="w-full min-w-[6rem] bg-transparent px-2 py-1 outline-none focus:bg-blue-50 disabled:text-slate-500"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
