"use client";

/**
 * 霓虹栈城 · 档案塔（二叉树 / 二叉排序树）
 * 玩法：在树上亲手走——查档每层抉择左右；插入点对空位；
 * 三种巡逻路线 = 三种遍历；终关体验「退化成一根棍」。
 */
import { useState } from "react";
import { GameShell, type DsBrief, type DsLevelMeta, type DsStatus } from "@/components/ds/GameShell";
import { TreeSVG, type TNode, type TreeSlot } from "@/components/ds/TreeSVG";

const HUE = 45;

const BRIEFING: DsBrief[] = [
  {
    term: "二叉排序树（BST）",
    story:
      "档案塔的归档规矩传了三代人：比当前档号小的，放左边塔翼；大的，放右边塔翼。每一层都这么放，整座塔自己就是一张排好序的地图。",
    definition:
      "二叉排序树：任意结点的左子树所有值 < 该结点 < 右子树所有值。查找、插入沿比较路径下行，平均 O(log n)。",
  },
  {
    term: "查找路径",
    story:
      "找档案不用翻遍整座塔——从塔顶开始，每层只问一句「比你小还是大」，就把一半塔翼排除在外。七层的塔，三次就能锁定。",
    definition:
      "BST 查找：目标小于当前结点则入左子树，大于则入右子树，等于即命中；路径长度 = 结点深度。",
  },
  {
    term: "三种遍历",
    story:
      "巡逻队有三条路线：先查自己再查两翼（前序）、先左翼再自己再右翼（中序）、两翼查完才查自己（后序）。中序路线走完，报出的档号竟然天然有序。",
    definition:
      "前序：根-左-右；中序：左-根-右；后序：左-右-根。对 BST 做中序遍历，输出严格递增。",
  },
  {
    term: "退化",
    story:
      "新来的档案员把档案按编号顺序一份份入库，塔越长越歪——最后长成了一根直棍。找最底层的档案，要把整根棍走完。",
    definition:
      "按有序序列插入，BST 退化为单支链，查找恶化为 O(n)——这正是平衡树（AVL）诞生的理由。",
  },
];

interface ArchiveLevel extends DsLevelMeta {
  mode: "search" | "insert" | "traverse";
  initialValues: number[];
  target?: number;
  insertQueue?: number[];
  traversalKind?: "in" | "pre";
}

const BASE = [50, 30, 70, 20, 40, 60, 80];

