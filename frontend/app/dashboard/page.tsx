"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Database,
  FolderOpen,
  GraduationCap,
  Home,
  Lock,
  LogOut,
  Radar,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { maskPhone, useAuthStore } from "@/lib/auth-store";

type Feature = {
  title: string;
  eyebrow: string;
  desc: string;
  status: "ready" | "soon";
  href?: string;
  icon: typeof BookOpen;
  accent: string;
};

const heroFeatures: Feature[] = [
  {
    title: "专业课程体系",
    eyebrow: "已开放",
    desc: "查看四个专业的课程递进、岗位能力和考研路线。",
    status: "ready",
    href: "/curriculum",
    icon: BookOpen,
    accent: "from-emerald-500 to-teal-400",
  },
  {
    title: "课程资料空间",
    eyebrow: "建设中",
    desc: "先从数据结构和数据库原理开始，沉淀资料、视频、练习和延伸服务。",
    status: "ready",
    href: "/course-spaces",
    icon: FolderOpen,
    accent: "from-violet-500 to-indigo-400",
  },
  {
    title: "闯关升级",
    eyebrow: "规划中",
    desc: "按课程章节设置关卡，答题过关并逐步积累最终项目能力。",
    status: "soon",
    icon: ClipboardList,
    accent: "from-orange-500 to-amber-400",
  },
];

const futureFeatures: Feature[] = [
  {
    title: "数据结构关卡",
    eyebrow: "规划中",
    desc: "线性表、栈队列、树、图、查找排序逐关推进，最终完成综合项目。",
    status: "soon",
    icon: Radar,
    accent: "from-blue-500 to-cyan-400",
  },
  {
    title: "数据库原理关卡",
    eyebrow: "规划中",
    desc: "ER 建模、SQL、规范化、事务索引逐关训练，最终完成数据库项目。",
    status: "soon",
    icon: Database,
    accent: "from-emerald-500 to-teal-400",
  },
  {
    title: "学习后台数据",
    eyebrow: "规划中",
    desc: "查看学生进度、答题正确率、卡点知识点和最终项目完成情况。",
    status: "soon",
    icon: ClipboardList,
    accent: "from-rose-400 to-pink-300",
  },
  {
    title: "课程能力档案",
    eyebrow: "规划中",
    desc: "把每次闯关、练习、项目提交沉淀成学生自己的课程能力记录。",
    status: "soon",
    icon: GraduationCap,
    accent: "from-violet-500 to-fuchsia-400",
  },
];

function FeatureCard({ feature, large = false }: { feature: Feature; large?: boolean }) {
  const router = useRouter();
  const Icon = feature.icon;
  const ready = feature.status === "ready";

  return (
    <button
      type="button"
      disabled={!ready}
      onClick={() => feature.href && router.push(feature.href)}
      className={`group relative overflow-hidden rounded-[2rem] bg-white text-left shadow-sm ring-1 ring-black/5 transition ${
        large ? "min-h-[15rem] p-7 md:p-8" : "min-h-[13rem] p-6"
      } ${ready ? "hover:-translate-y-1 hover:shadow-2xl hover:shadow-slate-200" : "cursor-default"}`}
    >
      <div
        className={`absolute -right-16 -top-16 h-44 w-44 rounded-full bg-gradient-to-br ${feature.accent} opacity-15 blur-2xl`}
      />
      <div className="relative z-10 flex h-full flex-col">
        <div className="flex items-center justify-between">
          <span
            className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${feature.accent} text-white shadow-lg shadow-slate-200`}
          >
            <Icon size={22} />
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-500">
            {ready ? <CheckCircle2 size={14} /> : <Lock size={14} />}
            {feature.eyebrow}
          </span>
        </div>

        <div className="mt-auto pt-8">
          <h2 className={`${large ? "text-3xl md:text-4xl" : "text-xl"} font-semibold tracking-tight text-slate-950`}>
            {feature.title}
          </h2>
          <p className="mt-3 max-w-md text-base leading-7 text-slate-500">{feature.desc}</p>
          {ready && (
            <span className="mt-5 inline-flex items-center gap-1 text-base font-semibold text-blue-600">
              进入
              <ArrowRight size={17} className="transition group-hover:translate-x-0.5" />
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { token, phone, logout } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !token) router.replace("/login");
  }, [mounted, router, token]);

  if (!mounted || !token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f5f7] text-base text-slate-500">
        正在进入工作台...
      </main>
    );
  }

  function handleLogout() {
    logout();
    router.replace("/");
  }

  return (
    <main className="min-h-screen bg-[#f5f5f7] text-slate-950">
      <nav className="sticky top-0 z-30 border-b border-black/5 bg-[#f5f5f7]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Logo />
          <div className="flex items-center gap-3">
            <span className="hidden text-sm font-medium text-slate-500 sm:inline">
              {phone ? maskPhone(phone) : "已登录"}
            </span>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm ring-1 ring-black/5 transition hover:text-blue-600"
              aria-label="返回首页"
            >
              <Home size={18} />
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm ring-1 ring-black/5 transition hover:text-red-500"
              aria-label="退出登录"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </nav>

      <section className="mx-auto max-w-6xl px-5 pb-10 pt-10 text-center md:pt-14">
        <p className="text-sm font-semibold text-blue-600">同乐科技学生工作台</p>
        <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl">
          本人课程相关内容，都在这里继续。
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-slate-500">
          课程资料、推荐视频、闯关升级、最终项目和学习数据后台会集中放在课程工作台。
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-5 text-base font-semibold">
          <button type="button" onClick={() => router.push("/curriculum")} className="text-blue-600 hover:underline">
            查看课程体系
          </button>
          <button type="button" onClick={() => router.push("/course-spaces")} className="text-blue-600 hover:underline">
            进入课程空间
          </button>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-5 px-5 pb-5 md:grid-cols-3">
        {heroFeatures.map((feature) => (
          <FeatureCard key={feature.title} feature={feature} large />
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20 pt-6">
        <div className="mb-5 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">后续课程模块</h2>
          <p className="mt-3 text-base text-slate-500">围绕数据结构、数据库原理先搭建闯关、项目和后台数据能力。</p>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {futureFeatures.map((feature) => (
            <FeatureCard key={feature.title} feature={feature} />
          ))}
        </div>
      </section>
    </main>
  );
}
