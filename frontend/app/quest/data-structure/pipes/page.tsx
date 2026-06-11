"use client";

/**
 * 霓虹栈城 · 管道区（链表）
 * 玩法：亲手改接 next 指针——先点源（HEAD 或某节管道），再点目标。
 * 失去引用的管段会飘进虚空（内存泄漏可视化）；暂存钩 = 临时指针变量。
 * 终关：快慢双巡检员步进相遇，识破管网中的环（Floyd 判环）。
 */
import { useState } from "react";
import { GameShell, type DsBrief, type DsLevelMeta, type DsStatus } from "@/components/ds/GameShell";

const HUE = 320;

const BRIEFING: DsBrief[] = [
  {
    term: "结点与 next 指针",
    story:
      "管道区没有连续的长管，只有一节节短管：每节管子尾部有一个接头（next），指向下一节在哪。水流顺着接头一路找下去——接头指错，后面整段就找不到了。",
    definition:
      "链表结点 = 数据域 + 指针域（next）。逻辑顺序由指针决定，物理位置无关紧要；头指针 HEAD 是整条链的唯一入口。",
  },
  {
    term: "内存泄漏（引用丢失）",
    story:
      "一节管子如果没有任何接头指着它，它就从管网里「飘走」了——还占着空间，却再也没人能找到它。老师傅管这叫「喂了虚空」。",
    definition:
      "失去所有引用的结点无法再被访问。改接指针的顺序错误是经典成因：先断开旧链，再建立新链，中间一步就可能丢失整段后继。",
  },
  {
    term: "暂存钩（临时指针）",
    story:
      "改接复杂管路前，老师傅总会先把关键的那节挂在腰间的暂存钩上——只要钩子挂着它，它就不会飘走。",
    definition:
      "临时指针变量在改接期间额外保存对结点的引用，防止其变为不可达。插入、删除、反转都靠它兜底。",
  },
  {
    term: "快慢指针判环",
    story:
      "传说有一段被改坏的管网，水流永远转不出来。两位巡检员同时出发：慢的一次走一节，快的一次走两节——如果管网成环，快的迟早从背后追上慢的。",
    definition:
      "Floyd 判环：快慢指针同起点出发，快者每次走两步、慢者一步；二者相遇则链表有环，快者先到 null 则无环。",
  },
];

interface PipeLevel extends DsLevelMeta {
  nodeIds: string[];
  next0: Record<string, string | null>;
  head0: string | null;
  temp0: string | null;
  mode: "traverse" | "rewire" | "cycle";
  targetChain?: string[];
  requireRecycled?: string[];
}

