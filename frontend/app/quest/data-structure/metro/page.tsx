"use client";

/**
 * 霓虹栈城 · 环线地铁（队列）
 * 玩法：列车进站（入队）/ 发车（出队），先到先走。
 * 亮点：假溢出现场改造环形轨道；环形队满判定；双端列车（deque）。
 */
import { useState } from "react";
import { GameShell, type DsBrief, type DsLevelMeta, type DsStatus } from "@/components/ds/GameShell";

const HUE = 145;

const BRIEFING: DsBrief[] = [
  {
    term: "队列（Queue）与 FIFO",
    story:
      "环线地铁的站台只有一个进口、一个出口：列车从队尾进站，从队头发车。先来的先走，谁也不能插队——这是地铁最古老的规矩。",
    definition:
      "队列是受限线性表：插入只在队尾（rear）进行，删除只在队头（front）进行，遵循「先进先出」（FIFO, First In First Out）。",
  },
  {
    term: "假溢出",
    story:
      "直线站台上，发走的列车留下空位，但新列车只能停在队尾后面——队尾撞到站台尽头时，明明前面还有空位，调度系统却报「站台已满」。这就是假警报。",
    definition:
      "顺序存储的队列中，front/rear 只增不减，rear 到达数组末端即无法入队，即使前端仍有空闲单元——称为假溢出。",
  },
  {
    term: "循环队列",
    story:
      "把直线站台首尾焊成一个环，队尾越过尽头就绕回开头停进空位。从此空间循环利用，假溢出成为历史。",
    definition:
      "用取模运算把数组首尾逻辑相接：rear = (rear + 1) % N。通常牺牲一个单元区分空/满：队满条件为 (rear + 1) % N == front。",
  },
  {
    term: "双端队列（Deque）",
    story:
      "贵宾专列两头都有门：可以从队头上车，也可以从队尾下车。规矩松了，玩法就多了。",
    definition:
      "双端队列允许在两端进行插入和删除，是栈与队列的一般化结构。",
  },
];

interface MetroLevel extends DsLevelMeta {
  cap: number;
  inbound: number[];
  mode0: "linear" | "circular";
  /** 留一空判满（循环队列约定） */
  spareOne?: boolean;
  /** 双端队列关 */
  deque?: boolean;
  /** 双端关的目标发车顺序 */
  target?: number[];
}

