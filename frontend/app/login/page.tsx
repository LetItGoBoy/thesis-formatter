"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, Phone, Sparkles } from "lucide-react";
import { loginUser, registerUser } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

type Tab = "login" | "register";

function PhoneInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-500">手机号</span>
      <div className="relative">
        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <span className="absolute left-10 top-1/2 -translate-y-1/2 select-none text-sm text-slate-400">
          +86
        </span>
        <input
          type="tel"
          maxLength={11}
          placeholder="请输入 11 位手机号"
          value={value}
          onChange={(event) => onChange(event.target.value.replace(/\D/g, ""))}
          disabled={disabled}
          className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-20 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100 disabled:opacity-60"
        />
      </div>
    </label>
  );
}

function PasswordInput({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-500">{label}</span>
      <div className="relative">
        <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <input
          type="password"
          placeholder="不少于 6 位"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100 disabled:opacity-60"
        />
      </div>
    </label>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { token, setAuth } = useAuthStore();
  const [tab, setTab] = useState<Tab>("login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (token) router.replace("/dashboard");
  }, [router, token]);

  function switchTab(next: Tab) {
    setTab(next);
    setError("");
    setPassword("");
    setPassword2("");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setError("请输入正确的 11 位手机号");
      return;
    }
    if (password.length < 6) {
      setError("密码不少于 6 位");
      return;
    }
    if (tab === "register" && password !== password2) {
      setError("两次密码输入不一致");
      return;
    }

    setError("");
    setLoading(true);
    try {
      const result =
        tab === "login"
          ? await loginUser(phone, password)
          : await registerUser(phone, password);
      setAuth(result.token, result.phone);
      router.replace("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : tab === "login" ? "登录失败" : "注册失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_15%_10%,#dff7ef_0,transparent_32%),linear-gradient(135deg,#f8fafc_0%,#edf8ff_48%,#f7fbf8_100%)] p-5">
      <section className="w-full max-w-md">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-xl shadow-slate-300">
            <Sparkles size={24} />
          </div>
          <h1 className="text-2xl font-black text-slate-900">同乐科技学生工作台</h1>
          <p className="mt-2 text-sm text-slate-500">先用手机号和密码进入，验证码功能之后再接。</p>
        </div>

        <div className="rounded-[2rem] border border-white/80 bg-white/86 p-6 shadow-xl shadow-slate-200/70 backdrop-blur">
          <div className="mb-6 grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => switchTab("login")}
              className={`rounded-xl py-2.5 text-sm font-semibold transition ${
                tab === "login" ? "bg-white text-cyan-700 shadow-sm" : "text-slate-500"
              }`}
            >
              登录
            </button>
            <button
              type="button"
              onClick={() => switchTab("register")}
              className={`rounded-xl py-2.5 text-sm font-semibold transition ${
                tab === "register" ? "bg-white text-cyan-700 shadow-sm" : "text-slate-500"
              }`}
            >
              注册
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <PhoneInput value={phone} onChange={setPhone} disabled={loading} />
            <PasswordInput label="密码" value={password} onChange={setPassword} disabled={loading} />
            {tab === "register" && (
              <PasswordInput
                label="确认密码"
                value={password2}
                onChange={setPassword2}
                disabled={loading}
              />
            )}

            {error && (
              <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-slate-900 py-3 text-sm font-bold text-white shadow-lg shadow-slate-300 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "处理中..." : tab === "login" ? "登录并进入工作台" : "注册并进入工作台"}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-slate-400">
            {tab === "login" ? "还没有账号？" : "已有账号？"}
            <button
              type="button"
              onClick={() => switchTab(tab === "login" ? "register" : "login")}
              className="ml-1 font-semibold text-cyan-700 hover:underline"
            >
              {tab === "login" ? "去注册" : "去登录"}
            </button>
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">当前阶段每个手机号只能注册一次。</p>
      </section>
    </main>
  );
}
