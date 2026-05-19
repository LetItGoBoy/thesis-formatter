import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "w-full rounded-md border border-slate-300 bg-white p-2 text-sm",
      "focus:outline-none focus:ring-2 focus:ring-blue-500",
      "resize-y",
      className
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
