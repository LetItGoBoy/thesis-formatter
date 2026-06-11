"use client";

/**
 * 霓虹栈城 · 分拣厂（排序）—— 终章
 * 玩法：亲手当分拣员——冒泡逐对裁决、选择排序点最小件、
 * 插入排序找落位、快排亲手 partition，最后看冒泡 vs 快排赛跑。
 */
import { useEffect, useRef, useState } from "react";
import { GameShell, type DsBrief, type DsLevelMeta, type DsStatus } from "@/components/ds/GameShell";

const HUE = 0;

const BRIEFING: DsBrief[] = [
  {
    term: "冒泡排序",
    story:
      "传送带上两两相邻的货箱比一比：左边重就交换。一轮下来，最重的货箱「冒」到了最末端；再来一轮，第二重的也归位——像气泡浮出水面。",
    definition:
      "冒泡排序：重复扫描相邻元素并交换逆序对，每轮把最大值移至末尾。时间 O(n²)，稳定。",
  },
  {
    term: "选择 / 插入排序",
    story:
      "选择排序的工头每轮扫一眼全场，把最小的拎到队首；插入排序的新货箱则像插队的乘客，从后往前找到属于自己的位置坐下。",
    definition:
      "选择排序：每轮选未排序区最小元素放到已排序区末端，O(n²) 不稳定。插入排序：将新元素插入已排序前缀的正确位置，O(n²)，近乎有序时接近 O(n)。",
  },
  {
    term: "快速排序与 partition",
    story:
      "快排工头随手指定一件「基准货」，喊一嗓子：比它轻的去左边堆，重的去右边堆！一次分堆，基准货的位置就永远定了——再对两个小堆如法炮制。",
    definition:
      "快排核心是 partition：以基准元素划分序列，左侧 ≤ 基准 ≤ 右侧，基准就位；递归处理两侧。平均 O(n log n)。",
  },
  {
    term: "O(n²) vs O(n log n)",
    story:
      "14 件货，冒泡工组挥汗如雨地换了几十次，快排工组早已收工喝茶。货箱翻倍，差距还会再翻几倍——复杂度不是黑板上的符号，是下班时间。",
    definition:
      "n=10⁶ 时，n² ≈ 10¹²，n log n ≈ 2×10⁷——五个数量级的差距，这就是算法选择的意义。",
  },
];

interface SortLevel extends DsLevelMeta {
  mode: "bubble" | "select" | "insert" | "partition" | "race";
  array: number[];
}

