import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DeletedAlert } from "./DeletedAlert";

export default async function RoomsPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  const { deleted } = await searchParams;
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
      <DeletedAlert deleted={deleted === "1"} />

      <section className="mt-5 rounded-2xl bg-app-card p-5 shadow-sm">
        <div
          className="grid max-h-[min(60dvh,26rem)] gap-3 overflow-y-auto overscroll-y-contain pr-0.5 [scrollbar-gutter:stable]"
          role="region"
          aria-label="방 목록"
        >
          {rooms && rooms.length > 0 ? (
            rooms.map((room) => {
              // 완료 기준: 모집 마감 + 확정 일정 존재
              // (확정 해제 시 다시 일반 상태로 돌아감)
              const isCompleted = Boolean(room.is_closed && room.fixed_start_date);
              return (
                <Link
                  key={room.id}
                  href={`/rooms/${room.id}`}
                  className={`rounded-xl border px-3 py-3 ${
                    isCompleted ? "border-zinc-200 bg-zinc-100" : "border-violet-100 bg-white"
                  }`}
                >
                  <p className="flex items-center text-sm text-app-muted">
                    {room.type === "travel" ? "여행 모임" : "일반 모임"}
                    {room.password_hash ? (
                      <span
                        aria-label="비밀번호가 설정된 방"
                        className="select-none text-xs"
                        title="비밀번호가 설정된 방"
                      >
                        🔒
                      </span>
                    ) : null}
                  </p>
                  <h2 className="mt-1 text-base font-semibold">{room.name}</h2>
                  <p className="mt-1 text-xs text-app-muted">
                    {room.date_range_start} ~ {room.date_range_end}
                  </p>
                  {isCompleted ? <p className="mt-1 text-xs text-zinc-600">일정이 확정된 모임</p> : null}
                </Link>
              );
            })
          ) : (
            <p className="text-sm text-app-muted">아직 생성된 방이 없습니다.</p>
          )}
        </div>
      </section>

      <div className="mt-4 flex flex-col gap-2">
        <Link
          href="/rooms/new?type=single"
          className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-app-primary text-sm font-semibold text-white"
        >
          새 방 만들기
        </Link>
      </div>
    </main>
  );
}
