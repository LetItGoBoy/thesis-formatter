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
} from "lucide-react";
import { Logo, LogoMark } from "@/components/Logo";
import { MusicPlayer } from "@/components/MusicPlayer";
import { maskPhone, useAuthStore } from "@/lib/auth-store";

type Tool = {
  title: string;
  badge: string;
  desc: string;
  href: string;
  icon: typeof FileText;
};

const tools: Tool[] = [
  {
    title: "提交前体检",
    badge: "原型",
    desc: "上传后先识别结构、摘要、关键词与规范风险，明确修改优先级，避免最后阶段反复返工。",
    href: "/checkup",
    icon: ClipboardCheck,
  },
  {
    title: "AI 表达优化",
    badge: "已开放",
    desc: "像在线文档一样选中任意文字，做学术润色、压缩、扩写与逻辑优化，逐段确认后导出。",
    href: "/polish",
    icon: CheckCircle2,
  },
  {
    title: "格式对齐",
    badge: "已开放",
    desc: "统一版式、段落、目录与导出规则，中英混排、三线表、分页一键规范化收尾。",
    href: "/tools",
    icon: FileText,
  },
];

type FeatureRow = {
  eyebrow: string;
  title: string;
  highlight: string;
  desc: string;
  image: string;
  cta: { label: string; href: string };
  flip?: boolean;
};

const featureRows: FeatureRow[] = [
  {
    eyebrow: "AI 表达优化",
    title: "像在线文档一样，",
    highlight: "选中即改。",
    desc: "全文按原顺序呈现，用鼠标选中任意一段或几句，即可进行学术润色、压缩精简、适当扩写与逻辑优化。改写结果先确认、可还原，绝不擅自替换。",
    image: "/images/tool-polish.svg",
    cta: { label: "开始润色", href: "/polish" },
  },
  {
    eyebrow: "格式对齐",
    title: "一次对齐，",
    highlight: "全文规范。",
    desc: "依托呼伦贝尔学院本科论文标准，自动处理中英文混排、三线表、首行缩进、目录与分页，导出可直接提交的标准 Word。",
    image: "/images/tool-format.svg",
    cta: { label: "查看格式工具", href: "/tools" },
    flip: true,
  },
  {
    eyebrow: "提交前体检",
    title: "先发现问题，",
    highlight: "再动手修改。",
    desc: "在动笔修改前，先识别结构完整性、摘要与关键词、图表与引用规范等常见风险，给出一份清晰的修改优先级清单。",
    image: "/images/tool-checkup.svg",
    cta: { label: "开始体检", href: "/checkup" },
  },
];

