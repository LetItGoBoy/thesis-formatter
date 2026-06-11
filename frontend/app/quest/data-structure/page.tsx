"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Circle,
  Lock,
  Map,
  Radio,
  RotateCcw,
  Shield,
  Sparkles,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { dataStructureQuest } from "@/lib/quest-data";

export default function DataStructureQuestPage() {
  const router = useRouter();
  const openChapter = dataStructureQuest.chapters[0];
  const [activeLevelId, setActiveLevelId] = useState(openChapter.levels[0]?.id ?? "");
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const activeLevel = useMemo(
    () => openChapter.levels.find((level) => level.id === activeLevelId) ?? openChapter.levels[0],
    [activeLevelId, openChapter.levels]
  );

  const activeQuestions = activeLevel?.questions ?? [];
  const answeredCount = activeQuestions.filter((question) => answers[question.id]).length;
  const correctCount = activeQuestions.filter((question) => answers[question.id] === question.answer).length;
  const completed = answeredCount === activeQuestions.length && activeQuestions.length > 0;

  function chooseAnswer(questionId: string, choiceId: string) {
    setAnswers((current) => ({ ...current, [questionId]: choiceId }));
  }

  function resetActiveLevel() {
    setAnswers((current) => {
      const next = { ...current };
      activeQuestions.forEach((question) => {
        delete next[question.id];
      });
      return next;
    });
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] text-slate-950">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <button
          type="button"
          onClick={() => router.push("/course-spaces")}
          className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm ring-1 ring-slate-200 transition hover:text-blue-600"
        >
          <ArrowLeft size={16} />
          返回课程空间
        </button>
      </nav>

      <section className="mx-auto max-w-6xl px-5 pb-8 pt-6">
        <div className="grid gap-5 lg:grid-cols-[1fr_21rem]">
          <div className="rounded-[2rem] bg-white p-7 shadow-sm ring-1 ring-slate-200 md:p-9">
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 ring-1 ring-blue-100">
              <Sparkles size={16} />
              {dataStructureQuest.subtitle}
            </div>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight md:text-6xl">
              {dataStructureQuest.storyTitle}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-500">
              先听飞书故事，再完成小节关卡。每次通关都会点亮能力，推动“秩序协议”继续恢复。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-100 transition hover:bg-blue-700"
              >
                <Radio size={17} />
                飞书故事链接待接入
              </button>
              <button
                type="button"
                onClick={() => document.getElementById("chapter-map")?.scrollIntoView({ behavior: "smooth" })}
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:text-blue-600"
              >
                <Map size={17} />
                查看章节地图
              </button>
            </div>
          </div>

          <aside className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-blue-600">状态卡</p>
                <h2 className="mt-2 text-2xl font-semibold">{dataStructureQuest.currentLevel}</h2>
              </div>
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                <Shield size={23} />
              </span>
            </div>
            <div className="mt-7 space-y-4 text-sm">
              <div>
                <div className="mb-2 flex items-center justify-between text-slate-500">
                  <span>秩序协议</span>
                  <span>{dataStructureQuest.progress}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-blue-600"
                    style={{ width: `${dataStructureQuest.progress}%` }}
                  />
                </div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
                <p className="text-slate-500">已解锁技能</p>
                <p className="mt-1 text-lg font-semibold">{dataStructureQuest.unlockedSkill}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
                <p className="text-slate-500">下一章</p>
                <p className="mt-1 text-lg font-semibold">{dataStructureQuest.nextChapter}</p>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {/* 霓虹栈城 2.0 · 可玩城区入口 */}
      <section className="mx-auto max-w-6xl px-5 pb-8">
        <button
          type="button"
          onClick={() => router.push("/quest/data-structure/stack")}
          className="group relative block w-full overflow-hidden rounded-[2rem] bg-[#0b0b18] p-7 text-left ring-1 ring-cyan-400/30 transition hover:-translate-y-0.5 hover:ring-cyan-300/60 md:p-9"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_120%_at_85%_20%,rgba(34,211,238,0.16),transparent_60%)]" />
          <div className="relative flex flex-wrap items-center justify-between gap-5">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-cyan-400/10 px-3 py-1 font-mono text-[11px] tracking-[0.25em] text-cyan-300 ring-1 ring-cyan-400/25">
                NEW · 可玩城区
              </div>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-white md:text-4xl">
                货运塔 <span className="text-cyan-300">· 栈</span>
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-7 text-slate-400">
                不再读小说答题——亲手操作塔吊：入塔、装车、限高、倒塔。
                六个递进任务，把 LIFO、栈混洗、栈溢出玩进手感里。
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-cyan-400 px-6 py-3 text-sm font-bold text-slate-950 transition group-hover:bg-cyan-300">
              进入城区
              <Sparkles size={16} />
            </span>
          </div>
        </button>
      </section>

      <section id="chapter-map" className="mx-auto max-w-6xl px-5 pb-10">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-600">Chapter Map</p>
            <h2 className="mt-1 text-3xl font-semibold tracking-tight">章节地图</h2>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {dataStructureQuest.chapters.map((chapter) => {
            const open = chapter.status === "open";
            return (
              <article
                key={chapter.id}
                className={`rounded-[1.5rem] bg-white p-5 shadow-sm ring-1 ${
                  open ? "ring-blue-200" : "opacity-70 ring-slate-200"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-blue-600">{chapter.title}</p>
                    <h3 className="mt-1 text-2xl font-semibold">{chapter.storyTitle}</h3>
                  </div>
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-slate-500 ring-1 ring-slate-100">
                    {open ? <CheckCircle2 size={20} className="text-blue-600" /> : <Lock size={20} />}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-500">{chapter.summary}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="mb-4">
          <p className="text-sm font-semibold text-blue-600">{openChapter.title}</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight">{openChapter.storyTitle} · 关卡</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {openChapter.levels.map((level) => (
            <article key={level.id} className="rounded-[1.5rem] bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center justify-between gap-4">
                <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
                  {level.id}
                </span>
                <Circle size={18} className="text-blue-400" />
              </div>
              <h3 className="mt-5 text-xl font-semibold">{level.title}</h3>
              <p className="mt-2 text-sm text-slate-400">{level.subtitle}</p>
              <p className="mt-4 text-sm leading-6 text-slate-500">{level.storyHook}</p>

              <div className="mt-5 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Knowledge</p>
                <ul className="mt-2 space-y-1 text-sm text-slate-600">
                  {level.knowledgeGoal.map((goal) => (
                    <li key={goal}>- {goal}</li>
                  ))}
                </ul>
              </div>

              <div className="mt-4 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Questions</p>
                <p className="mt-2 text-sm text-slate-600">{level.questions.length} 题 · {level.passRule}</p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setActiveLevelId(level.id);
                  setTimeout(() => document.getElementById("level-practice")?.scrollIntoView({ behavior: "smooth" }), 0);
                }}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                <BookOpen size={16} />
                开始闯关
              </button>
            </article>
          ))}
        </div>
      </section>

      {activeLevel && (
        <section id="level-practice" className="mx-auto max-w-6xl px-5 pb-24">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-600">Level Practice</p>
              <h2 className="mt-1 text-3xl font-semibold tracking-tight">
                {activeLevel.id} · {activeLevel.title}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{activeLevel.storyHook}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-white px-4 py-2 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
                {correctCount}/{activeQuestions.length} 正确
              </span>
              <button
                type="button"
                onClick={resetActiveLevel}
                className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:text-blue-600"
              >
                <RotateCcw size={15} />
                重做
              </button>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_19rem]">
            <div className="space-y-4">
              {activeQuestions.map((question, index) => {
                const selected = answers[question.id];
                const answered = Boolean(selected);
                const correct = selected === question.answer;
                return (
                  <article key={question.id} className="rounded-[1.5rem] bg-white p-5 shadow-sm ring-1 ring-slate-200">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-semibold leading-8">{question.stem}</h3>
                        <div className="mt-4 grid gap-2">
                          {question.choices.map((choice) => {
                            const isSelected = selected === choice.id;
                            const isAnswer = question.answer === choice.id;
                            const stateClass = !answered
                              ? "bg-white text-slate-700 ring-slate-200 hover:bg-blue-50 hover:ring-blue-200"
                              : isAnswer
                                ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                                : isSelected
                                  ? "bg-rose-50 text-rose-800 ring-rose-200"
                                  : "bg-slate-50 text-slate-400 ring-slate-100";
                            return (
                              <button
                                key={choice.id}
                                type="button"
                                onClick={() => chooseAnswer(question.id, choice.id)}
                                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm ring-1 transition ${stateClass}`}
                              >
                                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 font-semibold text-slate-700">
                                  {choice.id}
                                </span>
                                <span>{choice.text}</span>
                              </button>
                            );
                          })}
                        </div>
                        {answered && (
                          <div className={`mt-4 rounded-2xl p-4 text-sm leading-6 ring-1 ${
                            correct
                              ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                              : "bg-rose-50 text-rose-800 ring-rose-200"
                          }`}>
                            <p className="font-semibold">{correct ? "回答正确" : `回答错误，正确答案是 ${question.answer}`}</p>
                            <p className="mt-1 opacity-90">{question.explanation}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            <aside className="h-fit rounded-[1.5rem] bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <p className="text-sm font-semibold text-blue-600">通关面板</p>
              <h3 className="mt-2 text-2xl font-semibold">{completed ? "本关已作答" : "答题进行中"}</h3>
              <div className="mt-5 space-y-3 text-sm text-slate-600">
                <div className="flex justify-between rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
                  <span>已答题</span>
                  <span>{answeredCount}/{activeQuestions.length}</span>
                </div>
                <div className="flex justify-between rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
                  <span>正确数</span>
                  <span>{correctCount}</span>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
                  <p className="text-slate-400">解锁内容</p>
                  <ul className="mt-2 space-y-1">
                    {activeLevel.unlock.map((item) => (
                      <li key={item}>- {item}</li>
                    ))}
                  </ul>
                </div>
              </div>
              {completed && (
                <div className="mt-5 rounded-2xl bg-blue-50 p-4 text-sm font-semibold text-blue-800 ring-1 ring-blue-100">
                  {correctCount >= activeQuestions.length - 1 ? "达到通关条件，后续可写入学习进度。" : "还差一点，建议重做本关。"}
                </div>
              )}
            </aside>
          </div>
        </section>
      )}
    </main>
  );
}
