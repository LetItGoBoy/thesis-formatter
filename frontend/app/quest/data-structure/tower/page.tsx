"use client";

/**
 * 霓虹栈城 · 倾斜高塔（AVL 平衡树）
 * 玩法：吊装新构件（插入）→ 塔失衡时整体倾斜 → 玩家找出失衡结点
 * → 选择正确旋转（右旋/左旋/LR/RL）扶正。
 */
import { useState } from "react";
import { GameShell, type DsBrief, type DsLevelMeta, type DsStatus } from "@/components/ds/GameShell";
import { TreeSVG, type TNode } from "@/components/ds/TreeSVG";

const HUE = 25;

const BRIEFING: DsBrief[] = [
  {
    term: "平衡因子（BF）",
    story:
      "高塔的每个承重节点都装着水平仪：左翼高度减右翼高度。读数 -1、0、+1 都算稳；一旦到 ±2，整座塔就开始往重的一边倾斜。",
    definition:
      "平衡因子 = 左子树高度 − 右子树高度。AVL 树要求所有结点 |BF| ≤ 1，超出即失衡。",
  },
  {
    term: "失衡结点",
    story:
      "新构件吊上去的瞬间，报警的不一定是它自己——顺着吊装路径往上看，第一个水平仪爆表的节点，才是要动手术的地方。",
    definition:
      "插入后沿插入路径向上回溯，最低的 |BF| > 1 结点即最小失衡子树的根，只需对它做旋转。",
  },
  {
    term: "四种失衡形态",
    story:
      "老工程师的口诀：重量压在左翼的左边（LL），右手一转；压在右翼的右边（RR），左手一转；压在左翼的右边（LR）或右翼的左边（RL），得先小转一次再大转一次。",
    definition:
      "LL→右旋；RR→左旋；LR→先对左孩子左旋再右旋；RL→先对右孩子右旋再左旋。判别依据：新值落在失衡结点哪个孙辈方向。",
  },
  {
    term: "旋转",
    story:
      "旋转不是拆塔重盖——只是把两层承重节点换个位置抱住，中间的翼挪个手。一次旋转，塔应声扶正，归档规矩（左小右大）分毫不乱。",
    definition:
      "旋转在 O(1) 时间内调整局部结构且保持 BST 有序性；右旋提升左孩子，左旋提升右孩子。",
  },
];

interface TowerLevel extends DsLevelMeta {
  sequence: number[];
}

const LEVELS: TowerLevel[] = [
  {
    badge: "任务 01",
    title: "左倾事故",
    concept: "LL 型 · 右旋",
    story: "工人按 3、2、1 吊装构件，全压在左翼的左边。第三件落位的瞬间，塔向左歪出警戒线。",
    task: "吊装 3、2、1。塔倾斜后：点击失衡结点，再选择正确的旋转。",
    sequence: [3, 2, 1],
    hint: "新构件 1 落在结点 3 的左孩子的左边——这是 LL 型，右旋一次。",
    skeleton: "吊装 3 → 吊装 2 → 吊装 1（失衡）→ 点结点 3 → 右旋 → 2(1,3)",
    winNote: "LL 型：重量在左·左，右旋提升左孩子，三个结点一步归位。",
  },
  {
    badge: "任务 02",
    title: "右倾事故",
    concept: "RR 型 · 左旋",
    story: "另一组工人按 1、2、3 吊装，全压在右翼的右边——和上次完美对称的事故。",
    task: "吊装 1、2、3。失衡后点失衡结点，选正确旋转。",
    sequence: [1, 2, 3],
    hint: "镜像问题用镜像解法：RR 型，左旋。",
    skeleton: "吊装 1 → 吊装 2 → 吊装 3（失衡）→ 点结点 1 → 左旋 → 2(1,3)",
    winNote: "RR 型与 LL 型互为镜像：左旋提升右孩子。",
  },
  {
    badge: "任务 03",
    title: "拐角难题",
    concept: "LR 型 · 先左后右",
    story: "这次的重量很刁钻：压在左翼的右边（3、1、2）。老工程师摇头：一次旋转救不了，得转两次。",
    task: "吊装 3、1、2。失衡后点失衡结点，选正确的复合旋转。",
    sequence: [3, 1, 2],
    hint: "直接右旋会把问题原样甩到右边。先对左孩子左旋「拉直」成 LL，再右旋。",
    skeleton: "吊装 3 → 吊装 1 → 吊装 2（失衡）→ 点结点 3 → 先左旋后右旋 → 2(1,3)",
    winNote: "LR 型「拐着弯的重量」：先小转拉直成 LL，再按 LL 处理。",
  },
  {
    badge: "任务 04",
    title: "镜像拐角",
    concept: "RL 型 · 先右后左",
    story: "1、3、2——重量压在右翼的左边。你已经看出规律了：这是拐角难题的镜像。",
    task: "吊装 1、3、2。失衡后点失衡结点，选正确的复合旋转。",
    sequence: [1, 3, 2],
    hint: "RL 型：先对右孩子右旋拉直成 RR，再左旋。",
    skeleton: "吊装 1 → 吊装 3 → 吊装 2（失衡）→ 点结点 1 → 先右旋后左旋 → 2(1,3)",
    winNote: "四种形态你已集齐：LL/RR 一次旋转，LR/RL 两次。判别只看新值落在哪个孙辈方向。",
  },
  {
    badge: "任务 05",
    title: "通宵抢工",
    concept: "连续插入综合演练",
    story:
      "竣工前夜，七件构件连夜吊装：10、20、30、5、4、25、27。塔会失衡三次——每一次，都要你来扶正。",
    task: "完成全部吊装，正确处理途中出现的每一次失衡。",
    sequence: [10, 20, 30, 5, 4, 25, 27],
    alert: "三次失衡",
    hint: "30 进来是 RR；4 进来是 LL；27 进来时重量压在 30 的左翼右边——LR。",
    skeleton: "10,20,30→左旋(10) → 5 → 4→右旋(10) → 25 → 27→先左旋后右旋(30)",
    winNote: "AVL 在每次插入后即时小修，永远把高度压在 O(log n)——歪塔惊魂不再重演。",
  },
];