const LEVELS: SortLevel[] = [
  {
    badge: "任务 01",
    title: "气泡上浮",
    concept: "冒泡排序",
    story: "分拣厂复工第一单。规矩：只看相邻两箱，左比右重就换。一轮一轮来，重的自然沉底。",
    task: "对每对高亮的相邻货箱做出裁决：「交换」或「保持」。直到全部有序。",
    mode: "bubble",
    array: [38, 12, 45, 7, 23],
    hint: "只比较高亮的两箱：左 > 右才交换。每轮结束，最大值会到达最右端。",
    skeleton: "第1轮：38>12换 → 38<45不换 → 45>7换 → 45>23换 → 第2轮…直到无逆序",
    winNote: "冒泡每轮锁定一个最大值，n 件货最多 n−1 轮——简单可靠，但 O(n²) 的汗水做不了大单。",
  },
  {
    badge: "任务 02",
    title: "工头的眼力",
    concept: "选择排序",
    story: "老工头的做法不一样：每轮扫一眼整条未分拣的传送带，直接把最小的那箱拎到队首。",
    task: "每一轮，点击未排序区（高亮区域）中最小的货箱，它会被换到队首。",
    mode: "select",
    array: [29, 10, 14, 37, 13, 5],
    hint: "整个未排序区里找最小值——第一轮是 5，点它。",
    skeleton: "5 → 10 → 13 → 14 → 29（37 自动归位）",
    winNote: "选择排序交换次数最少（每轮至多一次），但比较一次不少——还是 O(n²)。",
  },
  {
    badge: "任务 03",
    title: "对号入座",
    concept: "插入排序",
    story: "左边的货箱已经排好了序。新到的每一箱，要在已排序队伍里找到自己的位置插进去。",
    task: "为每个高亮的新货箱点击它在已排序前缀中的落位（▾ 间隙）。",
    mode: "insert",
    array: [12, 40, 8, 25, 16],
    hint: "在已排序前缀里从左到右找：第一个比新箱大的位置之前，就是它的座位。",
    skeleton: "40→12 之后 · 8→12 之前 · 25→12 与 40 之间 · 16→12 与 25 之间 ⇒ [8,12,16,25,40]",
    winNote: "插入排序对近乎有序的数据飞快（接近 O(n)）——这正是 TimSort 用它打底的原因。",
  },
  {
    badge: "任务 04",
    title: "基准分堆",
    concept: "快排 partition",
    story: "快排工头指着最后那箱 24 号：「它是基准！轻的去左堆，重的去右堆，分完它就永远归位。」",
    task: "对每件高亮货箱做出裁决：≤24 进左堆，>24 进右堆。",
    mode: "partition",
    array: [33, 15, 48, 9, 27, 24],
    hint: "一件一件来：33 比 24 重，右堆；15 轻，左堆……分完基准 24 就坐进两堆中间。",
    skeleton: "33→右 · 15→左 · 48→右 · 9→左 · 27→右 ⇒ [15,9] 24 [33,48,27]",
    winNote: "partition 一次划分让基准永久就位，问题规模减半再减半——分治的力量即 O(n log n)。",
  },
  {
    badge: "任务 05",
    title: "终局赛跑",
    concept: "复杂度对决",
    story:
      "厂庆压轴节目：同样 14 件乱序货箱，冒泡组与快排组同时开工，每次交换算一步。全厂下注：谁先收工？",
    task: "先下注，再鸣枪——看完这场比赛，你就再也不会忘记 O(n²) 和 O(n log n) 的差距。",
    mode: "race",
    array: [13, 7, 21, 3, 18, 10, 25, 1, 16, 8, 22, 5, 19, 11],
    hint: "数据量越大差距越悬殊。14 件货，冒泡的交换次数 = 逆序对个数，快排远少于它。",
    skeleton: "下注 → 开始比赛 → 观察两边的交换计数与进度",
    winNote:
      "同一批货：冒泡换了几十次，快排十几次就收工。把 n 换成一百万，这就是「跑一晚上」和「眨一下眼」的区别。",
  },
];

function crateStyle(v: number, max: number) {
  const h = 200 - (v / max) * 160;
  return {
    background: `linear-gradient(160deg, hsl(${h} 75% 30%), hsl(${h} 70% 16%))`,
    boxShadow: `inset 0 0 0 1px hsl(${h} 85% 65% / 0.4)`,
    color: `hsl(${h} 90% 80%)`,
  };
}

function bubbleFrames(a0: number[]): number[][] {
  const a = [...a0];
  const f = [[...a]];
  for (let n = a.length; n > 1; n--)
    for (let i = 0; i < n - 1; i++)
      if (a[i] > a[i + 1]) {
        [a[i], a[i + 1]] = [a[i + 1], a[i]];
        f.push([...a]);
      }
  return f;
}
function quickFrames(a0: number[]): number[][] {
  const a = [...a0];
  const f = [[...a]];
  function qs(lo: number, hi: number) {
    if (lo >= hi) return;
    const p = a[hi];
    let i = lo;
    for (let j = lo; j < hi; j++)
      if (a[j] <= p) {
        if (i !== j) {
          [a[i], a[j]] = [a[j], a[i]];
          f.push([...a]);
        }
        i++;
      }
    if (i !== hi) {
      [a[i], a[hi]] = [a[hi], a[i]];
      f.push([...a]);
    }
    qs(lo, i - 1);
    qs(i + 1, hi);
  }
  qs(0, a.length - 1);
  return f;
}

