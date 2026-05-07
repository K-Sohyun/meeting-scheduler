import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { RoomsActionToast } from "./RoomsActionToast";
import { RoomsListLive } from "./RoomsListLive";
import { RoomsRealtimeListener } from "./RoomsRealtimeListener";

export default async function RoomsPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string; created?: string }>;
}) {
  const { deleted, created } = await searchParams;
  const supabase = createSupabaseServerClient();
  const { data: rooms } = await supabase
    .from("rooms")
    .select(
      "id, name, type, date_range_start, date_range_end, created_at, password_hash, is_closed, fixed_start_date",
    )
    .order("created_at", { ascending: false })
    .limit(30);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-5 pb-6 pt-8">
      <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm" aria-label="페이지 이동">
        <Link
          href="/"
          className="rounded-full bg-app-primary-soft px-3 py-1.5 font-medium text-app-primary"
        >
          홈
        </Link>
        <span
          className="rounded-full bg-app-card px-3 py-1.5 font-medium text-app-text shadow-sm ring-1 ring-violet-100"
          aria-current="page"
        >
          방 리스트
        </span>
      </nav>
      <header className="rounded-2xl bg-app-card p-5 shadow-sm">
        <p className="text-sm font-medium text-app-primary">방 리스트</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">참여할 방을 선택하세요.</h1>
        <p className="mt-2 text-sm text-app-muted">
          방을 클릭하면 닉네임 참여 화면으로 이동합니다.
        </p>
      </header>
      <RoomsActionToast deleted={deleted === "1"} createdRoomId={created} />
      <RoomsRealtimeListener />

      <RoomsListLive initialRooms={rooms ?? []} />

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link
          href="/rooms/new?type=single"
          className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-app-primary text-sm font-semibold text-white"
        >
          일반 모임 생성
        </Link>
        <Link
          href="/rooms/new?type=travel"
          className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-violet-200 bg-white text-sm font-semibold text-app-primary"
        >
          여행 모임 생성
        </Link>
      </div>
    </main>
  );
}
