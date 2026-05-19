import * as React from "react";
import { cn } from "@/lib/utils";

interface ProgressProps {
  value: number; // 0-100
  className?: string;
  barClassName?: string;
}

export function Progress({ value, className, barClassName }: ProgressProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn(
        "h-2 w-full overflow-hidden rounded-full bg-slate-200",
        className
      )}
    >
      <div
        className={cn(
          "h-full rounded-full bg-blue-500 transition-all",
          barClassName
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
