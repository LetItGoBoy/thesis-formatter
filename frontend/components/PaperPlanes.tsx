"use client";

import { useEffect, useRef } from "react";

export function PaperPlanes() {
  const sharkRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const shark = sharkRef.current;
    if (!shark || reduce) return;

    let raf = 0;
    let targetX = window.innerWidth * 0.72;
    let targetY = window.innerHeight * 0.26;
    let currentX = targetX;
    let currentY = targetY;
    let lastX = currentX;

    const move = (event: PointerEvent) => {
      targetX = event.clientX;
      targetY = event.clientY;
    };

    const tick = () => {
      currentX += (targetX - currentX) * 0.055;
      currentY += (targetY - currentY) * 0.055;

      const dx = currentX - lastX;
      const facing = dx < -0.08 ? -1 : 1;
      const tilt = Math.max(-8, Math.min(8, (targetY - currentY) * 0.018));

      shark.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) translate(-50%, -50%) scaleX(${facing}) rotate(${tilt * facing}deg)`;

      lastX = currentX;
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", move);
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", move);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div ref={sharkRef} className="shark">
        <svg viewBox="0 0 180 92" className="h-full w-full" role="img">
          <defs>
            <linearGradient id="sharkBody" x1="22" y1="20" x2="142" y2="68" gradientUnits="userSpaceOnUse">
              <stop stopColor="#38bdf8" />
              <stop offset="0.55" stopColor="#2563eb" />
              <stop offset="1" stopColor="#1e40af" />
            </linearGradient>
            <linearGradient id="sharkBelly" x1="52" y1="52" x2="132" y2="78" gradientUnits="userSpaceOnUse">
              <stop stopColor="#f8fafc" />
              <stop offset="1" stopColor="#dbeafe" />
            </linearGradient>
          </defs>

          <path
            className="tail"
            d="M22 46C10 34 8 21 11 12C24 18 34 28 40 39C34 43 31 47 40 54C33 65 22 75 9 80C7 69 10 57 22 46Z"
            fill="#2563eb"
          />
          <path
            d="M41 45C60 20 102 10 139 25C159 33 171 45 173 48C165 54 151 61 132 66C94 76 59 68 41 45Z"
            fill="url(#sharkBody)"
          />
          <path
            d="M61 51C82 62 114 65 147 55C136 68 106 80 76 72C61 68 50 60 41 45C48 48 54 50 61 51Z"
            fill="url(#sharkBelly)"
            opacity="0.96"
          />
          <path
            className="fin-top"
            d="M89 24C98 8 108 3 121 2C119 17 111 26 100 32Z"
            fill="#1d4ed8"
          />
          <path
            className="fin-bottom"
            d="M92 63C101 76 111 83 124 86C122 72 113 63 101 57Z"
            fill="#1d4ed8"
            opacity="0.88"
          />
          <path
            d="M145 39C151 39 157 41 162 45"
            fill="none"
            stroke="#0f172a"
            strokeLinecap="round"
            strokeWidth="2.5"
            opacity="0.28"
          />
          <circle cx="139" cy="37" r="3.2" fill="#0f172a" />
          <circle cx="140.2" cy="35.9" r="1" fill="#ffffff" />
          <path
            d="M154 48C149 51 143 52 136 51"
            fill="none"
            stroke="#ffffff"
            strokeLinecap="round"
            strokeWidth="2.2"
            opacity="0.86"
          />
        </svg>
        <span className="bubble bubble-one" />
        <span className="bubble bubble-two" />
        <span className="bubble bubble-three" />
      </div>

      <style jsx>{`
        .shark {
          position: absolute;
          left: 0;
          top: 0;
          height: 4.8rem;
          width: 9.4rem;
          opacity: 0.9;
          filter: drop-shadow(0 18px 28px rgba(37, 99, 235, 0.16));
          transform: translate3d(72vw, 26vh, 0) translate(-50%, -50%);
          transform-origin: center;
          will-change: transform;
        }

        .tail {
          transform-origin: 38px 46px;
          animation: tailWave 820ms ease-in-out infinite alternate;
        }

        .fin-top {
          transform-origin: 98px 30px;
          animation: finFloat 1.7s ease-in-out infinite alternate;
        }

        .fin-bottom {
          transform-origin: 102px 60px;
          animation: finFloat 1.9s 120ms ease-in-out infinite alternate-reverse;
        }

        .bubble {
          position: absolute;
          left: -0.6rem;
          bottom: 1.8rem;
          border-radius: 999px;
          border: 1px solid rgba(59, 130, 246, 0.22);
          background: rgba(255, 255, 255, 0.62);
          animation: bubbleUp 3.2s ease-in-out infinite;
        }

        .bubble-one {
          height: 0.42rem;
          width: 0.42rem;
        }

        .bubble-two {
          height: 0.28rem;
          width: 0.28rem;
          animation-delay: 900ms;
        }

        .bubble-three {
          height: 0.22rem;
          width: 0.22rem;
          animation-delay: 1.7s;
        }

        @keyframes tailWave {
          from {
            transform: rotate(-7deg);
          }
          to {
            transform: rotate(9deg);
          }
        }

        @keyframes finFloat {
          from {
            transform: rotate(-2deg);
          }
          to {
            transform: rotate(5deg);
          }
        }

        @keyframes bubbleUp {
          0% {
            opacity: 0;
            transform: translate(0, 0) scale(0.7);
          }
          22% {
            opacity: 0.8;
          }
          100% {
            opacity: 0;
            transform: translate(-1.5rem, -2rem) scale(1.12);
          }
        }

        @media (max-width: 640px) {
          .shark {
            height: 3.7rem;
            width: 7.2rem;
            opacity: 0.78;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .shark {
            left: 78%;
            top: 24%;
            transform: translate(-50%, -50%);
          }

          .tail,
          .fin-top,
          .fin-bottom,
          .bubble {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}

