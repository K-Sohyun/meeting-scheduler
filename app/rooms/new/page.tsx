import Link from "next/link";
import { InlineMessage } from "@/components/ui/InlineMessage";
import { CreateRoomForm } from "./CreateRoomForm";

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
          <InlineMessage tone="error" className="mb-4">
            {error}
          </InlineMessage>
        ) : null}
        <CreateRoomForm roomType={roomType} buttonLabel={content.buttonLabel} />
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
