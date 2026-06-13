"use client";

/**
 * 霓虹栈城 · 中央邮局（哈希表）
 * 玩法：按哈希函数 H(k)=k%N 亲手投信；撞格口时体验链地址与线性探测；
 * 查找必须沿探测序走；装填因子超标触发扩容 rehash。
 */
import { useState } from "react";
import { GameShell, type DsBrief, type DsLevelMeta, type DsStatus } from "@/components/ds/GameShell";

const HUE = 265;

const BRIEFING: DsBrief[] = [
  {
    term: "哈希函数",
    story:
      "中央邮局不查目录：投递员拿到信，把地址号一算（除以格口数取余数），直接走到那个格口——一步到位，不用翻找。",
    definition:
      "哈希函数把关键字映射为存储地址，常用除留余数法 H(k) = k mod N。理想情况下查找 O(1)。",
  },
  {
    term: "冲突与链地址法",
    story:
      "两封信算出了同一个格口？老办法：在格口下面挂条链子，后来的信就拴在链上。格口还是那个格口，只是下面越挂越长。",
    definition:
      "不同关键字映射到同一地址即冲突。链地址法：每个槽位维护一条链表，冲突元素挂入链中。",
  },
  {
    term: "开放定址（线性探测）",
    story:
      "新邮局不许挂链子。格口被占？往后挪一格看看，再占再挪——总能找到空格。但查信时也得按同样的路线找，不能抄近道。",
    definition:
      "线性探测：H(k) 被占则依次探查 (H(k)+1)%N, (H(k)+2)%N…查找必须沿同一探测序列，遇空槽即可断定不存在。",
  },
  {
    term: "装填因子与 rehash",
    story:
      "格口快满时，投一封信要挪好多格，邮局名存实亡。局长一声令下：搬进两倍大的新楼，所有信按新格口数重新计算、重新入格。",
    definition:
      "装填因子 α = 已存元素数 / 槽位数。α 过高（常以 0.75 为阈）则扩容并对全部元素重新散列（rehash）。",
  },
];

interface PostLevel extends DsLevelMeta {
  mode: "direct" | "chain" | "probe" | "lookup" | "rehash";
  size: number;
  letters: number[];
  prefill?: [number, number][]; // [slot, value]
  lookupTargets?: { value: number; exists: boolean }[];
  newSize?: number;
}

const LEVELS: PostLevel[] = [
  {
    badge: "任务 01",
    title: "一步到位",
    concept: "哈希函数 H(k)=k%7",
    story: "上岗第一天，四封信，七个格口。规矩只有一条算式：地址号除以 7 取余数，就是格口号。",
    task: "为每封信点击正确的格口（H(k) = k mod 7）。",
    mode: "direct",
    size: 7,
    letters: [10, 23, 4, 19],
    hint: "10 ÷ 7 余 3 → 3 号格口。其余的照着算。",
    skeleton: "10→格3 · 23→格2 · 4→格4 · 19→格5",
    winNote: "不比较、不遍历，一次计算直达地址——这是哈希 O(1) 的全部秘密。",
  },
  {
    badge: "任务 02",
    title: "挂链的格口",
    concept: "冲突 · 链地址法",
    story: "今天的信邪门了：10、17、24 算出来全是 3 号格口。还好这间老邮局允许挂链子。",
    task: "把 5 封信投进各自的基格口，冲突的信会自动挂上链条。",
    mode: "chain",
    size: 7,
    letters: [10, 5, 17, 24, 12],
    hint: "照样算 k%7，不用管格口占没占——链地址法里冲突的信都挂在同一个基格口下。",
    skeleton: "10→格3 · 5→格5 · 17→格3（挂链）· 24→格3（挂链）· 12→格5（挂链）",
    winNote: "链地址法：槽位变链表头。冲突不挪窝，只是链变长——查找退化为沿链比较。",
  },
  {
    badge: "任务 03",
    title: "禁止挂链",
    concept: "开放定址 · 线性探测",
    story: "新邮局明令禁止挂链。格口被占就往后挪一格（+1），再占再挪。四封信，三封要撞格口。",
    task: "为每封信点击它最终落入的格口（线性探测后的位置）。",
    mode: "probe",
    size: 7,
    letters: [10, 17, 3, 24],
    hint: "17%7=3，但 3 号已被 10 占了 → 探测 4 号。后面的信要连跳好几格。",
    skeleton: "10→格3 · 17→3占→格4 · 3→3,4占→格5 · 24→3,4,5占→格6",
    winNote: "线性探测把冲突摊到邻近槽位。代价：占用成片（聚集），探测越来越长。",
  },
  {
    badge: "任务 04",
    title: "按图索信",
    concept: "哈希查找 · 探测序列",
    story:
      "昨晚的信全靠探测入格。现在有人来取 24 号信——你不能直接翻到 6 号格，必须沿当年的探测路线重新走一遍。还有人来取根本不存在的 31 号信。",
    task: "先沿探测序列逐格点击找到 24；再为 31 沿探测序列走到空格口，点「确认不存在」。",
    mode: "lookup",
    size: 7,
    letters: [],
    prefill: [
      [3, 10],
      [4, 17],
      [5, 3],
      [6, 24],
    ],
    lookupTargets: [
      { value: 24, exists: true },
      { value: 31, exists: false },
    ],
    hint: "查找和插入必须走同一条探测路：从 H(k) 出发逐格 +1。遇到空格还没找到？那它一定不存在。",
    skeleton: "找24：格3→4→5→6 ✓ · 找31：格3→4→5→6→0（空）→ 确认不存在",
    winNote: "开放定址的查找铁律：沿原探测序走，碰到空槽即可宣判不存在——这就是为什么删除要打「墓碑」标记。",
  },
  {
    badge: "任务 05",
    title: "爆仓搬家",
    concept: "装填因子 · rehash",
    story:
      "格口 7 个，信已 5 封（α≈0.71）。又来一封 12 号信——投完它，装填因子将冲破 0.75 警戒线，整座邮局必须扩容搬家。",
    task: "先把 12 号信探测入格；警报响起后扩容到 11 格，再把所有信按 k mod 11 重新入格。",
    mode: "rehash",
    size: 7,
    newSize: 11,
    letters: [12],
    prefill: [
      [0, 14],
      [1, 8],
      [2, 22],
      [3, 31],
      [5, 5],
    ],
    alert: "α 警戒线 0.75",
    hint: "12%7=5 被占 → 格6。扩容后全部重算：14%11=3、8%11=8、22%11=0、31%11=9、5%11=5、12%11=1。",
    skeleton: "12→格6（α=6/7 报警）→ 扩容 → 14→格3 · 8→格8 · 22→格0 · 31→格9 · 5→格5 · 12→格1",
    winNote: "rehash 是哈希表的「搬家日」：一次 O(n) 的重整，换回长久的 O(1)。工程里它均摊在每次插入上。",
  },
];

