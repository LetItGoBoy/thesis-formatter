"use client";
/**
 * 登录 / 注册页面
 * frontend/app/login/page.tsx
 *
 * 注册流程：手机号 → 发送短信验证码（60s 冷却）→ 输入验证码 + 设置密码 → 注册
 * 登录流程：手机号 + 密码 → 登录
 * 同一手机号只能注册一次（后端 UNIQUE 约束强制）。
 */
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { sendCode, registerUser, loginUser } from "@/lib/api";

type Tab = "login" | "register";

function PhoneInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm select-none">
        +86
      </span>
      <input
        type="tel"
        maxLength={11}
        placeholder="请输入手机号"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        disabled={disabled}
        className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-12 pr-4 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:opacity-60"
      />
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { token, setAuth } = useAuthStore();
  const [tab, setTab] = useState<Tab>("login");

  // login state
  const [lPhone, setLPhone] = useState("");
  const [lPass, setLPass] = useState("");
  const [lLoading, setLLoading] = useState(false);
  const [lError, setLError] = useState("");

  // register state
  const [rPhone, setRPhone] = useState("");
  const [rCode, setRCode] = useState("");
  const [rPass, setRPass] = useState("");
  const [rPass2, setRPass2] = useState("");
  const [rLoading, setRLoading] = useState(false);
  const [rError, setRError] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (token) router.replace("/");
  }, [token, router]);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  function startCountdown() {
    setCountdown(60);
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(timerRef.current!); return 0; }
        return c - 1;
      });
    }, 1000);
  }

  async function handleSendCode() {
    if (!/^1[3-9]\d{9}$/.test(rPhone)) {
      setRError("请输入正确的11位手机号");
      return;
    }
    setRError("");
    setRLoading(true);
    try {
      await sendCode(rPhone);
      setCodeSent(true);
      startCountdown();
    } catch (e: unknown) {
      setRError(e instanceof Error ? e.message : "发送失败");
    } finally {
      setRLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!/^1[3-9]\d{9}$/.test(rPhone)) { setRError("手机号格式不正确"); return; }
    if (rCode.length !== 6) { setRError("请输入6位验证码"); return; }
    if (rPass.length < 6) { setRError("密码不少于6位"); return; }
    if (rPass !== rPass2) { setRError("两次密码输入不一致"); return; }
    setRError("");
    setRLoading(true);
    try {
      const { token, phone } = await registerUser(rPhone, rCode, rPass);
      setAuth(token, phone);
      router.replace("/");
    } catch (e: unknown) {
      setRError(e instanceof Error ? e.message : "注册失败");
    } finally {
      setRLoading(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!/^1[3-9]\d{9}$/.test(lPhone)) { setLError("手机号格式不正确"); return; }
    if (!lPass) { setLError("请输入密码"); return; }
    setLError("");
    setLLoading(true);
    try {
      const { token, phone } = await loginUser(lPhone, lPass);
      setAuth(token, phone);
      router.replace("/");
    } catch (e: unknown) {
      setLError(e instanceof Error ? e.message : "登录失败");
    } finally {
      setLLoading(false);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-slate-200 bg-white py-3 px-4 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:opacity-60";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-cyan-50/30 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500 text-2xl shadow-lg shadow-indigo-200">
            📄
          </div>
          <h1 className="text-xl font-bold text-slate-800">论文格式化工具</h1>
          <p className="mt-1 text-xs text-slate-400">呼伦贝尔学院本科论文格式助手</p>
        </div>

        <div className="rounded-3xl bg-white/80 shadow-xl shadow-slate-200/60 backdrop-blur p-6">
          {/* Tabs */}
          <div className="mb-6 flex rounded-xl bg-slate-100 p-1">
            {(["login", "register"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setLError(""); setRError(""); }}
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                  tab === t
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {t === "login" ? "登录" : "注册"}
              </button>
            ))}
          </div>

          {/* Login form */}
          {tab === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <PhoneInput value={lPhone} onChange={setLPhone} disabled={lLoading} />
              <input
                type="password"
                placeholder="密码"
                value={lPass}
                onChange={(e) => setLPass(e.target.value)}
                disabled={lLoading}
                className={inputCls}
              />
              {lError && <p className="text-xs text-red-500">{lError}</p>}
              <button
                type="submit"
                disabled={lLoading}
                className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 py-3 text-sm font-semibold text-white shadow shadow-indigo-200 transition hover:opacity-90 disabled:opacity-60"
              >
                {lLoading ? "登录中…" : "登录"}
              </button>
              <p className="text-center text-xs text-slate-400">
                还没有账号？
                <button type="button" onClick={() => setTab("register")} className="text-indigo-500 hover:underline ml-1">
                  立即注册
                </button>
              </p>
            </form>
          )}

          {/* Register form */}
          {tab === "register" && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="flex gap-2">
                <div className="flex-1">
                  <PhoneInput value={rPhone} onChange={setRPhone} disabled={rLoading || codeSent} />
                </div>
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={rLoading || countdown > 0}
                  className="shrink-0 rounded-xl border border-indigo-200 bg-indigo-50 px-3 text-xs font-medium text-indigo-600 transition hover:bg-indigo-100 disabled:opacity-50 whitespace-nowrap"
                >
                  {countdown > 0 ? `${countdown}s` : "发送验证码"}
                </button>
              </div>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="6位短信验证码"
                value={rCode}
                onChange={(e) => setRCode(e.target.value.replace(/\D/g, ""))}
                disabled={rLoading}
                className={inputCls}
              />
              <input
                type="password"
                placeholder="设置密码（不少于6位）"
                value={rPass}
                onChange={(e) => setRPass(e.target.value)}
                disabled={rLoading}
                className={inputCls}
              />
              <input
                type="password"
                placeholder="确认密码"
                value={rPass2}
                onChange={(e) => setRPass2(e.target.value)}
                disabled={rLoading}
                className={inputCls}
              />
              {rError && <p className="text-xs text-red-500">{rError}</p>}
              <button
                type="submit"
                disabled={rLoading}
                className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 py-3 text-sm font-semibold text-white shadow shadow-indigo-200 transition hover:opacity-90 disabled:opacity-60"
              >
                {rLoading ? "注册中…" : "注册"}
              </button>
              <p className="text-center text-xs text-slate-400">
                已有账号？
                <button type="button" onClick={() => setTab("login")} className="text-indigo-500 hover:underline ml-1">
                  去登录
                </button>
              </p>
            </form>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          每个手机号只能注册一次账号
        </p>
      </div>
    </div>
  );
}
