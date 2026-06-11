"use client";

/**
 * 高光谱交互 Demo（首页核心亮点）
 * components/SpectralDemo.tsx
 *
 * 左：一张伪彩高光谱影像（合成场景：植被 / 水体 / 土壤 / 建筑）。
 * 右：鼠标所在像素的「光谱指纹」曲线（400–1000nm，31 个波段）+ 实时 NDVI。
 *
 * 全部前端合成，无需后端 / 真实数据，刷新即用；移动端点按取样。
 */
import { useEffect, useMemo, useRef, useState } from "react";

// ---- 场景尺寸（逻辑像素，绘制时放大） ----
const COLS = 52;
const ROWS = 32;
const BANDS = 31; // 400..1000nm，步长 20nm
const WL = Array.from({ length: BANDS }, (_, i) => 400 + i * 20);

// ---- 四类地物的光谱反射率曲线（0..1，示意而非实测） ----
const SIGNATURES: Record<
  number,
  { name: string; color: [number, number, number]; refl: number[] }
> = {
  0: {
    name: "植被 Vegetation",
    color: [76, 175, 80],
    // 蓝低 → 绿凸 → 红吸收 → 红边陡升 → 近红外高原
    refl: [
      0.04, 0.04, 0.05, 0.06, 0.08, 0.11, 0.12, 0.1, 0.08, 0.06, 0.05, 0.05,
      0.06, 0.09, 0.18, 0.32, 0.43, 0.46, 0.47, 0.47, 0.46, 0.46, 0.45, 0.45,
      0.44, 0.44, 0.43, 0.43, 0.42, 0.42, 0.41,
    ],
  },
  1: {
    name: "水体 Water",
    color: [33, 118, 220],
    // 蓝端略高，向近红外单调衰减至近零
    refl: [
      0.07, 0.075, 0.08, 0.075, 0.07, 0.06, 0.05, 0.045, 0.04, 0.035, 0.03,
      0.025, 0.022, 0.02, 0.018, 0.015, 0.012, 0.01, 0.009, 0.008, 0.007, 0.006,
      0.006, 0.005, 0.005, 0.004, 0.004, 0.004, 0.003, 0.003, 0.003,
    ],
  },
  2: {
    name: "土壤 Soil",
    color: [170, 110, 60],
    // 平滑单调上升
    refl: [
      0.1, 0.11, 0.12, 0.13, 0.14, 0.16, 0.17, 0.18, 0.19, 0.2, 0.21, 0.22,
      0.23, 0.24, 0.26, 0.27, 0.28, 0.29, 0.3, 0.31, 0.32, 0.33, 0.34, 0.34,
      0.35, 0.35, 0.36, 0.36, 0.37, 0.37, 0.38,
    ],
  },
  3: {
    name: "建筑 Urban",
    color: [150, 150, 158],
    // 相对平坦、缓慢抬升
    refl: [
      0.2, 0.205, 0.21, 0.215, 0.22, 0.225, 0.23, 0.235, 0.24, 0.245, 0.25,
      0.255, 0.26, 0.262, 0.265, 0.268, 0.27, 0.272, 0.275, 0.278, 0.28, 0.282,
      0.285, 0.288, 0.29, 0.292, 0.295, 0.298, 0.3, 0.302, 0.305,
    ],
  },
};

// 红 / 近红外 波段索引（用于 NDVI）：680nm≈i14，800nm≈i20
const RED_BAND = 14;
const NIR_BAND = 20;