const LEVELS: ArchiveLevel[] = [
  {
    badge: "任务 01",
    title: "三问锁定",
    concept: "BST 查找",
    story: "市民来取 40 号档案。塔顶管理员只教你一句话：小的往左，大的往右。",
    task: "从塔顶 50 出发，逐层点击正确的下一个结点，找到 40 号档案。",
    mode: "search",
    initialValues: BASE,
    target: 40,
    hint: "40 < 50，往左到 30；40 > 30，往右——就到了。每一步都只是一次比较。",
    skeleton: "50（40<50 往左）→ 30（40>30 往右）→ 40 ✓ 共 3 步",
    winNote: "7 份档案只走了 3 步——每次比较排除一半，这就是 O(log n) 的手感。",
  },
  {
    badge: "任务 02",
    title: "新档入库",
    concept: "BST 插入",
    story: "今天新到三份档案：65、25、75。归档规矩不变：小的往左，大的往右，走到空位就放下。",
    task: "依次为 65、25、75 点击正确的空位（虚线圈）。",
    mode: "insert",
    initialValues: BASE,
    insertQueue: [65, 25, 75],
    hint: "在心里走一遍查找路径：65 → 比 50 大往右、比 70 小往左、比 60 大往右——落在 60 的右空位。",
    skeleton: "65 → 60 的右空位；25 → 20 的右空位；75 → 80 的左空位",
    winNote: "插入 = 一次失败的查找 + 在终点放下新结点。树的形状由到来的顺序决定。",
  },
  {
    badge: "任务 03",
    title: "有序巡逻",
    concept: "中序遍历",
    story: "夜间巡逻走「中序路线」：先左翼、再自己、后右翼。老管理员神秘一笑：走完你会发现一个秘密。",
    task: "按中序顺序点击所有结点（左-根-右）。",
    mode: "traverse",
    initialValues: BASE,
    traversalKind: "in",
    hint: "最先点的是一路向左的最深结点（20），最后是一路向右的最深结点（80）。",
    skeleton: "20 → 30 → 40 → 50 → 60 → 70 → 80",
    winNote: "秘密揭晓：BST 的中序遍历恰好是从小到大——树长什么样，序就藏在哪。",
  },
  {
    badge: "任务 04",
    title: "送信路线",
    concept: "前序遍历",
    story: "给每层管理员送通知要走「前序路线」：先送自己，再送左翼，最后右翼——保证上级永远比下级先收到。",
    task: "按前序顺序点击所有结点（根-左-右）。",
    mode: "traverse",
    initialValues: BASE,
    traversalKind: "pre",
    hint: "第一个就是塔顶 50；随后整个左翼送完，才轮到右翼。",
    skeleton: "50 → 30 → 20 → 40 → 70 → 60 → 80",
    winNote: "前序「先根」适合复制整棵树、输出目录结构——根先于子孙出现。",
  },
  {
    badge: "任务 05",
    title: "歪塔惊魂",
    concept: "BST 退化",
    story:
      "档案局空了一座新塔。粗心的同事把 10、20、30、40、50 按顺序一份份入库——你边放边觉得不对劲：这塔怎么只往一边长？",
    task: "依次把 10、20、30、40、50 放进正确空位，亲眼看着塔长歪。",
    mode: "insert",
    initialValues: [],
    insertQueue: [10, 20, 30, 40, 50],
    alert: "事故现场",
    hint: "每个新档号都比之前的大——所以每次都落在最右端的右空位。",
    skeleton: "10 进根 → 20 进 10 右 → 30 进 20 右 → 40 进 30 右 → 50 进 40 右（一根棍）",
    winNote:
      "有序插入让 BST 退化成链：找 50 要走 5 步，而平衡时只要 3 步。如何让塔自己扶正？下一城区：倾斜高塔（AVL）。",
  },
];

function buildBST(values: number[]): TNode | null {
  let root: TNode | null = null;
  for (const v of values) root = insert(root, v);
  return root;
}
function insert(n: TNode | null, v: number): TNode {
  if (!n) return { v, l: null, r: null };
  if (v < n.v) n.l = insert(n.l, v);
  else n.r = insert(n.r, v);
  return n;
}
function inOrder(n: TNode | null, out: number[] = []): number[] {
  if (!n) return out;
  inOrder(n.l, out);
  out.push(n.v);
  inOrder(n.r, out);
  return out;
}
function preOrder(n: TNode | null, out: number[] = []): number[] {
  if (!n) return out;
  out.push(n.v);
  preOrder(n.l, out);
  preOrder(n.r, out);
  return out;
}
function nullSlots(n: TNode | null, out: TreeSlot[] = []): TreeSlot[] {
  if (!n) return out;
  if (!n.l) out.push({ key: `${n.v}-l`, parent: n.v, side: "l" });
  if (!n.r) out.push({ key: `${n.v}-r`, parent: n.v, side: "r" });
  nullSlots(n.l, out);
  nullSlots(n.r, out);
  return out;
}
/** 值 v 应落入的空位 */
function expectedSlot(root: TNode | null, v: number): TreeSlot | null {
  if (!root) return null;
  let cur = root;
  for (;;) {
    if (v < cur.v) {
      if (!cur.l) return { key: `${cur.v}-l`, parent: cur.v, side: "l" };
      cur = cur.l;
    } else {
      if (!cur.r) return { key: `${cur.v}-r`, parent: cur.v, side: "r" };
      cur = cur.r;
    }
  }
}
function findNode(n: TNode | null, v: number): TNode | null {
  if (!n) return null;
  if (n.v === v) return n;
  return v < n.v ? findNode(n.l, v) : findNode(n.r, v);
}
function depth(n: TNode | null): number {
  return n ? 1 + Math.max(depth(n.l), depth(n.r)) : 0;
}