function letterStyle(n: number) {
  const h = (n * 37 + 200) % 360;
  return {
    background: `linear-gradient(160deg, hsl(${h} 75% 28%), hsl(${h} 70% 15%))`,
    boxShadow: `inset 0 0 0 1px hsl(${h} 85% 65% / 0.5)`,
    color: `hsl(${h} 90% 80%)`,
  };
}

export default function PostOfficePage() {
  const [levelIdx, setLevelIdx] = useState(0);
  const [maxCleared, setMaxCleared] = useState(0);
  const level = LEVELS[levelIdx];

  const [size, setSize] = useState(LEVELS[0].size);
  const [slots, setSlots] = useState<(number | null)[]>(Array(LEVELS[0].size).fill(null));
  const [chains, setChains] = useState<number[][]>(Array(LEVELS[0].size).fill(null).map(() => []));
  const [letterIdx, setLetterIdx] = useState(0);
  const [lookupIdx, setLookupIdx] = useState(0);
  const [probeIdx, setProbeIdx] = useState(0);
  const [rehashPhase, setRehashPhase] = useState<"deliver" | "alarm" | "replace">("deliver");
  const [replaceQueue, setReplaceQueue] = useState<number[]>([]);
  const [status, setStatus] = useState<DsStatus>("playing");
  const [mistakes, setMistakes] = useState(0);
  const [msg, setMsg] = useState("");

  function loadLevel(i: number) {
    const lv = LEVELS[i];
    setLevelIdx(i);
    setSize(lv.size);
    const s: (number | null)[] = Array(lv.size).fill(null);
    lv.prefill?.forEach(([slot, v]) => (s[slot] = v));
    setSlots(s);
    setChains(Array(lv.size).fill(null).map(() => []));
    setLetterIdx(0);
    setLookupIdx(0);
    setProbeIdx(0);
    setRehashPhase("deliver");
    setReplaceQueue([]);
    setStatus("playing");
    setMistakes(0);
    setMsg("");
  }

  function win() {
    setStatus("won");
    setMaxCleared((m) => Math.max(m, levelIdx + 1));
  }

  /** 线性探测的最终落点 */
  function probeDest(k: number, table: (number | null)[], n: number): number {
    let i = k % n;
    while (table[i] !== null) i = (i + 1) % n;
    return i;
  }

  function clickSlot(idx: number) {
    if (status !== "playing") return;
    const m = level.mode;

    if (m === "direct" || m === "chain") {
      const k = level.letters[letterIdx];
      const expected = k % size;
      if (idx !== expected) {
        setMistakes((x) => x + 1);
        setMsg(`🚫 ${k} mod ${size} 不等于 ${idx}——再算一遍。`);
        return;
      }
      if (m === "direct") {
        const next = [...slots];
        next[idx] = k;
        setSlots(next);
      } else {
        if (slots[idx] === null) {
          const next = [...slots];
          next[idx] = k;
          setSlots(next);
          setMsg(`✅ ${k} 入格 ${idx}。`);
        } else {
          const next = chains.map((c) => [...c]);
          next[idx].push(k);
          setChains(next);
          setMsg(`🔗 格 ${idx} 已有信，${k} 挂上链条。`);
        }
      }
      const ni = letterIdx + 1;
      setLetterIdx(ni);
      if (ni === level.letters.length) win();
      return;
    }

    if (m === "probe" || (m === "rehash" && rehashPhase === "deliver")) {
      const k = level.letters[letterIdx];
      const expected = probeDest(k, slots, size);
      if (idx !== expected) {
        setMistakes((x) => x + 1);
        setMsg(
          slots[idx] !== null
            ? `🚫 格 ${idx} 已被 ${slots[idx]} 占用——继续 +1 往后探测。`
            : `🚫 探测序还没走到格 ${idx}。从 ${k}%${size}=${k % size} 出发逐格 +1。`
        );
        return;
      }
      const next = [...slots];
      next[idx] = k;
      setSlots(next);
      const ni = letterIdx + 1;
      setLetterIdx(ni);
      if (m === "probe") {
        setMsg(`✅ ${k} 落入格 ${idx}。`);
        if (ni === level.letters.length) win();
      } else {
        // rehash 关：投完触发警报
        const count = next.filter((x) => x !== null).length;
        setRehashPhase("alarm");
        setMsg(`🚨 装填因子 α = ${count}/${size} ≈ ${(count / size).toFixed(2)} > 0.75——必须扩容搬家！`);
      }
      return;
    }

    if (m === "lookup") {
      const t = level.lookupTargets![lookupIdx];
      const seq: number[] = [];
      let i = t.value % size;
      for (;;) {
        seq.push(i);
        if (slots[i] === null || slots[i] === t.value) break;
        i = (i + 1) % size;
      }
      const expected = seq[probeIdx];
      if (idx !== expected) {
        setMistakes((x) => x + 1);
        setMsg(`🚫 必须沿探测序走：从 ${t.value}%${size}=${t.value % size} 出发逐格 +1，不能抄近道。`);
        return;
      }
      const found = slots[idx] === t.value;
      const empty = slots[idx] === null;
      if (found) {
        setMsg(`📬 在格 ${idx} 找到 ${t.value} 号信！`);
        const nl = lookupIdx + 1;
        setLookupIdx(nl);
        setProbeIdx(0);
        if (nl === level.lookupTargets!.length) win();
      } else if (empty) {
        setMsg(`格 ${idx} 是空的——探测序走到空格还没见到 ${t.value}，说明……？`);
        setProbeIdx(probeIdx + 1);
      } else {
        setMsg(`格 ${idx} 里是 ${slots[idx]}，不是 ${t.value}——继续探测。`);
        setProbeIdx(probeIdx + 1);
      }
      return;
    }

    if (m === "rehash" && rehashPhase === "replace") {
      const k = replaceQueue[0];
      const expected = k % size;
      if (idx !== expected) {
        setMistakes((x) => x + 1);
        setMsg(`🚫 新邮局有 ${size} 个格口：${k} mod ${size} 才是它的新家。`);
        return;
      }
      const next = [...slots];
      next[idx] = k;
      setSlots(next);
      const rq = replaceQueue.slice(1);
      setReplaceQueue(rq);
      setMsg(`✅ ${k} 入新格 ${idx}。`);
      if (rq.length === 0) win();
    }
  }

  function confirmNotExist() {
    if (status !== "playing" || level.mode !== "lookup") return;
    const t = level.lookupTargets![lookupIdx];
    // 当前探测位置是否已撞到空格
    const seq: number[] = [];
    let i = t.value % size;
    for (;;) {
      seq.push(i);
      if (slots[i] === null || slots[i] === t.value) break;
      i = (i + 1) % size;
    }
    const walkedToEmpty = probeIdx >= seq.length && slots[seq[seq.length - 1]] === null;
    if (!t.exists && walkedToEmpty) {
      setMsg(`✅ 判定正确：探测序撞到空格，${t.value} 号信不存在。`);
      const nl = lookupIdx + 1;
      setLookupIdx(nl);
      setProbeIdx(0);
      if (nl === level.lookupTargets!.length) win();
    } else {
      setMistakes((x) => x + 1);
      setMsg(t.exists ? "🚫 这封信明明存在——继续沿探测序找。" : "🚫 还没走到空格，不能下结论。");
    }
  }

  function doRehash() {
    if (level.mode !== "rehash" || rehashPhase !== "alarm") return;
    const all = slots.filter((x): x is number => x !== null);
    setSize(level.newSize!);
    setSlots(Array(level.newSize!).fill(null));
    setReplaceQueue(all);
    setRehashPhase("replace");
    setMsg(`🏗️ 新邮局 ${level.newSize} 个格口已就绪。把每封信按 k mod ${level.newSize} 重新入格。`);
  }

  const currentLetter =
    level.mode === "rehash" && rehashPhase === "replace"
      ? replaceQueue[0]
      : level.letters[letterIdx];
  const currentLookup = level.mode === "lookup" ? level.lookupTargets?.[lookupIdx] : undefined;
  const filled = slots.filter((x) => x !== null).length;

  return (
    <GameShell
      code="HSH"
      courseId="ds-postoffice"
      name="中央邮局"
      structure="哈希表 Hash"
      hue={HUE}
      districtNo="城区 06"
      flavor="用哈希函数把信投进格口。撞了格子，是挂链子还是找下一格？"
      briefing={BRIEFING}
      levels={LEVELS}
      levelIdx={levelIdx}
      maxCleared={maxCleared}
      onSelectLevel={loadLevel}
      status={status}
      mistakes={mistakes}
      onRetry={() => loadLevel(levelIdx)}
      onNext={() => loadLevel(levelIdx + 1)}
      completionText="邮路畅通！下一站：城市电网（图）"
      consoleSlot={
        <>
          {level.mode === "lookup" && (
            <button
              type="button"
              onClick={confirmNotExist}
              disabled={status !== "playing"}
              className="w-full rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-600 transition hover:bg-amber-500/20 disabled:opacity-40"
            >
              确认不存在
            </button>
          )}
          {level.mode === "rehash" && rehashPhase === "alarm" && (
            <button
              type="button"
              onClick={doRehash}
              className="w-full animate-glow rounded-xl border border-amber-500/40 bg-amber-500/15 px-4 py-2.5 text-sm font-bold text-amber-600 transition hover:bg-amber-500/25"
            >
              🏗️ 扩容搬家（{size} → {level.newSize} 格）
            </button>
          )}
          <div className="rounded-xl bg-slate-50 p-3 font-mono text-[11px] leading-6 text-slate-600 ring-1 ring-slate-200">
            H(k) = k mod {size}
            <br />
            α = {filled}/{size} = {(filled / size).toFixed(2)}
          </div>
        </>
      }
    >
      {/* 待处理 */}
      <div>
        <div className="mb-2 font-mono text-[11px] tracking-widest text-slate-600">
          {level.mode === "lookup" ? "PICKUP · 取信请求" : "INBOX · 待投递"}
        </div>
        <div className="flex min-h-[3.4rem] flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
          {level.mode === "lookup" ? (
            currentLookup ? (
              <span className="px-2 text-sm text-slate-600">
                有人来取 <b className="text-cyan-600">{currentLookup.value} 号信</b>——从格{" "}
                {currentLookup.value % size} 开始沿探测序点击。
              </span>
            ) : (
              <span className="px-2 text-xs text-slate-600">全部处理完毕</span>
            )
          ) : currentLetter !== undefined ? (
            <>
              <div style={letterStyle(currentLetter)} className="flex h-11 min-w-[2.75rem] items-center justify-center rounded-lg px-2 text-base font-black ring-2 ring-cyan-300/60">
                ✉ {currentLetter}
              </div>
              <span className="font-mono text-xs text-slate-600">
                {currentLetter} mod {size} = ?
              </span>
            </>
          ) : (
            <span className="px-2 text-xs text-slate-600">没有待投递的信</span>
          )}
        </div>
      </div>

      {/* 格口墙 */}
      <div className="mt-6">
        <div className="mb-2 font-mono text-[11px] tracking-widest text-slate-600">
          PIGEONHOLES · 格口墙（{size} 格）
        </div>
        <div className="flex flex-wrap items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          {slots.map((v, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={() => clickSlot(i)}
                disabled={status !== "playing"}
                style={v !== null ? letterStyle(v) : undefined}
                className={`flex h-12 w-12 items-center justify-center rounded-lg text-sm font-black transition hover:scale-105 ${
                  v === null ? "border border-dashed border-slate-300 text-slate-600" : ""
                }`}
              >
                {v ?? "空"}
              </button>
              <div className="font-mono text-[11px] text-slate-600">[{i}]</div>
              {/* 链 */}
              {chains[i]?.map((c, j) => (
                <div key={j} className="flex flex-col items-center">
                  <span className="text-[11px] leading-3 text-slate-600">↓</span>
                  <div style={letterStyle(c)} className="flex h-9 w-11 items-center justify-center rounded-md text-xs font-black opacity-90">
                    {c}
                  </div>
                </div>
              ))}
            </div>
          ))}
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