function hash(x: number, y: number) {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

/** 像素 → 地物类别（合成一条蜿蜒河流 + 建筑簇 + 土壤斑块，其余为植被） */
function materialAt(x: number, y: number): number {
  const river = ROWS * 0.46 + Math.sin(x * 0.22) * 4.5 + Math.sin(x * 0.07) * 3;
  if (Math.abs(y - river) < 2.3) return 1; // 水体
  if (x < COLS * 0.32 && y > ROWS * 0.6 && hash(Math.floor(x / 3), Math.floor(y / 3)) > 0.42)
    return 3; // 建筑
  if (hash(Math.floor(x / 4) + 7, Math.floor(y / 4)) > 0.8) return 2; // 土壤
  return 0; // 植被
}

export function SpectralDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [px, setPx] = useState({ x: Math.floor(COLS / 2), y: Math.floor(ROWS * 0.3) });

  // 预计算地物图
  const matMap = useMemo(() => {
    const m: number[] = new Array(COLS * ROWS);
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++) m[y * COLS + x] = materialAt(x, y);
    return m;
  }, []);

  // 绘制伪彩场景
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const cw = cv.width;
    const ch = cv.height;
    const cellW = cw / COLS;
    const cellH = ch / ROWS;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const mat = matMap[y * COLS + x];
        const [r, g, b] = SIGNATURES[mat].color;
        // 轻微逐像素抖动，避免色块死板
        const j = (hash(x, y) - 0.5) * 28;
        ctx.fillStyle = `rgb(${r + j}, ${g + j}, ${b + j})`;
        ctx.fillRect(Math.floor(x * cellW), Math.floor(y * cellH), Math.ceil(cellW), Math.ceil(cellH));
      }
    }
    // 取样高亮框
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.lineWidth = 2;
    ctx.strokeRect(px.x * cellW, px.y * cellH, cellW, cellH);
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = 1;
    ctx.strokeRect(px.x * cellW - 1, px.y * cellH - 1, cellW + 2, cellH + 2);
  }, [matMap, px]);

  function pick(clientX: number, clientY: number) {
    const cv = canvasRef.current;
    if (!cv) return;
    const rect = cv.getBoundingClientRect();
    const x = Math.floor(((clientX - rect.left) / rect.width) * COLS);
    const y = Math.floor(((clientY - rect.top) / rect.height) * ROWS);
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return;
    setPx({ x, y });
  }

  const mat = matMap[px.y * COLS + px.x];
  const sig = SIGNATURES[mat];
  // 逐像素整体缩放抖动，让同类不同像素的曲线略有差异
  const scale = 1 + (hash(px.x * 3.1, px.y * 1.7) - 0.5) * 0.18;
  const curve = sig.refl.map((v) => Math.max(0, Math.min(0.55, v * scale)));
  const ndvi =
    (curve[NIR_BAND] - curve[RED_BAND]) / (curve[NIR_BAND] + curve[RED_BAND] + 1e-6);

  // SVG 曲线坐标
  const W = 380;
  const H = 170;
  const PAD = { l: 34, r: 10, t: 12, b: 26 };
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const xOf = (i: number) => PAD.l + (i / (BANDS - 1)) * plotW;
  const yOf = (v: number) => PAD.t + (1 - v / 0.55) * plotH;
  const path = curve.map((v, i) => `${i === 0 ? "M" : "L"}${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(" ");

  return (
    <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
      {/* 左：伪彩高光谱影像 */}
      <div>
        <div className="mb-2 flex items-center justify-between text-[11px] font-mono tracking-wider text-slate-500">
          <span>FALSE-COLOR SCENE · {COLS}×{ROWS}</span>
          <span>
            ({px.x}, {px.y})
          </span>
        </div>
        <canvas
          ref={canvasRef}
          width={520}
          height={320}
          onMouseMove={(e) => pick(e.clientX, e.clientY)}
          onClick={(e) => pick(e.clientX, e.clientY)}
          onTouchMove={(e) => {
            const t = e.touches[0];
            if (t) pick(t.clientX, t.clientY);
          }}
          className="w-full cursor-crosshair rounded-xl ring-1 ring-slate-200 [image-rendering:pixelated]"
        />
        <p className="mt-2 text-xs text-slate-500">
          在影像上移动鼠标（手机长按拖动）取样任意像素的光谱指纹。
        </p>
      </div>

      {/* 右：光谱曲线 + 读数 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-sm"
              style={{ background: `rgb(${sig.color.join(",")})` }}
            />
            <span className="text-sm font-semibold text-slate-900">{sig.name}</span>
          </div>
          <span className="font-mono text-[11px] tracking-wider text-slate-500">REFLECTANCE</span>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full">
          {/* 网格与坐标 */}
          {[0, 0.25, 0.5].map((g) => (
            <g key={g}>
              <line
                x1={PAD.l}
                x2={W - PAD.r}
                y1={yOf(g)}
                y2={yOf(g)}
                stroke="rgba(15,23,42,0.08)"
              />
              <text x={4} y={yOf(g) + 3} fill="#64748b" fontSize="9" fontFamily="monospace">
                {g.toFixed(2)}
              </text>
            </g>
          ))}
          {[400, 700, 1000].map((w) => {
            const i = (w - 400) / 20;
            return (
              <text
                key={w}
                x={xOf(i)}
                y={H - 8}
                fill="#64748b"
                fontSize="9"
                fontFamily="monospace"
                textAnchor="middle"
              >
                {w}
              </text>
            );
          })}
          {/* 红 / 近红外 标注 */}
          <line x1={xOf(RED_BAND)} x2={xOf(RED_BAND)} y1={PAD.t} y2={H - PAD.b} stroke="rgba(239,68,68,0.25)" />
          <line x1={xOf(NIR_BAND)} x2={xOf(NIR_BAND)} y1={PAD.t} y2={H - PAD.b} stroke="rgba(132,204,22,0.25)" />
          {/* 曲线 */}
          <defs>
            <linearGradient id="spec-line" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#7c3aed" />
              <stop offset="35%" stopColor="#06b6d4" />
              <stop offset="60%" stopColor="#22c55e" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
          </defs>
          <path d={path} fill="none" stroke="url(#spec-line)" strokeWidth="2.4" strokeLinejoin="round" />
        </svg>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Readout label="NDVI" value={ndvi.toFixed(2)} hint="植被指数" />
          <Readout label="R680" value={curve[RED_BAND].toFixed(2)} hint="红波段" />
          <Readout label="R800" value={curve[NIR_BAND].toFixed(2)} hint="近红外" />
        </div>
        <p className="mt-3 text-[11px] leading-5 text-slate-500">
          NDVI =（近红外−红）/（近红外+红）。植被红边的陡升，是高光谱区分地物的关键特征。
        </p>
      </div>
    </div>
  );
}

function Readout({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-2 py-2">
      <div className="font-mono text-[10px] tracking-wider text-slate-500">{label}</div>
      <div className="mt-0.5 text-lg font-semibold text-slate-900">{value}</div>
      <div className="text-[10px] text-slate-500">{hint}</div>
    </div>
  );
}
