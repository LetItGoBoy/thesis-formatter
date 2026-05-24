import type { Metadata } from "next";
import "./globals.css";
import { AuthSync } from "@/components/AuthSync";

export const metadata: Metadata = {
  title: "论文格式化工具 - 呼伦贝尔学院",
  description: "自动将论文格式化为呼伦贝尔学院标准格式",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased min-h-screen bg-slate-50 text-slate-900">
        <AuthSync />
        {children}
      </body>
    </html>
  );
}
