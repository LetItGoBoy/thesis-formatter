"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useThesisStore } from "@/lib/store";
import { parseDocx } from "@/lib/api";

export default function UploadPage() {
  const router = useRouter();
  const setSource = useThesisStore((s) => s.setSource);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [progressText, setProgressText] = useState("");

  async function handleFile(file: File) {
    setError("");
    if (!file.name.toLowerCase().endsWith(".docx")) {
      setError("仅支持 .docx 文件");
      return;
    }
    setLoading(true);
    setProgressText("正在上传并解析文档...");
    try {
      // 读取base64留存原始docx，格式化时回传
      const buf = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buf).reduce((acc, b) => acc + String.fromCharCode(b), "")
      );
      setProgressText("AI正在识别段落类型...");
      const data = await parseDocx(file);
      setSource(file.name, base64, data.paragraphs);
      router.push("/review");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
      setProgressText("");
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-2">论文格式化工具</h1>
          <p className="text-slate-600">
            呼伦贝尔学院本科论文格式自动化 · 内部工具
          </p>
        </header>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`
            cursor-pointer rounded-2xl border-2 border-dashed bg-white p-16 text-center transition
            ${dragOver ? "border-blue-500 bg-blue-50" : "border-slate-300 hover:border-blue-400"}
            ${loading ? "pointer-events-none opacity-60" : ""}
          `}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".docx"
            className="hidden"
            onChange={onChange}
          />
          <div className="text-5xl mb-4">📄</div>
          <p className="text-lg font-medium mb-2">
            点击或拖拽上传 .docx 论文文件
          </p>
          <p className="text-sm text-slate-500">
            上传后AI将识别每段类型，您逐段确认后即可一键格式化
          </p>
        </div>

        {loading && (
          <div className="mt-6 rounded-lg bg-blue-50 border border-blue-200 p-4 text-center text-blue-700">
            <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent mr-2 align-middle" />
            {progressText || "处理中..."}
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-lg bg-red-50 border border-red-200 p-4 text-red-700">
            ⚠️ {error}
          </div>
        )}

        <div className="mt-8 text-center">
          <Button
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={loading}
          >
            选择文件
          </Button>
        </div>

        <footer className="mt-12 text-center text-xs text-slate-400">
          支持中英文混排 · 自动三线表 · 表格不跨页
        </footer>
      </div>
    </main>
  );
}
