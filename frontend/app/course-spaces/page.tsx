"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Code2,
  Database,
  FileText,
  FolderOpen,
  Lock,
  PlayCircle,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { useAuthStore } from "@/lib/auth-store";

const courses = [
  {
    title: "数据结构",
    subtitle: "当前重点课程",
    desc: "霓虹栈城有声小说、关卡测试、技能状态卡和章节地图会优先在这里接入。",
    icon: BookOpen,
    modules: ["飞书听书", "闯关地图", "状态卡", "章节测试"],
    href: "/quest/data-structure",
  },
  {
    title: "数据库原理",
    subtitle: "当前重点课程",
    desc: "围绕 ER 模型、关系模型、SQL、规范化、事务与索引，整理案例、项目练习和复习资料。",
    icon: Database,
    modules: ["课程讲义", "SQL 练习", "推荐视频", "项目案例"],
    href: "",
  },
];

const spaceFeatures = [
  { title: "课程资料", desc: "课件、重点笔记、实验要求和复习提纲。", icon: FolderOpen },
  { title: "推荐视频", desc: "按章节筛选适合学生补基础的视频资源。", icon: PlayCircle },
  { title: "练习与代码", desc: "配套题目、示例代码和常见错误提醒。", icon: Code2 },
  { title: "延伸服务", desc: "后续接入答疑、作业辅导、项目训练和就业技能路径。", icon: FileText },
];

export default function CourseSpacesPage() {
  const router = useRouter();
  const { token } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !token) router.replace("/login");
  }, [mounted, router, token]);

  if (!mounted || !token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f5f7] text-sm text-slate-500">
        正在进入课程空间...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f5f7] text-slate-950">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-black/5 transition hover:text-blue-600"
        >
          <ArrowLeft size={16} />
          返回工作台
        </button>
      </nav>

      <section className="mx-auto max-w-6xl px-5 pb-10 pt-8">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold text-blue-600">课程空间</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
            每门课都应该有一个能持续沉淀的学习空间。
          </h1>
          <p className="mt-5 text-base leading-8 text-slate-500">
            这里先放数据结构和数据库原理。后面可以把每门课的资料、推荐视频、练习、项目和增值服务都接进来。
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-5 pb-10 md:grid-cols-2">
        {courses.map((course) => {
          const Icon = course.icon;
          return (
            <article key={course.title} className="rounded-[2rem] bg-white p-7 shadow-sm ring-1 ring-black/5">
              <div className="flex items-start justify-between gap-4">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
                  <Icon size={22} />
                </span>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
                  {course.subtitle}
                </span>
              </div>
              <h2 className="mt-8 text-3xl font-semibold tracking-tight">{course.title}</h2>
              <p className="mt-3 text-base leading-7 text-slate-500">{course.desc}</p>
              <div className="mt-6 flex flex-wrap gap-2">
                {course.modules.map((module) => (
                  <span key={module} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
                    {module}
                  </span>
                ))}
              </div>
              {course.href && (
                <button
                  type="button"
                  onClick={() => router.push(course.href)}
                  className="mt-6 rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  进入闯关地图
                </button>
              )}
            </article>
          );
        })}
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="grid gap-4 md:grid-cols-4">
          {spaceFeatures.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="rounded-[1.5rem] bg-white/75 p-6 shadow-sm ring-1 ring-black/5">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm ring-1 ring-black/5">
                  <Icon size={20} />
                </span>
                <h3 className="mt-5 text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{feature.desc}</p>
              </div>
            );
          })}
        </div>
        <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm text-slate-500 shadow-sm ring-1 ring-black/5">
          <Lock size={15} />
          课程空间内容登录后逐步开放
        </div>
      </section>
    </main>
  );
}
