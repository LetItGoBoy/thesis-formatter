"use client";

import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Languages,
  LayoutDashboard,
  LogIn,
  LogOut,
  MousePointerClick,
  ShieldCheck,
  Sparkles,
  Table2,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { MusicPlayer } from "@/components/MusicPlayer";
import { maskPhone, useAuthStore } from "@/lib/auth-store";

type ToolProduct = {
  title: string;
  badge: string;
  desc: string;
  href: string;
  icon: typeof FileText;
  image: string;
  glow: string; // 卡片光晕 + 描边主色
  chip: string; // 图标底色
};

const toolProducts: ToolProduct[] = [
  {
    title: "提交前体检",
    badge: "规划中",
    desc: "上传后先识别结构、摘要、关键词与规范风险，明确修改优先级。",
    href: "/tools",
    icon: ClipboardCheck,
    image: "/images/paper-precheck.png",
    glow: "from-amber-400/30 to-orange-500/10 group-hover:ring-amber-400/60",
    chip: "bg-gradient-to-br from-amber-400 to-orange-500",
  },
  {
    title: "AI 表达优化",
    badge: "已开放",
    desc: "像在线文档一样选中任意文字，做学术润色、压缩、扩写与逻辑优化。",
    href: "/polish",
    icon: CheckCircle2,
    image: "/images/paper-ai-expression.png",
    glow: "from-cyan-400/30 to-sky-500/10 group-hover:ring-cyan-400/60",
    chip: "bg-gradient-to-br from-cyan-400 to-sky-500",
  },
  {
    title: "格式对齐",
    badge: "已开放",
    desc: "统一版式、段落、目录与导出规则，中英混排、三线表一键规范。",
    href: "/tools",
    icon: FileText,
    image: "/images/paper-format-align.png",
    glow: "from-violet-400/30 to-indigo-500/10 group-hover:ring-violet-400/60",
    chip: "bg-gradient-to-br from-violet-400 to-indigo-500",
  },
];

const features = [
  { icon: MousePointerClick, title: "逐段可控", desc: "选中即改，接受/还原随时可逆" },
  { icon: Languages, title: "中英混排", desc: "数字与英文自动 Times New Roman" },
  { icon: Table2, title: "三线表规范", desc: "上下 1.5 磅、中间 1 磅自动重建" },
  { icon: ShieldCheck, title: "数据不留存", desc: "文件仅用于本次处理，不长期保存" },
];

