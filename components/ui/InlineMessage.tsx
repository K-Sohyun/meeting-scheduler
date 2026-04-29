import type { ReactNode } from "react";

type InlineMessageTone = "success" | "info" | "error";

const toneClasses: Record<InlineMessageTone, string> = {
  success: "bg-emerald-50 text-emerald-800",
  info: "bg-violet-50 text-violet-700",
  error: "bg-red-50 text-red-700",
};

type InlineMessageProps = {
  tone: InlineMessageTone;
  children: ReactNode;
  className?: string;
};

export function InlineMessage({ tone, children, className = "" }: InlineMessageProps) {
  return (
    <p className={`rounded-xl px-3 py-2 text-sm ${toneClasses[tone]} ${className}`.trim()}>{children}</p>
  );
}
