export function LogoMark({ size = 44 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="240 240 720 620"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="同乐科技"
    >
      <defs>
        <linearGradient id="tlm-g0" x1="260" y1="300" x2="610" y2="760" gradientUnits="userSpaceOnUse">
          <stop stopColor="#13B5F5" />
          <stop offset="1" stopColor="#0058C9" />
        </linearGradient>
        <linearGradient id="tlm-g1" x1="620" y1="300" x2="960" y2="760" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFB000" />
          <stop offset="1" stopColor="#FF6A00" />
        </linearGradient>
      </defs>
      <path d="M590 260C522.527 258.147 456.108 277.028 399.7 314.099C343.293 351.17 299.61 404.646 274.541 467.317C249.473 529.987 244.225 598.838 259.506 664.584C274.787 730.33 309.862 789.809 360 835L430 765C396.174 732.721 372.746 691.085 362.713 645.418C352.679 599.751 356.497 552.129 373.676 508.644C390.856 465.158 420.616 427.786 459.152 401.307C497.687 374.827 543.246 360.445 590 360V260Z" fill="url(#tlm-g0)" />
      <path d="M610 260C677.473 258.147 743.892 277.028 800.299 314.099C856.707 351.17 900.39 404.646 925.458 467.317C950.527 529.987 955.774 598.838 940.493 664.584C925.212 730.33 890.138 789.809 840 835L770 765C803.826 732.721 827.253 691.085 837.287 645.418C847.32 599.751 843.503 552.129 826.324 508.644C809.144 465.158 779.383 427.786 740.848 401.307C702.312 374.827 656.754 360.445 610 360V260Z" fill="url(#tlm-g1)" />
      <path d="M505 479C523.778 479 539 463.778 539 445C539 426.222 523.778 411 505 411C486.222 411 471 426.222 471 445C471 463.778 486.222 479 505 479Z" fill="url(#tlm-g0)" />
      <path d="M695 479C713.778 479 729 463.778 729 445C729 426.222 713.778 411 695 411C676.222 411 661 426.222 661 445C661 463.778 676.222 479 695 479Z" fill="url(#tlm-g1)" />
      <path d="M470 515C470 501.667 476.667 495 490 495H545C556.333 495 566 499 574 507L610 543L560 593L520 553V710C520 723.333 513.333 730 500 730H490C476.667 730 470 723.333 470 710V515Z" fill="url(#tlm-g0)" />
      <path d="M730 515C730 501.667 723.333 495 710 495H655C643.667 495 634 499 626 507L590 543L640 593L680 553V710C680 723.333 686.667 730 700 730H710C723.333 730 730 723.333 730 710V515Z" fill="url(#tlm-g1)" />
    </svg>
  );
}

export function Logo({ size = 44, dark = false }: { size?: number; dark?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <LogoMark size={size} />
      <div className="leading-tight">
        <div className={`text-xl font-bold tracking-tight ${dark ? "text-white" : "text-slate-800"}`}>
          同乐科技
        </div>
        <div className={`text-[10px] font-semibold tracking-[0.25em] ${dark ? "text-slate-400" : "text-slate-400"}`}>
          TONGLE&nbsp;TECH
        </div>
      </div>
    </div>
  );
}
