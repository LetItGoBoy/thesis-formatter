"use client";

/**
 * 霓虹栈城 · 城市电网（图）
 * 玩法：在真实的城市图上动手——BFS 按波纹恢复供电、DFS 钻下水道、
 * 给救护车点出最短路、用最少电缆重建电网（MST）。
 * 所有判定（层序/最短路/MST 权重）均在运行时计算，不靠硬编码。
 */
import { useState } from "react";
import { GameShell, type DsBrief, type DsLevelMeta, type DsStatus } from "@/components/ds/GameShell";

const HUE = 165;

const BRIEFING: DsBrief[] = [
  {
    term: "图：顶点与边",
    story:
      "把城市摊开看：变电站、街区是一个个点，电缆、道路是连接它们的线。谁挨着谁、距离多远，整张网就是城市真正的形状。",
    definition:
      "图 G=(V,E) 由顶点集与边集构成；带权图的边附有权值。常用邻接矩阵 / 邻接表存储。",
  },
  {
    term: "BFS 广度优先",
    story:
      "大停电后从电站送电：先点亮隔一条电缆的街区，再点亮隔两条的——电像水波一圈圈漾开去。波纹到达的先后，就是离电站的远近。",
    definition:
      "BFS 借助队列逐层扩展，先访问距源点近的顶点；无权图中 BFS 给出最少边数路径。",
  },
  {
    term: "DFS 深度优先",
    story:
      "下水道检修员的走法完全相反：认准一条道走到黑，走不通了才退回岔口换一条。一根绳一支笔，整张管网迟早走完。",
    definition:
      "DFS 借助栈（或递归）沿一条路径深入到底，再回溯换路，直至访问所有可达顶点。",
  },
  {
    term: "最短路径（Dijkstra）",
    story:
      "救护车不看「经过几个路口」，只看总里程。Dijkstra 的做法：每次确定离起点最近的一个路口，再用它去松弛邻居——确定一个，就永不反悔。",
    definition:
      "Dijkstra 按距离从小到大确定各顶点最短路（要求非负权），typical 实现 O((V+E)logV)。",
  },
  {
    term: "最小生成树（MST）",
    story:
      "预算紧张的电网重建：要让全城 9 个街区都通电，电缆却要尽量省。贪心的智慧：每次都接当前最便宜、又不绕回路的那一根。",
    definition:
      "生成树 = 连通 n 个顶点的 n−1 条边；总权最小者为 MST。Kruskal 按权排序选边、并查集避环。",
  },
];

// ---------- 城市图数据 ----------
const NODES: Record<string, { x: number; y: number; label: string }> = {
  P: { x: 210, y: 50, label: "电站" },
  B: { x: 90, y: 130, label: "北桥" },
  C: { x: 330, y: 130, label: "码头" },
  D: { x: 40, y: 260, label: "西仓" },
  E: { x: 210, y: 210, label: "中枢" },
  F: { x: 380, y: 260, label: "东港" },
  G: { x: 120, y: 350, label: "南市" },
  H: { x: 300, y: 350, label: "旧城" },
  I: { x: 210, y: 430, label: "医院" },
};
const IDS = Object.keys(NODES);
const EDGES: [string, string, number][] = [
  ["P", "B", 4],
  ["P", "C", 3],
  ["B", "D", 5],
  ["B", "E", 2],
  ["C", "E", 6],
  ["C", "F", 4],
  ["E", "F", 2],
  ["D", "G", 6],
  ["E", "G", 3],
  ["E", "H", 7],
  ["F", "H", 4],
  ["G", "I", 5],
  ["H", "I", 3],
];

