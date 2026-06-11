"use client";

/**
 * 个人作品集主页
 * frontend/app/page.tsx
 *
 * 主题：高光谱（可见光谱分光）——亮色赛博：浅底 + 光谱渐变 + 扫描线纹理 + 霓虹强调。
 * 板块：Hero → 关于(含 NOW) → 研究(含高光谱交互 Demo) → 成果 → 作品 → 教学
 *       → 履历 → 影响我的 → 联系 → 页脚。
 *
 * ⚙️ 个人/内容数据集中在下面的 PROFILE / NOW / LINKS / RESEARCH / PUBLICATIONS /
 *   WORKS / TEACHING / TIMELINE / FILMS，改这里即可。
 * 🖼️ Hero 主视觉：components/HeroCube.tsx 纯 SVG 矢量高光谱立方体（无需图片文件）。
 */
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  Cpu,
  Film,
  FlaskConical,
  Gamepad2,
  Layers,
  Mail,
  Microscope,
  Sparkles,
  FileText,
  Database,
  BookOpen,
  Code2,
  GraduationCap,
  Fingerprint,
  Radio,
  Clapperboard,
  Award,
  ExternalLink,
} from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { MusicPlayer } from "@/components/MusicPlayer";
import { SpectralDemo } from "@/components/SpectralDemo";
import { HeroCube } from "@/components/HeroCube";
import { Reveal } from "@/components/Reveal";
import { useAuthStore } from "@/lib/auth-store";

// ============================================================
// 个人信息（改这里）
// ============================================================
const PROFILE = {
  name: "同乐科技", // 品牌名（顶栏 / 页脚）
  headline: "光谱之外", // Hero 大标题（贴合高光谱主题，不露真名）
  title: "高校教师 · AI 研究者",
  field: "高光谱图像 / 深度学习",
  // Hero 一句话主张
  tagline: "超越可见之光，让机器读懂万物的光谱指纹。",
  intro:
    "我是一名高校教师，研究方向是高光谱图像与深度学习——让机器看见人眼看不见的光谱维度。课余沉迷电影与动漫，也喜欢把课程做成能玩的东西。这里收集我的研究、作品与课程资料。",
  tags: ["高光谱成像", "深度学习", "遥感 / 图像分类", "高校教学", "电影 & 动漫"],
  email: "you@example.edu.cn", // ← 改成你的邮箱
};

// 「最近在做」（一句话动态，按需替换）
const NOW = [
  "本学期在带《数据库原理》《数据结构》两门课。",
  "在投一篇高光谱小样本分类的论文。",
  "在迭代课程游戏《雾港档案》与论文助手。",
];

// 外部链接（把 # 换成你的真实主页；留空的可删）
const LINKS = [
  { label: "GitHub", href: "#", icon: Code2 },
  { label: "Google Scholar", href: "#", icon: GraduationCap },
  { label: "ORCID", href: "#", icon: Fingerprint },
];

// 论文 / 成果（按需替换；type: 期刊 / 会议）
const PUBLICATIONS = [
  {
    title: "面向小样本的轻量化光谱—空间高光谱图像分类网络",
    authors: "你的名字, 合作者 A, 合作者 B",
    venue: "示例期刊 / 会议",
    year: "2025",
    type: "期刊",
    award: "",
    links: [
      { label: "PDF", href: "#" },
      { label: "代码", href: "#" },
      { label: "BibTeX", href: "#" },
    ],
  },
  {
    title: "高光谱与多源遥感的特征级融合方法研究",
    authors: "你的名字, 合作者 C",
    venue: "示例会议",
    year: "2024",
    type: "会议",
    award: "最佳论文提名",
    links: [
      { label: "PDF", href: "#" },
      { label: "BibTeX", href: "#" },
    ],
  },
];

