"use client";

/**
 * 关于 · Alex Wu / 同乐科技
 * frontend/app/about/page.tsx
 *
 * 个人自述（AI 自动化）+ 照片 + 预约 CTA + 任务徽标 + 在做的方向。
 * 📸 把照片放到 /public/images/alex.jpg 自动生效（建议竖版 3:4）。
 */
import { ArrowRight, CalendarClock, Mail } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";

const EMAIL = "alex@example.com"; // ← 换成你的预约邮箱
const PHOTO = "/images/alex.jpg"; // ← 把照片放到 frontend/public/images/alex.jpg

// 任务徽标：「无穷符号 + 刻度」隐喻「万物皆可量化」
function MissionMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="任务徽标">
      <defs>
        <linearGradient id="mm" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#d946ef" />
        </linearGradient>
      </defs>
      {Array.from({ length: 24 }).map((_, i) => {
        const a = (i / 24) * Math.PI * 2;
        const r1 = 26;
        const r2 = i % 6 === 0 ? 20 : 23;
        return (
          <line
            key={i}
            x1={32 + Math.cos(a) * r1}
            y1={32 + Math.sin(a) * r1}
            x2={32 + Math.cos(a) * r2}
            y2={32 + Math.sin(a) * r2}
            stroke="url(#mm)"
            strokeWidth="1.4"
            opacity="0.55"
          />
        );
      })}
      <path
        d="M20 32c0-5 4-8 8-4l8 8c4 4 8 1 8-4s-4-8-8-4l-8 8c-4 4-8 1-8-4z"
        fill="none"
        stroke="url(#mm)"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

const FOCUS = [
  { title: "企业 AI 自动化", desc: "梳理重复、易错、耗时的环节，用 AI 把它们自动化，省时间也省成本。" },
  { title: "工作流优化", desc: "无论是从零搭建还是优化现有流程，把「人来回搬数据」变成「系统自动跑」。" },
  { title: "开源工具链与教育游戏化", desc: "把好东西用开源的方式交到更多人手里，把课程做成能亲手玩的系统。" },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-white text-stone-900">
      <SiteNav active="about" />

      <div className="mx-auto max-w-5xl px-6 py-16 md:px-10 md:py-24">
        {/* 个人自述 + 照片 */}
        <div className="grid items-center gap-10 md:grid-cols-[280px_1fr] md:gap-14">
          {/* 照片 */}
          <div className="relative mx-auto w-full max-w-[280px]">
            <div
              className="absolute -inset-3 -z-10 rounded-[2rem] opacity-60 blur-2xl"
              style={{ background: "radial-gradient(circle at 50% 30%, rgba(99,102,241,0.35), transparent 70%)" }}
            />
            <div className="overflow-hidden rounded-[2rem] shadow-[0_24px_60px_-24px_rgba(60,50,120,0.4)] ring-1 ring-black/[0.07]">
              <img
                src={PHOTO}
                alt="Alex Wu"
                className="aspect-[3/4] w-full bg-stone-100 object-cover"
              />
            </div>
          </div>

          {/* 自述 */}
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-stone-400">
              同乐科技创始人 · AI 自动化
            </div>
            <h1 className="font-display mt-4 text-4xl leading-tight tracking-tight text-stone-900 md:text-5xl">
              你好，我是 Alex Wu 👋
            </h1>
            <div className="mt-6 space-y-4 text-[15px] leading-8 text-stone-600">
              <p>我热衷于帮助企业释放 AI 自动化的力量，从而节省时间、降低成本，并保持竞争力。</p>
              <p>
                我相信，不采用 AI 的企业将很难跟上时代发展。而我在这里，就是为了帮助你走在趋势前面。
                无论你是刚开始接触 AI，还是希望优化现有工作流程，我都可以全程为你提供指导。
              </p>
              <p>让我们一起打造一个更高效的未来！欢迎通过我的网站预约一次沟通。</p>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href={`mailto:${EMAIL}?subject=${encodeURIComponent("预约一次沟通")}`}
                className="group inline-flex items-center gap-2 rounded-full bg-stone-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-stone-700"
              >
                <CalendarClock size={16} />
                预约一次沟通
                <ArrowRight size={15} className="transition group-hover:translate-x-0.5" />
              </a>
              <a
                href={`mailto:${EMAIL}`}
                className="inline-flex items-center gap-2 rounded-full border border-stone-300 px-5 py-3 text-sm font-medium text-stone-700 transition hover:bg-stone-900/[0.04]"
              >
                <Mail size={16} />
                邮件联系
              </a>
            </div>
          </div>
        </div>

        {/* 信条 */}
        <div className="mt-16 flex items-center gap-4 rounded-3xl border border-black/[0.07] bg-gradient-to-br from-indigo-50 to-white p-6 md:p-8">
          <MissionMark className="h-14 w-14 shrink-0" />
          <div>
            <div className="font-display text-2xl tracking-tight text-stone-900">万物皆可量化</div>
            <p className="mt-1 text-[15px] leading-7 text-stone-600">
              能被理解的，终将能被度量；能被度量的，就能被打磨得更好。这是我做每一件事的底层信念。
            </p>
          </div>
        </div>

        {/* 在做的方向 */}
        <h2 className="font-display mt-14 text-3xl tracking-tight text-stone-900">在做的方向</h2>
        <div className="mt-6 divide-y divide-stone-200 border-y border-stone-200">
          {FOCUS.map((r) => (
            <div key={r.title} className="py-6">
              <h3 className="text-lg font-bold tracking-tight text-stone-900">{r.title}</h3>
              <p className="mt-2 text-[15px] leading-7 text-stone-600">{r.desc}</p>
            </div>
          ))}
        </div>

        <p className="mt-10 text-sm text-stone-400">— 同乐科技 · 用可量化的方式，把抽象变得可以亲手触摸。</p>
      </div>
    </main>
  );
}