export default function HomePage() {
  const router = useRouter();
  const { token, phone, logout } = useAuthStore();

  function goCourseWorkspace() {
    router.push(token ? "/dashboard" : "/login");
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#070b16] text-slate-100">
      {/* 背景光晕 */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-sky-500/20 blur-[140px]" />
        <div className="absolute -top-20 right-[-10rem] h-[28rem] w-[28rem] rounded-full bg-amber-500/15 blur-[130px]" />
        <div className="absolute top-[40rem] left-[-12rem] h-[30rem] w-[30rem] rounded-full bg-indigo-600/15 blur-[140px]" />
        <div
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.06) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(ellipse 80% 50% at 50% 0%, black 40%, transparent 100%)",
          }}
        />
      </div>

      {/* 顶栏 */}
      <nav className="sticky top-0 z-30 border-b border-white/10 bg-[#070b16]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Logo dark />
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => router.push("/tools")}
              className="rounded-full bg-gradient-to-r from-sky-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-500/25 transition hover:brightness-110"
            >
              论文工具
            </button>
            <button
              type="button"
              onClick={goCourseWorkspace}
              className="hidden rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10 sm:inline-flex"
            >
              课程工作台
            </button>
            {token ? (
              <>
                <span className="hidden text-sm text-slate-400 md:inline">
                  {phone ? maskPhone(phone) : "已登录"}
                </span>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-slate-300 transition hover:text-red-400"
                  aria-label="退出登录"
                >
                  <LogOut size={17} />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10"
              >
                <LogIn size={16} />
                登录
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-5xl px-5 pb-20 pt-20 text-center md:pt-28">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm font-medium text-slate-300 backdrop-blur">
          <Sparkles size={15} className="text-amber-400" />
          论文一站式辅助 · Academic Tool Suite
        </div>
        <h1 className="mx-auto mt-8 max-w-4xl text-4xl font-extrabold leading-[1.1] tracking-tight md:text-6xl">
          从内容检查到格式规范，
          <span className="mt-2 block bg-gradient-to-r from-sky-400 via-cyan-300 to-amber-300 bg-clip-text text-transparent">
            一站式完成论文交付。
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-slate-300 md:text-lg">
          面向本科论文提交前的关键环节：先发现问题，再优化表达，最后完成格式对齐。
          全程逐段可控、可逆，导出标准 Word。
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/tools")}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-sky-500 to-cyan-500 px-7 py-3.5 text-sm font-semibold text-white shadow-xl shadow-sky-500/30 transition hover:brightness-110"
          >
            进入论文工具
            <ArrowRight size={17} />
          </button>
          <button
            type="button"
            onClick={goCourseWorkspace}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-7 py-3.5 text-sm font-semibold text-slate-100 backdrop-blur transition hover:bg-white/10"
          >
            <LayoutDashboard size={17} />
            课程工作台
          </button>
        </div>

        {/* 信任条 */}
        <div className="mx-auto mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-slate-400">
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 size={15} className="text-emerald-400" /> 呼伦贝尔学院本科论文标准
          </span>
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 size={15} className="text-emerald-400" /> 上传不长期保存
          </span>
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 size={15} className="text-emerald-400" /> 导出标准 .docx
          </span>
        </div>
      </section>

      {/* 工具卡片 */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 pb-24">
        <div className="mb-8 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-cyan-400">Our Tools</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">提交前的三步质量闭环</h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-slate-400">
            体检、表达优化、格式对齐按顺序完成，避免最后阶段反复返工。
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {toolProducts.map((product) => {
            const Icon = product.icon;
            const open = product.badge === "已开放";
            return (
              <button
                key={product.title}
                type="button"
                onClick={() => router.push(product.href)}
                className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-2 text-left ring-1 ring-transparent backdrop-blur transition hover:-translate-y-1 hover:bg-white/[0.06]"
              >
                {/* 顶部图片 + 光晕 */}
                <div className="relative overflow-hidden rounded-2xl">
                  <div
                    className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${product.glow} opacity-80`}
                  />
                  <div className="relative flex h-48 items-center justify-center p-4">
                    <img
                      src={product.image}
                      alt={`${product.title}示意图`}
                      className="h-full w-full rounded-xl bg-white/90 object-contain p-2 shadow-2xl"
                    />
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-lg ${product.chip}`}
                    >
                      <Icon size={20} />
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        open
                          ? "bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30"
                          : "bg-white/5 text-slate-400 ring-1 ring-white/10"
                      }`}
                    >
                      {product.badge}
                    </span>
                  </div>
                  <h3 className="mt-5 text-xl font-bold tracking-tight text-white">{product.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{product.desc}</p>
                  <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-cyan-300">
                    {open ? "立即使用" : "查看详情"}
                    <ArrowRight size={15} className="transition group-hover:translate-x-0.5" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 特性条 */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 pb-24">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur transition hover:border-white/20"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500/30 to-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400/30">
                  <Icon size={18} />
                </span>
                <div className="mt-4 text-base font-semibold text-white">{f.title}</div>
                <p className="mt-1 text-sm leading-6 text-slate-400">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 课程工作台 CTA */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 pb-24">
        <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-indigo-600/30 via-sky-600/20 to-amber-500/20 p-8 backdrop-blur md:flex md:items-center md:justify-between md:p-10">
          <div className="pointer-events-none absolute -right-10 -top-10 h-60 w-60 rounded-full bg-amber-400/20 blur-3xl" />
          <div className="relative">
            <p className="text-sm font-semibold text-amber-300">Course Studio</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-white md:text-3xl">
              把课程学习设计成一条可抵达的路径。
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
              以数据结构、数据库原理为起点，将资料、训练、项目和学习反馈沉淀到同一个课程空间。
            </p>
          </div>
          <button
            type="button"
            onClick={goCourseWorkspace}
            className="relative mt-6 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-slate-900 shadow-xl transition hover:brightness-95 md:mt-0"
          >
            <BookOpen size={17} />
            进入课程工作台
          </button>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/10 py-8 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} 同乐科技 · TONGLE TECH · 论文一站式辅助
      </footer>
      <MusicPlayer />
    </main>
  );
}
