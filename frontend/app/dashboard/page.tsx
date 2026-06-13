"use client";

/**
 * 工作台 · 成长面板（学生）/ 监督台（管理员）
 * frontend/app/dashboard/page.tsx
 *
 * 学生：昵称、等级、成长值进度、连续学习、各课程进度、最近通关。
 * 管理员（手机号在后端 ADMIN_PHONES 内）：全体学生学习进度与监督信息。
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Flame, Trophy, Star, Target, Pencil, RefreshCw, Check } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { maskPhone, useAuthStore } from "@/lib/auth-store";
import {
  getProfile,
  getAdminStudents,
  updateNickname,
  type Profile,
  type StudentRow,
} from "@/lib/api";

const COURSE_NAMES: Record<string, string> = {
  "ds-stack": "货运塔 · 栈",
  "ds-metro": "环线地铁 · 队列",
  "ds-pipes": "管道区 · 链表",
  "ds-archive": "档案塔 · 二叉树",
  "ds-tower": "倾斜高塔 · AVL",
  "ds-postoffice": "中央邮局 · 哈希",
  "ds-grid": "城市电网 · 图",
  "ds-sorting": "分拣厂 · 排序",
  "db-detective": "雾港档案 · SQL 侦探",
};
const courseName = (c: string) => COURSE_NAMES[c] || c;

function relativeDay(iso: string | null): string {
  if (!iso) return "从未";
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return "今天";
  if (days === 1) return "昨天";
  if (days < 30) return `${days} 天前`;
  return d.toLocaleDateString();
}

export default function DashboardPage() {
  const router = useRouter();
  const { token, phone, nickname, isAdmin, setNickname } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (mounted && !token) router.replace("/login");
  }, [mounted, token, router]);

  if (!mounted || !token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white text-sm text-stone-500">
        正在进入工作台…
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-stone-900">
      <SiteNav />
      <div className="mx-auto max-w-6xl px-6 py-10 md:px-10">
        {isAdmin ? (
          <AdminPanel />
        ) : (
          <StudentPanel phone={phone} nickname={nickname} setNickname={setNickname} />
        )}
      </div>
    </main>
  );
}

// ============================================================
// 学生成长面板
// ============================================================
function StudentPanel({
  phone,
  nickname,
  setNickname,
}: {
  phone: string | null;
  nickname: string | null;
  setNickname: (n: string) => void;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    getProfile()
      .then((p) => {
        setProfile(p);
        if (p.nickname) setNickname(p.nickname);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "加载失败"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveNick() {
    const n = draft.trim();
    if (!n) return setEditing(false);
    await updateNickname(n);
    setNickname(n);
    setProfile((p) => (p ? { ...p, nickname: n } : p));
    setEditing(false);
  }

  const display = profile?.nickname || nickname || (phone ? `学员${phone.slice(-4)}` : "学员");

  return (
    <div>
      <h1 className="font-display text-4xl tracking-tight text-stone-900 md:text-5xl">我的成长</h1>
      <p className="mt-2 text-sm text-stone-500">闯关、答题、连续学习——所有努力都会变成成长值。</p>

      {err && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          暂时无法连接成长服务（{err}）。可先去课程闯关，登录后通关会自动累计。
        </div>
      )}

      {/* 成长概览 */}
      <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="rounded-3xl border border-black/[0.07] bg-gradient-to-br from-indigo-50 to-white p-7">
          <div className="flex items-center gap-4">
            <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
              <span className="font-display text-2xl">Lv{profile?.level ?? 1}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {editing ? (
                  <>
                    <input
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      maxLength={20}
                      className="min-w-0 flex-1 rounded-lg border border-stone-300 px-2 py-1 text-lg font-bold outline-none focus:border-indigo-400"
                    />
                    <button onClick={saveNick} className="text-emerald-600">
                      <Check size={18} />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="truncate text-2xl font-bold text-stone-900">{display}</span>
                    <button
                      onClick={() => {
                        setDraft(display);
                        setEditing(true);
                      }}
                      className="text-stone-400 transition hover:text-stone-700"
                    >
                      <Pencil size={15} />
                    </button>
                  </>
                )}
              </div>
              <div className="mt-0.5 text-sm text-stone-500">
                {profile?.title ?? "新手学徒"}
                {phone ? ` · ${maskPhone(phone)}` : ""}
              </div>
            </div>
          </div>

          <div className="mt-6">
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="font-medium text-stone-700">成长值 {profile?.xp ?? 0}</span>
              <span className="text-stone-500">距下一级还差 {profile?.xp_to_next ?? 100}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-stone-100">
              <div
                className="h-3 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all"
                style={{ width: `${profile?.xp_into_level ?? 0}%` }}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Stat icon={Flame} color="text-orange-600" label="连续学习" value={`${profile?.streak ?? 0} 天`} />
          <Stat icon={Trophy} color="text-amber-600" label="通关数" value={`${profile?.cleared_count ?? 0}`} />
          <Stat icon={Star} color="text-yellow-600" label="完美通关" value={`${profile?.perfect_count ?? 0}`} />
          <Stat icon={Target} color="text-rose-600" label="累计失误" value={`${profile?.mistakes_total ?? 0}`} />
        </div>
      </div>

      <h2 className="mt-12 text-lg font-bold tracking-tight text-stone-900">课程进度</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {profile && Object.keys(profile.per_course).length > 0 ? (
          Object.entries(profile.per_course).map(([course, pc]) => (
            <div key={course} className="rounded-2xl border border-black/[0.07] bg-white p-5">
              <div className="flex items-center justify-between">
                <span className="font-medium text-stone-800">{courseName(course)}</span>
                <span className="text-sm text-stone-500">
                  {pc.cleared}/{pc.total} 关
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-100">
                <div
                  className="h-2 rounded-full bg-emerald-500"
                  style={{ width: `${Math.min(100, (pc.cleared / pc.total) * 100)}%` }}
                />
              </div>
              {pc.perfect > 0 && <div className="mt-2 text-xs text-amber-600">★ 完美 {pc.perfect} 关</div>}
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500 sm:col-span-2">
            还没有通关记录。去
            <button
              onClick={() => location.assign("/course-spaces")}
              className="mx-1 font-medium text-indigo-600 hover:underline"
            >
              课程空间
            </button>
            开始第一关吧！
          </div>
        )}
      </div>

      {profile && profile.recent.length > 0 && (
        <>
          <h2 className="mt-12 text-lg font-bold tracking-tight text-stone-900">最近通关</h2>
          <div className="mt-4 divide-y divide-stone-200 rounded-2xl border border-black/[0.07]">
            {profile.recent.map((r, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3 text-sm">
                <span className="text-stone-700">
                  {courseName(r.course)} · <span className="text-stone-500">{r.level_id}</span>
                </span>
                <span className="flex items-center gap-3 text-stone-500">
                  {r.perfect ? (
                    <span className="text-amber-600">★ 完美</span>
                  ) : (
                    <span>失误 {r.best_mistakes}</span>
                  )}
                  <span>{relativeDay(r.last_at)}</span>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  color,
  label,
  value,
}: {
  icon: typeof Flame;
  color: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-black/[0.07] bg-white p-5">
      <Icon size={20} className={color} />
      <div className="mt-3 text-2xl font-bold text-stone-900">{value}</div>
      <div className="mt-0.5 text-sm text-stone-500">{label}</div>
    </div>
  );
}

// ============================================================
// 管理员监督台
// ============================================================
function AdminPanel() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    getAdminStudents()
      .then((s) => {
        setStudents(s);
        setErr("");
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "加载失败"))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  const totalCleared = students.reduce((s, x) => s + x.cleared_count, 0);
  const activeToday = students.filter((x) => relativeDay(x.last_active) === "今天").length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl tracking-tight text-stone-900 md:text-5xl">学生监督台</h1>
          <p className="mt-2 text-sm text-stone-500">管理员视图 · 查看所有学生的成长与学习进度。</p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-900/[0.04]"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          刷新
        </button>
      </div>

      {err && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          无法加载学生数据（{err}）。请确认后端已部署，且你的手机号已加入后端环境变量 ADMIN_PHONES。
        </div>
      )}

      <div className="mt-8 grid grid-cols-3 gap-3">
        <Stat icon={Trophy} color="text-indigo-600" label="学生总数" value={`${students.length}`} />
        <Stat icon={Star} color="text-emerald-600" label="累计通关" value={`${totalCleared}`} />
        <Stat icon={Flame} color="text-orange-600" label="今日活跃" value={`${activeToday}`} />
      </div>

      <div className="mt-8 overflow-x-auto rounded-2xl border border-black/[0.07]">
        <table className="w-full min-w-[780px] text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
            <tr>
              <th className="px-4 py-3 font-medium">昵称</th>
              <th className="px-4 py-3 font-medium">手机号</th>
              <th className="px-4 py-3 font-medium">等级 / 称号</th>
              <th className="px-4 py-3 font-medium">成长值</th>
              <th className="px-4 py-3 font-medium">通关进度</th>
              <th className="px-4 py-3 font-medium">完美</th>
              <th className="px-4 py-3 font-medium">失误</th>
              <th className="px-4 py-3 font-medium">连续</th>
              <th className="px-4 py-3 font-medium">最近活跃</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {students.map((s) => (
              <tr key={s.id} className="hover:bg-stone-50">
                <td className="px-4 py-3 font-medium text-stone-900">{s.nickname}</td>
                <td className="px-4 py-3 text-stone-500">{maskPhone(s.phone)}</td>
                <td className="px-4 py-3 text-stone-700">
                  Lv{s.level} · {s.title}
                </td>
                <td className="px-4 py-3 font-semibold text-indigo-600">{s.xp}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-stone-100">
                      <div
                        className="h-1.5 rounded-full bg-emerald-500"
                        style={{ width: `${Math.min(100, (s.cleared_count / s.total_levels) * 100)}%` }}
                      />
                    </div>
                    <span className="text-stone-500">
                      {s.cleared_count}/{s.total_levels}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-amber-600">{s.perfect_count}</td>
                <td className="px-4 py-3 text-rose-600">{s.mistakes_total}</td>
                <td className="px-4 py-3 text-stone-700">{s.streak} 天</td>
                <td className="px-4 py-3 text-stone-500">{relativeDay(s.last_active)}</td>
              </tr>
            ))}
            {students.length === 0 && !loading && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-stone-400">
                  暂无学生数据
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
