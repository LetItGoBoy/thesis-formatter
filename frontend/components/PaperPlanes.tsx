"use client";

import { useEffect, useRef } from "react";

// ── 3D 向量工具 ─────────────────────────────────────────────────
type V3 = { x: number; y: number; z: number };
const v = (x: number, y: number, z: number): V3 => ({ x, y, z });
const add = (a: V3, b: V3): V3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const mul = (a: V3, s: number): V3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const dot = (a: V3, b: V3) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: V3, b: V3): V3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const len = (a: V3) => Math.hypot(a.x, a.y, a.z);
const norm = (a: V3): V3 => {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};
// 罗德里格旋转：把向量 a 绕单位轴 k 旋转 ang 弧度
const rotAxis = (a: V3, k: V3, ang: number): V3 => {
  const c = Math.cos(ang), s = Math.sin(ang);
  const kxa = cross(k, a);
  const kd = dot(k, a) * (1 - c);
  return {
    x: a.x * c + kxa.x * s + k.x * kd,
    y: a.y * c + kxa.y * s + k.y * kd,
    z: a.z * c + kxa.z * s + k.z * kd,
  };
};

// ── 纸飞机 3D 网格（局部坐标：+x 机头 / +y 机背朝上 / +z 右翼）──
const MESH = {
  N: v(1.7, 0.0, 0.0),     // 机头
  T: v(-1.1, 0.3, 0.0),    // 机尾上脊（折起的高点）
  L: v(-1.5, -0.08, -1.1), // 左翼尖
  R: v(-1.5, -0.08, 1.1),  // 右翼尖
};

// 折纸配色：[正面亮, 背面/腹部暗]
const COLORS: [string, string][] = [
  ["#6366f1", "#3730a3"],
  ["#f43f5e", "#9f1239"],
  ["#f59e0b", "#92400e"],
  ["#10b981", "#065f46"],
  ["#0ea5e9", "#075985"],
  ["#8b5cf6", "#5b21b6"],
];

// ── 调参 ────────────────────────────────────────────────────────
const FOCAL = 720;        // 焦距（越大透视越平）
const PLANE_SCALE = 26;   // 飞机世界尺寸
const TURN_RATE = 0.95;   // 最大转向角速度（rad/s）
const MAX_BANK = 1.0;     // 最大滚转
const ROLL_RATE = 1.9;    // 滚转速率上限
const WANDER = 0.85;      // 漫游方向扰动
const RETURN_GAIN = 2.6;  // 出界回拉强度
const BANK_GAIN = 1.1;    // 转向→视觉滚转

// 漫游体积（世界坐标，z 为景深）
const X_SOFT = 820, X_RANGE = 420;
const Y_SOFT = 430, Y_RANGE = 280;
const Z_NEAR = 360, Z_FAR = 2200, Z_PAD = 320;
const Z_CLAMP = 150;      // 投影时的最近夹值，防止爆炸

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

type Plane = {
  pos: V3;
  fwd: V3;          // 机头方向（单位向量）
  bank: number;
  speed: number;
  baseSpeed: number;
  phugoid: number;
  phugoidFreq: number;
  wander: V3;       // 漫游目标方向
  light: string;
  dark: string;
  trail: V3[];
};

