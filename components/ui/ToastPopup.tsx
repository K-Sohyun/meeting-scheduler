"use client";

type ToastPopupProps = {
  message: string;
};

export function ToastPopup({ message }: ToastPopupProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-20 flex justify-center px-4">
      <div className="flex min-w-[280px] max-w-[360px] items-center gap-2.5 rounded-xl bg-slate-600/95 px-4 py-3 text-sm font-semibold text-white shadow-lg">
        <span
          className="inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-emerald-400 text-[11px] leading-none text-white"
          aria-hidden
        >
          ✓
        </span>
        <p className="truncate">{message}</p>
      </div>
    </div>
  );
}
