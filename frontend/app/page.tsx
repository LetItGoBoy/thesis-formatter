"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  DragEvent,
  ChangeEvent,
} from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Logo } from "@/components/Logo";
import { useThesisStore, MODEL_TIERS } from "@/lib/store";
import { parseDocx } from "@/lib/api";
import { useAuthStore, maskPhone } from "@/lib/auth-store";

const COLLEGES = [
  { value: "hulunbeier_univ", label: "呼伦贝尔学院 · 工学院", available: true },
];
const COMING_SOON = ["文学院", "经济管理学院", "教育科学学院", "美术学院"];

// ─── Floating particle canvas ─────────────────────────────────────────────────
const PARTICLE_WORDS = [
  "格式规范","参考文献","摘  要","绪  论","三线表","行间距","字  号",
  "首行缩进","宋  体","黑  体","仿  宋","目  录","总  结","致  谢",
  "引  用","对  齐","规  范","关键词","Times New Roman","标  注",
];

type Pt = { x: number; y: number; vx: number; vy: number; w: string; a: number; sz: number };

function ParticleCanvas({
  mpRef,
}: {
  mpRef: React.MutableRefObject<{ x: number; y: number }>;
}) {
  const canRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const can = canRef.current;
    if (!can) return;
    const ctx = can.getContext("2d")!;
    let W = window.innerWidth, H = window.innerHeight;

    const resize = () => {
      W = window.innerWidth; H = window.innerHeight;
      can.width = W; can.height = H;
    };
    resize();
    window.addEventListener("resize", resize);

    const ps: Pt[] = Array.from({ length: 26 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.28, vy: (Math.random() - 0.5) * 0.28,
      w: PARTICLE_WORDS[Math.floor(Math.random() * PARTICLE_WORDS.length)],
      a: 0.06 + Math.random() * 0.09,
      sz: 11 + Math.floor(Math.random() * 9),
    }));

    let raf: number;
    const tick = () => {
      ctx.clearRect(0, 0, W, H);
      const { x: mx, y: my } = mpRef.current;
      for (const p of ps) {
        const dx = p.x - mx, dy = p.y - my;
        const d2 = dx * dx + dy * dy;
        if (d2 < 200 * 200) {
          const d = Math.sqrt(d2);
          const f = ((200 - d) / 200) * 0.5;
          p.vx += (dx / d) * f; p.vy += (dy / d) * f;
        }
        p.vx *= 0.97; p.vy *= 0.97;
        p.x += p.vx; p.y += p.vy;
        if (p.x < -90) p.x = W + 90;
        else if (p.x > W + 90) p.x = -90;
        if (p.y < -30) p.y = H + 30;
        else if (p.y > H + 30) p.y = -30;
        ctx.save();
        ctx.globalAlpha = p.a;
        ctx.font = `${p.sz}px "PingFang SC","Microsoft YaHei",sans-serif`;
        ctx.fillStyle = "#6366f1";
        ctx.fillText(p.w, p.x, p.y);
        ctx.restore();
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [mpRef]);

  return <canvas ref={canRef} className="pointer-events-none fixed inset-0 z-0" />;
}

// ─── Paper Mascot ─────────────────────────────────────────────────────────────
const BUBBLES = [
  "上传你的论文～",
  "格式交给我！",
  "点我玩 (≧▽≦)",
  "宋体黑体我全会",
  "一键规范，轻松毕业！",
];