// ---------- AVL 工具 ----------
function h(n: TNode | null): number {
  return n ? 1 + Math.max(h(n.l), h(n.r)) : 0;
}
function bf(n: TNode): number {
  return h(n.l) - h(n.r);
}
function clone(n: TNode | null): TNode | null {
  return n ? { v: n.v, l: clone(n.l), r: clone(n.r) } : null;
}
function bstInsert(n: TNode | null, v: number): TNode {
  if (!n) return { v, l: null, r: null };
  if (v < n.v) n.l = bstInsert(n.l, v);
  else n.r = bstInsert(n.r, v);
  return n;
}
type RotKind = "LL" | "RR" | "LR" | "RL";
/** 找最低失衡结点（沿插入路径回溯）并判型 */
function findUnbalanced(root: TNode | null, v: number): { node: number; kind: RotKind } | null {
  const path: TNode[] = [];
  let cur = root;
  while (cur) {
    path.push(cur);
    if (v === cur.v) break;
    cur = v < cur.v ? cur.l : cur.r;
  }
  for (let i = path.length - 1; i >= 0; i--) {
    const n = path[i];
    const b = bf(n);
    if (b > 1) return { node: n.v, kind: v < n.l!.v ? "LL" : "LR" };
    if (b < -1) return { node: n.v, kind: v > n.r!.v ? "RR" : "RL" };
  }
  return null;
}
function rotR(y: TNode): TNode {
  const x = y.l!;
  y.l = x.r;
  x.r = y;
  return x;
}
function rotL(y: TNode): TNode {
  const x = y.r!;
  y.r = x.l;
  x.l = y;
  return x;
}
function fixAt(n: TNode | null, target: number, kind: RotKind): TNode | null {
  if (!n) return null;
  if (n.v === target) {
    if (kind === "LL") return rotR(n);
    if (kind === "RR") return rotL(n);
    if (kind === "LR") {
      n.l = rotL(n.l!);
      return rotR(n);
    }
    n.r = rotR(n.r!);
    return rotL(n);
  }
  n.l = fixAt(n.l, target, kind);
  n.r = fixAt(n.r, target, kind);
  return n;
}

const ROT_LABELS: { kind: RotKind; label: string }[] = [
  { kind: "LL", label: "右旋（LL 型）" },
  { kind: "RR", label: "左旋（RR 型）" },
  { kind: "LR", label: "先左旋后右旋（LR 型）" },
  { kind: "RL", label: "先右旋后左旋（RL 型）" },
];

type Phase = "insert" | "pickNode" | "pickRot";