const LEVELS: MetroLevel[] = [
  {
    badge: "任务 01",
    title: "首班车",
    concept: "FIFO · 入队与出队",
    story: "环线地铁恢复运营的第一天。三列检修车按 1、2、3 进站，也要按 1、2、3 发出。",
    task: "点「进站」让列车入队，点「发车」放走队头。试试点中间的列车——看看地铁的规矩。",
    cap: 6,
    inbound: [1, 2, 3],
    mode0: "circular",
    hint: "队列只认一个方向：队尾进、队头出。点停着的车厢可以试图发它——但插队会被拒绝。",
    skeleton: "进站 1 → 进站 2 → 进站 3 → 发车 1 → 发车 2 → 发车 3（或边进边发）",
    winNote: "先进先出：队列的输出顺序永远等于到达顺序，这是它和栈最大的不同。",
  },
  {
    badge: "任务 02",
    title: "假警报",
    concept: "假溢出",
    story:
      "这是一段还没改造的老式直线站台，只有 5 个停车位。今晚有 7 列车要通行——而队尾一旦撞到站台尽头，就再也进不来车了。",
    task: "让 7 列车全部通行。撞上「假溢出」时，想办法解决它。",
    cap: 5,
    inbound: [1, 2, 3, 4, 5, 6, 7],
    mode0: "linear",
    alert: "老式直线站台",
    hint: "先发走几列腾出前排空位——你会发现新车还是进不来：空位在前面，队尾却在尽头。这不是真的满。",
    skeleton: "进站×5 → 发车×若干 → 第 6 列进站时触发假溢出 → 改造环形轨道 → 队尾绕回前排空位",
    winNote: "front/rear 只增不减，rear 撞墙就是假溢出。循环队列用取模把数组卷成环，空间循环利用。",
  },
  {
    badge: "任务 03",
    title: "满环之夜",
    concept: "循环队列 · 队满判定",
    story:
      "环形轨道改造完成。但调度手册写着：环上必须留一个空位，否则系统分不清「空」和「满」。今晚高峰，8 列车要过站。",
    task: "5 个车位的环线，最多同时停 4 列。让 8 列车全部通行，体会「(rear+1)%N == front 即满」。",
    cap: 5,
    inbound: [1, 2, 3, 4, 5, 6, 7, 8],
    mode0: "circular",
    spareOne: true,
    alert: "留一空判满",
    hint: "停到第 4 列时再进站会被拒——那个保留空位是用来区分空环和满环的。发一列，才能再进一列。",
    skeleton: "进站×4 →（队满，被拒）→ 发车 → 进站 → …… 循环到 8 列全部通行",
    winNote:
      "若不留空位，front==rear 既可能是空也可能是满。牺牲一个单元，(rear+1)%N==front 即满，front==rear 即空——歧义消除。",
  },
  {
    badge: "任务 04",
    title: "贵宾专列",
    concept: "双端队列 Deque",
    story:
      "市长的贵宾专列编组有特殊要求：列车按 1、2、3、4 抵达，却要按 2、1、3、4 的顺序发出。普通队列做不到——好在贵宾站台两头都有门。",
    task: "用「头部进站 / 尾部进站 / 头部发车 / 尾部发车」四种操作，按 2、1、3、4 发车。",
    cap: 6,
    inbound: [1, 2, 3, 4],
    mode0: "circular",
    deque: true,
    target: [2, 1, 3, 4],
    hint: "2 号要先发，但 1 号先到——让 2 号从「头部」进站，它就插到了 1 号前面。",
    skeleton: "尾部进站 1 → 头部进站 2 → 头部发车 2 → 头部发车 1 → 尾部进站 3 → 头部发车 3 → 尾部进站 4 → 头部发车 4",
    winNote: "双端队列两端皆可进出，是队列和栈的一般化：限制它，就退化成其中之一。",
  },
];

function trainStyle(n: number) {
  const h = (n * 47 + 100) % 360;
  return {
    background: `linear-gradient(160deg, hsl(${h} 80% 28%), hsl(${h} 75% 15%))`,
    boxShadow: `inset 0 0 0 1px hsl(${h} 90% 65% / 0.5)`,
    color: `hsl(${h} 95% 78%)`,
  };
}