// 履历时间线（按需替换）
const TIMELINE = [
  { year: "2023 — 至今", title: "高校教师 · AI 研究", desc: "从事高光谱图像与深度学习教学科研。" },
  { year: "2020 — 2023", title: "博士 / 硕士阶段", desc: "遥感图像处理与机器学习方向。" },
  { year: "更早", title: "起点", desc: "对图像、光与计算的最初兴趣。" },
];

// 影响我的影视 / 番剧（人格化记忆点，按需替换）
const FILMS = ["你的名字", "星际穿越", "攻壳机动队", "银翼杀手 2049", "EVA", "瑞克和莫蒂"];

const STATS = [
  { k: "研究方向", v: "高光谱图像" },
  { k: "身份", v: "高校教师" },
  { k: "在研项目", v: "3 项" },
  { k: "教学 IP", v: "2 套" },
];

// 在研项目（高光谱方向占位，按需替换）
const RESEARCH = [
  {
    icon: Layers,
    code: "HSI-01",
    title: "高光谱图像分类的轻量化网络",
    desc: "在有限标注与算力下，设计兼顾光谱—空间信息的轻量模型，提升地物分类精度与推理效率。",
    tags: ["光谱-空间", "轻量化", "小样本"],
    status: "在研",
  },
  {
    icon: Cpu,
    code: "HSI-02",
    title: "高光谱 × 多模态数据融合",
    desc: "融合高光谱与多源遥感（多光谱、LiDAR 等）信息，缓解单一模态的信息缺口，增强鲁棒性。",
    tags: ["多模态", "特征融合", "遥感"],
    status: "在研",
  },
  {
    icon: FlaskConical,
    code: "HSI-03",
    title: "高光谱反演与场景应用",
    desc: "面向农业、环境监测等场景，探索从光谱到物理量的反演方法，把研究落到真实问题上。",
    tags: ["反演", "农业/环境", "应用"],
    status: "孵化",
  },
];

// 作品（两个）
const WORKS = [
  {
    icon: FileText,
    kind: "在线工具",
    title: "论文助手",
    en: "Thesis Copilot",
    desc: "面向本科毕业论文的一站式助手：提交前体检、AI 表达优化、按校本规范一键格式对齐与标准 Word 导出。",
    accent: "from-sky-500/20 to-blue-600/10",
    ring: "ring-sky-400/30",
    links: [
      { label: "进入论文助手", href: "/thesis", primary: true },
      { label: "提交前体检", href: "/checkup", primary: false },
    ],
  },
  {
    icon: Gamepad2,
    kind: "教学 IP",
    title: "课程游戏空间",
    en: "Course Game Lab",
    desc: "把课程做成能玩的闯关：SQL 侦探《雾港档案》八案推理学数据库，《霓虹栈城》赛博朋克闯关学数据结构。",
    accent: "from-fuchsia-500/20 to-indigo-600/10",
    ring: "ring-fuchsia-400/30",
    links: [
      { label: "SQL 侦探 · 雾港档案", href: "/quest/database", primary: true },
      { label: "数据结构 · 霓虹栈城", href: "/quest/data-structure", primary: false },
    ],
  },
];

// 课程资料
const TEACHING = [
  { icon: BookOpen, title: "培养方案 · 课程地图", desc: "按专业方向梳理的课程关系与学习路径。", href: "/curriculum" },
  { icon: Database, title: "课程空间", desc: "每门课的资料、练习与项目沉淀地。", href: "/course-spaces" },
];

