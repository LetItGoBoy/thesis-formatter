"use client";

/**
 * Hero 动态主视觉 · 旋转点阵球 + 轨道环（纯 Canvas 2D，无依赖）
 * components/HeroOrbit.tsx
 *
 * 斐波那契球面点阵缓慢自转 + 三道倾斜铜色轨道环 + 鼠标视差，
 * 暖墨色调，契合 World Labs 的奶油/墨/铜美学。酷炫但克制。
 */
import { useEffect, useRef } from "react";

interface V3 {
  x: number;
  y: number;
  z: number;
}

function rotateY(p: V3, a: number): V3 {
  const c = Math.cos(a),
    s = Math.sin(a);
  return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c };
}
function rotateX(p: V3, a: number): V3 {
  const c = Math.cos(a),
    s = Math.sin(a);
  return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c };
}

export function HeroOrbit({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 斐波那契球面点阵
    const N = 320;
    const pts: V3[] = [];
    const gold = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = gold * i;
      pts.push({ x: Math.cos(th) * r, y, z: Math.sin(th) * r });
    }
    // 几个强调大点
    const accents = new Set<number>();
    for (let i = 0; i < 7; i++) accents.add(Math.floor((i * N) / 7));

    // 三道轨道环（各自倾斜）
    const rings = [
      { tilt: 0.0, yaw: 0.0, scale: 1.28 },
      { tilt: 1.15, yaw: 0.5, scale: 1.18 },
      { tilt: -0.9, yaw: -0.6, scale: 1.4 },
    ];
    const ringPts = rings.map((rg) => {
      const arr: V3[] = [];
      const segs = 120;
      for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        let p: V3 = { x: Math.cos(a) * rg.scale, y: 0, z: Math.sin(a) * rg.scale };
        p = rotateX(p, rg.tilt);
        p = rotateY(p, rg.yaw);
        arr.push(p);
      }
      return arr;
    });

    let raf = 0;
    let t = 0;
    let dpr = 1;
    let cw = 0;
    let ch = 0;

    function resize() {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cw = rect.width;
      ch = rect.height;
      canvas.width = cw * dpr;
      canvas.height = ch * dpr;
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    function project(p: V3, R: number, cx: number, cy: number) {
      // 轻微透视
      const persp = 2.6 / (2.6 - p.z * 0.55);
      return { sx: cx + p.x * R * persp, sy: cy + p.y * R * persp, depth: p.z, persp };
    }

    function frame() {
      if (!ctx || !canvas) return;
      t += 0.0042;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);

      const cx = cw / 2;
      const cy = ch / 2;
      const R = Math.min(cw, ch) * 0.33;

      // 鼠标视差倾斜
      const yaw = t + mouse.current.x * 0.5;
      const pitch = 0.42 + mouse.current.y * 0.35;

      const tf = (p: V3) => rotateX(rotateY(p, yaw), pitch);

      // 轨道环（铜色）
      ringPts.forEach((arr) => {
        ctx.beginPath();
        arr.forEach((p0, i) => {
          const p = tf(p0);
          const { sx, sy } = project(p, R, cx, cy);
          if (i === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        });
        ctx.strokeStyle = "rgba(176, 108, 56, 0.5)";
        ctx.lineWidth = 1.2;
        ctx.stroke();
      });

      // 球面点阵（按深度排序，远的先画）
      const drawn = pts
        .map((p0, i) => ({ p: tf(p0), i }))
        .sort((a, b) => a.p.z - b.p.z);

      for (const { p, i } of drawn) {
        const { sx, sy, depth, persp } = project(p, R, cx, cy);
        const fade = (depth + 1) / 2; // 0 远 1 近
        const isAccent = accents.has(i);
        const baseR = (isAccent ? 2.6 : 1.5) * persp;
        ctx.beginPath();
        ctx.arc(sx, sy, baseR * (0.5 + fade * 0.7), 0, Math.PI * 2);
        if (isAccent) {
          ctx.fillStyle = `rgba(176, 108, 56, ${0.35 + fade * 0.55})`;
        } else {
          ctx.fillStyle = `rgba(41, 37, 30, ${0.12 + fade * 0.5})`;
        }
        ctx.fill();
      }

      // 近邻连线（仅近半球，淡墨）
      ctx.strokeStyle = "rgba(41, 37, 30, 0.06)";
      ctx.lineWidth = 0.6;
      for (let a = 0; a < drawn.length; a += 3) {
        const pa = drawn[a];
        if (pa.p.z < 0) continue;
        for (let b = a + 1; b < Math.min(a + 8, drawn.length); b++) {
          const pb = drawn[b];
          if (pb.p.z < 0) continue;
          const dx = pa.p.x - pb.p.x;
          const dy = pa.p.y - pb.p.y;
          const dz = pa.p.z - pb.p.z;
          if (dx * dx + dy * dy + dz * dz < 0.16) {
            const A = project(pa.p, R, cx, cy);
            const B = project(pb.p, R, cx, cy);
            ctx.beginPath();
            ctx.moveTo(A.sx, A.sy);
            ctx.lineTo(B.sx, B.sy);
            ctx.stroke();
          }
        }
      }

      raf = requestAnimationFrame(frame);
    }
    frame();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  function onMove(e: React.MouseEvent) {
    const rect = e.currentTarget.getBoundingClientRect();
    mouse.current = {
      x: (e.clientX - rect.left) / rect.width - 0.5,
      y: (e.clientY - rect.top) / rect.height - 0.5,
    };
  }
  function onLeave() {
    mouse.current = { x: 0, y: 0 };
  }

  return (
    <canvas
      ref={canvasRef}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={className}
      aria-hidden
    />
  );
}