function PaperMascot({
  mpRef,
  onPuff,
}: {
  mpRef: React.MutableRefObject<{ x: number; y: number }>;
  onPuff: () => void;
}) {
  const [xy, setXY] = useState({ x: 0, y: 0 });
  const [pupil, setPupil] = useState({ x: 0, y: 0 });
  const [puffed, setPuffed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [bubbleIdx, setBubbleIdx] = useState(0);
  const [showBubble, setShowBubble] = useState(false);
  const curRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const t1 = setTimeout(() => setShowBubble(true), 900);
    const t2 = setTimeout(() => setShowBubble(false), 3800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  useEffect(() => {
    const W = window.innerWidth;
    const ix = W > 900 ? W * 0.72 : W * 0.5 - 60;
    const iy = W > 900 ? 160 : 70;
    curRef.current = { x: ix, y: iy };
    setXY({ x: ix, y: iy });

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const loop = () => {
      const W2 = window.innerWidth;
      const { x: mx, y: my } = mpRef.current;
      const hasMouse = mx > 0 && my > 0;
      const isDesktop = W2 > 900;
      const tx = hasMouse
        ? (isDesktop ? mx * 0.1 + W2 * 0.62 : W2 * 0.5 - 60)
        : (isDesktop ? W2 * 0.72 : W2 * 0.5 - 60);
      const ty = hasMouse && isDesktop ? my * 0.07 + 110 : (isDesktop ? 160 : 70);

      curRef.current.x = lerp(curRef.current.x, tx, 0.045);
      curRef.current.y = lerp(curRef.current.y, ty, 0.045);
      setXY({ ...curRef.current });

      const cx = curRef.current.x + 60, cy = curRef.current.y + 75;
      const dx = (hasMouse ? mx : cx + 20) - cx;
      const dy = (hasMouse ? my : cy - 20) - cy;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const ratio = Math.min(d / 130, 1);
      setPupil({ x: (dx / d) * ratio * 3, y: (dy / d) * ratio * 3 });

      rafRef.current = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(rafRef.current);
  }, [mpRef]);

  function handleClick() {
    setPuffed(true);
    setTimeout(() => setPuffed(false), 700);
    setBubbleIdx((i) => (i + 1) % BUBBLES.length);
    setShowBubble(true);
    setTimeout(() => setShowBubble(false), 2500);
    onPuff();
  }

  const sm = hovered || puffed;
  const sc = puffed ? 1.38 : hovered ? 1.1 : 1;

  return (
    <div className="pointer-events-none fixed inset-0 z-30 hidden lg:block">
      <div
        className="pointer-events-auto absolute"
        style={{ transform: `translate(${xy.x}px, ${xy.y}px)` }}
        onMouseEnter={() => { setHovered(true); setShowBubble(true); }}
        onMouseLeave={() => { setHovered(false); setShowBubble(false); }}
        onClick={handleClick}
      >
        {/* Speech bubble */}
        {showBubble && (
          <div
            className="absolute rounded-2xl bg-white/95 px-3 py-2 text-sm font-medium text-indigo-700 shadow-lg ring-1 ring-indigo-100 backdrop-blur"
            style={{
              bottom: "calc(100% + 14px)",
              left: "50%",
              transform: "translateX(-50%)",
              whiteSpace: "nowrap",
              animation: "fadeIn 0.25s ease",
            }}
          >
            {BUBBLES[bubbleIdx]}
            <div className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 rounded-sm bg-white/95 shadow-sm" />
          </div>
        )}

        {/* Bobbing wrapper */}
        <div style={{ animation: "mascotBob 3s ease-in-out infinite", cursor: "pointer" }}>
          {/* Scale + glow wrapper */}
          <div
            style={{
              transform: `scale(${sc})`,
              transformOrigin: "center bottom",
              transition: puffed
                ? "transform 0.18s cubic-bezier(0.34,2.4,0.64,1)"
                : "transform 0.4s cubic-bezier(0.34,1.6,0.64,1)",
              filter: `drop-shadow(0 ${sm ? 16 : 8}px ${sm ? 40 : 22}px rgba(99,102,241,${sm ? 0.5 : 0.25}))`,
            }}
          >
            <svg width="120" height="155" viewBox="0 0 120 155" fill="none">
              {/* Ground shadow */}
              <ellipse
                cx="60" cy="152"
                rx={puffed ? 50 : 30} ry="5"
                fill="rgba(99,102,241,0.12)"
                style={{ transition: "all 0.3s" }}
              />
              {/* Puff halo */}
              {puffed && (
                <rect x="0" y="0" width="120" height="148" rx="18" fill="rgba(165,180,252,0.1)" />
              )}
              {/* Paper body */}
              <rect
                x="8" y="8" width="104" height="136" rx="14"
                fill="white" stroke={sm ? "#a5b4fc" : "#c7d2fe"} strokeWidth="2"
              />
              {/* Dog-ear */}
              <path d="M 88 8 L 112 32 L 88 32 Z" fill="#e0e7ff" />
              <path d="M 88 8 L 88 32 L 112 32" stroke="#c7d2fe" strokeWidth="1.5" fill="none" />
              {/* Blush */}
              <ellipse cx="24" cy="73" rx="12" ry={sm ? 10 : 7} fill="rgba(251,113,133,0.2)" style={{ transition: "ry 0.3s" }} />
              <ellipse cx="96" cy="73" rx="12" ry={sm ? 10 : 7} fill="rgba(251,113,133,0.2)" style={{ transition: "ry 0.3s" }} />
              {/* Eye whites */}
              <circle cx="40" cy="57" r="14" fill="#f0f4ff" />
              <circle cx="80" cy="57" r="14" fill="#f0f4ff" />
              {/* Iris */}
              <circle cx="40" cy="57" r="9" fill="#6366f1" />
              <circle cx="80" cy="57" r="9" fill="#6366f1" />
              {/* Pupils (follow mouse) */}
              <circle cx={40 + pupil.x} cy={57 + pupil.y} r="5" fill="#1e1b4b" />
              <circle cx={80 + pupil.x} cy={57 + pupil.y} r="5" fill="#1e1b4b" />
              {/* Eye shine */}
              <circle cx="43" cy="51" r="3" fill="white" />
              <circle cx="83" cy="51" r="3" fill="white" />
              {/* Eyebrows – normal */}
              <path d="M 31 42 Q 40 38 49 42" stroke="#818cf8" strokeWidth="2" fill="none" strokeLinecap="round"
                style={{ opacity: puffed ? 0 : 1, transition: "opacity 0.15s" }} />
              <path d="M 71 42 Q 80 38 89 42" stroke="#818cf8" strokeWidth="2" fill="none" strokeLinecap="round"
                style={{ opacity: puffed ? 0 : 1, transition: "opacity 0.15s" }} />
              {/* Eyebrows – raised */}
              <path d="M 29 38 Q 40 33 51 38" stroke="#6366f1" strokeWidth="2.5" fill="none" strokeLinecap="round"
                style={{ opacity: puffed ? 1 : 0, transition: "opacity 0.15s" }} />
              <path d="M 69 38 Q 80 33 91 38" stroke="#6366f1" strokeWidth="2.5" fill="none" strokeLinecap="round"
                style={{ opacity: puffed ? 1 : 0, transition: "opacity 0.15s" }} />
              {/* Mouth – neutral */}
              <path d="M 42 78 Q 60 84 78 78" stroke="#818cf8" strokeWidth="2.5" fill="none" strokeLinecap="round"
                style={{ opacity: sm ? 0 : 1, transition: "opacity 0.2s" }} />
              {/* Mouth – smile */}
              <path d="M 38 78 Q 60 97 82 78" stroke="#6366f1" strokeWidth="3"
                fill="rgba(238,242,255,0.5)" strokeLinecap="round"
                style={{ opacity: sm ? 1 : 0, transition: "opacity 0.2s" }} />
              {/* Text lines */}
              <rect x="16" y="104" width="54" height="4.5" rx="2.25" fill="#e0e7ff" />
              <rect x="16" y="114" width="84" height="3.5" rx="1.75" fill="#ede9fe" />
              <rect x="16" y="123" width="70" height="3.5" rx="1.75" fill="#ede9fe" />
              <rect x="16" y="132" width="44" height="3.5" rx="1.75" fill="#ede9fe" />
              {/* Sparkles on puff */}
              <circle cx="8"  cy="22" r="4"   fill="#fbbf24" style={{ opacity: puffed ? 0.95 : 0, transition: "opacity 0.1s" }} />
              <circle cx="114" cy="18" r="3"  fill="#34d399" style={{ opacity: puffed ? 0.95 : 0, transition: "opacity 0.1s" }} />
              <circle cx="3"  cy="88" r="3.5" fill="#f472b6" style={{ opacity: puffed ? 0.95 : 0, transition: "opacity 0.1s" }} />
              <circle cx="117" cy="96" r="3"  fill="#60a5fa" style={{ opacity: puffed ? 0.95 : 0, transition: "opacity 0.1s" }} />
              <circle cx="60" cy="2"  r="3"   fill="#a78bfa" style={{ opacity: puffed ? 0.9  : 0, transition: "opacity 0.1s" }} />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 3-D tilt card wrapper ────────────────────────────────────────────────────
function TiltCard({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [tf, setTf] = useState("");
  const [shine, setShine] = useState({ x: 50, y: 50, op: 0 });

  function onMove(e: React.MouseEvent) {
    if (disabled) return;
    const r = ref.current!.getBoundingClientRect();
    const dx = (e.clientX - r.left - r.width / 2) / (r.width / 2);
    const dy = (e.clientY - r.top - r.height / 2) / (r.height / 2);
    setTf(`perspective(900px) rotateX(${-dy * 7}deg) rotateY(${dx * 7}deg) scale3d(1.02,1.02,1.02)`);
    setShine({
      x: ((e.clientX - r.left) / r.width) * 100,
      y: ((e.clientY - r.top) / r.height) * 100,
      op: 0.15,
    });
  }

  function onLeave() {
    setTf("");
    setShine({ x: 50, y: 50, op: 0 });
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{
        transform: tf,
        transition: tf ? "none" : "transform 0.55s cubic-bezier(0.23,1,0.32,1)",
        transformStyle: "preserve-3d",
        position: "relative",
      }}
    >
      {children}
      <div
        className="pointer-events-none absolute inset-0 rounded-3xl"
        style={{
          background: `radial-gradient(circle at ${shine.x}% ${shine.y}%, rgba(255,255,255,${shine.op}), transparent 55%)`,
        }}
      />
    </div>
  );
}

// ─── Main upload page ─────────────────────────────────────────────────────────
export default function UploadPage() {
  const router = useRouter();
  const { phone, logout } = useAuthStore();
  const setSource = useThesisStore((s) => s.setSource);
  const template = useThesisStore((s) => s.template);
  const setTemplate = useThesisStore((s) => s.setTemplate);
  const tier = useThesisStore((s) => s.tier);
  const setTier = useThesisStore((s) => s.setTier);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [progressText, setProgressText] = useState("");
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Mouse tracking: ref for canvas/mascot (no re-render), state for parallax (needs re-render)
  const mpRef = useRef<{ x: number; y: number }>({ x: -999, y: -999 });
  const [mouseXY, setMouseXY] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      mpRef.current = { x: e.clientX, y: e.clientY };
      setMouseXY({ x: e.clientX, y: e.clientY });
    }
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  function startCreep() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setProgress((p) => (p >= 90 ? p : p + Math.max(0.5, (90 - p) * 0.05)));
    }, 500);
  }

  async function handleFile(file: File) {
    setError("");
    if (!file.name.toLowerCase().endsWith(".docx")) {
      setError("仅支持 .docx 文件");
      return;
    }
    setLoading(true);
    setProgress(6);
    setProgressText("正在读取文件...");
    try {
      const buf = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buf).reduce((acc, b) => acc + String.fromCharCode(b), "")
      );
      setProgress(18);
      setProgressText("AI 正在通读全文，批量识别每段类型...");
      startCreep();
      const data = await parseDocx(file, tier);
      if (timerRef.current) clearInterval(timerRef.current);
      setProgress(100);
      setProgressText("识别完成，正在进入分块确认...");
      setSource(file.name, base64, data.paragraphs);
      router.push("/review");
    } catch (e: unknown) {
      if (timerRef.current) clearInterval(timerRef.current);
      setError(e instanceof Error ? e.message : String(e));
      setLoading(false);
      setProgress(0);
      setProgressText("");
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (loading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  const onPuff = useCallback(() => {}, []);

  // Parallax offset for hero text
  const px = mouseXY ? (mouseXY.x / window.innerWidth  - 0.5) * 2 : 0;
  const py = mouseXY ? (mouseXY.y / window.innerHeight - 0.5) * 2 : 0;

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-gradient-to-br from-slate-50 via-indigo-50 to-cyan-50">
      {/* Layer 0 – particles */}
      <ParticleCanvas mpRef={mpRef} />

      {/* Layer 3 – mascot (desktop only) */}
      <PaperMascot mpRef={mpRef} onPuff={onPuff} />

      {/* Layer 2 – page content */}
      <div className="relative z-20">
        {/* Nav */}
        <nav className="flex items-center justify-between px-6 py-4 md:px-10">
          <Logo />
          <div className="flex items-center gap-3">
            {phone ? (
              <>
                <span className="hidden text-xs text-slate-500 sm:block">{maskPhone(phone)}</span>
                <button
                  onClick={() => logout()}
                  className="rounded-lg border border-slate-200 bg-white/70 px-3 py-1.5 text-xs text-slate-500 transition hover:border-red-200 hover:text-red-500"
                >
                  退出登录
                </button>
              </>
            ) : (
              <button
                onClick={() => router.push("/login")}
                className="rounded-lg border border-indigo-200 bg-white/70 px-3 py-1.5 text-xs text-indigo-600 transition hover:bg-indigo-50"
              >
                登录 / 注册
              </button>
            )}
          </div>
        </nav>

        <div className="flex flex-col items-center px-6 pb-16 pt-6 md:pt-12">
          <div className="w-full max-w-2xl">

            {/* Hero header with parallax */}
            <header className="mb-8 text-center">
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-indigo-600 shadow-sm ring-1 ring-indigo-100">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                一键对齐高校论文格式标准
              </div>
              <h1
                className="bg-gradient-to-r from-indigo-600 to-cyan-500 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent"
                style={{
                  transform: `translate(${px * -7}px, ${py * -4}px)`,
                  transition: "transform 0.08s linear",
                  willChange: "transform",
                }}
              >
                论文格式化工具
              </h1>
              <p
                className="mt-3 text-slate-500"
                style={{
                  transform: `translate(${px * -4}px, ${py * -2.5}px)`,
                  transition: "transform 0.12s linear",
                  willChange: "transform",
                }}
              >
                上传 .docx → AI 批量识别分块 → 逐段确认 → 一键导出规范论文
              </p>
            </header>

            {/* 学院选择 */}
            <div className="mb-4 flex items-center justify-center gap-3">
              <label className="text-sm font-medium text-slate-600">论文标准</label>
              <Select
                value={template}
                disabled={loading}
                onChange={(e) => setTemplate(e.target.value)}
                className="h-10 min-w-[15rem]"
              >
                <optgroup label="现行可用">
                  {COLLEGES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </optgroup>
                <optgroup label="陆续接入（敬请期待）">
                  {COMING_SOON.map((c) => (
                    <option key={c} value={c} disabled>呼伦贝尔学院 · {c}</option>
                  ))}
                </optgroup>
              </Select>
            </div>

            {/* 模型档位 */}
            <div className="mb-5">
              <div className="mb-2 flex items-center justify-center gap-2 text-sm font-medium text-slate-600">
                识别模型
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-normal text-slate-400">
                  价格仅展示，当前免费试用
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {MODEL_TIERS.map((m) => {
                  const active = tier === m.value;
                  return (
                    <button
                      key={m.value}
                      type="button"
                      disabled={loading}
                      onClick={() => setTier(m.value)}
                      className={`
                        relative rounded-2xl border-2 p-3 text-left transition
                        ${active
                          ? "border-indigo-500 bg-indigo-50/80 shadow-sm"
                          : "border-slate-200 bg-white/70 hover:border-indigo-300"}
                        ${loading ? "cursor-not-allowed opacity-60" : "cursor-pointer"}
                      `}
                    >
                      {m.recommended && (
                        <span className="absolute -top-2 right-3 rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow">
                          推荐
                        </span>
                      )}
                      {m.value === "economy" && (
                        <span className="absolute -top-2 right-3 rounded-full bg-orange-400 px-2 py-0.5 text-[10px] font-semibold text-white shadow">
                          低精度
                        </span>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-700">{m.label}</span>
                        <span className={`text-xs font-medium ${active ? "text-indigo-600" : "text-slate-400"}`}>
                          {m.price}
                        </span>
                      </div>
                      <div className="mt-1 text-xs leading-snug text-slate-400">{m.desc}</div>
                    </button>
                  );
                })}
              </div>
              {tier === "economy" && (
                <div className="mt-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-700">
                  ⚠️ 经济版使用规则识别，无需联网，但识别率约 70%，需在确认页面较多手动纠错。如论文排版复杂，建议改用标准版或旗舰版。
                </div>
              )}
            </div>

            {/* 上传区（3-D tilt） */}
            <TiltCard disabled={loading}>
              <div
                onDragOver={(e) => { e.preventDefault(); if (!loading) setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => !loading && inputRef.current?.click()}
                className={`
                  group cursor-pointer rounded-3xl border-2 border-dashed bg-white/80 p-14 text-center shadow-sm backdrop-blur transition
                  ${dragOver ? "border-indigo-500 bg-indigo-50/80 scale-[1.01]" : "border-slate-300 hover:border-indigo-400 hover:bg-white"}
                  ${loading ? "pointer-events-none opacity-60" : ""}
                `}
              >
                <input ref={inputRef} type="file" accept=".docx" className="hidden" onChange={onChange} />
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500 text-3xl shadow-lg shadow-indigo-200 transition group-hover:scale-110">
                  📄
                </div>
                <p className="mb-1 text-lg font-semibold text-slate-700">
                  点击或拖拽上传 .docx 论文文件
                </p>
                <p className="text-sm text-slate-400">
                  文件仅用于本次格式化，处理后不长期保存
                </p>
              </div>
            </TiltCard>

            {/* 进度条 */}
            {loading && (
              <div className="mt-6 rounded-2xl border border-indigo-100 bg-white/90 p-5 shadow-sm">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="flex items-center font-medium text-indigo-700">
                    <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent align-middle" />
                    {progressText || "处理中..."}
                  </span>
                  <span className="tabular-nums text-slate-400">{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} barClassName="bg-gradient-to-r from-indigo-500 to-cyan-500" />
              </div>
            )}

            {error && (
              <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
                ⚠️ {error}
              </div>
            )}

            {!loading && (
              <div className="mt-8 text-center">
                <Button variant="outline" onClick={() => inputRef.current?.click()}>
                  选择文件
                </Button>
              </div>
            )}

            {/* 特性卡 */}
            <div className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { t: "AI 智能分块", d: "通读全文识别五大块与段落类型" },
                { t: "逐段可控", d: "分块确认 · 增删段落 · A4 实时预览" },
                { t: "规范导出", d: "中英混排 · 三线表 · 分页 · 导航目录" },
              ].map((f) => (
                <div
                  key={f.t}
                  className="rounded-2xl border border-white bg-white/70 p-4 text-center shadow-sm backdrop-blur"
                >
                  <div className="text-sm font-semibold text-slate-700">{f.t}</div>
                  <div className="mt-1 text-xs text-slate-400">{f.d}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <footer className="pb-8 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} 同乐科技 · TONGLE TECH · 论文格式自动化
        </footer>
      </div>
    </main>
  );
}
