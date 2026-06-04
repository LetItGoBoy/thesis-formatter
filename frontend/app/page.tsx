"use client";

import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  LogIn,
  LogOut,
  Sparkles,
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
};

const toolProducts: ToolProduct[] = [
  {
    title: "提交前体检",
    badge: "规划中",
    desc: "先识别结构、摘要、关键词与规范风险，明确修改优先级。",
    href: "/tools",
    icon: ClipboardCheck,
    image: "/images/paper-precheck.png",
  },
  {
    title: "AI 表达优化",
    badge: "规划中",
    desc: "降低模板化表达和空泛语气，让文字回到自然、具体、学术的状态。",
    href: "/tools",
    icon: CheckCircle2,
    image: "/images/paper-ai-expression.png",
  },
  {
    title: "格式对齐",
    badge: "已开放",
    desc: "最后统一版式、段落、目录与导出规则，完成规范化收尾。",
    href: "/tools",
    icon: FileText,
    image: "/images/paper-format-align.png",
  },
];

export default function HomePage() {
  const router = useRouter();
  const { token, phone, logout } = useAuthStore();

  function goCourseWorkspace() {
    router.push(token ? "/dashboard" : "/login");
  }

  return (
    <main className="min-h-screen bg-[#f5f5f7] text-slate-950">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => router.push("/tools")}
            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
          >
            论文工具
          </button>
          <button
            type="button"
            onClick={goCourseWorkspace}
            className="hidden rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-black/5 transition hover:text-blue-600 sm:inline-flex"
          >
            课程工作台
          </button>
          {token ? (
            <>
              <span className="hidden text-sm text-slate-500 md:inline">{phone ? maskPhone(phone) : "已登录"}</span>
              <button
                type="button"
                onClick={() => logout()}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-black/5 transition hover:text-red-500"
                aria-label="退出登录"
              >
                <LogOut size={17} />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => router.push("/login")}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-black/5 transition hover:text-blue-600"
            >
              <LogIn size={16} />
              登录
            </button>
          )}
        </div>
      </nav>

      <section className="mx-auto max-w-6xl px-5 pb-12 pt-12 text-center md:pb-16 md:pt-20">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm ring-1 ring-black/5">
          <Sparkles size={16} className="text-blue-500" />
          Academic Tool Suite
        </div>
        <h1 className="mx-auto mt-7 max-w-4xl text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">
          从内容检查到格式规范，
          <span className="block text-slate-500">一站式论文交付工具。</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-slate-500 md:text-lg">
          面向本科论文提交前的关键环节，先发现问题，再优化表达，最后完成格式对齐。
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/tools")}
            className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700"
          >
            进入论文工具
            <ArrowRight size={17} />
          </button>
          <button
            type="button"
            onClick={goCourseWorkspace}
            className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-800 shadow-sm ring-1 ring-black/5 transition hover:text-blue-600"
          >
            <LayoutDashboard size={17} />
            课程工作台
          </button>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-600">Product Line</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">提交前的三步质量闭环</h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-slate-500">
            体检、表达优化、格式对齐按顺序完成，避免最后阶段反复返工。
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {toolProducts.map((product) => {
            const Icon = product.icon;
            return (
              <button
                key={product.title}
                type="button"
                onClick={() => router.push(product.href)}
                className="group overflow-hidden rounded-[1.75rem] bg-white text-left shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-xl"
              >
                <div className="flex h-56 items-center justify-center bg-slate-50 p-3">
                  <img
                    src={product.image}
                    alt={`${product.title}示意图`}
                    className="h-full w-full rounded-[1.25rem] object-contain"
                  />
                </div>
                <div className="p-7 pt-5">
                  <div className="flex items-center justify-between gap-4">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
                      <Icon size={21} />
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-500">
                      {product.badge}
                    </span>
                  </div>
                  <h3 className="mt-6 text-2xl font-semibold tracking-tight">{product.title}</h3>
                  <p className="mt-3 text-base leading-7 text-slate-500">{product.desc}</p>
                  <span className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-blue-600">
                    查看工具
                    <ArrowRight size={16} className="transition group-hover:translate-x-0.5" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="rounded-[2rem] bg-white p-7 shadow-sm ring-1 ring-black/5 md:flex md:items-center md:justify-between md:p-9">
          <div>
            <p className="text-sm font-semibold text-emerald-600">Course Studio</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">把课程学习设计成一条可抵达的路径。</h2>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-500">
              以数据结构、数据库原理为起点，将资料、训练、项目和学习反馈沉淀到同一个课程空间。
            </p>
          </div>
          <button
            type="button"
            onClick={goCourseWorkspace}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 md:mt-0"
          >
            <BookOpen size={17} />
            进入课程工作台
          </button>
        </div>
      </section>

      <footer className="pb-8 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} 同乐科技 · TONGLE TECH
      </footer>
      <MusicPlayer />
    </main>
  );
}
