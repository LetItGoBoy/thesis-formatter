"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Clock,
  Filter,
  Home,
  Search,
  Target,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";
import {
  curriculumDataByMajor,
  curriculumMajors,
  semesterLabels,
  type CareerRole,
  type Course,
  type CourseCategory,
} from "@/lib/curriculum";

const categoryClasses: Record<CourseCategory, string> = {
  通用素养: "bg-slate-100 text-slate-700 ring-slate-200",
  数学建模: "bg-sky-100 text-sky-700 ring-sky-200",
  编程基础: "bg-violet-100 text-violet-700 ring-violet-200",
  电路硬件: "bg-amber-100 text-amber-800 ring-amber-200",
  嵌入式底层: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  通信感知: "bg-cyan-100 text-cyan-700 ring-cyan-200",
  数据与应用: "bg-indigo-100 text-indigo-700 ring-indigo-200",
  项目实践: "bg-rose-100 text-rose-700 ring-rose-200",
};

const allRoleFilter = "all";
const stageOrder = ["foundation", "engineering", "software", "embedded", "iot", "practice"];

function semesterNumber(semester: Course["semester"]) {
  if (typeof semester === "number") return semester;
  return Number(semester.split("-")[0]);
}

function formatSemester(semester: Course["semester"]) {
  if (semester === "1-8") return "1-8 学期";
  if (semester === "7-8") return "7-8 学期";
  return `第 ${semester} 学期`;
}

function ImportanceDots({ level }: { level: Course["importance"] }) {
  return (
    <div className="flex items-center gap-1" aria-label={`重要性 ${level}/5`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <span
          key={index}
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            index < level ? "bg-blue-600" : "bg-slate-200"
          )}
        />
      ))}
    </div>
  );
}

