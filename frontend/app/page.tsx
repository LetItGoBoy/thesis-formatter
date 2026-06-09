"use client";

/**
 * 个人作品集主页
 * frontend/app/page.tsx
 *
 * 主题：高光谱（可见光谱分光）——深空底色 + 光谱渐变 + 扫描线/辉光的电影感 HUD。
 * 板块：Hero（大背景图占位）→ 关于我 → 在研项目 → 作品 → 课程资料 → 页脚。
 *
 * ⚙️ 个人信息集中在下面的 PROFILE / RESEARCH / WORKS / TEACHING，改这里即可。
 * 🖼️ 大背景图：把图片放到 /public/images/hero-bg.png 自动生效；未放则显示光谱星云渐变占位。
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
} from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { MusicPlayer } from "@/components/MusicPlayer";
import { useAuthStore } from "@/lib/auth-store";

// ============================================================
// 个人信息（改这里）
// ============================================================
const PROFILE = {
  name: "你的名字", // ← 改成你的真名
  enName: "YOUR NAME",
  title: "高校教师 · AI 研究者",
  field: "高光谱图像 / 深度学习",
  // Hero 一句话主张
  tagline: "在像素背后，每一束光都藏着一条光谱。",
  intro:
    "我是一名高校教师，研究方向是高光谱图像与深度学习——让机器看见人眼看不见的光谱维度。课余沉迷电影与动漫，也喜欢把课程做成能玩的东西。这里收集我的研究、作品与课程资料。",
  tags: ["高光谱成像", "深度学习", "遥感 / 图像分类", "高校教学", "电影 & 动漫"],
  email: "you@example.edu.cn", // ← 改成你的邮箱
};

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
    <main className="relative min-h-screen overflow-x-hidden bg-[#06060c] text-slate-100 selection:bg-fuchsia-500/30">
      {/* ================= 顶栏 ================= */}
      <nav className="fixed inset-x-0 top-0 z-40 border-b border-white/5 bg-[#06060c]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <button onClick={() => scrollTo("top")} className="flex items-center gap-2.5">
            <LogoMark size={30} />
            <span className="text-sm font-semibold tracking-wide">{PROFILE.name}</span>
          </button>
          <div className="flex items-center gap-1 text-sm">
            {[
              { label: "关于", id: "about" },
              { label: "研究", id: "research" },
              { label: "作品", id: "works" },
              { label: "课程", id: "teaching" },
            ].map((n) => (
              <button
                key={n.id}
                onClick={() => scrollTo(n.id)}
                className="hidden rounded-md px-3 py-2 font-medium text-slate-400 transition hover:text-white sm:inline-flex"
              >
                {n.label}
              </button>
            ))}
            <button
              onClick={() => router.push(token ? "/dashboard" : "/login")}
              className="ml-1 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-slate-200 ring-1 ring-white/10 transition hover:bg-white/20"
            >
              {token ? "工作台" : "登录"}
            </button>
          </div>
        </div>
      </nav>

      {/* ================= HERO ================= */}
      <section id="top" className="relative flex min-h-screen items-center">
        {/* 背景：大图 + 光谱星云渐变兜底 + 扫描线 + 暗场遮罩 */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[#06060c]" />
          {/* 🖼️ 放 /public/images/hero-bg.png 即生效；未放时下面的光谱星云渐变作占位 */}
          <div className="absolute inset-0 bg-[url('/images/hero-bg.png')] bg-cover bg-center" />
          {/* 星云渐变：放图后调低，作为氛围增强 / 无图时的兜底 */}
          <div
            className="absolute inset-0 animate-huedrift opacity-35"
            style={{
              backgroundImage:
                "radial-gradient(60% 80% at 16% 24%, rgba(124,58,237,0.45), transparent 60%)," +
                "radial-gradient(50% 60% at 28% 88%, rgba(34,197,94,0.16), transparent 60%)",
            }}
          />
          {/* 光谱扫描线：缓缓下扫，呼应"逐波段成像" */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="animate-sweep bg-spectrum absolute inset-x-0 h-px opacity-60 blur-[1px]" />
          </div>
          <div className="absolute inset-0 scanlines opacity-40" />
          {/* 左侧压暗，保证标题文字在亮图上也清晰 */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#06060c] via-[#06060c]/55 to-transparent" />
          {/* 顶/底淡入，衔接导航与下一屏 */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#06060c]/40 via-transparent to-[#06060c]" />
        </div>

        <div className="relative mx-auto w-full max-w-6xl px-5 pt-24">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium tracking-[0.2em] text-slate-300 backdrop-blur">
            <span className="bg-spectrum h-2 w-2 rounded-full" />
            HYPERSPECTRAL · AI · RESEARCH
          </div>

          <h1 className="mt-7 text-6xl font-black leading-[0.95] tracking-tight md:text-8xl">
            <span className="text-spectrum animate-huedrift">{PROFILE.name}</span>
          </h1>
          <div className="mt-3 font-mono text-sm tracking-[0.35em] text-slate-500">{PROFILE.enName}</div>

          <p className="mt-6 max-w-2xl text-2xl font-light leading-snug text-slate-200 md:text-3xl">
            {PROFILE.tagline}
          </p>
          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-400">
            {PROFILE.title} · {PROFILE.field}
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <button
              onClick={() => scrollTo("works")}
              className="group inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-200"
            >
              看我的作品
              <ArrowRight size={16} className="transition group-hover:translate-x-0.5" />
            </button>
            <button
              onClick={() => scrollTo("research")}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-slate-100 backdrop-blur transition hover:bg-white/10"
            >
              <Microscope size={16} />
              在研项目
            </button>
          </div>

          <button
            onClick={() => scrollTo("about")}
            className="mt-16 inline-flex animate-float items-center gap-1.5 text-xs text-slate-500 transition hover:text-slate-300"
          >
            向下滚动 <ChevronDown size={14} />
          </button>
        </div>
      </section>

      {/* ================= 关于我 ================= */}
      <section id="about" className="relative border-t border-white/5 py-24">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 md:grid-cols-[1.4fr_1fr]">
          <div>
            <SectionLabel n="01" title="关于我" en="ABOUT" />
            <p className="mt-7 text-2xl font-light leading-relaxed text-slate-200">
              {PROFILE.intro}
            </p>
            <div className="mt-7 flex flex-wrap gap-2">
              {PROFILE.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-sm text-slate-300"
                >
                  {t}
                </span>
              ))}
            </div>
            <div className="mt-7 flex items-center gap-2 text-sm text-slate-400">
              <Film size={15} className="text-fuchsia-400" />
              片单与番剧，是我灵感的另一半。
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 self-start">
            {STATS.map((s) => (
              <div
                key={s.k}
                className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent p-5"
              >
                <div className="text-xs tracking-wide text-slate-500">{s.k}</div>
                <div className="mt-2 text-lg font-semibold text-white">{s.v}</div>
              </div>
            ))}
            {/* 光谱条装饰 */}
            <div className="col-span-2 mt-1 h-1.5 w-full rounded-full bg-spectrum opacity-80" />
          </div>
        </div>
      </section>

      {/* ================= 在研项目 ================= */}
      <section id="research" className="relative border-t border-white/5 py-24">
        <div className="mx-auto max-w-6xl px-5">
          <SectionLabel n="02" title="在研项目" en="RESEARCH" />
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {RESEARCH.map((r) => {
              const Icon = r.icon;
              return (
                <div
                  key={r.code}
                  className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-white/20 hover:bg-white/[0.06]"
                >
                  <div className="absolute right-5 top-5 font-mono text-[11px] tracking-widest text-slate-600">
                    {r.code}
                  </div>
                  <span className="inline-flex size-11 items-center justify-center rounded-xl bg-white/5 text-cyan-300 ring-1 ring-white/10">
                    <Icon size={20} />
                  </span>
                  <div className="mt-5 flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-white">{r.title}</h3>
                  </div>
                  <p className="mt-2.5 text-sm leading-6 text-slate-400">{r.desc}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                        r.status === "在研"
                          ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/20"
                          : "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/20"
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
        </div>
      </section>

      {/* ================= 作品 ================= */}
      <section id="works" className="relative border-t border-white/5 py-24">
        <div className="mx-auto max-w-6xl px-5">
          <SectionLabel n="03" title="作品" en="WORKS" />
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {WORKS.map((w) => {
              const Icon = w.icon;
              return (
                <div
                  key={w.title}
                  className={`group relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br ${w.accent} p-8 ring-1 ${w.ring} transition hover:-translate-y-1`}
                >
                  <div className="scanlines pointer-events-none absolute inset-0 opacity-40" />
                  <div className="relative">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-white/10 text-white ring-1 ring-white/15 backdrop-blur">
                        <Icon size={26} />
                      </span>
                      <span className="rounded-full bg-black/30 px-3 py-1 text-[11px] font-medium tracking-wide text-slate-200 ring-1 ring-white/10">
                        {w.kind}
                      </span>
                    </div>
                    <h3 className="mt-6 text-3xl font-bold text-white">{w.title}</h3>
                    <div className="mt-1 font-mono text-xs tracking-[0.25em] text-slate-300/70">
                      {w.en}
                    </div>
                    <p className="mt-4 text-sm leading-7 text-slate-200/90">{w.desc}</p>
                    <div className="mt-7 flex flex-wrap gap-3">
                      {w.links.map((l) => (
                        <button
                          key={l.href}
                          onClick={() => router.push(l.href)}
                          className={`inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                            l.primary
                              ? "bg-white text-slate-900 hover:bg-slate-200"
                              : "border border-white/20 bg-white/5 text-slate-100 hover:bg-white/10"
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
      <section id="teaching" className="relative border-t border-white/5 py-24">
        <div className="mx-auto max-w-6xl px-5">
          <SectionLabel n="04" title="课程资料" en="TEACHING" />
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {TEACHING.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.href}
                  onClick={() => router.push(t.href)}
                  className="group flex items-center gap-5 rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-left transition hover:border-white/20 hover:bg-white/[0.06]"
                >
                  <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/5 text-amber-300 ring-1 ring-white/10">
                    <Icon size={22} />
                  </span>
                  <div className="flex-1">
                    <div className="font-semibold text-white">{t.title}</div>
                    <div className="mt-1 text-sm text-slate-400">{t.desc}</div>
                  </div>
                  <ArrowRight size={18} className="text-slate-500 transition group-hover:translate-x-1 group-hover:text-white" />
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================= 页脚 ================= */}
      <footer className="relative border-t border-white/5 py-14">
        <div className="bg-spectrum absolute inset-x-0 top-0 h-px opacity-60" />
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-5 text-center">
          <div className="flex items-center gap-2.5">
            <LogoMark size={28} />
            <span className="text-sm font-semibold">{PROFILE.name}</span>
          </div>
          <p className="max-w-md text-sm leading-6 text-slate-500">
            <Sparkles size={13} className="mb-0.5 mr-1 inline text-fuchsia-400" />
            {PROFILE.title} · 专注高光谱图像与 AI · 也爱电影与动漫
          </p>
          <a
            href={`mailto:${PROFILE.email}`}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm text-slate-200 transition hover:bg-white/10"
          >
            <Mail size={15} />
            {PROFILE.email}
          </a>
          <div className="mt-2 font-mono text-[11px] tracking-widest text-slate-600">
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
        <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">{title}</h2>
        <div className="font-mono text-[11px] tracking-[0.3em] text-slate-500">{en}</div>
      </div>
    </div>
  );
}