export default function ArchivePage() {
  const [levelIdx, setLevelIdx] = useState(0);
  const [maxCleared, setMaxCleared] = useState(0);
  const level = LEVELS[levelIdx];

  const [values, setValues] = useState<number[]>(LEVELS[0].initialValues);
  const [currentAt, setCurrentAt] = useState<number | null>(LEVELS[0].initialValues[0] ?? null);
  const [pathTaken, setPathTaken] = useState<number[]>([]);
  const [insertIdx, setInsertIdx] = useState(0);
  const [visitIdx, setVisitIdx] = useState(0);
  const [status, setStatus] = useState<DsStatus>("playing");
  const [mistakes, setMistakes] = useState(0);
  const [msg, setMsg] = useState("");

  const root = buildBST(values);
  const seq = level.traversalKind === "pre" ? preOrder(root) : inOrder(root);

  function loadLevel(i: number) {
    const lv = LEVELS[i];
    setLevelIdx(i);
    setValues([...lv.initialValues]);
    setCurrentAt(lv.initialValues[0] ?? null);
    setPathTaken(lv.initialValues.length ? [lv.initialValues[0]] : []);
    setInsertIdx(0);
    setVisitIdx(0);
    setStatus("playing");
    setMistakes(0);
    setMsg("");
  }

  function clickNode(v: number) {
    if (status !== "playing") return;
    if (level.mode === "search") {
      const cur = findNode(root, currentAt!)!;
      const want = level.target!;
      const expected = want < cur.v ? cur.l?.v : cur.r?.v;
      if (v === expected) {
        setCurrentAt(v);
        setPathTaken((p) => [...p, v]);
        if (v === want) {
          setStatus("won");
          setMaxCleared((m) => Math.max(m, levelIdx + 1));
          setMsg("");
        } else {
          setMsg(`${want} ${want < v ? "<" : ">"} ${v}，继续往${want < v ? "左" : "右"}。`);
        }
      } else {
        setMistakes((m) => m + 1);
        setMsg(`🚫 ${want} ${want < cur.v ? "<" : ">"} ${cur.v}，应该往${want < cur.v ? "左" : "右"}翼走。`);
      }
      return;
    }
    if (level.mode === "traverse") {
      if (v === seq[visitIdx]) {
        const n = visitIdx + 1;
        setVisitIdx(n);
        setMsg("");
        if (n === seq.length) {
          setStatus("won");
          setMaxCleared((m) => Math.max(m, levelIdx + 1));
        }
      } else {
        setMistakes((m) => m + 1);
        setMsg(`🚫 ${level.traversalKind === "in" ? "中序" : "前序"}路线下一个不是 ${v}——再想想根和左右翼的次序。`);
      }
    }
  }

  function clickSlot(s: TreeSlot) {
    if (status !== "playing" || level.mode !== "insert") return;
    const v = level.insertQueue![insertIdx];
    const exp = expectedSlot(root, v);
    if (exp && exp.parent === s.parent && exp.side === s.side) {
      const nextValues = [...values, v];
      setValues(nextValues);
      const ni = insertIdx + 1;
      setInsertIdx(ni);
      setMsg(`✅ ${v} 已归档（${s.parent} 的${s.side === "l" ? "左" : "右"}空位）。`);
      if (ni === level.insertQueue!.length) {
        setStatus("won");
        setMaxCleared((m) => Math.max(m, levelIdx + 1));
      }
    } else {
      setMistakes((m) => m + 1);
      setMsg(`🚫 ${v} 不该放那——从塔顶走一遍：小往左，大往右。`);
    }
  }

  function placeRoot() {
    if (status !== "playing" || level.mode !== "insert" || root) return;
    const v = level.insertQueue![insertIdx];
    setValues([v]);
    setInsertIdx(insertIdx + 1);
    setMsg(`✅ ${v} 成为塔顶（根结点）。`);
  }

  function nodeFill(v: number): string {
    if (level.mode === "search") {
      if (status === "won" && v === level.target) return "hsl(150 70% 32%)";
      if (v === currentAt) return "hsl(190 80% 35%)";
      if (pathTaken.includes(v)) return "hsl(220 30% 30%)";
    }
    if (level.mode === "traverse") {
      const idx = seq.indexOf(v);
      if (idx < visitIdx) return "hsl(150 60% 28%)";
      if (idx === visitIdx) return "hsl(220 30% 26%)";
    }
    return "hsl(220 30% 22%)";
  }

  const d = depth(root);

  return (
    <GameShell
      code="BST"
      courseId="ds-archive"
      name="档案塔"
      structure="二叉树 / BST"
      hue={HUE}
      districtNo="城区 04"
      flavor="按编号查档，每一层都要决定往左还是往右。三条巡逻路线，三种遍历。"
      briefing={BRIEFING}
      levels={LEVELS}
      levelIdx={levelIdx}
      maxCleared={maxCleared}
      onSelectLevel={loadLevel}
      status={status}
      mistakes={mistakes}
      onRetry={() => loadLevel(levelIdx)}
      onNext={() => loadLevel(levelIdx + 1)}
      completionText="档案塔秩序恢复！下一站：倾斜高塔（AVL）"
      consoleSlot={
        <div className="rounded-xl bg-slate-50 p-3 text-xs leading-6 text-slate-600 ring-1 ring-slate-200">
          {level.mode === "search" && (
            <>
              目标档案：<b className="text-cyan-600">{level.target}</b>
              <br />
              当前位置：<b className="text-fuchsia-600">{currentAt}</b>
              <br />
              已走步数：{pathTaken.length - 1}
            </>
          )}
          {level.mode === "insert" && (
            <>
              {insertIdx < (level.insertQueue?.length ?? 0) ? (
                <>
                  待入库：<b className="text-cyan-600">{level.insertQueue![insertIdx]} 号</b>
                  <br />
                  进度：{insertIdx} / {level.insertQueue!.length}
                </>
              ) : (
                "全部入库完成"
              )}
              <br />
              当前塔高（深度）：<b className={d >= 4 ? "text-red-600" : "text-emerald-600"}>{d}</b>
            </>
          )}
          {level.mode === "traverse" && (
            <>
              路线：<b className="text-cyan-600">{level.traversalKind === "in" ? "中序 左-根-右" : "前序 根-左-右"}</b>
              <br />
              已巡逻：{visitIdx} / {seq.length}
              {visitIdx > 0 && (
                <>
                  <br />
                  报号：{seq.slice(0, visitIdx).join(" → ")}
                </>
              )}
            </>
          )}
        </div>
      }
    >
      <div className="mb-2 flex items-center justify-between font-mono text-[11px] tracking-widest text-slate-600">
        <span>ARCHIVE TOWER · 档案塔</span>
        <span>结点 {values.length} · 深度 {d}</span>
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        {root ? (
          <TreeSVG
            root={root}
            onNodeClick={clickNode}
            nodeFill={nodeFill}
            slots={level.mode === "insert" && status === "playing" ? nullSlots(root) : undefined}
            onSlotClick={clickSlot}
          />
        ) : (
          <div className="flex justify-center py-8">
            <button
              type="button"
              onClick={placeRoot}
              className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-cyan-300/60 text-sm font-bold text-cyan-600 transition hover:bg-cyan-400/10"
            >
              放根
            </button>
          </div>
        )}
      </div>

      {msg && (
        <p className="mt-4 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-sm leading-6 text-amber-700">
          {msg}
        </p>
      )}
    </GameShell>
  );
}