export default function TowerPage() {
  const [levelIdx, setLevelIdx] = useState(0);
  const [maxCleared, setMaxCleared] = useState(0);
  const level = LEVELS[levelIdx];

  const [root, setRoot] = useState<TNode | null>(null);
  const [queueIdx, setQueueIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("insert");
  const [pending, setPending] = useState<{ node: number; kind: RotKind } | null>(null);
  const [status, setStatus] = useState<DsStatus>("playing");
  const [mistakes, setMistakes] = useState(0);
  const [msg, setMsg] = useState("");

  function loadLevel(i: number) {
    setLevelIdx(i);
    setRoot(null);
    setQueueIdx(0);
    setPhase("insert");
    setPending(null);
    setStatus("playing");
    setMistakes(0);
    setMsg("");
  }

  function craneNext() {
    if (status !== "playing" || phase !== "insert" || queueIdx >= level.sequence.length) return;
    const v = level.sequence[queueIdx];
    const nr = bstInsert(clone(root), v);
    setRoot(nr);
    setQueueIdx(queueIdx + 1);
    const unbal = findUnbalanced(nr, v);
    if (unbal) {
      setPending(unbal);
      setPhase("pickNode");
      setMsg(`⚠ 塔失衡了！顺着 ${v} 的吊装路径往上找：点击水平仪爆表（|BF|>1）的那个结点。`);
    } else {
      setMsg("");
      if (queueIdx + 1 === level.sequence.length) {
        setStatus("won");
        setMaxCleared((m) => Math.max(m, levelIdx + 1));
      }
    }
  }

  function clickNode(v: number) {
    if (status !== "playing" || phase !== "pickNode" || !pending) return;
    if (v === pending.node) {
      setPhase("pickRot");
      setMsg(`✅ 失衡结点就是 ${v}。现在判型：新构件压在它哪个孙辈方向？选择旋转方式。`);
    } else {
      setMistakes((m) => m + 1);
      setMsg(`🚫 ${v} 的水平仪还在安全区。找「最低」的那个 |BF|>1 的结点。`);
    }
  }

  function pickRotation(kind: RotKind) {
    if (status !== "playing" || phase !== "pickRot" || !pending) return;
    if (kind === pending.kind) {
      const nr = fixAt(clone(root), pending.node, kind);
      setRoot(nr);
      setPending(null);
      setPhase("insert");
      setMsg("🏗️ 旋转完成，塔扶正了！");
      if (queueIdx === level.sequence.length) {
        setStatus("won");
        setMaxCleared((m) => Math.max(m, levelIdx + 1));
      }
    } else {
      setMistakes((m) => m + 1);
      setMsg("🚫 这么转塔会塌得更快——重新判型：新值落在失衡结点的哪一侧的哪一边？");
    }
  }

  // 失衡时塔整体倾斜
  const tiltDeg =
    pending && root ? (pending.kind.startsWith("L") ? -3 : 3) : 0;

  function nodeFill(v: number): string {
    if (pending && v === pending.node) return "hsl(0 70% 40%)";
    return "hsl(220 30% 22%)";
  }
  function nodeLabel(v: number): string | null {
    const find = (n: TNode | null): TNode | null =>
      !n ? null : n.v === v ? n : find(n.l) ?? find(n.r);
    const n = find(root);
    if (!n) return null;
    const b = bf(n);
    return `bf${b >= 0 ? "+" : ""}${b}`;
  }

  return (
    <GameShell
      code="AVL"
      name="倾斜高塔"
      structure="平衡树 AVL"
      hue={HUE}
      districtNo="城区 05"
      flavor="数据总往一边堆，塔就会倾斜。找到失衡结点，一次旋转扶正整座塔。"
      briefing={BRIEFING}
      levels={LEVELS}
      levelIdx={levelIdx}
      maxCleared={maxCleared}
      onSelectLevel={loadLevel}
      status={status}
      mistakes={mistakes}
      onRetry={() => loadLevel(levelIdx)}
      onNext={() => loadLevel(levelIdx + 1)}
      completionText="高塔永立！下一站：中央邮局（哈希表）"
      consoleSlot={
        <>
          <button
            type="button"
            onClick={craneNext}
            disabled={status !== "playing" || phase !== "insert" || queueIdx >= level.sequence.length}
            className="w-full rounded-xl bg-cyan-400/90 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
          >
            吊装下一件
            {phase === "insert" && queueIdx < level.sequence.length ? ` · ${level.sequence[queueIdx]}` : ""}
          </button>
          {phase === "pickRot" && (
            <div className="space-y-1.5">
              {ROT_LABELS.map((r) => (
                <button
                  key={r.kind}
                  type="button"
                  onClick={() => pickRotation(r.kind)}
                  className="w-full rounded-xl bg-fuchsia-400/80 px-3 py-2 text-xs font-bold text-slate-950 transition hover:bg-fuchsia-300"
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
          <div className="rounded-xl bg-slate-50 p-3 text-xs leading-6 text-slate-600 ring-1 ring-slate-200">
            吊装序列：
            {level.sequence.map((v, i) => (
              <span key={i} className={i < queueIdx ? "text-emerald-600" : i === queueIdx ? "font-bold text-cyan-600" : "text-slate-500"}>
                {i > 0 && "、"}
                {v}
              </span>
            ))}
          </div>
        </>
      }
    >
      <div className="mb-2 flex items-center justify-between font-mono text-[11px] tracking-widest text-slate-500">
        <span>BALANCE TOWER · 高塔（每个结点标注平衡因子）</span>
        <span className={pending ? "font-bold text-red-600" : "text-emerald-600"}>
          {pending ? "⚠ 失衡" : "稳定"}
        </span>
      </div>
      <div
        className="rounded-xl border border-slate-200 bg-slate-50 p-3 transition-transform duration-700"
        style={{ transform: `rotate(${tiltDeg}deg)` }}
      >
        {root ? (
          <TreeSVG root={root} onNodeClick={clickNode} nodeFill={nodeFill} nodeLabel={nodeLabel} />
        ) : (
          <div className="py-10 text-center text-sm text-slate-400">塔基已就绪，点「吊装下一件」开工</div>
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
