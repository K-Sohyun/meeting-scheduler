import Link from "next/link";

type RoomType = "single" | "travel";

const roomTypeContent: Record<
  RoomType,
  { title: string; description: string; buttonLabel: string }
> = {
  single: {
    title: "일반 모임 방 만들기",
    description: "참여자들이 날짜를 자유롭게 고릅니다.",
    buttonLabel: "일반 모임 만들기",
  },
  travel: {
    title: "여행 모임 방 만들기",
    description: "여행 모임에서는 N박 기준으로 N+1일 연속 구간을 고릅니다.",
    buttonLabel: "여행 모임 만들기",
  },
};

function getRoomType(rawType: string | undefined): RoomType {
  return rawType === "travel" ? "travel" : "single";
}

export default async function NewRoomPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; error?: string }>;
}) {
  const { type, error } = await searchParams;
  const roomType = getRoomType(type);
  const content = roomTypeContent[roomType];

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-5 pb-6 pt-8">
      <header className="rounded-2xl bg-app-card p-5 shadow-sm">
        <p className="text-sm font-medium text-app-primary">방 생성</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{content.title}</h1>
        <p className="mt-3 text-sm leading-6 text-app-muted">{content.description}</p>
      </header>

      <section className="mt-5 rounded-2xl bg-app-card p-5 shadow-sm">
        {error ? (
          <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        <form className="grid gap-4" method="post" action="/rooms/new/create">
          <input type="hidden" name="type" value={roomType} />
          <label className="grid gap-1">
            <span className="text-sm font-medium">방 이름</span>
            <input
              name="name"
              type="text"
              placeholder="예: 맛집 도장 깨기 원정대"
              required
              className="h-11 rounded-xl border border-violet-100 px-3 text-sm outline-none focus:ring-2 focus:ring-violet-300"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium">시작일</span>
            <input
              name="dateRangeStart"
              type="date"
              required
              className="h-11 rounded-xl border border-violet-100 px-3 text-sm outline-none focus:ring-2 focus:ring-violet-300"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium">종료일</span>
            <input
              name="dateRangeEnd"
              type="date"
              required
              className="h-11 rounded-xl border border-violet-100 px-3 text-sm outline-none focus:ring-2 focus:ring-violet-300"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium">
              예상 인원수
            </span>
            <input
              name="expectedParticipantCount"
              type="number"
              min={1}
              max={200}
              defaultValue={5}
              required
              className="h-11 rounded-xl border border-violet-100 px-3 text-sm outline-none focus:ring-2 focus:ring-violet-300"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium">방 비밀번호 (선택)</span>
            <input
              name="roomPassword"
              type="password"
              placeholder="미입력 시 공개 링크로 참여"
              minLength={4}
              maxLength={30}
              className="h-11 rounded-xl border border-violet-100 px-3 text-sm outline-none focus:ring-2 focus:ring-violet-300"
            />
          </label>

          {roomType === "travel" ? (
            <label className="grid gap-1">
              <span className="text-sm font-medium">N박</span>
              <input
                name="nights"
                type="number"
                min={1}
                max={30}
                defaultValue={2}
                required
                className="h-11 rounded-xl border border-violet-100 px-3 text-sm outline-none focus:ring-2 focus:ring-violet-300"
              />
            </label>
          ) : null}

          <button
            type="submit"
            className="mt-1 h-11 rounded-xl bg-app-primary text-sm font-semibold text-white"
          >
            {content.buttonLabel}
          </button>
        </form>
      </section>

      <Link
        href="/"
        className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-xl bg-app-primary-soft text-sm font-medium text-app-primary"
      >
        홈으로 돌아가기
      </Link>
    </main>
  );
}