const LEVELS: PipeLevel[] = [
  {
    badge: "任务 01",
    title: "顺流巡检",
    concept: "遍历",
    story: "新人第一课：沿着接头把整条主管线走一遍。从 HEAD 出发，水流到哪，你走到哪。",
    task: "按指针指向的顺序，依次点击每节管道完成巡检。",
    nodeIds: ["A", "B", "C", "D"],
    next0: { A: "B", B: "C", C: "D", D: null },
    head0: "A",
    temp0: null,
    mode: "traverse",
    hint: "从 HEAD 指向的那节开始，每次走向 next 指向的下一节，直到 null。",
    skeleton: "HEAD → A → B → C → D → null，按 A、B、C、D 依次点击",
    winNote: "链表只能顺着 next 一步步走——没有下标直达，这是它与数组的根本差异。",
  },
  {
    badge: "任务 02",
    title: "切除病管",
    concept: "删除结点",
    story: "X 管段锈穿了，整段水压告急。把它从管线里切出去，再送进回收站。",
    task: "改接指针让水流绕过 X（HEAD → A → B），然后点击飘走的 X 将它回收。",
    nodeIds: ["A", "X", "B"],
    next0: { A: "X", X: "B", B: null },
    head0: "A",
    temp0: null,
    mode: "rewire",
    targetChain: ["A", "B"],
    requireRecycled: ["X"],
    hint: "先点 A（选中源头），再点 B——A 的接头直接跳过 X。X 没了引用就会飘起来。",
    skeleton: "点 A → 点 B（A.next=B，X 飘走）→ 点漂浮的 X 回收",
    winNote: "删除 = 前驱结点的 next 绕过目标。被绕过的结点失去引用，记得回收（free）。",
  },
  {
    badge: "任务 03",
    title: "插入新管",
    concept: "插入与改接顺序",
    story:
      "要在 A 和 B 之间加装净化段 N。N 正挂在你的暂存钩上。老师傅叮嘱：先接后断，顺序错了，下游整段管线就喂了虚空。",
    task: "把 N 插到 A、B 之间（HEAD → A → N → B → C），完成后取下暂存钩。",
    nodeIds: ["A", "B", "C", "N"],
    next0: { A: "B", B: "C", C: null, N: null },
    head0: "A",
    temp0: "N",
    mode: "rewire",
    targetChain: ["A", "N", "B", "C"],
    hint: "正确顺序：先让 N 指向 B（N.next=B），再让 A 指向 N。要是先改 A，B 和 C 立刻飘走——试试也无妨，还能抢救。",
    skeleton: "点 N → 点 B（N.next=B）→ 点 A → 点 N（A.next=N）→ 取下暂存钩",
    winNote: "插入口诀「先接后断」：新结点先挂住后继，再让前驱指过来。顺序反了就是一次泄漏事故。",
  },
  {
    badge: "任务 04",
    title: "逆流改造",
    concept: "链表反转",
    story:
      "泵站要反向供水：整条 A → B → C 管线必须调头成 C → B → A。管子一节都不能换，只能改接头。",
    task: "把链反转为 HEAD → C → B → A，不许有管段飘在虚空，最后清空暂存钩。",
    nodeIds: ["A", "B", "C"],
    next0: { A: "B", B: "C", C: null },
    head0: "A",
    temp0: null,
    mode: "rewire",
    targetChain: ["C", "B", "A"],
    hint: "先把 C 挂上暂存钩保住整条尾巴，再逐个调转每节的接头，最后让 HEAD 指向 C。",
    skeleton:
      "点 C → 挂到暂存钩 → 点 C → 点 B（C.next=B）→ 点 B → 点 A（B.next=A）→ 点 A → 指向 NULL → 点 HEAD → 点 C → 清空暂存钩",
    winNote: "反转 = 把每个 next 调头 + 头指针换到原尾部。临时引用兜底，每一步都不丢结点。",
  },
  {
    badge: "任务 05",
    title: "无尽回廊",
    concept: "快慢指针判环",
    story:
      "4 号管网的水流了一夜也没流出来——有人把 D 的接头偷偷接回了 B。派出快慢两名巡检员，用相遇证明环的存在，再把环拆掉。",
    task: "反复点「步进」直到两名巡检员相遇 → 点「确认相遇·有环」→ 把 D 的接头改为 NULL 拆环。",
    nodeIds: ["A", "B", "C", "D"],
    next0: { A: "B", B: "C", C: "D", D: "B" },
    head0: "A",
    temp0: null,
    mode: "cycle",
    targetChain: ["A", "B", "C", "D"],
    hint: "慢者一步、快者两步。若有环，快者必从身后追上慢者；相遇即证据。拆环 = 找到指回去的那个接头，掐断它。",
    skeleton: "步进 ×3（在 D 相遇）→ 确认相遇 → 点 D → 指向 NULL",
    winNote: "Floyd 判环：相遇即有环，O(1) 空间。工程里它揪出的是「永远走不完的链」。",
  },
];

function pipeStyle(id: string, drifting = false) {
  const h = (id.charCodeAt(0) * 53) % 360;
  return {
    background: `linear-gradient(160deg, hsl(${h} 70% ${drifting ? 16 : 26}%), hsl(${h} 65% ${drifting ? 9 : 14}%))`,
    boxShadow: drifting ? "none" : `inset 0 0 0 1px hsl(${h} 85% 65% / 0.5)`,
    color: `hsl(${h} 90% 78%)`,
  };
}

