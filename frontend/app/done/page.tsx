"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useThesisStore } from "@/lib/store";

export default function DonePage() {
  const router = useRouter();
  const { outputBlob, fileName, reset } = useThesisStore();
  const [downloadUrl, setDownloadUrl] = useState<string>("");

  useEffect(() => {
    if (!outputBlob) {
      router.replace("/");
      return;
    }
    const url = URL.createObjectURL(outputBlob);
    setDownloadUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [outputBlob, router]);

  const outName = fileName
    ? fileName.replace(/\.docx$/i, "") + "_formatted.docx"
    : "formatted.docx";

  function handleAnother() {
    reset();
    router.push("/");
  }

  if (!outputBlob) return null;

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-xl text-center">
        <div className="text-6xl mb-6">🎉</div>
        <h1 className="text-2xl font-bold mb-2">格式化完成</h1>
        <p className="text-slate-600 mb-8">
          您的论文已按呼伦贝尔学院标准格式重新排版
        </p>

        <div className="rounded-2xl bg-white border p-8 mb-6">
          <div className="text-4xl mb-3">📥</div>
          <p className="font-medium mb-4 break-all">{outName}</p>
          <a
            href={downloadUrl}
            download={outName}
            className="inline-flex items-center justify-center h-12 px-6 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700"
          >
            下载文件
          </a>
        </div>

        <div className="flex justify-center gap-3">
          <Button variant="outline" onClick={() => router.push("/review")}>
            返回修改
          </Button>
          <Button onClick={handleAnother}>格式化新论文</Button>
        </div>

        <p className="mt-8 text-xs text-slate-400">
          建议下载后用Word打开核对效果，如有问题可返回修改重新格式化
        </p>
      </div>
    </main>
  );
}