export default function HomePage() {
  const router = useRouter();
  const { token, phone, logout } = useAuthStore();

  function goCourseWorkspace() {
    router.push(token ? "/dashboard" : "/login");
  }

  return (
    <main className="min-h-screen bg-white text-slate-900">
      {/* 顶栏 */}
      <nav className="sticky top-0 z-30 border-b border-slate-100 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <Logo />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/tools")}
              className="hidden rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition hover:text-blue-600 sm:inline-flex"
            >
              论文工具
            </button>
            <button
              type="button"
              onClick={goCourseWorkspace}
              className="hidden rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition hover:text-blue-600 sm:inline-flex"
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
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-400 transition hover:text-red-500"
                  aria-label="退出登录"
                >
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition hover:text-blue-600"
              >
                <LogIn size={16} />
                登录
              </button>
            )}
            <button
              type="button"
              onClick={() => router.push("/tools")}
              className="ml-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              开始使用
            </button>
          </div>
        </div>
      </nav>

      {/* Hero：左文右产品 */}
      <section className="border-b border-slate-100 bg-gradient-to-b from-slate-50/60 to-white">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 md:py-24 lg:grid-cols-2">
          <div>
            <h1 className="text-4xl font-extrabold leading-[1.12] tracking-tight md:text-5xl">
              更聪明的论文工具。
              <span className="mt-1 block text-blue-600">为规范交付而生。</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-600">
              从提交前体检到表达优化，再到格式对齐，覆盖本科论文交付的关键环节。
              逐段可控、可逆，最终导出可直接提交的标准 Word。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => router.push("/tools")}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                进入论文工具
                <ArrowRight size={16} />
              </button>
              <button
                type="button"
                onClick={goCourseWorkspace}
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
              >
                <LayoutDashboard size={16} />
                课程工作台
              </button>
            </div>
          </div>

          {/* 实拍：手持红笔批改论文 */}
          <HeroPhoto />
        </div>
      </section>

      {/* 三个工具卡片 */}
      <section className="border-b border-slate-100">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
            提交前，给论文一个<span className="text-blue-600">完整闭环。</span>
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
            体检、表达优化、格式对齐三步衔接，按顺序完成，少走弯路。
          </p>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {tools.map((t) => {
              const Icon = t.icon;
              const open = t.badge === "已开放";
              return (
                <button
                  key={t.title}
                  type="button"
                  onClick={() => router.push(t.href)}
                  className="group rounded-xl border border-slate-200 bg-white p-6 text-left transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-slate-900 text-white">
                      <Icon size={20} />
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        open ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {t.badge}
                    </span>
                  </div>
                  <h3 className="mt-5 text-lg font-bold tracking-tight">{t.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{t.desc}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-blue-600">
                    {open ? "立即使用" : "查看详情"}
                    <ArrowRight size={15} className="transition group-hover:translate-x-0.5" />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* 交替特性行 */}
      {featureRows.map((row, i) => (
        <section key={row.title} className={i % 2 === 1 ? "bg-slate-50" : "bg-white"}>
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 lg:grid-cols-2 lg:py-20">
            <div className={row.flip ? "lg:order-2" : ""}>
              <p className="text-sm font-semibold text-blue-600">{row.eyebrow}</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">
                {row.title}
                <span className="text-blue-600">{row.highlight}</span>
              </h2>
              <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">{row.desc}</p>
              <button
                type="button"
                onClick={() => router.push(row.cta.href)}
                className="mt-6 inline-flex items-center gap-2 rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                {row.cta.label}
                <ArrowRight size={15} />
              </button>
            </div>
            <div className={row.flip ? "lg:order-1" : ""}>
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <img src={row.image} alt={row.eyebrow} className="h-full w-full object-cover" />
              </div>
            </div>
          </div>
        </section>
      ))}

      {/* 课程工作台 CTA */}
      <section className="border-t border-slate-100 bg-white">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <div className="rounded-2xl bg-slate-900 p-8 md:flex md:items-center md:justify-between md:p-10">
            <div>
              <p className="text-sm font-semibold text-blue-400">Course Studio</p>
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
              className="mt-6 inline-flex items-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 md:mt-0"
            >
              <BookOpen size={16} />
              进入课程工作台
            </button>
          </div>
        </div>
      </section>

      {/* 深色页脚 */}
      <footer className="bg-slate-950 text-slate-400">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:grid-cols-2 md:grid-cols-4">
          <div className="sm:col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5">
              <LogoMark size={32} />
              <span className="text-base font-bold text-white">同乐科技</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              论文一站式辅助 · 提交前体检 · 表达优化 · 格式对齐
            </p>
          </div>
          <FooterCol
            title="论文工具"
            links={[
              { label: "提交前体检", href: "/checkup" },
              { label: "AI 表达优化", href: "/polish" },
              { label: "格式对齐", href: "/tools" },
            ]}
            onNav={(h) => router.push(h)}
          />
          <FooterCol
            title="课程空间"
            links={[
              { label: "课程工作台", href: token ? "/dashboard" : "/login" },
              { label: "课程列表", href: "/curriculum" },
            ]}
            onNav={(h) => router.push(h)}
          />
          <FooterCol
            title="账户"
            links={[
              { label: token ? "我的工作台" : "登录 / 注册", href: token ? "/dashboard" : "/login" },
              { label: "论文工具", href: "/tools" },
            ]}
            onNav={(h) => router.push(h)}
          />
        </div>
        <div className="border-t border-white/10 py-6 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} 同乐科技 · TONGLE TECH · 论文一站式辅助
        </div>
      </footer>
      <MusicPlayer />
    </main>
  );
}

function FooterCol({
  title,
  links,
  onNav,
}: {
  title: string;
  links: { label: string; href: string }[];
  onNav: (href: string) => void;
}) {
  return (
    <div>
      <div className="text-sm font-semibold text-white">{title}</div>
      <ul className="mt-3 space-y-2">
        {links.map((l) => (
          <li key={l.label}>
            <button
              type="button"
              onClick={() => onNav(l.href)}
              className="text-sm text-slate-400 transition hover:text-white"
            >
              {l.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Hero 右侧：模拟「论文表达润色」编辑器的产品截图 */
function HeroPhoto() {
  return (
    <div className="relative">
      <div className="overflow-hidden rounded-2xl shadow-2xl shadow-slate-300/50 ring-1 ring-slate-200">
        <img
          src="/images/hero-editing.jpg"
          alt="手持红笔批改论文"
          className="block w-full object-cover"
          style={{ aspectRatio: "4/3" }}
        />
      </div>
      {/* 装饰光斑 */}
      <div className="pointer-events-none absolute -right-6 -top-6 -z-10 h-40 w-40 rounded-full bg-blue-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-6 -left-6 -z-10 h-40 w-40 rounded-full bg-amber-200/40 blur-3xl" />
    </div>
  );
}