function CourseMiniCard({
  course,
  selected,
  isPrerequisite,
  isUnlock,
  onSelect,
}: {
  course: Course;
  selected: boolean;
  isPrerequisite: boolean;
  isUnlock: boolean;
  onSelect: (courseId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(course.id)}
      className={cn(
        "group w-full rounded-lg border bg-white p-3 text-left shadow-sm transition",
        "hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md",
        selected && "border-blue-600 bg-blue-50 ring-2 ring-blue-200",
        isPrerequisite && !selected && "border-amber-300 bg-amber-50",
        isUnlock && !selected && "border-emerald-300 bg-emerald-50"
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900">
            {course.name}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
            <span>{course.credits} 学分</span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span>{formatSemester(course.semester)}</span>
          </div>
        </div>
        <ImportanceDots level={course.importance} />
      </div>
      <div
        className={cn(
          "mb-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1",
          categoryClasses[course.category]
        )}
      >
        {course.category}
      </div>
      <p className="line-clamp-2 text-xs leading-relaxed text-slate-600">{course.focus}</p>
      {(isPrerequisite || isUnlock) && !selected && (
        <div className="mt-2 text-[11px] font-medium text-slate-600">
          {isPrerequisite ? "所选课程的前置基础" : "所选课程的后续承接"}
        </div>
      )}
    </button>
  );
}

export default function CurriculumPage() {
  const pathname = usePathname();
  const [selectedCourseId, setSelectedCourseId] = useState("iot-project");
  const [roleFilter, setRoleFilter] = useState<string>(allRoleFilter);
  const [query, setQuery] = useState("");
  const activeMajorId = pathname.split("/")[2] || "electronic-iot";
  const selectedMajor = curriculumMajors.find((major) => major.id === activeMajorId) ?? curriculumMajors[0];
  const majorReady = selectedMajor.status === "已接入";
  const dataset = curriculumDataByMajor[selectedMajor.id] ?? curriculumDataByMajor["electronic-iot"];
  const courses = dataset.courses;
  const careerRoles = dataset.careerRoles;

  const courseById = useMemo(() => new Map(courses.map((course) => [course.id, course])), [courses]);
  const selectedCourse = courseById.get(selectedCourseId) ?? courses[0];
  const selectedRole = roleFilter === allRoleFilter ? null : careerRoles.find((role) => role.id === roleFilter);

  const prerequisiteIds = useMemo(() => new Set(selectedCourse.prerequisites), [selectedCourse]);
  const unlockIds = useMemo(() => {
    return new Set(
      courses
        .filter((course) => course.prerequisites.includes(selectedCourse.id))
        .map((course) => course.id)
    );
  }, [courses, selectedCourse]);

  const roleCourseIds = useMemo(() => {
    if (!selectedRole) return new Set<string>();
    return new Set(selectedRole.courseIds);
  }, [selectedRole]);

  const filteredCourses = useMemo(() => {
    const lower = query.trim().toLowerCase();
    return courses.filter((course) => {
      const matchRole = roleFilter === allRoleFilter || roleCourseIds.has(course.id);
      const haystack = [course.name, course.focus, course.why, course.category, ...course.skills]
        .join(" ")
        .toLowerCase();
      const matchQuery = !lower || haystack.includes(lower);
      return matchRole && matchQuery;
    });
  }, [courses, query, roleCourseIds, roleFilter]);

  const filteredIds = useMemo(() => new Set(filteredCourses.map((course) => course.id)), [filteredCourses]);

  const coursesBySemester = useMemo(() => {
    return Array.from({ length: 8 }, (_, index) => {
      const semester = index + 1;
      return courses
        .filter((course) => {
          if (course.semester === "1-8") return true;
          if (course.semester === "7-8") return semester === 7 || semester === 8;
          return course.semester === semester;
        })
        .sort((a, b) => {
          if (a.stage !== b.stage) return stageOrder.indexOf(a.stage) - stageOrder.indexOf(b.stage);
          return b.importance - a.importance;
        });
    });
  }, [courses]);

  const selectedCourseRoles = careerRoles.filter((role) => role.courseIds.includes(selectedCourse.id));

  function handleCourseSelect(courseId: string) {
    setSelectedCourseId(courseId);
    setRoleFilter(allRoleFilter);
  }

  function selectRole(roleId: string) {
    setRoleFilter(roleId);
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <nav className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur md:px-8">
        <div className="mx-auto flex max-w-[118rem] items-center justify-between gap-3">
          <Logo size={38} />
          <div className="flex items-center gap-2">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <Home className="h-4 w-4" />
                返回论文工具
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-[118rem] px-4 py-6 md:px-8">
        <section className="mb-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-4xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                <Target className="h-3.5 w-3.5" />
                {selectedMajor.title}
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">
                课程体系与岗位技能路径
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                {dataset.sourceNote} 课程按先修关系递进，点击任意课程可查看重点内容、重要性、
                前后衔接课程，以及它对应的真实岗位技能路径。
              </p>
              {!majorReady && (
                <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                  这个专业的培养方案还未接入，路由和入口已预留。当前下方暂展示“电子信息工程（物联网方向）”样例数据。
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {curriculumMajors.map((major) => {
                  const active = activeMajorId === major.id;
                  const ready = major.status === "已接入";
                  return (
                    <Link
                      key={major.id}
                      href={`/curriculum/${major.id}`}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                        active
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50"
                      )}
                    >
                      {major.shortTitle}
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px]",
                          ready ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500",
                          active && "bg-white/20 text-white"
                        )}
                      >
                        {major.status}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[34rem]">
              {dataset.stats.map((item) => (
                <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xl font-bold text-slate-950">{item.value}</div>
                  <div className="mt-1 text-xs font-medium text-slate-700">{item.label}</div>
                  <div className="mt-0.5 text-[11px] text-slate-500">{item.note}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mb-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-1 flex-col gap-3 md:flex-row">
              <label className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索课程、技能或关键词，例如 ARM、数据库、无线、Android"
                  className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  setRoleFilter(allRoleFilter);
                  setQuery("");
                }}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm text-slate-700 transition hover:bg-slate-50"
              >
                <Filter className="h-4 w-4" />
                清空筛选
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => selectRole(allRoleFilter)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                  roleFilter === allRoleFilter
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-blue-300"
                )}
              >
                全部岗位
              </button>
              {careerRoles.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => selectRole(role.id)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                    roleFilter === role.id
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-blue-300"
                  )}
                >
                  {role.title}
                </button>
              ))}
            </div>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_25rem]">
          <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-950">课程递进路线</h2>
                <p className="mt-1 text-xs text-slate-500">
                  岗位或搜索筛选后，只保留相关课程；点击课程可切换到单课关系视图。
                </p>
              </div>
              <Badge variant="muted">{filteredCourses.length} 门课程匹配</Badge>
            </div>

            <div className="overflow-x-auto pb-2">
              <div className="grid min-w-[96rem] grid-cols-8 gap-3">
                {coursesBySemester.map((semesterCourses, index) => (
                  <div key={semesterLabels[index]} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    {(() => {
                      const visibleCourses = semesterCourses.filter((course) => filteredIds.has(course.id));
                      return (
                        <>
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-bold text-slate-900">{semesterLabels[index]}</div>
                        <div className="mt-0.5 text-[11px] text-slate-500">
                          第 {Math.floor(index / 2) + 1} 学年
                        </div>
                      </div>
                      <Clock className="h-4 w-4 text-slate-400" />
                    </div>
                    <div className="space-y-2">
                      {visibleCourses.length === 0 ? (
                        <div className="rounded-md border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">
                          本学期无匹配课程
                        </div>
                      ) : (
                        visibleCourses.map((course) => (
                          <CourseMiniCard
                            key={`${course.id}-${index}`}
                            course={course}
                                  selected={!selectedRole && course.id === selectedCourse.id}
                                  isPrerequisite={!selectedRole && prerequisiteIds.has(course.id)}
                                  isUnlock={!selectedRole && unlockIds.has(course.id)}
                                  onSelect={handleCourseSelect}
                                />
                        ))
                      )}
                    </div>
                        </>
                      );
                    })()}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <aside className="xl:sticky xl:top-24 xl:self-start">
            {selectedRole ? (
              <RoleDetail
                role={selectedRole}
                courses={courses}
                courseById={courseById}
                onSelectCourse={handleCourseSelect}
              />
            ) : (
              <CourseDetail
                course={selectedCourse}
                courseById={courseById}
                selectedCourseRoles={selectedCourseRoles}
                unlockIds={Array.from(unlockIds)}
                onSelectCourse={handleCourseSelect}
                onSelectRole={selectRole}
              />
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}

function CourseDetail({
  course,
  courseById,
  selectedCourseRoles,
  unlockIds,
  onSelectCourse,
  onSelectRole,
}: {
  course: Course;
  courseById: Map<string, Course>;
  selectedCourseRoles: CareerRole[];
  unlockIds: string[];
  onSelectCourse: (courseId: string) => void;
  onSelectRole: (roleId: string) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <Badge className={cn("mb-2 ring-1", categoryClasses[course.category])}>
            {course.category}
          </Badge>
          <h2 className="text-xl font-bold leading-snug text-slate-950">{course.name}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>{formatSemester(course.semester)}</span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span>{course.credits} 学分</span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span>重要性</span>
            <ImportanceDots level={course.importance} />
          </div>
        </div>
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
      </div>

      <div className="space-y-4">
        <div>
          <div className="mb-1 text-xs font-semibold text-slate-500">重点内容</div>
          <p className="text-sm leading-6 text-slate-800">{course.focus}</p>
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold text-slate-500">为什么重要</div>
          <p className="text-sm leading-6 text-slate-700">{course.why}</p>
        </div>
        <div>
          <div className="mb-2 text-xs font-semibold text-slate-500">形成的技能</div>
          <div className="flex flex-wrap gap-2">
            {course.skills.map((skill) => (
              <span key={skill} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                {skill}
              </span>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <RelationList
            title="前置基础"
            empty="没有强前置课"
            ids={course.prerequisites}
            courseById={courseById}
            onSelect={onSelectCourse}
            tone="amber"
          />
          <RelationList
            title="后续承接"
            empty="已经接近出口能力"
            ids={unlockIds}
            courseById={courseById}
            onSelect={onSelectCourse}
            tone="emerald"
          />
        </div>
        <div>
          <div className="mb-2 text-xs font-semibold text-slate-500">关联岗位</div>
          <div className="space-y-2">
            {selectedCourseRoles.length === 0 ? (
              <p className="text-sm text-slate-500">主要作为通用基础能力支撑。</p>
            ) : (
              selectedCourseRoles.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => onSelectRole(role.id)}
                  className="flex w-full items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-left text-sm transition hover:border-blue-300 hover:bg-blue-50"
                >
                  <span>{role.title}</span>
                  <Briefcase className="h-4 w-4 text-slate-400" />
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RoleDetail({
  role,
  courses,
  courseById,
  onSelectCourse,
}: {
  role: CareerRole;
  courses: Course[];
  courseById: Map<string, Course>;
  onSelectCourse: (courseId: string) => void;
}) {
  const roleCourseIds = new Set(role.courseIds);
  const roleCourses = role.courseIds
    .map((id) => courseById.get(id))
    .filter((course): course is Course => Boolean(course))
    .sort((a, b) => semesterNumber(a.semester) - semesterNumber(b.semester));

  return (
    <div className="rounded-lg border border-blue-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <Badge className="mb-2 bg-blue-100 text-blue-700 ring-1 ring-blue-200">
            岗位路径
          </Badge>
          <h2 className="text-xl font-bold leading-snug text-slate-950">{role.title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{role.fit}</p>
        </div>
        <Briefcase className="h-5 w-5 shrink-0 text-blue-500" />
      </div>

      <div className="mb-4">
        <div className="mb-2 text-xs font-semibold text-slate-500">真实招聘高频要求</div>
        <div className="space-y-1.5">
          {role.demand.map((item) => (
            <div key={item} className="flex items-start gap-2 text-sm text-slate-700">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-slate-950">核心课程链路</div>
          <div className="mt-0.5 text-xs text-slate-500">按学习顺序排列，点击课程会退出岗位路径。</div>
        </div>
        <Badge variant="muted">{roleCourses.length} 门</Badge>
      </div>

      <div className="space-y-2">
        {roleCourses.map((course, index) => {
          const previous = course.prerequisites
            .filter((id) => roleCourseIds.has(id))
            .map((id) => courseById.get(id)?.name)
            .filter(Boolean);
          const next = courses
            .filter((item) => roleCourseIds.has(item.id) && item.prerequisites.includes(course.id))
            .map((item) => item.name);

          return (
            <button
              key={course.id}
              type="button"
              onClick={() => onSelectCourse(course.id)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-blue-300 hover:bg-blue-50"
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-blue-600">第 {index + 1} 站</div>
                  <div className="mt-0.5 text-sm font-bold leading-snug text-slate-950">{course.name}</div>
                </div>
                <ImportanceDots level={course.importance} />
              </div>
              <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                <span>{formatSemester(course.semester)}</span>
                <span>{course.credits} 学分</span>
                <span className={cn("rounded-full px-2 py-0.5 ring-1", categoryClasses[course.category])}>
                  {course.category}
                </span>
              </div>
              <p className="text-xs leading-5 text-slate-700">{course.focus}</p>
              <div className="mt-2 space-y-1 text-[11px] text-slate-500">
                <div>前置：{previous.length > 0 ? previous.join(" / ") : "无强前置或来自通用基础"}</div>
                <div>后续：{next.length > 0 ? next.join(" / ") : "作为出口能力或项目支撑"}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RelationList({
  title,
  empty,
  ids,
  courseById,
  onSelect,
  tone,
}: {
  title: string;
  empty: string;
  ids: string[];
  courseById: Map<string, Course>;
  onSelect: (courseId: string) => void;
  tone: "amber" | "emerald";
}) {
  const toneClass =
    tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300"
      : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-300";

  return (
    <div>
      <div className="mb-2 text-xs font-semibold text-slate-500">{title}</div>
      {ids.length === 0 ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
          {empty}
        </div>
      ) : (
        <div className="space-y-2">
          {ids.map((id) => {
            const course = courseById.get(id);
            if (!course) return null;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelect(id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-xs transition",
                  toneClass
                )}
              >
                <span>{course.name}</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
