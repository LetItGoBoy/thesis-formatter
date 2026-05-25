"use client";

import { useEffect, useRef } from "react";

type Plane = {
  x: number;
  y: number;
  heading: number;      // 机头朝向（弧度，0 = 指向 +x）
  bank: number;         // 当前滚转角（侧倾），带符号
  wanderBank: number;   // 漫游目标侧倾（随机游走）
  baseSpeed: number;
  speed: number;
  phugoid: number;      // 长周期振荡相位
  phugoidFreq: number;
  size: number;
  light: string;
  dark: string;
  trail: { x: number; y: number }[];
};

// 折纸感配色：[正面亮色, 背面暗色]
const COLORS: [string, string][] = [
  ["#6366f1", "#4338ca"], // 靛蓝
  ["#f43f5e", "#be123c"], // 玫红
  ["#f59e0b", "#b45309"], // 琥珀
  ["#10b981", "#047857"], // 翡翠
  ["#0ea5e9", "#0369a1"], // 天蓝
  ["#8b5cf6", "#6d28d9"], // 紫罗兰
];

// ── 空气动力学参数 ──────────────────────────────────────────────
const TURN_G = 42;       // 协调转弯系数：转弯率 = TURN_G·tan(bank)/speed
const MAX_BANK = 1.05;   // 最大滚转角 ≈ 60°
const ROLL_RATE = 1.6;   // 滚转速率上限（rad/s）——不能瞬间侧倾
const WANDER_RATE = 1.4; // 漫游侧倾随机游走强度
const EDGE_MARGIN = 240; // 距边缘多少像素开始侧倾回中

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const wrap = (a: number) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};

export function PaperPlanes() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let W = window.innerWidth;
    let H = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
    };
    resize();
    window.addEventListener("resize", resize);

    const N = W < 640 ? 3 : 5;
    const planes: Plane[] = Array.from({ length: N }, (_, i) => {
      const [light, dark] = COLORS[i % COLORS.length];
      const baseSpeed = rand(55, 105);
      return {
        x: rand(W * 0.2, W * 0.8),
        y: rand(H * 0.2, H * 0.8),
        heading: rand(-Math.PI, Math.PI),
        bank: 0,
        wanderBank: rand(-0.3, 0.3),
        baseSpeed,
        speed: baseSpeed,
        phugoid: rand(0, Math.PI * 2),
        phugoidFreq: rand(0.45, 0.75),
        size: rand(0.8, 1.3),
        light,
        dark,
        trail: [],
      };
    });

    function drawPlane(p: Plane) {
      // 渐隐尾迹（沿飞行轨迹）
      const t = p.trail;
      ctx.lineCap = "round";
      for (let i = 1; i < t.length; i++) {
        ctx.strokeStyle = p.light;
        ctx.globalAlpha = (i / t.length) * 0.22;
        ctx.lineWidth = (i / t.length) * 2.4 * p.size;
        ctx.beginPath();
        ctx.moveTo(t[i - 1].x, t[i - 1].y);
        ctx.lineTo(t[i].x, t[i].y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      const s = p.size;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.heading);
      ctx.scale(1, Math.cos(p.bank)); // 侧倾时机翼透视收窄
      ctx.rotate(p.bank * 0.2);       // 一点滚转的姿态感

      // 软投影（悬浮于页面之上）
      ctx.shadowColor = "rgba(30,41,59,0.18)";
      ctx.shadowBlur = 8 * s;
      ctx.shadowOffsetY = 5 * s;

      // 远侧机翼（暗色）
      ctx.beginPath();
      ctx.moveTo(15 * s, 0);
      ctx.lineTo(-15 * s, 12 * s);
      ctx.lineTo(-9 * s, 0);
      ctx.closePath();
      ctx.fillStyle = p.dark;
      ctx.fill();

      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      // 近侧机翼（亮色）
      ctx.beginPath();
      ctx.moveTo(15 * s, 0);
      ctx.lineTo(-15 * s, -12 * s);
      ctx.lineTo(-9 * s, 0);
      ctx.closePath();
      ctx.fillStyle = p.light;
      ctx.fill();

      // 中脊高光
      ctx.beginPath();
      ctx.moveTo(15 * s, 0);
      ctx.lineTo(-9 * s, 0);
      ctx.lineTo(-15 * s, -12 * s);
      ctx.closePath();
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fill();

      // 折痕线
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(15 * s, 0);
      ctx.lineTo(-9 * s, 0);
      ctx.stroke();

      ctx.restore();
    }

    function update(p: Plane, dt: number) {
      // 漫游：侧倾角随机游走
      p.wanderBank += rand(-1, 1) * WANDER_RATE * dt;
      p.wanderBank = Math.max(-MAX_BANK, Math.min(MAX_BANK, p.wanderBank));

      // 边缘强度 0..1
      const d = Math.min(p.x, W - p.x, p.y, H - p.y);
      let edge = d < EDGE_MARGIN ? (EDGE_MARGIN - d) / EDGE_MARGIN : 0;
      if (d < 0) edge = 1;

      // 朝向中心的修正侧倾（航向误差 → 侧倾符号）
      const aC = Math.atan2(H / 2 - p.y, W / 2 - p.x);
      const eC = wrap(aC - p.heading);
      const corrective = Math.max(-MAX_BANK, Math.min(MAX_BANK, eC * 1.8));

      const desiredBank = (1 - edge) * p.wanderBank + edge * corrective;

      // 滚转速率受限地趋向目标侧倾
      const db = Math.max(
        -ROLL_RATE * dt,
        Math.min(ROLL_RATE * dt, desiredBank - p.bank)
      );
      p.bank += db;

      // 长周期速度振荡（滑翔机特征）
      p.phugoid += p.phugoidFreq * dt;
      p.speed = p.baseSpeed * (1 + 0.15 * Math.sin(p.phugoid));

      // 协调转弯：航向随侧倾改变
      p.heading += (TURN_G * Math.tan(p.bank) / Math.max(p.speed, 1)) * dt;

      // 位移
      p.x += Math.cos(p.heading) * p.speed * dt;
      p.y += Math.sin(p.heading) * p.speed * dt;

      // 记录尾迹
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 26) p.trail.shift();
    }

    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.05) dt = 0.05; // 标签页切回时夹住大间隔

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      for (const p of planes) {
        update(p, dt);
        drawPlane(p);
      }
      raf = requestAnimationFrame(frame);
    };

    if (reduce) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      for (const p of planes) drawPlane(p);
    } else {
      raf = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0"
    />
  );
}