export default function SortingPage() {
  const [levelIdx, setLevelIdx] = useState(0);
  const [maxCleared, setMaxCleared] = useState(0);
  const level = LEVELS[levelIdx];

  const [arr, setArr] = useState<number[]>(LEVELS[0].array);
  const [pairI, setPairI] = useState(0); // 冒泡当前对
  const [passEnd, setPassEnd] = useState(LEVELS[0].array.length - 1);
  const [roundR, setRoundR] = useState(0); // 选择排序轮次
  const [sortedLen, setSortedLen] = useState(1); // 插入排序前缀
  const [partIdx, setPartIdx] = useState(0); // partition 当前件
  const [leftBin, setLeftBin] = useState<number[]>([]);
  const [rightBin, setRightBin] = useState<number[]>([]);
  // 赛跑
  const [racePhase, setRacePhase] = useState<"bet" | "racing" | "done">("bet");
  const [bet, setBet] = useState<"bubble" | "quick" | null>(null);
  const [frame, setFrame] = useState(0);
  const framesRef = useRef<{ b: number[][]; q: number[][] }>({ b: [], q: [] });

  const [status, setStatus] = useState<DsStatus>("playing");
  const [mistakes, setMistakes] = useState(0);
  const [msg, setMsg] = useState("");

  const maxV = Math.max(...level.array);

  function loadLevel(i: number) {
    const lv = LEVELS[i];
    setLevelIdx(i);
    setArr([...lv.array]);
    setPairI(0);
    setPassEnd(lv.array.length - 1);
    setRoundR(0);
    setSortedLen(1);
    setPartIdx(0);
    setLeftBin([]);
    setRightBin([]);
    setRacePhase("bet");
    setBet(null);
    setFrame(0);
    setStatus("playing");
    setMistakes(0);
    setMsg("");
  }

  function win() {
    setStatus("won");
    setMaxCleared((m) => Math.max(m, levelIdx + 1));
  }
  const isSorted = (a: number[]) => a.every((v, i) => i === 0 || a[i - 1] <= v);

  // ---------- 冒泡 ----------
  function bubbleDecide(swap: boolean) {
    if (status !== "playing" || level.mode !== "bubble") return;
    const should = arr[pairI] > arr[pairI + 1];
    if (swap !== should) {
      setMistakes((m) => m + 1);
      setMsg(`🚫 ${arr[pairI]} 和 ${arr[pairI + 1]}：${should ? "左边更重，该交换" : "顺序没错，别动"}。`);
      return;
    }
    let a = arr;
    if (swap) {
      a = [...arr];
      [a[pairI], a[pairI + 1]] = [a[pairI + 1], a[pairI]];
      setArr(a);
    }
    setMsg(swap ? `🔁 交换 ${a[pairI + 1]} ↔ ${a[pairI]}` : "✅ 保持");
    if (pairI + 1 < passEnd) {
      setPairI(pairI + 1);
    } else {
      if (isSorted(a)) {
        win();
        return;
      }
      setPassEnd(passEnd - 1);
      setPairI(0);
      setMsg(`🏁 本轮结束，${a[passEnd]} 已沉底。开始下一轮。`);
      if (passEnd - 1 <= 0 || isSorted(a)) win();
    }
  }

  // ---------- 选择 ----------
  function selectClick(i: number) {
    if (status !== "playing" || level.mode !== "select" || i < roundR) return;
    const region = arr.slice(roundR);
    const minV = Math.min(...region);
    if (arr[i] !== minV) {
      setMistakes((m) => m + 1);
      setMsg(`🚫 未排序区里还有比 ${arr[i]} 更小的。`);
      return;
    }
    const a = [...arr];
    [a[roundR], a[i]] = [a[i], a[roundR]];
    setArr(a);
    const nr = roundR + 1;
    setRoundR(nr);
    setMsg(`✅ ${minV} 归位到第 ${nr} 位。`);
    if (nr >= a.length - 1) win();
  }

  // ---------- 插入 ----------
  function insertAt(gap: number) {
    if (status !== "playing" || level.mode !== "insert") return;
    const v = arr[sortedLen];
    let correct = sortedLen;
    for (let j = 0; j < sortedLen; j++)
      if (arr[j] > v) {
        correct = j;
        break;
      }
    if (gap !== correct) {
      setMistakes((m) => m + 1);
      setMsg(`🚫 ${v} 的座位不在那——找第一个比它大的箱子，坐它前面。`);
      return;
    }
    const a = [...arr];
    a.splice(sortedLen, 1);
    a.splice(gap, 0, v);
    setArr(a);
    const nl = sortedLen + 1;
    setSortedLen(nl);
    setMsg(`✅ ${v} 对号入座。`);
    if (nl >= a.length) win();
  }

  // ---------- partition ----------
  function partDecide(side: "left" | "right") {
    if (status !== "playing" || level.mode !== "partition") return;
    const pivot = level.array[level.array.length - 1];
    const v = level.array[partIdx];
    const should: "left" | "right" = v <= pivot ? "left" : "right";
    if (side !== should) {
      setMistakes((m) => m + 1);
      setMsg(`🚫 ${v} ${v <= pivot ? "≤" : ">"} ${pivot}，应进${should === "left" ? "左" : "右"}堆。`);
      return;
    }
    if (side === "left") setLeftBin((b) => [...b, v]);
    else setRightBin((b) => [...b, v]);
    const ni = partIdx + 1;
    setPartIdx(ni);
    setMsg(`✅ ${v} 进${side === "left" ? "左" : "右"}堆。`);
    if (ni >= level.array.length - 1) {
      setMsg(`🎉 partition 完成：基准 ${pivot} 永久归位，两堆递归即得全序。`);
      win();
    }
  }

  // ---------- 赛跑 ----------
  function startRace() {
    if (level.mode !== "race" || racePhase !== "bet" || !bet) return;
    framesRef.current = { b: bubbleFrames(level.array), q: quickFrames(level.array) };
    setRacePhase("racing");
    setFrame(0);
  }
  useEffect(() => {
    if (racePhase !== "racing") return;
    const { b, q } = framesRef.current;
    const maxF = Math.max(b.length, q.length);
    const t = setInterval(() => {
      setFrame((f) => {
        if (f + 1 >= maxF) {
          clearInterval(t);
          setRacePhase("done");
          const winner = b.length <= q.length ? "bubble" : "quick";
          if (bet !== winner) setMistakes((m) => m + 1);
          setMsg(
            `🏆 ${winner === "quick" ? "快排" : "冒泡"}组先收工！交换次数 冒泡 ${b.length - 1} vs 快排 ${q.length - 1}。${
              bet === winner ? "你押对了！" : "你押错了——记住这一课。"
            }`
          );
          setTimeout(win, 600);
          return maxF - 1;
        }
        return f + 1;
      });
    }, 110);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [racePhase]);

  const pivot = level.array[level.array.length - 1];

  return (
    <GameShell
      code="SRT"
      name="分拣厂"
      structure="排序 Sorting"
      hue={HUE}
      districtNo="终章"
      flavor="当所有结构归位，剩下的，是让混乱的数据重新排好队。"
      briefing={BRIEFING}
      levels={LEVELS}
      levelIdx={levelIdx}
      maxCleared={maxCleared}
      onSelectLevel={loadLevel}
      status={status}
      mistakes={mistakes}
      onRetry={() => loadLevel(levelIdx)}
      onNext={() => loadLevel(levelIdx + 1)}
      completionText="秩序协议完全恢复——霓虹栈城，通关！"
      consoleSlot={
        <>
          {level.mode === "bubble" && (
            <>
              <button type="button" onClick={() => bubbleDecide(true)} disabled={status !== "playing"} className="w-full rounded-xl bg-fuchsia-400/90 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-fuchsia-300 disabled:bg-white/5 disabled:text-slate-600">
                交换 ↔
              </button>
              <button type="button" onClick={() => bubbleDecide(false)} disabled={status !== "playing"} className="w-full rounded-xl bg-cyan-400/90 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:bg-white/5 disabled:text-slate-600">
                保持 ✓
              </button>
            </>
          )}
          {level.mode === "partition" && (
            <>
              <button type="button" onClick={() => partDecide("left")} disabled={status !== "playing"} className="w-full rounded-xl bg-cyan-400/90 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:bg-white/5 disabled:text-slate-600">
                ≤ {pivot} 进左堆
              </button>
              <button type="button" onClick={() => partDecide("right")} disabled={status !== "playing"} className="w-full rounded-xl bg-fuchsia-400/90 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-fuchsia-300 disabled:bg-white/5 disabled:text-slate-600">
                &gt; {pivot} 进右堆
              </button>
            </>
          )}
          {level.mode === "race" && racePhase === "bet" && (
            <>
              <button type="button" onClick={() => setBet("bubble")} className={`w-full rounded-xl px-4 py-2 text-xs font-bold transition ${bet === "bubble" ? "bg-amber-400 text-slate-950" : "bg-white/5 text-slate-300 ring-1 ring-white/10 hover:bg-white/10"}`}>
                押 冒泡组 🫧
              </button>
              <button type="button" onClick={() => setBet("quick")} className={`w-full rounded-xl px-4 py-2 text-xs font-bold transition ${bet === "quick" ? "bg-amber-400 text-slate-950" : "bg-white/5 text-slate-300 ring-1 ring-white/10 hover:bg-white/10"}`}>
                押 快排组 ⚡
              </button>
              <button type="button" onClick={startRace} disabled={!bet} className="w-full rounded-xl bg-emerald-400/90 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-emerald-300 disabled:bg-white/5 disabled:text-slate-600">
                🏁 鸣枪开赛
              </button>
            </>
          )}
        </>
      }
    >
      {level.mode === "race" ? (
        <RaceBoard level={level} racePhase={racePhase} frame={frame} framesRef={framesRef} maxV={maxV} />
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between font-mono text-[11px] tracking-widest text-slate-500">
            <span>CONVEYOR · 传送带</span>
            {level.mode === "bubble" && <span>本轮范围 0..{passEnd}</span>}
            {level.mode === "select" && <span>第 {roundR + 1} 轮</span>}
          </div>
          <div className="flex flex-wrap items-end gap-2 rounded-xl border border-white/10 bg-black/40 p-3">
            {level.mode === "insert"
              ? // 插入：渲染 已排序前缀 + 间隙按钮 + 待插入 + 剩余
                (() => {
                  const out: JSX.Element[] = [];
                  for (let g = 0; g <= sortedLen && sortedLen < arr.length; g++) {
                    out.push(
                      <button key={`g${g}`} type="button" onClick={() => insertAt(g)} disabled={status !== "playing"} className="h-12 w-5 rounded border border-dashed border-cyan-300/50 text-cyan-300 transition hover:bg-cyan-400/15" title="插到这里">
                        ▾
                      </button>
                    );
                    if (g < sortedLen)
                      out.push(
                        <div key={`s${g}`} style={crateStyle(arr[g], maxV)} className="flex h-12 w-12 items-center justify-center rounded-lg text-base font-black opacity-90">
                          {arr[g]}
                        </div>
                      );
                  }
                  if (sortedLen < arr.length) {
                    out.push(
                      <div key="cur" style={crateStyle(arr[sortedLen], maxV)} className="ml-3 flex h-12 w-12 items-center justify-center rounded-lg text-base font-black ring-2 ring-cyan-300/70">
                        {arr[sortedLen]}
                      </div>
                    );
                    arr.slice(sortedLen + 1).forEach((v, j) =>
                      out.push(
                        <div key={`r${j}`} style={crateStyle(v, maxV)} className="flex h-12 w-12 items-center justify-center rounded-lg text-base font-black opacity-40">
                          {v}
                        </div>
                      )
                    );
                  } else {
                    arr.forEach((v, j) =>
                      out.push(
                        <div key={`d${j}`} style={crateStyle(v, maxV)} className="flex h-12 w-12 items-center justify-center rounded-lg text-base font-black">
                          {v}
                        </div>
                      )
                    );
                  }
                  return out;
                })()
              : level.mode === "partition"
                ? level.array.slice(0, -1).map((v, i) => (
                    <div key={i} style={crateStyle(v, maxV)} className={`flex h-12 w-12 items-center justify-center rounded-lg text-base font-black ${i === partIdx ? "ring-2 ring-cyan-300/70" : i < partIdx ? "opacity-25" : "opacity-60"}`}>
                      {v}
                    </div>
                  ))
                : arr.map((v, i) => {
                    const hot =
                      level.mode === "bubble"
                        ? status === "playing" && (i === pairI || i === pairI + 1)
                        : false;
                    const done =
                      level.mode === "bubble" ? i > passEnd : level.mode === "select" ? i < roundR : false;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => level.mode === "select" && selectClick(i)}
                        disabled={status !== "playing" || level.mode !== "select" || done}
                        style={crateStyle(v, maxV)}
                        className={`flex h-12 w-12 items-center justify-center rounded-lg text-base font-black transition ${
                          hot ? "ring-2 ring-cyan-300/70" : ""
                        } ${done ? "opacity-30" : ""} ${level.mode === "select" && !done ? "hover:scale-105" : ""}`}
                      >
                        {v}
                      </button>
                    );
                  })}
          </div>

          {level.mode === "partition" && (
            <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-start gap-3">
              <div>
                <div className="mb-1 font-mono text-[11px] text-cyan-300">左堆 ≤ {pivot}</div>
                <div className="flex min-h-[3.5rem] flex-wrap gap-1.5 rounded-xl border border-cyan-400/25 bg-black/40 p-2">
                  {leftBin.map((v, i) => (
                    <div key={i} style={crateStyle(v, maxV)} className="flex h-10 w-10 items-center justify-center rounded-md text-sm font-black">
                      {v}
                    </div>
                  ))}
                </div>
              </div>
              <div className="self-center">
                <div style={crateStyle(pivot, maxV)} className="flex h-14 w-14 items-center justify-center rounded-lg text-lg font-black ring-2 ring-amber-300/80">
                  {pivot}
                </div>
                <div className="mt-1 text-center font-mono text-[10px] text-amber-300">基准</div>
              </div>
              <div>
                <div className="mb-1 font-mono text-[11px] text-fuchsia-300">右堆 &gt; {pivot}</div>
                <div className="flex min-h-[3.5rem] flex-wrap gap-1.5 rounded-xl border border-fuchsia-400/25 bg-black/40 p-2">
                  {rightBin.map((v, i) => (
                    <div key={i} style={crateStyle(v, maxV)} className="flex h-10 w-10 items-center justify-center rounded-md text-sm font-black">
                      {v}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {msg && (
        <p className="mt-4 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-sm leading-6 text-amber-200">
          {msg}
        </p>
      )}
    </GameShell>
  );
}

function RaceBoard({
  level,
  racePhase,
  frame,
  framesRef,
  maxV,
}: {
  level: SortLevel;
  racePhase: "bet" | "racing" | "done";
  frame: number;
  framesRef: React.MutableRefObject<{ b: number[][]; q: number[][] }>;
  maxV: number;
}) {
  const { b, q } = framesRef.current;
  const bArr = racePhase === "bet" ? level.array : b[Math.min(frame, b.length - 1)];
  const qArr = racePhase === "bet" ? level.array : q[Math.min(frame, q.length - 1)];
  const bDone = racePhase !== "bet" && frame >= b.length - 1;
  const qDone = racePhase !== "bet" && frame >= q.length - 1;
  return (
    <div className="space-y-5">
      {[
        { name: "冒泡组 🫧", a: bArr, done: bDone, swaps: racePhase === "bet" ? "?" : `${Math.min(frame, b.length - 1)}/${b.length - 1}` },
        { name: "快排组 ⚡", a: qArr, done: qDone, swaps: racePhase === "bet" ? "?" : `${Math.min(frame, q.length - 1)}/${q.length - 1}` },
      ].map((lane) => (
        <div key={lane.name}>
          <div className="mb-1.5 flex items-center justify-between font-mono text-[11px] tracking-widest text-slate-500">
            <span>
              {lane.name} {lane.done && <span className="text-emerald-400">✓ 收工</span>}
            </span>
            <span>交换 {lane.swaps}</span>
          </div>
          <div className={`flex items-end gap-1 rounded-xl border bg-black/40 p-2 ${lane.done ? "border-emerald-500/30" : "border-white/10"}`}>
            {lane.a.map((v, i) => (
              <div
                key={i}
                className="flex-1 rounded-t transition-all duration-100"
                style={{
                  height: `${(v / maxV) * 64 + 8}px`,
                  background: `hsl(${200 - (v / maxV) * 160} 75% 45%)`,
                }}
                title={String(v)}
              />
            ))}
          </div>
        </div>
      ))}
      {racePhase === "bet" && (
        <p className="text-center text-sm text-slate-400">在右侧操作台下注，然后鸣枪开赛。</p>
      )}
    </div>
  );
}
