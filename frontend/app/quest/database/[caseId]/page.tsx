"use client";

/**
 * 单个案件页 · /quest/database/[caseId]
 * 按 caseId 取出案件并交给 CaseRunner 渲染；找不到则回探案集。
 */
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { CaseRunner } from "@/components/CaseRunner";
import { getCase } from "@/lib/cases";

export default function CasePage() {
  const params = useParams();
  const router = useRouter();
  const caseId = Array.isArray(params.caseId) ? params.caseId[0] : params.caseId;
  const caseData = caseId ? getCase(caseId) : undefined;

  useEffect(() => {
    if (!caseData) router.replace("/quest/database");
  }, [caseData, router]);

  if (!caseData) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#eef1f8] text-sm text-slate-500">
        正在返回探案集…
      </main>
    );
  }

  return <CaseRunner caseData={caseData} />;
}