export function PaperPlanes() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let W = window.innerWidth, H = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let cx = W / 2, cy = H * 0.46;

    const resize = () => {
      W = window.innerWidth; H = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cx = W / 2; cy = H * 0.46;
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
    };
    resize();
    window.addEventListener("resize", resize);

    const N = W < 640 ? 3 : 6;
    const planes: Plane[] = Array.from({ length: N }, (_, i) => {
      const [light, dark] = COLORS[i % COLORS.length];
      const baseSpeed = rand(230, 360);
      const dir = norm(v(rand(-1, 1), rand(-0.3, 0.3), rand(-1, 1)));
      return {
        pos: v(rand(-X_SOFT, X_SOFT), rand(-Y_SOFT, Y_SOFT), rand(Z_NEAR, Z_FAR)),
        fwd: dir,
        bank: 0,
        speed: baseSpeed,
        baseSpeed,
        phugoid: rand(0, Math.PI * 2),
        phugoidFreq: rand(0.4, 0.7),
        wander: dir,
        light,
        dark,
        trail: [],
      };
    });

    // 世界点 → 屏幕，返回投影坐标与缩放比；behind=true 表示在相机后方
    const project = (p: V3) => {
      const z = Math.max(p.z, Z_CLAMP);
      const scale = FOCAL / z;
      return { sx: cx + p.x * scale, sy: cy + p.y * scale, scale, behind: p.z <= Z_CLAMP };
    };

    function update(p: Plane, dt: number) {
      // 1) 漫游方向随机游走（限制俯仰，避免直上直下）
      p.wander = norm({
        x: p.wander.x + rand(-1, 1) * WANDER * dt,
        y: clamp(p.wander.y + rand(-1, 1) * WANDER * 0.5 * dt, -0.45, 0.45),
        z: p.wander.z + rand(-1, 1) * WANDER * dt,
      });

      // 2) 出界回拉（六个面，越界越强）
      const ret = v(0, 0, 0);
      if (p.pos.x > X_SOFT) ret.x -= clamp((p.pos.x - X_SOFT) / X_RANGE, 0, 1);
      if (p.pos.x < -X_SOFT) ret.x += clamp((-X_SOFT - p.pos.x) / X_RANGE, 0, 1);
      if (p.pos.y > Y_SOFT) ret.y -= clamp((p.pos.y - Y_SOFT) / Y_RANGE, 0, 1);
      if (p.pos.y < -Y_SOFT) ret.y += clamp((-Y_SOFT - p.pos.y) / Y_RANGE, 0, 1);
      if (p.pos.z < Z_NEAR) ret.z += clamp((Z_NEAR - p.pos.z) / Z_PAD, 0, 1); // 太近 → 远离
      if (p.pos.z > Z_FAR) ret.z -= clamp((p.pos.z - Z_FAR) / Z_PAD, 0, 1);   // 太远 → 靠近

      // 3) 目标方向 = 漫游 + 回拉
      let desired = add(p.wander, mul(ret, RETURN_GAIN));
      if (len(desired) < 1e-4) desired = p.fwd;
      desired = norm(desired);

      // 4) 受限转向（趋向目标方向）
      const d = clamp(dot(p.fwd, desired), -1, 1);
      const theta = Math.acos(d);
      let bankTarget = 0;
      if (theta > 1e-3) {
        const axis = norm(cross(p.fwd, desired));
        const turn = Math.min(theta, TURN_RATE * dt);
        p.fwd = norm(rotAxis(p.fwd, axis, turn));
        // 水平转向分量（绕世界上方向 (0,-1,0)）决定视觉滚转方向
        bankTarget = clamp(BANK_GAIN * dot(axis, v(0, -1, 0)) * (turn / dt) / TURN_RATE,
          -MAX_BANK, MAX_BANK);
      }

      // 5) 滚转速率受限
      p.bank += clamp(bankTarget - p.bank, -ROLL_RATE * dt, ROLL_RATE * dt);

      // 6) phugoid 速度振荡 + 轻微重力耦合（下滑加速、爬升减速）
      p.phugoid += p.phugoidFreq * dt;
      p.speed = p.baseSpeed * (1 + 0.14 * Math.sin(p.phugoid)) * (1 + 0.05 * p.fwd.y);

      // 7) 位移
      p.pos = add(p.pos, mul(p.fwd, p.speed * dt));

      // 8) 尾迹
      p.trail.push({ ...p.pos });
      if (p.trail.length > 22) p.trail.shift();
    }

    function drawPlane(p: Plane) {
      // 正交基：机头 fwd，参考上方 (0,-1,0)
      const f = p.fwd;
      let refUp = v(0, -1, 0);
      if (Math.abs(dot(f, refUp)) > 0.95) refUp = v(0, 0, 1);
      const r0 = norm(cross(f, refUp));
      const u0 = norm(cross(r0, f));
      const cb = Math.cos(p.bank), sb = Math.sin(p.bank);
      const right = add(mul(r0, cb), mul(u0, sb));
      const up = sub(mul(u0, cb), mul(r0, sb));

      // 局部 → 世界 → 屏幕
      const toWorld = (lp: V3) =>
        add(p.pos, add(add(mul(f, lp.x * PLANE_SCALE), mul(up, lp.y * PLANE_SCALE)),
          mul(right, lp.z * PLANE_SCALE)));
      const P = (lp: V3) => project(toWorld(lp));

      const N = P(MESH.N), T = P(MESH.T), L = P(MESH.L), R = P(MESH.R);
      if (N.behind || T.behind || L.behind || R.behind) return;

      // 景深透明度（远处淡出）
      const alpha = clamp(1 - (p.pos.z - 500) / (Z_FAR - 200), 0.28, 1);

      // 三个面：左翼/右翼(亮) + 腹部(暗)，按平均深度排序后绘制
      const wz = (a: V3) => toWorld(a).z;
      const faces = [
        { pts: [N, T, L], color: p.light, z: (wz(MESH.N) + wz(MESH.T) + wz(MESH.L)) / 3, top: true },
        { pts: [N, T, R], color: p.light, z: (wz(MESH.N) + wz(MESH.T) + wz(MESH.R)) / 3, top: true },
        { pts: [N, L, R], color: p.dark, z: (wz(MESH.N) + wz(MESH.L) + wz(MESH.R)) / 3, top: false },
      ].sort((a, b) => b.z - a.z);

      ctx.globalAlpha = alpha;
      for (const fc of faces) {
        ctx.beginPath();
        ctx.moveTo(fc.pts[0].sx, fc.pts[0].sy);
        ctx.lineTo(fc.pts[1].sx, fc.pts[1].sy);
        ctx.lineTo(fc.pts[2].sx, fc.pts[2].sy);
        ctx.closePath();
        ctx.fillStyle = fc.color;
        ctx.fill();
        if (fc.top) {
          ctx.strokeStyle = "rgba(255,255,255,0.35)";
          ctx.lineWidth = Math.max(0.5, N.scale * 0.8);
          ctx.stroke();
        }
      }
      // 中脊折痕高光
      ctx.globalAlpha = alpha * 0.7;
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = Math.max(0.5, N.scale);
      ctx.beginPath();
      ctx.moveTo(N.sx, N.sy);
      ctx.lineTo(T.sx, T.sy);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    function drawTrail(p: Plane) {
      const t = p.trail;
      ctx.lineCap = "round";
      for (let i = 1; i < t.length; i++) {
        const a = project(t[i - 1]), b = project(t[i]);
        if (a.behind || b.behind) continue;
        ctx.strokeStyle = p.light;
        ctx.globalAlpha = (i / t.length) * 0.18 * clamp(b.scale * 1.5, 0.3, 1);
        ctx.lineWidth = (i / t.length) * 3 * b.scale;
        ctx.beginPath();
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(b.sx, b.sy);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    function render() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      // 远 → 近 排序，画家算法
      const order = [...planes].sort((a, b) => b.pos.z - a.pos.z);
      for (const p of order) {
        drawTrail(p);
        drawPlane(p);
      }
    }

    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.05) dt = 0.05;
      for (const p of planes) update(p, dt);
      render();
      raf = requestAnimationFrame(frame);
    };

    if (reduce) {
      render();
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
