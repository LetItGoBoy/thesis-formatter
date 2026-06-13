"use client";

/**
 * 关于 · 创始人与同乐科技
 * frontend/app/about/page.tsx
 *
 * 一段创始人小介绍（不点明教师身份）+ 任务徽标 + 科研方向。
 */
import { SiteNav } from "@/components/SiteNav";

// 任务徽标：用「无穷符号 + 刻度」隐喻「万物皆可量化」
function MissionMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="任务徽标">
      <defs>
        <linearGradient id="mm" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#d946ef" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill="none" stroke="url(#mm)" strokeWidth="2" opacity="0.4" />
      {/* 刻度 */}
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
      {/* 无穷符号 ∞ */}
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

const RESEARCH = [
  {
    title: "高光谱图像 × 深度学习",
    desc: "在有限标注与算力下，让模型读懂人眼看不见的光谱维度——地物分类、特征融合与场景反演。",
  },
  {
    title: "学习行为的量化建模",
    desc: "把闯关、答题、连续学习沉淀成可度量的数据，用成长值与进度刻画每一次进步。",
  },
  {
    title: "开源工具链与教育游戏化",
    desc: "把枯燥的课程做成能亲手玩的系统，用开源的方式把好东西交到更多人手里。",
  },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-white text-stone-900">
      <SiteNav active="about" />

      <div className="mx-auto max-w-3xl px-6 py-16 md:px-10 md:py-24">
        {/* 任务徽标 */}
        <MissionMark className="h-16 w-16" />

        <h1 className="font-display mt-7 text-5xl leading-tight tracking-tight text-stone-900 md:text-6xl">
          万物皆可量化
        </h1>
        <p className="mt-5 text-lg leading-8 text-stone-600">
          同乐科技的信条只有一句：<span className="font-medium text-stone-900">能被理解的，终将能被度量；能被度量的，就能被打磨得更好。</span>
          光谱、城市、一次次失误与坚持——在我们眼里，都是可以建模、可以量化、可以变得更聪明的对象。
        </p>

        {/* 创始人小介绍 */}
        <div className="mt-12 rounded-3xl border border-black/[0.07] bg-gradient-to-br from-indigo-50 to-white p-7 md:p-9">
          <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-stone-400">
            Founder · 同乐科技创始人
          </div>
          <p className="mt-4 text-[15px] leading-8 text-stone-700">
            一只长期泡在项目里的「老妖精」——写了很多年代码，从底层到全栈、从原型到上线都趟过一遍，
            见过的 bug 比头发还多。信奉开源文化，相信好的东西就该被人用、被人改、被人传下去；
            也偏执地认为<span className="font-medium text-stone-900">万物皆可量化</span>，
            于是把这股劲儿做成了同乐科技：把课程拆成能亲手玩的关卡，把论文写作拆成可度量的流程，
            把「学得怎么样」变成看得见的成长曲线。
          </p>
          <p className="mt-4 text-[15px] leading-8 text-stone-700">
            不爱讲大道理，只信「跑起来再说」。能用一行代码解决的事，绝不开三次会；
            能让机器自动做的事，绝不让人重复第十遍。
          </p>
        </div>

        {/* 科研方向 */}
        <h2 className="font-display mt-14 text-3xl tracking-tight text-stone-900">在做的方向</h2>
        <div className="mt-6 divide-y divide-stone-200 border-y border-stone-200">
          {RESEARCH.map((r) => (
            <div key={r.title} className="py-6">
              <h3 className="text-lg font-bold tracking-tight text-stone-900">{r.title}</h3>
              <p className="mt-2 text-[15px] leading-7 text-stone-600">{r.desc}</p>
            </div>
          ))}
        </div>

        <p className="mt-10 text-sm text-stone-400">
          — 同乐科技 · 用可量化的方式，把抽象变得可以亲手触摸。
        </p>
      </div>
    </main>
  );
}
