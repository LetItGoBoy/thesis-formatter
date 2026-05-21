/**
 * 同乐科技 LOGO
 * frontend/components/Logo.tsx
 *
 * 设计理念：一张「会微笑的文档」——
 * 圆角文档（折角）象征论文/排版，笑脸呼应「同乐」(共同欢乐)，
 * 渐变取靛蓝→青色，传达科技感。纯 SVG，任意尺寸清晰。
 */

export function LogoMark({ size = 44 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="同乐科技"
    >
      <defs>
        <linearGradient id="tl-grad" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366f1" />
          <stop offset="1" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="12" fill="url(#tl-grad)" />
      {/* 文档主体 */}
      <path
        d="M16 11h10.5l5.5 5.5V35a2.5 2.5 0 0 1-2.5 2.5H16A2.5 2.5 0 0 1 13.5 35V13.5A2.5 2.5 0 0 1 16 11Z"
        fill="#ffffff"
      />
      {/* 折角 */}
      <path d="M26.5 11 32 16.5h-5.5V11Z" fill="#c7d2fe" />
      {/* 笑脸（乐） */}
      <circle cx="20.3" cy="24" r="1.5" fill="#4f46e5" />
      <circle cx="27.7" cy="24" r="1.5" fill="#4f46e5" />
      <path
        d="M19 28.2c1.6 2.4 8.4 2.4 10 0"
        stroke="#4f46e5"
        strokeWidth="1.9"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function Logo({ size = 44 }: { size?: number }) {
  return (
    <div className="flex items-center gap-3">
      <LogoMark size={size} />
      <div className="leading-tight">
        <div className="text-xl font-bold tracking-tight text-slate-800">同乐科技</div>
        <div className="text-[10px] font-semibold tracking-[0.25em] text-slate-400">
          TONGLE&nbsp;TECH
        </div>
      </div>
    </div>
  );
}
