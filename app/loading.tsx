"use client";

export default function AppLoading() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col items-center justify-center px-5 pb-6 pt-8">
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-app-card px-6 py-5 shadow-sm">
        <span
          className="h-7 w-7 animate-spin rounded-full border-2 border-violet-200 border-t-app-primary"
          aria-hidden
        />
        <p className="text-sm text-app-muted">화면을 불러오는 중이에요.</p>
      </div>
    </main>
  );
}