export default function MetroPage() {
  const [levelIdx, setLevelIdx] = useState(0);
  const [maxCleared, setMaxCleared] = useState(0);
  const level = LEVELS[levelIdx];

  const [inbound, setInbound] = useState<number[]>(LEVELS[0].inbound);
  const [slots, setSlots] = useState<(number | null)[]>(Array(LEVELS[0].cap).fill(null));
  const [front, setFront] = useState(0);
  const [count, setCount] = useState(0);
  const [linearRear, setLinearRear] = useState(0); // 仅 linear 模式使用（只增不减）
  const [mode, setMode] = useState<"linear" | "circular">(LEVELS[0].mode0);
  const [served, setServed] = useState<number[]>([]);
  const [dq, setDq] = useState<number[]>([]); // 双端关用
  const [status, setStatus] = useState<DsStatus>("playing");
  const [mistakes, setMistakes] = useState(0);
  const [fakeOverflow, setFakeOverflow] = useState(false);
  const [msg, setMsg] = useState("");
  const [log, setLog] = useState<string[]>([]);

  function loadLevel(i: number) {
    const lv = LEVELS[i];
    setLevelIdx(i);
    setInbound(lv.inbound);
    setSlots(Array(lv.cap).fill(null));
    setFront(0);
    setCount(0);
    setLinearRear(0);
    setMode(lv.mode0);
    setServed([]);
    setDq([]);
    setStatus("playing");
    setMistakes(0);
    setFakeOverflow(false);
    setMsg("");
    setLog([]);
  }

  const totalToServe = level.deque ? level.target!.length : level.inbound.length;

  function finishCheck(servedNext: number[]) {
    if (servedNext.length === totalToServe) {
      setStatus("won");
      setMaxCleared((m) => Math.max(m, levelIdx + 1));
    }
  }

  // ---------- 普通 / 循环队列操作 ----------
  function enqueue() {
    if (status !== "playing" || inbound.length === 0 || level.deque) return;
    setMsg("");
    const train = inbound[0];
    const usable = level.spareOne ? level.cap - 1 : level.cap;
    if (mode === "linear") {
      if (linearRear >= level.cap) {
        if (count < level.cap) {
          // 假溢出！
          setFakeOverflow(true);
          setMsg("⚠ 假溢出：前排明明有空位，队尾却撞到了站台尽头。");
          setLog((l) => [...l, "⚠ 假溢出"]);
        } else {
          setMsg("站台真的满了，先发车。");
        }
        return;
      }
      const next = [...slots];
      next[linearRear] = train;
      setSlots(next);
      setLinearRear(linearRear + 1);
      setCount(count + 1);
      setInbound(inbound.slice(1));
      setLog((l) => [...l, `进站 ${train}`]);
      return;
    }
    // circular
    if (count >= usable) {
      setMsg(
        level.spareOne
          ? `队满：(rear+1)%${level.cap} == front。发一列，才能再进一列。`
          : "站台已满，先发车。"
      );
      setLog((l) => [...l, "✗ 队满被拒"]);
      return;
    }
    const rear = (front + count) % level.cap;
    const next = [...slots];
    next[rear] = train;
    setSlots(next);
    setCount(count + 1);
    setInbound(inbound.slice(1));
    setLog((l) => [...l, `进站 ${train}`]);
  }

  function dequeue() {
    if (status !== "playing" || count === 0 || level.deque) return;
    setMsg("");
    const train = slots[front]!;
    const next = [...slots];
    next[front] = null;
    setSlots(next);
    setFront(mode === "circular" ? (front + 1) % level.cap : front + 1);
    setCount(count - 1);
    const servedNext = [...served, train];
    setServed(servedNext);
    setLog((l) => [...l, `发车 ${train}`]);
    finishCheck(servedNext);
  }

  /** 点击停着的列车：尝试发它（教学：非队头 = 插队被拒） */
  function tryDepartAt(idx: number) {
    if (status !== "playing" || level.deque) return;
    if (slots[idx] === null) return;
    if (idx === front) {
      dequeue();
    } else {
      setMistakes((m) => m + 1);
      setMsg(`🚫 ${slots[idx]} 号想插队？它前面还有车——队列只放队头走。`);
      setLog((l) => [...l, `✗ 插队 ${slots[idx]}`]);
    }
  }

  function upgradeToCircular() {
    if (!fakeOverflow) return;
    setMode("circular");
    setFakeOverflow(false);
    // 把现存列车按队序搬进环形布局：front 归 0
    const trains: number[] = [];
    for (let i = front; i < linearRear; i++) if (slots[i] !== null) trains.push(slots[i]!);
    const next: (number | null)[] = Array(level.cap).fill(null);
    trains.forEach((t, i) => (next[i] = t));
    setSlots(next);
    setFront(0);
    setCount(trains.length);
    setMsg("✅ 环形轨道改造完成：队尾将用 (rear+1)%N 绕回前排。");
    setLog((l) => [...l, "改造环形轨道"]);
  }

  // ---------- 双端队列操作 ----------
  function dqOp(op: "pushFront" | "pushRear" | "popFront" | "popRear") {
    if (status !== "playing" || !level.deque) return;
    setMsg("");
    if (op === "pushFront" || op === "pushRear") {
      if (inbound.length === 0) return;
      const t = inbound[0];
      setInbound(inbound.slice(1));
      setDq(op === "pushFront" ? [t, ...dq] : [...dq, t]);
      setLog((l) => [...l, `${op === "pushFront" ? "头进" : "尾进"} ${t}`]);
      return;
    }
    if (dq.length === 0) return;
    const t = op === "popFront" ? dq[0] : dq[dq.length - 1];
    const need = level.target![served.length];
    if (t !== need) {
      setMistakes((m) => m + 1);
      setMsg(`🚫 发出的是 ${t} 号，但订单下一列是 ${need} 号。`);
      setLog((l) => [...l, `✗ 误发 ${t}`]);
      return;
    }
    setDq(op === "popFront" ? dq.slice(1) : dq.slice(0, -1));
    const servedNext = [...served, t];
    setServed(servedNext);
    setLog((l) => [...l, `${op === "popFront" ? "头发" : "尾发"} ${t}`]);
    finishCheck(servedNext);
  }

  const rearIdx = mode === "circular" ? (front + count) % level.cap : linearRear;

  return (
    <GameShell
      code="QUE"
      name="环线地铁"
      structure="队列 Queue"
      hue={HUE}
      districtNo="城区 02"
      flavor="先到先走的环形轨道。当列车排满整圈，下一班该停在哪？这里教会全城什么叫秩序。"
      briefing={BRIEFING}
      levels={LEVELS}
      levelIdx={levelIdx}
      maxCleared={maxCleared}
      onSelectLevel={loadLevel}
      status={status}
      mistakes={mistakes}
      onRetry={() => loadLevel(levelIdx)}
      onNext={() => loadLevel(levelIdx + 1)}
      completionText="环线地铁全线贯通！下一站：管道区（链表）"
      consoleSlot={
        level.deque ? (
          <>
            <button type="button" onClick={() => dqOp("pushFront")} disabled={status !== "playing" || inbound.length === 0} className="w-full rounded-xl bg-cyan-400/90 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400">
              头部进站{inbound.length > 0 ? ` · ${inbound[0]} 号` : ""}
            </button>
            <button type="button" onClick={() => dqOp("pushRear")} disabled={status !== "playing" || inbound.length === 0} className="w-full rounded-xl bg-cyan-400/60 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400">
              尾部进站{inbound.length > 0 ? ` · ${inbound[0]} 号` : ""}
            </button>
            <button type="button" onClick={() => dqOp("popFront")} disabled={status !== "playing" || dq.length === 0} className="w-full rounded-xl bg-fuchsia-400/90 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-fuchsia-300 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400">
              头部发车{dq.length > 0 ? ` · ${dq[0]} 号` : ""}
            </button>
            <button type="button" onClick={() => dqOp("popRear")} disabled={status !== "playing" || dq.length === 0} className="w-full rounded-xl bg-fuchsia-400/60 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-fuchsia-300 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400">
              尾部发车{dq.length > 0 ? ` · ${dq[dq.length - 1]} 号` : ""}
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={enqueue} disabled={status !== "playing" || inbound.length === 0} className="w-full rounded-xl bg-cyan-400/90 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400">
              进站 ENQUEUE{inbound.length > 0 ? ` · ${inbound[0]} 号` : ""}
            </button>
            <button type="button" onClick={dequeue} disabled={status !== "playing" || count === 0} className="w-full rounded-xl bg-fuchsia-400/90 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-fuchsia-300 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400">
              发车 DEQUEUE
            </button>
            {fakeOverflow && (
              <button type="button" onClick={upgradeToCircular} className="w-full animate-glow rounded-xl border border-amber-500/40 bg-amber-500/15 px-4 py-2.5 text-sm font-bold text-amber-600 transition hover:bg-amber-500/25">
                🔧 改造为环形轨道
              </button>
            )}
          </>
        )
      }
    >
      {/* 待进站 */}
      <div>
        <div className="mb-2 flex items-center justify-between font-mono text-[11px] tracking-widest text-slate-500">
          <span>INBOUND · 进站序列</span>
          <span>{inbound.length} 列待进站</span>
        </div>
        <div className="flex min-h-[3.2rem] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
          {inbound.length === 0 && <span className="px-2 text-xs text-slate-400">全部列车已进站</span>}
          {inbound.map((n, i) => (
            <div key={`${n}-${i}`} style={trainStyle(n)} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base font-black ${i === 0 ? "ring-2 ring-cyan-300/70" : "opacity-60"}`}>
              {n}
            </div>
          ))}
        </div>
      </div>

      {/* 站台 */}
      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between font-mono text-[11px] tracking-widest text-slate-500">
          <span>
            PLATFORM · {level.deque ? "贵宾站台（两端开门）" : mode === "linear" ? "直线站台（老式）" : "环形站台"}
          </span>
          {!level.deque && (
            <span>
              front={front} rear={rearIdx >= level.cap ? `${rearIdx}（撞墙）` : rearIdx}
            </span>
          )}
        </div>

        {level.deque ? (
          <div className="flex min-h-[4.5rem] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <span className="font-mono text-[10px] text-cyan-600">头▶</span>
            {dq.length === 0 && <span className="px-2 text-xs text-slate-400">站台为空</span>}
            {dq.map((n, i) => (
              <div key={`${n}-${i}`} style={trainStyle(n)} className="flex h-11 w-11 items-center justify-center rounded-lg text-lg font-black">
                {n}
              </div>
            ))}
            <span className="ml-auto font-mono text-[10px] text-fuchsia-600">◀尾</span>
          </div>
        ) : (
          <div className={`relative rounded-xl border p-3 ${mode === "circular" ? "border-emerald-400/30" : "border-amber-500/30"} bg-slate-50`}>
            <div className="flex items-end gap-2">
              {slots.map((t, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    onClick={() => tryDepartAt(i)}
                    disabled={t === null || status !== "playing"}
                    style={t !== null ? trainStyle(t) : undefined}
                    className={`flex h-12 w-12 items-center justify-center rounded-lg text-lg font-black transition ${
                      t === null
                        ? "border border-dashed border-slate-200 text-slate-700"
                        : i === front
                          ? "cursor-pointer ring-2 ring-fuchsia-300/70 hover:scale-105"
                          : "cursor-pointer opacity-90"
                    }`}
                  >
                    {t ?? ""}
                  </button>
                  <div className="font-mono text-[10px] text-slate-400">
                    [{i}]
                    {i === front && count > 0 && <span className="ml-0.5 text-fuchsia-600">F</span>}
                    {i === rearIdx % level.cap && rearIdx < level.cap + level.cap && inbound.length > 0 && rearIdx < level.cap && (
                      <span className="ml-0.5 text-cyan-600">R</span>
                    )}
                  </div>
                </div>
              ))}
              {mode === "circular" && (
                <div className="ml-1 self-center font-mono text-lg text-emerald-600" title="首尾相接">
                  ↩
                </div>
              )}
            </div>
            {mode === "linear" && rearIdx >= level.cap && (
              <div className="mt-2 font-mono text-[11px] text-amber-600">
                ⚠ rear 已撞到站台尽头（rear={rearIdx} ≥ {level.cap}）
              </div>
            )}
          </div>
        )}
      </div>

      {/* 已发车 */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <div className="mb-2 font-mono text-[11px] tracking-widest text-slate-500">
            DEPARTED · 已发车 {served.length}/{totalToServe}
          </div>
          <div className="flex min-h-[3rem] flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-2">
            {served.length === 0 && <span className="px-2 text-xs text-slate-400">尚未发车</span>}
            {served.map((n, i) => (
              <div key={i} style={trainStyle(n)} className="flex h-8 w-8 items-center justify-center rounded-md text-sm font-black opacity-80">
                {n}
              </div>
            ))}
          </div>
          {level.deque && status === "playing" && (
            <p className="mt-2 text-xs text-slate-500">
              目标发车顺序：{level.target!.join(" → ")}，下一列：
              <span className="font-bold text-cyan-600">{level.target![served.length]} 号</span>
            </p>
          )}
        </div>
        <div>
          <div className="mb-2 font-mono text-[11px] tracking-widest text-slate-500">OPS LOG</div>
          <div className="min-h-[3rem] rounded-xl bg-slate-50 p-2 font-mono text-[11px] leading-5 text-slate-500 ring-1 ring-slate-200">
            {log.length === 0 ? "（尚未操作）" : log.slice(-12).join(" → ")}
          </div>
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
