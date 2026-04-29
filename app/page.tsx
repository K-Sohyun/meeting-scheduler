import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-5 pb-6 pt-8">
      <header className="rounded-2xl bg-app-card p-5 shadow-sm">
        <p className="text-sm font-medium text-app-primary">모여라</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight break-keep">
        약속과 여행 일정을 빠르게 맞춰보세요!
        </h1>
        <p className="mt-3 text-sm leading-6 text-app-muted">
          닉네임으로 쉽게 참여하고, 가능한 날짜를 한눈에 확인할 수 있어요.
        </p>
      </header>

      <section className="mt-5 grid gap-3">
        <Link
          href="/rooms"
          className="flex items-center justify-center rounded-2xl border border-violet-200 bg-app-card py-3 text-sm font-semibold text-app-text shadow-sm"
        >
          기존 방에 참여하기
        </Link>
        <Link
          href="/rooms/new?type=single"
          className="rounded-2xl bg-app-primary p-4 text-white shadow-sm"
        >
          <p className="text-sm opacity-90">일반 모임</p>
          <h2 className="mt-1 text-lg font-semibold">날짜 선택 시작하기</h2>
        </Link>
        <Link
          href="/rooms/new?type=travel"
          className="rounded-2xl bg-app-card p-4 text-app-text shadow-sm ring-1 ring-violet-100"
        >
          <p className="text-sm text-app-muted">여행 모임</p>
          <h2 className="mt-1 text-lg font-semibold">N박 선택 시작하기</h2>
        </Link>
      </section>

      <footer className="mt-auto pt-6 text-center text-xs text-app-muted">
        Copyright &copy; 2026. Sohyun. All rights reserved.
      </footer>
    </main>
  );
}