function neighbors(id: string): { to: string; w: number }[] {
  const out: { to: string; w: number }[] = [];
  for (const [a, b, w] of EDGES) {
    if (a === id) out.push({ to: b, w });
    if (b === id) out.push({ to: a, w });
  }
  return out;
}
/** BFS 跳数 */
function hopDist(src: string): Record<string, number> {
  const d: Record<string, number> = { [src]: 0 };
  const q = [src];
  while (q.length) {
    const u = q.shift()!;
    for (const { to } of neighbors(u))
      if (!(to in d)) {
        d[to] = d[u] + 1;
        q.push(to);
      }
  }
  return d;
}
/** Dijkstra 最短距离 */
function dijkstra(src: string): Record<string, number> {
  const dist: Record<string, number> = {};
  IDS.forEach((id) => (dist[id] = Infinity));
  dist[src] = 0;
  const done = new Set<string>();
  while (done.size < IDS.length) {
    let u = "";
    let best = Infinity;
    for (const id of IDS) if (!done.has(id) && dist[id] < best) ((best = dist[id]), (u = id));
    if (!u) break;
    done.add(u);
    for (const { to, w } of neighbors(u))
      if (dist[u] + w < dist[to]) dist[to] = dist[u] + w;
  }
  return dist;
}
/** Kruskal MST 权重 */
function mstWeight(): number {
  const parent: Record<string, string> = {};
  IDS.forEach((id) => (parent[id] = id));
  const find = (x: string): string => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  let total = 0;
  for (const [a, b, w] of [...EDGES].sort((x, y) => x[2] - y[2])) {
    if (find(a) !== find(b)) {
      parent[find(a)] = find(b);
      total += w;
    }
  }
  return total;
}

const HOPS = hopDist("P");
const DIST = dijkstra("P");
const MST_W = mstWeight();

interface GridLevel extends DsLevelMeta {
  mode: "bfs" | "dfs" | "path" | "mst";
}

const LEVELS: GridLevel[] = [
  {
    badge: "任务 01",
    title: "波纹送电",
    concept: "BFS 广度优先",
    story: "全城停电，只有电站还亮着。电要像波纹一样推出去：先点亮一条电缆能到的街区，再点亮两条的。",
    task: "按 BFS 层序点亮所有街区：同一圈内顺序随意，但不能跳圈。",
    mode: "bfs",
    hint: "第 1 圈：北桥、码头。它们都亮了，才轮到第 2 圈（西仓、中枢、东港）。",
    skeleton: "P(已亮) → 第1圈 B,C → 第2圈 D,E,F → 第3圈 G,H → 第4圈 I",
    winNote: "BFS 的队列保证「近的先访问」——无权图里，波纹到达的圈数就是最短边数。",
  },
  {
    badge: "任务 02",
    title: "下水道巡线",
    concept: "DFS 深度优先",
    story: "下水道里没有全景地图，只有手电和一条路走到黑的勇气。走不通，就退回上一个岔口。",
    task: "从电站出发深度优先走完全城：每一步只能走向当前位置的某个未访问邻居；死路会自动回溯。",
    mode: "dfs",
    hint: "始终从「当前所在」出发挑一个没去过的邻居钻进去。没有未访问邻居时，系统会带你回溯到上一个岔口。",
    skeleton: "P → 任一邻居 → 一路向深 → 死路回溯 → 换岔口 → …… 直到 9 个街区全部走到",
    winNote: "DFS 的栈记住来路：深入到底、回溯换路。迷宫、连通块、拓扑排序都是它的地盘。",
  },
  {
    badge: "任务 03",
    title: "生死时速",
    concept: "Dijkstra 最短路径",
    story: "医院告急！救护车从电站出发，每条街道的数字是里程。这座城有不止一条路去医院——但最短的只有一个数。",
    task: `沿街道点出一条从电站到医院的路线，总里程必须等于最短值。`,
    mode: "path",
    hint: "别只盯着「经过几个街区」——加一加每段里程。两条 14 公里的路线都算正解。",
    skeleton: "P→北桥(4)→中枢(2)→南市(3)→医院(5) = 14，或 P→码头(3)→东港(4)→旧城(4)→医院(3) = 14",
    winNote: "Dijkstra 每次锁定距离最小的顶点再松弛邻居——贪心却最优，前提是没有负权。",
  },
  {
    badge: "任务 04",
    title: "重建电网",
    concept: "最小生成树（Kruskal）",
    story: "预算司长拍板：全城 9 个街区必须连成一张电网，但每公里电缆都是钱。绕回路的电缆一律不批。",
    task: `点击街道铺设电缆：连通全城且总里程最小（系统会驳回形成回路的电缆）。`,
    mode: "mst",
    hint: "Kruskal 的贪心：每次都挑当前最便宜、且不和已铺电缆构成回路的那条。从 2 公里的两条开始。",
    skeleton: "北桥-中枢2 · 中枢-东港2 · 电站-码头3 · 中枢-南市3 · 旧城-医院3 · 电站-北桥4 · 东港-旧城4 · 北桥-西仓5",
    winNote: "n 个顶点、n−1 条边、无回路、连通——这就是生成树；按权贪心选边即得最小者。",
  },
];