export default function PipesPage() {
  const [levelIdx, setLevelIdx] = useState(0);
  const [maxCleared, setMaxCleared] = useState(0);
  const level = LEVELS[levelIdx];

  const [next, setNext] = useState<Record<string, string | null>>(LEVELS[0].next0);
  const [head, setHead] = useState<string | null>(LEVELS[0].head0);
  const [temp, setTemp] = useState<string | null>(LEVELS[0].temp0);
  const [recycled, setRecycled] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null); // "HEAD" 或结点 id
  const [visitedN, setVisitedN] = useState(0); // 巡检关
  const [slowAt, setSlowAt] = useState<string | null>(null);
  const [fastAt, setFastAt] = useState<string | null>(null);
  const [steps, setSteps] = useState(0);
  const [metConfirmed, setMetConfirmed] = useState(false);
  const [leaked, setLeaked] = useState<string[]>([]); // 曾经泄漏过的结点（只记一次失误）
  const [status, setStatus] = useState<DsStatus>("playing");
  const [mistakes, setMistakes] = useState(0);
  const [msg, setMsg] = useState("");

  function loadLevel(i: number) {
    const lv = LEVELS[i];
    setLevelIdx(i);
    setNext({ ...lv.next0 });
    setHead(lv.head0);
    setTemp(lv.temp0);
    setRecycled([]);
    setSelected(null);
    setVisitedN(0);
    setSlowAt(lv.mode === "cycle" ? lv.head0 : null);
    setFastAt(lv.mode === "cycle" ? lv.head0 : null);
    setSteps(0);
    setMetConfirmed(false);
    setLeaked([]);
    setStatus("playing");
    setMistakes(0);
    setMsg("");
  }

  /** 从 head 出发的链（带环保护），返回顺序与回环目标 */
  function chainFrom(start: string | null, nx: Record<string, string | null>) {
    const order: string[] = [];
    const seen = new Set<string>();
    let cur = start;
    let cycleBackTo: string | null = null;
    while (cur) {
      if (seen.has(cur)) {
        cycleBackTo = cur;
        break;
      }
      seen.add(cur);
      order.push(cur);
      cur = nx[cur] ?? null;
    }
    return { order, cycleBackTo };
  }

  function reachableSet(h: string | null, t: string | null, nx: Record<string, string | null>) {
    const s = new Set<string>();
    for (const start of [h, t]) {
      let cur = start;
      const guard = new Set<string>();
      while (cur && !guard.has(cur)) {
        guard.add(cur);
        s.add(cur);
        cur = nx[cur] ?? null;
      }
    }
    return s;
  }

  const { order: chain, cycleBackTo } = chainFrom(head, next);
  const reach = reachableSet(head, temp, next);
  const drifting = level.nodeIds.filter((id) => !reach.has(id) && !recycled.includes(id));

  /** 改接后统一处理：泄漏检测 + 胜利判定 */
  function applyRewire(nh: string | null, nt: string | null, nn: Record<string, string | null>) {
    const newReach = reachableSet(nh, nt, nn);
    const newDrift = level.nodeIds.filter((id) => !newReach.has(id) && !recycled.includes(id));
    const fresh = newDrift.filter((id) => !drifting.includes(id) && !leaked.includes(id));
    if (fresh.length > 0) {
      setLeaked((l) => [...l, ...fresh]);
      setMistakes((m) => m + 1);
      setMsg(`💨 ${fresh.join("、")} 失去了所有引用，飘进虚空！（仍可点击它把它接回来）`);
    } else {
      setMsg("");
    }
    setHead(nh);
    setTemp(nt);
    setNext(nn);
    checkWin(nh, nt, nn, recycled, metConfirmed);
  }

  function checkWin(
    h: string | null,
    t: string | null,
    nn: Record<string, string | null>,
    rec: string[],
    met: boolean
  ) {
    if (level.mode === "traverse") return;
    const { order, cycleBackTo: cyc } = chainFrom(h, nn);
    const newReach = reachableSet(h, t, nn);
    const drift = level.nodeIds.filter((id) => !newReach.has(id) && !rec.includes(id));
    if (level.mode === "rewire") {
      const chainOK =
        !cyc &&
        level.targetChain!.length === order.length &&
        level.targetChain!.every((id, i) => order[i] === id);
      const recOK = (level.requireRecycled ?? []).every((id) => rec.includes(id));
      const cleanOK = level.requireRecycled ? true : drift.length === 0 && t === null;
      if (chainOK && recOK && cleanOK) {
        setStatus("won");
        setMaxCleared((m) => Math.max(m, levelIdx + 1));
      }
    } else if (level.mode === "cycle") {
      const chainOK =
        !cyc && level.targetChain!.every((id, i) => order[i] === id) && order.length === level.targetChain!.length;
      if (met && chainOK) {
        setStatus("won");
        setMaxCleared((m) => Math.max(m, levelIdx + 1));
      }
    }
  }

  // ---------- 点击交互 ----------
  function clickChip(id: string) {
    if (status !== "playing") return;
    if (level.mode === "traverse") {
      const expected = chain[visitedN];
      if (id === expected) {
        const n = visitedN + 1;
        setVisitedN(n);
        setMsg("");
        if (n === chain.length) {
          setStatus("won");
          setMaxCleared((m) => Math.max(m, levelIdx + 1));
        }
      } else {
        setMistakes((m) => m + 1);
        setMsg(`🚫 水流还没到 ${id}——沿着 next 一节节走。`);
      }
      return;
    }
    if (level.mode === "cycle" && !metConfirmed) {
      setMsg("先用快慢巡检员证明环的存在，再动手拆环。");
      return;
    }
    // rewire 交互：选源 → 选目标
    if (selected === null) {
      if (recycled.includes(id)) return;
      // 无源选中时点漂浮结点：回收（仅删除关）
      if (drifting.includes(id) && level.requireRecycled?.includes(id)) {
        const rec = [...recycled, id];
        setRecycled(rec);
        setMsg(`♻️ ${id} 已回收。`);
        checkWin(head, temp, next, rec, metConfirmed);
        return;
      }
      setSelected(id);
      setMsg(`已选中 ${id === "HEAD" ? "头指针 HEAD" : `${id} 的接头`}，再点目标结点（或选 NULL / 暂存钩）。`);
      return;
    }
    if (selected === id) {
      setSelected(null);
      setMsg("");
      return;
    }
    // 执行改接
    if (selected === "HEAD") {
      setSelected(null);
      applyRewire(id, temp, { ...next });
    } else {
      setSelected(null);
      applyRewire(head, temp, { ...next, [selected]: id });
    }
  }

  function pointToNull() {
    if (!selected || status !== "playing") return;
    if (selected === "HEAD") {
      setSelected(null);
      applyRewire(null, temp, { ...next });
    } else {
      setSelected(null);
      applyRewire(head, temp, { ...next, [selected]: null });
    }
  }

  function hangOnTemp() {
    if (!selected || selected === "HEAD" || status !== "playing") return;
    const id = selected;
    setSelected(null);
    applyRewire(head, id, { ...next });
  }

  function clearTemp() {
    if (status !== "playing") return;
    applyRewire(head, null, { ...next });
  }

  function stepInspectors() {
    if (status !== "playing" || level.mode !== "cycle" || metConfirmed) return;
    const s1 = slowAt ? next[slowAt] ?? null : null;
    let f1 = fastAt ? next[fastAt] ?? null : null;
    f1 = f1 ? next[f1] ?? null : null;
    setSlowAt(s1);
    setFastAt(f1);
    setSteps((s) => s + 1);
    setMsg(s1 && f1 && s1 === f1 ? `🐢🐇 两名巡检员在 ${s1} 相遇了！` : "");
  }

  function confirmMeet() {
    if (status !== "playing" || metConfirmed) return;
    if (slowAt && fastAt && slowAt === fastAt && steps > 0) {
      setMetConfirmed(true);
      setMsg("✅ 相遇成立，管网有环！现在点 D，把它的接头改成 NULL。");
    } else {
      setMistakes((m) => m + 1);
      setMsg("🚫 他们还没相遇——继续步进。");
    }
  }

  const chipBase =
    "flex h-12 min-w-[3rem] items-center justify-center rounded-lg px-2 text-base font-black transition";

  return (
    <GameShell
      code="LST"
      name="管道区"
      structure="链表 Linked List"
      hue={HUE}
      districtNo="城区 03"
      flavor="一节节短管靠接头相连。亲手断开、改接——接错一节，整段就飘进虚空。"
      briefing={BRIEFING}
      levels={LEVELS}
      levelIdx={levelIdx}
      maxCleared={maxCleared}
      onSelectLevel={loadLevel}
      status={status}
      mistakes={mistakes}
      onRetry={() => loadLevel(levelIdx)}
      onNext={() => loadLevel(levelIdx + 1)}
      completionText="管道区疏通完毕！下一站：档案塔（二叉树）"
      consoleSlot={
        <>
          {level.mode === "cycle" && !metConfirmed && (
            <>
              <button type="button" onClick={stepInspectors} disabled={status !== "playing"} className="w-full rounded-xl bg-cyan-400/90 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:bg-slate-50 disabled:text-slate-400">
                步进 🐢+1 / 🐇+2
              </button>
              <button type="button" onClick={confirmMeet} disabled={status !== "playing"} className="w-full rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-600 transition hover:bg-amber-500/20">
                确认相遇 · 有环
              </button>
            </>
          )}
          {level.mode !== "traverse" && (level.mode !== "cycle" || metConfirmed) && (
            <>
              <button type="button" onClick={pointToNull} disabled={!selected || status !== "playing"} className="w-full rounded-xl bg-fuchsia-400/90 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-fuchsia-300 disabled:bg-slate-50 disabled:text-slate-400">
                {selected ? `${selected} 指向 NULL` : "（先选中一个源）指向 NULL"}
              </button>
              {level.mode === "rewire" && (
                <>
                  <button type="button" onClick={hangOnTemp} disabled={!selected || selected === "HEAD" || status !== "playing"} className="w-full rounded-xl bg-amber-400/80 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-amber-300 disabled:bg-slate-50 disabled:text-slate-400">
                    挂到暂存钩
                  </button>
                  <button type="button" onClick={clearTemp} disabled={temp === null || status !== "playing"} className="w-full rounded-xl bg-slate-50 px-4 py-2 text-xs text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-100 disabled:text-slate-400">
                    取下 / 清空暂存钩
                  </button>
                </>
              )}
            </>
          )}
        </>
      }
    >
      {/* 主管线 */}
      <div>
        <div className="mb-2 flex items-center justify-between font-mono text-[11px] tracking-widest text-slate-500">
          <span>MAINLINE · 主管线（从 HEAD 沿 next 延伸）</span>
          {level.mode === "cycle" && <span>步数 {steps}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <button
            type="button"
            onClick={() => clickChip("HEAD")}
            disabled={status !== "playing" || level.mode === "traverse"}
            className={`${chipBase} border text-xs ${
              selected === "HEAD"
                ? "border-cyan-300 bg-cyan-400/20 text-cyan-700 ring-2 ring-cyan-300/60"
                : "border-slate-300 bg-slate-50 text-slate-600"
            }`}
          >
            HEAD
          </button>
          <span className="text-slate-400">→</span>
          {chain.length === 0 && <span className="px-2 text-xs text-slate-400">null（空链）</span>}
          {chain.map((id, i) => (
            <span key={id} className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => clickChip(id)}
                disabled={status !== "playing"}
                style={pipeStyle(id)}
                className={`${chipBase} ${
                  selected === id
                    ? "ring-2 ring-cyan-300/80"
                    : level.mode === "traverse" && i === visitedN
                      ? "ring-2 ring-fuchsia-300/60"
                      : ""
                } ${level.mode === "traverse" && i < visitedN ? "opacity-50" : ""}`}
              >
                {id}
                {level.mode === "traverse" && i < visitedN && " ✓"}
                {level.mode === "cycle" && (
                  <span className="ml-1 text-xs">
                    {slowAt === id && "🐢"}
                    {fastAt === id && "🐇"}
                  </span>
                )}
              </button>
              <span className="text-slate-400">{i === chain.length - 1 && !cycleBackTo ? "→ ∅" : "→"}</span>
            </span>
          ))}
          {cycleBackTo && (
            <span className="rounded-md bg-red-500/15 px-2 py-1 font-mono text-[11px] text-red-600 ring-1 ring-red-500/25">
              ↩ 指回 {cycleBackTo}（环！）
            </span>
          )}
        </div>
      </div>

      {/* 暂存钩 + 虚空 */}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <div className="mb-2 font-mono text-[11px] tracking-widest text-slate-500">TEMP HOOK · 暂存钩</div>
          <div className="flex min-h-[4rem] items-center gap-2 rounded-xl border border-amber-500/25 bg-slate-50 p-3">
            {temp ? (
              <>
                <span className="text-lg">🪝</span>
                <button
                  type="button"
                  onClick={() => clickChip(temp)}
                  disabled={status !== "playing"}
                  style={pipeStyle(temp)}
                  className={`${chipBase} ${selected === temp ? "ring-2 ring-cyan-300/80" : ""}`}
                >
                  {temp}
                </button>
                {next[temp] && <span className="font-mono text-[11px] text-slate-500">→ {next[temp]}</span>}
              </>
            ) : (
              <span className="px-1 text-xs text-slate-400">钩子空着（临时指针 = null）</span>
            )}
          </div>
        </div>
        <div>
          <div className="mb-2 font-mono text-[11px] tracking-widest text-slate-500">
            THE VOID · 虚空（失去引用的管段）
          </div>
          <div className="flex min-h-[4rem] items-center gap-2 rounded-xl border border-dashed border-red-500/30 bg-slate-50 p-3">
            {drifting.length === 0 && recycled.length === 0 && (
              <span className="px-1 text-xs text-slate-400">很好，没有管段飘在这里</span>
            )}
            {drifting.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => clickChip(id)}
                disabled={status !== "playing"}
                style={pipeStyle(id, true)}
                className={`${chipBase} animate-float border border-dashed border-red-400/40 ${
                  selected === id ? "ring-2 ring-cyan-300/80" : ""
                }`}
                title={level.requireRecycled?.includes(id) ? "点击回收" : "点击可作为改接目标"}
              >
                {id} 💨
              </button>
            ))}
            {recycled.map((id) => (
              <span key={id} className="rounded-md bg-emerald-500/10 px-2 py-1 font-mono text-[11px] text-emerald-600 ring-1 ring-emerald-500/20">
                ♻️ {id} 已回收
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 指针表 */}
      <div className="mt-5">
        <div className="mb-2 font-mono text-[11px] tracking-widest text-slate-500">POINTER TABLE · 接头一览</div>
        <div className="flex flex-wrap gap-2 rounded-xl bg-slate-50 p-3 font-mono text-[11px] text-slate-500 ring-1 ring-slate-200">
          <span className="rounded bg-slate-50 px-2 py-1">HEAD → {head ?? "∅"}</span>
          {level.nodeIds
            .filter((id) => !recycled.includes(id))
            .map((id) => (
              <span key={id} className="rounded bg-slate-50 px-2 py-1">
                {id}.next → {next[id] ?? "∅"}
              </span>
            ))}
          <span className="rounded bg-amber-500/10 px-2 py-1 text-amber-600">temp → {temp ?? "∅"}</span>
        </div>
      </div>

      {msg && (
        <p className="mt-4 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-sm leading-6 text-amber-700">
          {msg}
        </p>
      )}
    </GameShell>
  );
}