export default function HomePage() {
  const router = useRouter();
  const { token } = useAuthStore();

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#eef1f8] text-slate-900 selection:bg-fuchsia-500/30">
      {/* ================= 顶栏 ================= */}
      <nav className="fixed inset-x-0 top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <button onClick={() => scrollTo("top")} className="flex items-center gap-2.5">
            <LogoMark size={30} />
            <span className="text-sm font-semibold tracking-wide">{PROFILE.name}</span>
          </button>
          <div className="flex items-center gap-1 text-sm">
            {[
              { label: "关于", id: "about" },
              { label: "研究", id: "research" },
              { label: "成果", id: "publications" },
              { label: "作品", id: "works" },
              { label: "教学", id: "teaching" },
            ].map((n) => (
              <button
                key={n.id}
                onClick={() => scrollTo(n.id)}
                className="hidden rounded-md px-3 py-2 font-medium text-slate-500 transition hover:text-slate-900 sm:inline-flex"
              >
                {n.label}
              </button>
            ))}
            <button
              onClick={() => router.push(token ? "/dashboard" : "/login")}
              className="ml-1 rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-800 ring-1 ring-slate-200 transition hover:bg-slate-200"
            >
              {token ? "工作台" : "登录"}
            </button>
          </div>
        </div>
      </nav>

      {/* ================= HERO ================= */}
      <section id="top" className="relative flex min-h-screen items-center overflow-hidden bg-[#eef1f8]">
        {/* 背景：静态叠层 */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 scanlines opacity-10" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#eef1f8] to-transparent" />
        </div>
        {/* 光谱扫描线：z-20 覆盖图片层 */}
        <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
          <div className="animate-sweep bg-spectrum absolute inset-x-0 h-px opacity-50 blur-[1px]" />
        </div>

        {/* 网格：左侧文字固定窄列，右侧图片出血到视口右缘（保证大而不压字） */}
        <div className="relative mx-auto grid w-full max-w-7xl items-center gap-10 px-6 pt-24 lg:grid-cols-[minmax(0,440px)_1fr] lg:px-12 lg:pt-0">
          {/* 左栏：文字 */}
          <div className="z-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-xs font-medium tracking-[0.2em] text-slate-600 backdrop-blur">
              <span className="bg-spectrum h-2 w-2 rounded-full" />
              HYPERSPECTRAL · AI · RESEARCH
            </div>

            <h1 className="mt-7 text-5xl font-black leading-[0.95] tracking-tight md:text-7xl">
              <span className="text-spectrum animate-huedrift">{PROFILE.headline}</span>
            </h1>

            <p className="mt-6 text-xl font-light leading-snug text-slate-800 md:text-2xl">
              {PROFILE.tagline}
            </p>
            <p className="mt-4 text-sm leading-7 text-slate-500">
              {PROFILE.title} · {PROFILE.field}
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <button
                onClick={() => scrollTo("works")}
                className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition hover:from-cyan-400 hover:to-indigo-400"
              >
                看我的作品
                <ArrowRight size={16} className="transition group-hover:translate-x-0.5" />
              </button>
              <button
                onClick={() => scrollTo("research")}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-6 py-3 text-sm font-semibold text-slate-900 backdrop-blur transition hover:bg-slate-100"
              >
                <Microscope size={16} />
                在研项目
              </button>
            </div>

            <button
              onClick={() => scrollTo("about")}
              className="mt-14 hidden animate-float items-center gap-1.5 text-xs text-slate-500 transition hover:text-slate-600 lg:inline-flex"
            >
              向下滚动 <ChevronDown size={14} />
            </button>
          </div>

          {/* 右栏：SVG 矢量高光谱立方体（亮底无黑边，任意缩放不糊） */}
          <div className="flex justify-center lg:justify-end lg:pr-4">
            <HeroCube className="w-full max-w-[560px]" />
          </div>
        </div>
      </section>

      {/* ================= 关于我 ================= */}
      <section id="about" className="relative border-t border-slate-200 py-24">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 md:grid-cols-[1.4fr_1fr]">
          <div>
            <SectionLabel n="01" title="关于我" en="ABOUT" />
            <p className="mt-7 text-2xl font-light leading-relaxed text-slate-800">
              {PROFILE.intro}
            </p>
            <div className="mt-7 flex flex-wrap gap-2">
              {PROFILE.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-sm text-slate-600"
                >
                  {t}
                </span>
              ))}
            </div>
            <div className="mt-7 flex items-center gap-2 text-sm text-slate-500">
              <Film size={15} className="text-fuchsia-600" />
              片单与番剧，是我灵感的另一半。
            </div>

            {/* 最近在做 */}
            <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2 text-xs font-mono tracking-widest text-emerald-600">
                <Radio size={14} className="animate-glow" />
                NOW · 最近在做
              </div>
              <ul className="mt-3 space-y-2">
                {NOW.map((n) => (
                  <li key={n} className="flex gap-2 text-sm leading-6 text-slate-600">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-spectrum" />
                    {n}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 self-start">
            {STATS.map((s) => (
              <div
                key={s.k}
                className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white/[0.06] to-transparent p-5"
              >
                <div className="text-xs tracking-wide text-slate-500">{s.k}</div>
                <div className="mt-2 text-lg font-semibold text-slate-900">{s.v}</div>
              </div>
            ))}
            {/* 光谱条装饰 */}
            <div className="col-span-2 mt-1 h-1.5 w-full rounded-full bg-spectrum opacity-80" />

            {/* 外部链接 */}
            <div className="col-span-2 mt-2 flex flex-wrap gap-2">
              {LINKS.map((l) => {
                const Icon = l.icon;
                return (
                  <a
                    key={l.label}
                    href={l.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                  >
                    <Icon size={14} />
                    {l.label}
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ================= 在研项目 ================= */}
      <section id="research" className="relative border-t border-slate-200 py-24">
        <div className="mx-auto max-w-6xl px-5">
          <SectionLabel n="02" title="在研项目" en="RESEARCH" />
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {RESEARCH.map((r) => {
              const Icon = r.icon;
              return (
                <div
                  key={r.code}
                  className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <div className="absolute right-5 top-5 font-mono text-[11px] tracking-widest text-slate-400">
                    {r.code}
                  </div>
                  <span className="inline-flex size-11 items-center justify-center rounded-xl bg-slate-50 text-cyan-600 ring-1 ring-slate-200">
                    <Icon size={20} />
                  </span>
                  <div className="mt-5 flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-slate-900">{r.title}</h3>
                  </div>
                  <p className="mt-2.5 text-sm leading-6 text-slate-500">{r.desc}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                        r.status === "在研"
                          ? "bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/20"
                          : "bg-amber-500/15 text-amber-600 ring-1 ring-amber-500/20"
                      }`}
                    >
                      {r.status}
                    </span>
                    {r.tags.map((t) => (
                      <span key={t} className="text-[11px] text-slate-500">
                        #{t}
                      </span>
                    ))}
                  </div>
                  {/* 底部光谱条 */}
                  <div className="bg-spectrum mt-5 h-0.5 w-0 rounded-full opacity-80 transition-all duration-500 group-hover:w-full" />
                </div>
              );
            })}
          </div>

          {/* 高光谱交互 Demo */}
          <Reveal className="mt-14">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">试一试 · 光谱指纹</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    高光谱影像里，每个像素都是一条曲线。移动鼠标，看不同地物如何被「光」区分。
                  </p>
                </div>
                <span className="rounded-full bg-slate-50 px-3 py-1 text-[11px] font-mono tracking-wider text-cyan-600 ring-1 ring-slate-200">
                  INTERACTIVE
                </span>
              </div>
              <SpectralDemo />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ================= 成果 / 论文 ================= */}
      <section id="publications" className="relative border-t border-slate-200 py-24">
        <div className="mx-auto max-w-6xl px-5">
          <SectionLabel n="03" title="成果" en="PUBLICATIONS" />
          <div className="mt-10 space-y-3">
            {PUBLICATIONS.map((p) => (
              <Reveal key={p.title}>
                <div className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-slate-300 hover:bg-slate-50">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-cyan-600 ring-1 ring-slate-200">
                          {p.type}
                        </span>
                        <span className="font-mono text-xs text-slate-500">{p.year}</span>
                        {p.award ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-600 ring-1 ring-amber-500/20">
                            <Award size={11} />
                            {p.award}
                          </span>
                        ) : null}
                      </div>
                      <h3 className="mt-2.5 text-base font-semibold leading-6 text-slate-900">
                        {p.title}
                      </h3>
                      <p className="mt-1.5 text-sm text-slate-500">{p.authors}</p>
                      <p className="mt-0.5 text-sm italic text-slate-500">{p.venue}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {p.links.map((l) => (
                      <a
                        key={l.label}
                        href={l.href}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                      >
                        {l.label}
                        <ExternalLink size={12} />
                      </a>
                    ))}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <p className="mt-5 text-xs text-slate-400">* 论文列表为占位示例，替换 PUBLICATIONS 即可。</p>
        </div>
      </section>

      {/* ================= 作品 ================= */}
      <section id="works" className="relative border-t border-slate-200 py-24">
        <div className="mx-auto max-w-6xl px-5">
          <SectionLabel n="04" title="作品" en="WORKS" />
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {WORKS.map((w) => {
              const Icon = w.icon;
              return (
                <div
                  key={w.title}
                  className={`group relative overflow-hidden rounded-[2rem] border border-slate-200 bg-gradient-to-br ${w.accent} p-8 ring-1 ${w.ring} transition hover:-translate-y-1`}
                >
                  <div className="scanlines pointer-events-none absolute inset-0 opacity-40" />
                  <div className="relative">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-900 ring-1 ring-slate-300 backdrop-blur">
                        <Icon size={26} />
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium tracking-wide text-slate-800 ring-1 ring-slate-200">
                        {w.kind}
                      </span>
                    </div>
                    <h3 className="mt-6 text-3xl font-bold text-slate-900">{w.title}</h3>
                    <div className="mt-1 font-mono text-xs tracking-[0.25em] text-slate-500">
                      {w.en}
                    </div>
                    <p className="mt-4 text-sm leading-7 text-slate-700">{w.desc}</p>
                    <div className="mt-7 flex flex-wrap gap-3">
                      {w.links.map((l) => (
                        <button
                          key={l.href}
                          onClick={() => router.push(l.href)}
                          className={`inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                            l.primary
                              ? "bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-md shadow-cyan-500/20 hover:from-cyan-400 hover:to-indigo-400"
                              : "border border-slate-300 bg-slate-50 text-slate-900 hover:bg-slate-100"
                          }`}
                        >
                          {l.label}
                          <ArrowUpRight size={15} />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================= 课程资料 ================= */}
      <section id="teaching" className="relative border-t border-slate-200 py-24">
        <div className="mx-auto max-w-6xl px-5">
          <SectionLabel n="05" title="教学" en="TEACHING" />
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {TEACHING.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.href}
                  onClick={() => router.push(t.href)}
                  className="group flex items-center gap-5 rounded-2xl border border-slate-200 bg-white p-6 text-left transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-amber-600 ring-1 ring-slate-200">
                    <Icon size={22} />
                  </span>
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900">{t.title}</div>
                    <div className="mt-1 text-sm text-slate-500">{t.desc}</div>
                  </div>
                  <ArrowRight size={18} className="text-slate-500 transition group-hover:translate-x-1 group-hover:text-slate-900" />
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================= 履历 ================= */}
      <section id="timeline" className="relative border-t border-slate-200 py-24">
        <div className="mx-auto max-w-6xl px-5">
          <SectionLabel n="06" title="履历" en="TIMELINE" />
          <div className="relative mt-12 pl-6">
            {/* 竖向光谱轴 */}
            <div className="bg-spectrum absolute left-0 top-1 h-[calc(100%-0.5rem)] w-0.5 rounded-full opacity-70" />
            <div className="space-y-9">
              {TIMELINE.map((t) => (
                <Reveal key={t.year}>
                  <div className="relative">
                    <span className="absolute -left-[1.65rem] top-1.5 h-3 w-3 rounded-full bg-white ring-4 ring-[#06060c]" />
                    <div className="font-mono text-xs tracking-wider text-slate-500">{t.year}</div>
                    <h3 className="mt-1 text-lg font-semibold text-slate-900">{t.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{t.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================= 影响我的作品 ================= */}
      <section id="films" className="relative border-t border-slate-200 py-24">
        <div className="mx-auto max-w-6xl px-5">
          <SectionLabel n="07" title="影响我的" en="OFF-DUTY" />
          <p className="mt-6 flex items-center gap-2 text-sm text-slate-500">
            <Clapperboard size={15} className="text-fuchsia-600" />
            实验室之外，这些电影与番剧塑造了我看世界的方式。
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {FILMS.map((f, i) => (
              <div
                key={f}
                className="group relative flex aspect-[3/4] items-end overflow-hidden rounded-xl border border-slate-200 p-3"
                style={{
                  background: `linear-gradient(160deg, hsl(${(i * 57) % 360} 70% 22%), hsl(${
                    (i * 57 + 40) % 360
                  } 65% 10%))`,
                }}
              >
                <div className="scanlines pointer-events-none absolute inset-0 opacity-30" />
                <span className="relative text-sm font-semibold leading-tight text-slate-900/95 drop-shadow">
                  {f}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= 联系 ================= */}
      <section id="contact" className="relative border-t border-slate-200 py-24">
        <div className="mx-auto max-w-3xl px-5 text-center">
          <SectionLabel n="08" title="联系" en="CONTACT" />
          <p className="mx-auto mt-7 max-w-xl text-lg font-light leading-relaxed text-slate-600">
            研究合作、教学交流、或只是想聊聊光谱与电影——欢迎随时来信。
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href={`mailto:${PROFILE.email}`}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition hover:from-cyan-400 hover:to-indigo-400"
            >
              <Mail size={16} />
              发邮件
            </a>
            {LINKS.map((l) => {
              const Icon = l.icon;
              return (
                <a
                  key={l.label}
                  href={l.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                >
                  <Icon size={16} />
                  {l.label}
                </a>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================= 页脚 ================= */}
      <footer className="relative border-t border-slate-200 py-14">
        <div className="bg-spectrum absolute inset-x-0 top-0 h-px opacity-60" />
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-5 text-center">
          <div className="flex items-center gap-2.5">
            <LogoMark size={28} />
            <span className="text-sm font-semibold">{PROFILE.name}</span>
          </div>
          <p className="max-w-md text-sm leading-6 text-slate-500">
            <Sparkles size={13} className="mb-0.5 mr-1 inline text-fuchsia-600" />
            {PROFILE.title} · 专注高光谱图像与 AI · 也爱电影与动漫
          </p>
          <a
            href={`mailto:${PROFILE.email}`}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-5 py-2.5 text-sm text-slate-800 transition hover:bg-slate-100"
          >
            <Mail size={15} />
            {PROFILE.email}
          </a>
          <div className="mt-2 font-mono text-[11px] tracking-widest text-slate-400">
            © {new Date().getFullYear()} · MADE WITH SPECTRUM
          </div>
        </div>
      </footer>

      <MusicPlayer />
    </main>
  );
}

// ============================================================
// 区块标题
// ============================================================
function SectionLabel({ n, title, en }: { n: string; title: string; en: string }) {
  return (
    <div className="flex items-end gap-4">
      <span className="bg-spectrum bg-clip-text font-mono text-5xl font-black text-transparent opacity-90">
        {n}
      </span>
      <div className="pb-1.5">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">{title}</h2>
        <div className="font-mono text-[11px] tracking-[0.3em] text-slate-500">{en}</div>
      </div>
    </div>
  );
}