export default function GridPage() {
  const [levelIdx, setLevelIdx] = useState(0);
  const [maxCleared, setMaxCleared] = useState(0);
  const level = LEVELS[levelIdx];

  const [lit, setLit] = useState<string[]>(["P"]);
  const [dfsStack, setDfsStack] = useState<string[]>(["P"]);
  const [dfsVisited, setDfsVisited] = useState<string[]>(["P"]);
  const [path, setPath] = useState<string[]>(["P"]);
  const [selEdges, setSelEdges] = useState<number[]>([]);
  const [status, setStatus] = useState<DsStatus>("playing");
  const [mistakes, setMistakes] = useState(0);
  const [msg, setMsg] = useState("");

  function loadLevel(i: number) {
    setLevelIdx(i);
    setLit(["P"]);
    setDfsStack(["P"]);
    setDfsVisited(["P"]);
    setPath(["P"]);
    setSelEdges([]);
    setStatus("playing");
    setMistakes(0);
    setMsg("");
  }

  function win() {
    setStatus("won");
    setMaxCleared((m) => Math.max(m, levelIdx + 1));
  }

  const pathSum = path.slice(1).reduce((s, id, i) => {
    const prev = path[i];
    const e = EDGES.find(([a, b]) => (a === prev && b === id) || (a === id && b === prev));
    return s + (e?.[2] ?? 0);
  }, 0);

  function clickNode(id: string) {
    if (status !== "playing") return;
    const m = level.mode;

    if (m === "bfs") {
      if (lit.includes(id)) return;
      const unlit = IDS.filter((x) => !lit.includes(x));
      const minHop = Math.min(...unlit.map((x) => HOPS[x]));
      if (HOPS[id] === minHop) {
        const nl = [...lit, id];
        setLit(nl);
        setMsg(`💡 ${NODES[id].label} 通电（第 ${HOPS[id]} 圈）。`);
        if (nl.length === IDS.length) win();
      } else {
        setMistakes((x) => x + 1);
        setMsg(`🚫 波纹还没到 ${NODES[id].label}——第 ${minHop} 圈还有街区没亮。`);
      }
      return;
    }

    if (m === "dfs") {
      if (dfsVisited.includes(id)) {
        setMsg("那里已经巡过了。");
        return;
      }
      const cur = dfsStack[dfsStack.length - 1];
      const isNeighbor = neighbors(cur).some((n) => n.to === id);
      if (!isNeighbor) {
        setMistakes((x) => x + 1);
        setMsg(`🚫 ${NODES[id].label} 不和当前位置（${NODES[cur].label}）相邻——DFS 只能钻向邻居。`);
        return;
      }
      let stack = [...dfsStack, id];
      const visited = [...dfsVisited, id];
      // 自动回溯：栈顶没有未访问邻居就弹出
      let note = `🔦 深入 ${NODES[id].label}。`;
      while (stack.length > 0) {
        const top = stack[stack.length - 1];
        if (neighbors(top).some((n) => !visited.includes(n.to))) break;
        stack = stack.slice(0, -1);
        if (stack.length > 0)
          note = `↩️ ${NODES[top].label} 是死路，回溯到 ${NODES[stack[stack.length - 1]].label}。`;
      }
      setDfsStack(stack);
      setDfsVisited(visited);
      setMsg(note);
      if (visited.length === IDS.length) win();
      return;
    }

    if (m === "path") {
      const cur = path[path.length - 1];
      if (id === cur) return;
      const edge = neighbors(cur).find((n) => n.to === id);
      if (!edge) {
        setMistakes((x) => x + 1);
        setMsg(`🚫 ${NODES[cur].label} 和 ${NODES[id].label} 之间没有直达街道。`);
        return;
      }
      if (path.includes(id)) {
        setMsg("救护车不走回头路。");
        return;
      }
      const np = [...path, id];
      setPath(np);
      if (id === "I") {
        const total = np.slice(1).reduce((s, x, i) => {
          const e = EDGES.find(([a, b]) => (a === np[i] && b === x) || (a === x && b === np[i]))!;
          return s + e[2];
        }, 0);
        if (total === DIST.I) {
          setMsg(`🚑 ${total} 公里抵达医院——正是最短路！`);
          win();
        } else {
          setStatus("failed");
          setMsg("");
          setMistakes((x) => x + 1);
        }
      } else {
        setMsg(`已行驶 ${pathSum + edge.w} 公里。`);
      }
    }
  }

  function clickEdge(ei: number) {
    if (status !== "playing" || level.mode !== "mst") return;
    if (selEdges.includes(ei)) {
      setSelEdges(selEdges.filter((x) => x !== ei));
      setMsg("拆除了一条电缆。");
      return;
    }
    // 并查集查环（只看已选边）
    const parent: Record<string, string> = {};
    IDS.forEach((id) => (parent[id] = id));
    const find = (x: string): string => (parent[x] === x ? x : (parent[x] = find(parent[x])));
    for (const i of selEdges) {
      const [a, b] = EDGES[i];
      parent[find(a)] = find(b);
    }
    const [a, b, w] = EDGES[ei];
    if (find(a) === find(b)) {
      setMistakes((x) => x + 1);
      setMsg(`🚫 ${NODES[a].label}—${NODES[b].label} 会构成回路：两端早已连通，这 ${w} 公里是浪费。`);
      return;
    }
    const ns = [...selEdges, ei];
    setSelEdges(ns);
    parent[find(a)] = find(b);
    const allConnected = IDS.every((id) => find(id) === find("P"));
    const total = ns.reduce((s, i) => s + EDGES[i][2], 0);
    if (allConnected) {
      if (total === MST_W) {
        setMsg(`⚡ 全城通电，总里程 ${total} 公里——恰好是最小生成树！`);
        win();
      } else {
        setStatus("failed");
        setMsg("");
        setMistakes((x) => x + 1);
      }
    } else {
      setMsg(`已铺 ${ns.length} 条电缆，共 ${total} 公里。`);
    }
  }

  function undoPath() {
    if (level.mode !== "path" || path.length <= 1 || status !== "playing") return;
    setPath(path.slice(0, -1));
    setMsg("倒车一步。");
  }

  function nodeState(id: string): "on" | "cur" | "off" {
    const m = level.mode;
    if (m === "bfs") return lit.includes(id) ? "on" : "off";
    if (m === "dfs")
      return dfsStack[dfsStack.length - 1] === id ? "cur" : dfsVisited.includes(id) ? "on" : "off";
    if (m === "path") return path[path.length - 1] === id ? "cur" : path.includes(id) ? "on" : "off";
    return "off";
  }

  const selWeight = selEdges.reduce((s, i) => s + EDGES[i][2], 0);

  return (
    <GameShell
      code="GRP"
      name="城市电网"
      structure="图 Graph"
      hue={HUE}
      districtNo="城区 07"
      flavor="停电之夜，供电像波纹一圈圈扩散。给救护车找一条最短的路。"
      briefing={BRIEFING}
      levels={LEVELS}
      levelIdx={levelIdx}
      maxCleared={maxCleared}
      onSelectLevel={loadLevel}
      status={status}
      mistakes={mistakes}
      failTitle={level.mode === "path" ? "这不是最短路" : "预算超支"}
      failNote={
        level.mode === "path"
          ? `你的路线 ${pathSum} 公里，而最短路是 ${DIST.I} 公里。换条路再试——记住，看总里程，别数路口。`
          : `全城是通电了，但花了 ${selWeight} 公里电缆；最省方案只要 ${MST_W} 公里。贪心一点：每次都选最便宜且不成环的。`
      }
      onRetry={() => loadLevel(levelIdx)}
      onNext={() => loadLevel(levelIdx + 1)}
      completionText="电网重建完成！终章：分拣厂（排序）"
      consoleSlot={
        <>
          {level.mode === "path" && (
            <button
              type="button"
              onClick={undoPath}
              disabled={path.length <= 1 || status !== "playing"}
              className="w-full rounded-xl bg-slate-50 px-4 py-2 text-xs text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-100 disabled:text-slate-600"
            >
              倒车一步
            </button>
          )}
          <div className="rounded-xl bg-slate-50 p-3 font-mono text-[11px] leading-6 text-slate-600 ring-1 ring-slate-200">
            {level.mode === "bfs" && <>已点亮 {lit.length}/{IDS.length}</>}
            {level.mode === "dfs" && (
              <>
                已巡查 {dfsVisited.length}/{IDS.length}
                <br />
                当前：{NODES[dfsStack[dfsStack.length - 1]]?.label ?? "—"}
                <br />
                栈深：{dfsStack.length}
              </>
            )}
            {level.mode === "path" && (
              <>
                里程 {pathSum} 公里
                <br />
                路线：{path.join("→")}
              </>
            )}
            {level.mode === "mst" && (
              <>
                电缆 {selEdges.length} 条 · {selWeight} 公里
              </>
            )}
          </div>
        </>
      }
    >
      <div className="mb-2 flex items-center justify-between font-mono text-[11px] tracking-widest text-slate-600">
        <span>CITY GRID · 城市图（边上数字为里程/权值）</span>
        <span>V={IDS.length} · E={EDGES.length}</span>
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
        <svg viewBox="0 0 420 470" className="mx-auto w-full max-w-xl">
          {/* 边 */}
          {EDGES.map(([a, b, w], i) => {
            const A = NODES[a];
            const B = NODES[b];
            const onPath =
              level.mode === "path" &&
              path.some((id, j) => j > 0 && ((path[j - 1] === a && id === b) || (path[j - 1] === b && id === a)));
            const sel = level.mode === "mst" && selEdges.includes(i);
            return (
              <g key={i} onClick={() => clickEdge(i)} className={level.mode === "mst" ? "cursor-pointer" : undefined}>
                <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="transparent" strokeWidth="16" />
                <line
                  x1={A.x}
                  y1={A.y}
                  x2={B.x}
                  y2={B.y}
                  stroke={sel || onPath ? "hsl(45 90% 55%)" : "rgba(148,163,184,0.35)"}
                  strokeWidth={sel || onPath ? 3.5 : 1.5}
                />
                <circle cx={(A.x + B.x) / 2} cy={(A.y + B.y) / 2} r="9" fill="#0b0b18" stroke="rgba(148,163,184,0.3)" />
                <text x={(A.x + B.x) / 2} y={(A.y + B.y) / 2 + 3.5} textAnchor="middle" fontSize="10" fill="#94a3b8" fontFamily="monospace">
                  {w}
                </text>
              </g>
            );
          })}
          {/* 顶点 */}
          {IDS.map((id) => {
            const n = NODES[id];
            const st = nodeState(id);
            const isPower = id === "P";
            const isTarget = level.mode === "path" && id === "I";
            return (
              <g key={id} onClick={() => clickNode(id)} className="cursor-pointer">
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={20}
                  fill={
                    st === "cur"
                      ? "hsl(190 85% 38%)"
                      : st === "on"
                        ? "hsl(160 70% 30%)"
                        : "hsl(220 25% 18%)"
                  }
                  stroke={
                    isPower
                      ? "hsl(45 90% 60%)"
                      : isTarget
                        ? "hsl(0 80% 60%)"
                        : "rgba(255,255,255,0.3)"
                  }
                  strokeWidth={isPower || isTarget ? 2.5 : 1.5}
                />
                <text x={n.x} y={n.y + 1} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">
                  {id === "P" ? "⚡" : id === "I" ? "🏥" : id}
                </text>
                <text x={n.x} y={n.y + 34} textAnchor="middle" fontSize="10" fill="#94a3b8">
                  {n.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {msg && (
        <p className="mt-4 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-sm leading-6 text-amber-700">
          {msg}
        </p>
      )}
    </GameShell>
  );
}
