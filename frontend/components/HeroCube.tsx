"use client";

/**
 * 高光谱数据立方体 · 纯 SVG 矢量插画（Hero 主视觉）
 * components/HeroCube.tsx
 *
 * 等距立方体：顶面 = 地表（农田 + 河流），左面 = 可见光谱彩虹波段，
 * 右面 = 近红外蓝色波段；上方卫星以彩虹光束扫描。
 * 矢量绘制 → 亮底上边缘锐利无黑边，任意缩放不糊。
 */

// ---- 等距几何 ----
const N = { x: 280, y: 60 }; // 顶面北角
const E = { x: 470, y: 165 }; // 东角
const S = { x: 280, y: 270 }; // 南角
const W = { x: 90, y: 165 }; // 西角
const H = 180; // 立方体高度

/** 顶面双线性参数化：u 沿 N→E，v 沿 N→W */
function P(u: number, v: number) {
  return {
    x: N.x + u * (E.x - N.x) + v * (W.x - N.x),
    y: N.y + u * (E.y - N.y) + v * (W.y - N.y),
  };
}
const pt = (p: { x: number; y: number }) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
/** 顶面上的小块（农田） */
function quad(u0: number, v0: number, u1: number, v1: number) {
  return [P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)].map(pt).join(" ");
}

// 左面光谱层颜色（上红 → 下紫，呼应波长递减）
const LEFT_BANDS = ["#ef4444", "#f97316", "#facc15", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6"];
// 右面近红外波段（深海军 → 青）
const RIGHT_BANDS = ["#0c2a52", "#0e3a6e", "#114e8c", "#1565a8", "#1b7fc4", "#27a0da", "#3ec3ec"];

// 农田色块（u0,v0,u1,v1,颜色）
const FIELDS: [number, number, number, number, string][] = [
  [0.04, 0.05, 0.46, 0.3, "#5da04c"],
  [0.52, 0.04, 0.96, 0.26, "#7ab55c"],
  [0.06, 0.36, 0.3, 0.62, "#8fc26a"],
  [0.55, 0.32, 0.8, 0.55, "#4c8f42"],
  [0.84, 0.3, 0.97, 0.6, "#a3cb7a"],
  [0.08, 0.68, 0.38, 0.95, "#6aa84f"],
  [0.44, 0.62, 0.7, 0.9, "#97bf63"],
  [0.74, 0.62, 0.96, 0.94, "#558b46"],
];

// 河流路径（顶面参数坐标）
const RIVER = [
  [0.0, 0.42],
  [0.18, 0.5],
  [0.38, 0.42],
  [0.58, 0.52],
  [0.78, 0.44],
  [1.0, 0.55],
].map(([u, v]) => P(u, v));

export function HeroCube({ className }: { className?: string }) {
  const bandH = H / LEFT_BANDS.length;
  const riverD =
    `M ${RIVER[0].x} ${RIVER[0].y} ` +
    RIVER.slice(1)
      .map((p) => `L ${p.x} ${p.y}`)
      .join(" ");

  return (
    <svg viewBox="0 0 560 520" className={className} role="img" aria-label="高光谱数据立方体插画">
      <defs>
        <linearGradient id="hc-beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="35%" stopColor="#facc15" stopOpacity="0.55" />
          <stop offset="70%" stopColor="#22c55e" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.35" />
        </linearGradient>
        <filter id="hc-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="12" />
        </filter>
      </defs>

      {/* 地面投影 */}
      <ellipse cx="280" cy="468" rx="215" ry="26" fill="#94a3b8" opacity="0.28" filter="url(#hc-blur)" />

      {/* ===== 左面：可见光谱波段 ===== */}
      <g>
        {LEFT_BANDS.map((c, i) => {
          const t0 = i * bandH;
          const t1 = t0 + bandH;
          return (
            <polygon
              key={c}
              points={`${W.x},${W.y + t0} ${S.x},${S.y + t0} ${S.x},${S.y + t1} ${W.x},${W.y + t1}`}
              fill={c}
            />
          );
        })}
        {/* 体素竖网格 */}
        {Array.from({ length: 9 }, (_, i) => {
          const f = (i + 1) / 10;
          const x = W.x + f * (S.x - W.x);
          const y = W.y + f * (S.y - W.y);
          return <line key={i} x1={x} y1={y} x2={x} y2={y + H} stroke="#fff" strokeOpacity="0.22" />;
        })}
        {/* 波段横线 */}
        {LEFT_BANDS.map((_, i) => (
          <line
            key={i}
            x1={W.x}
            y1={W.y + i * bandH}
            x2={S.x}
            y2={S.y + i * bandH}
            stroke="#fff"
            strokeOpacity="0.3"
          />
        ))}
      </g>

      {/* ===== 右面：近红外波段 ===== */}
      <g>
        {RIGHT_BANDS.map((c, i) => {
          const t0 = i * bandH;
          const t1 = t0 + bandH;
          return (
            <polygon
              key={c}
              points={`${S.x},${S.y + t0} ${E.x},${E.y + t0} ${E.x},${E.y + t1} ${S.x},${S.y + t1}`}
              fill={c}
            />
          );
        })}
        {Array.from({ length: 9 }, (_, i) => {
          const f = (i + 1) / 10;
          const x = S.x + f * (E.x - S.x);
          const y = S.y + f * (E.y - S.y);
          return <line key={i} x1={x} y1={y} x2={x} y2={y + H} stroke="#7dd3fc" strokeOpacity="0.25" />;
        })}
        {RIGHT_BANDS.map((_, i) => (
          <line
            key={i}
            x1={S.x}
            y1={S.y + i * bandH}
            x2={E.x}
            y2={E.y + i * bandH}
            stroke="#7dd3fc"
            strokeOpacity="0.3"
          />
        ))}
      </g>

      {/* ===== 顶面：地表 ===== */}
      <g>
        <polygon points={`${pt(N)} ${pt(E)} ${pt(S)} ${pt(W)}`} fill="#69a655" />
        {FIELDS.map(([u0, v0, u1, v1, c], i) => (
          <polygon key={i} points={quad(u0, v0, u1, v1)} fill={c} />
        ))}
        {/* 河流 */}
        <path d={riverD} fill="none" stroke="#2f7fc0" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" />
        <path d={riverD} fill="none" stroke="#5db5e8" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
        {/* 顶面等距网格 */}
        {Array.from({ length: 7 }, (_, i) => {
          const f = (i + 1) / 8;
          const a = P(f, 0);
          const b = P(f, 1);
          const c = P(0, f);
          const d = P(1, f);
          return (
            <g key={i} stroke="#fff" strokeOpacity="0.14">
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
              <line x1={c.x} y1={c.y} x2={d.x} y2={d.y} />
            </g>
          );
        })}
      </g>

      {/* ===== 立方体描边（亮底上的锐利轮廓） ===== */}
      <g fill="none" stroke="#0f172a" strokeOpacity="0.25" strokeWidth="1.5">
        <polygon points={`${pt(N)} ${pt(E)} ${pt(S)} ${pt(W)}`} />
        <polygon points={`${W.x},${W.y} ${S.x},${S.y} ${S.x},${S.y + H} ${W.x},${W.y + H}`} />
        <polygon points={`${S.x},${S.y} ${E.x},${E.y} ${E.x},${E.y + H} ${S.x},${S.y + H}`} />
      </g>

      {/* ===== 卫星 + 彩虹扫描光束（缓浮动画） ===== */}
      <g className="animate-float">
        {/* 光束（卫星 → 顶面足迹） */}
        <polygon points="438,52 458,52 360,205 250,165" fill="url(#hc-beam)" />
        {/* 扫描足迹 */}
        <ellipse cx="305" cy="182" rx="58" ry="22" fill="#fff" opacity="0.22" />
        <ellipse cx="305" cy="182" rx="34" ry="13" fill="#fff" opacity="0.25" />
        {/* 卫星本体 */}
        <g>
          <rect x="396" y="30" width="16" height="12" rx="2" fill="#1e3a5f" />
          <rect x="412" y="36" width="22" height="3" fill="#475569" />
          <rect x="384" y="36" width="14" height="3" fill="#475569" />
          <rect x="434" y="26" width="26" height="20" rx="3" fill="#334155" />
          <rect x="437" y="29" width="20" height="14" rx="2" fill="#1d4ed8" opacity="0.85" />
          <rect x="460" y="36" width="14" height="3" fill="#475569" />
          <rect x="474" y="26" width="26" height="20" rx="3" fill="#334155" />
          <rect x="477" y="29" width="20" height="14" rx="2" fill="#1d4ed8" opacity="0.85" />
          <circle cx="448" cy="50" r="4" fill="#facc15" />
        </g>
      </g>

      {/* 点缀星标 */}
      <g stroke="#94a3b8" strokeOpacity="0.6" strokeWidth="1.5" strokeLinecap="round">
        <path d="M70 80 v10 M65 85 h10" />
        <path d="M510 230 v8 M506 234 h8" />
        <path d="M120 420 v8 M116 424 h8" />
      </g>

      {/* 波段标注 */}
      <g fontFamily="monospace" fontSize="11" fill="#64748b">
        <text x="62" y={W.y + H + 24}>400nm</text>
        <text x="62" y={W.y + 14} textAnchor="start">
          700nm
        </text>
        <text x={E.x - 8} y={E.y + H + 24} textAnchor="end">
          NIR
        </text>
      </g>
    </svg>
  );
}
