"use client";

/**
 * 二叉树 SVG 渲染（档案塔 BST / 倾斜高塔 AVL 共用）
 * components/ds/TreeSVG.tsx
 *
 * 布局：x = 中序序号，y = 深度。支持节点点击、着色、角标（如平衡因子）、
 * 空位插槽（虚线圆，用于插入玩法）。
 */
export interface TNode {
  v: number;
  l: TNode | null;
  r: TNode | null;
}

export interface TreeSlot {
  key: string;
  parent: number;
  side: "l" | "r";
}

interface Pos {
  x: number;
  y: number;
}

const XGAP = 60;
const YGAP = 74;
const R = 17;

function layout(root: TNode | null): { pos: Map<number, Pos>; count: number; depth: number } {
  const pos = new Map<number, Pos>();
  let idx = 0;
  let maxDepth = 0;
  function walk(n: TNode | null, d: number) {
    if (!n) return;
    walk(n.l, d + 1);
    pos.set(n.v, { x: (idx + 1) * XGAP, y: d * YGAP + 34 });
    idx += 1;
    maxDepth = Math.max(maxDepth, d);
    walk(n.r, d + 1);
  }
  walk(root, 0);
  return { pos, count: idx, depth: maxDepth };
}

export function TreeSVG({
  root,
  onNodeClick,
  nodeFill,
  nodeLabel,
  slots,
  onSlotClick,
  height,
}: {
  root: TNode | null;
  onNodeClick?: (v: number) => void;
  /** 返回节点填充色（hsl 字符串）；不给则默认 */
  nodeFill?: (v: number) => string;
  /** 节点角标（如平衡因子） */
  nodeLabel?: (v: number) => string | null;
  slots?: TreeSlot[];
  onSlotClick?: (s: TreeSlot) => void;
  height?: number;
}) {
  const { pos, count, depth } = layout(root);
  const w = Math.max((count + 1) * XGAP, 320);
  const h = height ?? (depth + 1) * YGAP + 70;

  const edges: { from: Pos; to: Pos }[] = [];
  function collectEdges(n: TNode | null) {
    if (!n) return;
    const p = pos.get(n.v)!;
    for (const c of [n.l, n.r]) {
      if (c) {
        edges.push({ from: p, to: pos.get(c.v)! });
        collectEdges(c);
      }
    }
  }
  collectEdges(root);

  const nodes: TNode[] = [];
  (function collect(n: TNode | null) {
    if (!n) return;
    nodes.push(n);
    collect(n.l);
    collect(n.r);
  })(root);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ maxHeight: h }}>
      {edges.map((e, i) => (
        <line
          key={i}
          x1={e.from.x}
          y1={e.from.y}
          x2={e.to.x}
          y2={e.to.y}
          stroke="rgba(148,163,184,0.4)"
          strokeWidth="1.5"
        />
      ))}

      {/* 空位插槽 */}
      {slots?.map((s) => {
        const p = pos.get(s.parent);
        if (!p) return null;
        const sx = p.x + (s.side === "l" ? -XGAP * 0.55 : XGAP * 0.55);
        const sy = p.y + YGAP;
        return (
          <g
            key={s.key}
            onClick={() => onSlotClick?.(s)}
            className="cursor-pointer"
          >
            <line x1={p.x} y1={p.y} x2={sx} y2={sy} stroke="rgba(148,163,184,0.2)" strokeDasharray="3 3" />
            <circle
              cx={sx}
              cy={sy}
              r={R - 2}
              fill="rgba(34,211,238,0.06)"
              stroke="rgba(34,211,238,0.55)"
              strokeDasharray="4 3"
            />
            <text x={sx} y={sy + 4} textAnchor="middle" fontSize="11" fill="rgba(34,211,238,0.8)">
              ?
            </text>
          </g>
        );
      })}

      {nodes.map((n) => {
        const p = pos.get(n.v)!;
        const fill = nodeFill?.(n.v) ?? "hsl(220 30% 22%)";
        const label = nodeLabel?.(n.v);
        return (
          <g
            key={n.v}
            onClick={() => onNodeClick?.(n.v)}
            className={onNodeClick ? "cursor-pointer" : undefined}
          >
            <circle cx={p.x} cy={p.y} r={R} fill={fill} stroke="rgba(15,23,42,0.25)" strokeWidth="1.5" />
            <text
              x={p.x}
              y={p.y + 4.5}
              textAnchor="middle"
              fontSize="13"
              fontWeight="700"
              fill="#fff"
            >
              {n.v}
            </text>
            {label && (
              <text x={p.x + R + 3} y={p.y - R + 6} fontSize="10" fill="rgba(251,191,36,0.95)" fontFamily="monospace">
                {label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
