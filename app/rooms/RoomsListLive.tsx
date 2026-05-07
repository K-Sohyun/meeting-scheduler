"use client";

import Link from "next/link";
import { useEffect } from "react";
import useSWR from "swr";

type RoomListItem = {
  id: string;
  name: string;
  type: "single" | "travel";
  date_range_start: string;
  date_range_end: string;
  password_hash: string | null;
  is_closed: boolean | null;
  fixed_start_date: string | null;
};

type RoomsListPayload = {
  rooms: RoomListItem[];
};

type RoomsListLiveProps = {
  initialRooms: RoomListItem[];
};

const fetcher = async (url: string): Promise<RoomsListPayload> => {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    throw new Error("rooms list fetch failed");
  }
  return (await response.json()) as RoomsListPayload;
};

export function RoomsListLive({ initialRooms }: RoomsListLiveProps) {
  const { data, mutate } = useSWR<RoomsListPayload>("/api/rooms/list", fetcher, {
    fallbackData: { rooms: initialRooms },
    revalidateOnFocus: true,
    refreshInterval: 0,
  });

  useEffect(() => {
    const onRequestedRevalidate = () => {
      void mutate();
    };
    window.addEventListener("rooms-list-revalidate", onRequestedRevalidate);
    return () => window.removeEventListener("rooms-list-revalidate", onRequestedRevalidate);
  }, [mutate]);

  const rooms = data?.rooms ?? initialRooms;

  return (
    <section className="mt-5 rounded-2xl bg-app-card p-5 shadow-sm">
      <div
        className="grid max-h-[min(60dvh,26rem)] gap-3 overflow-y-auto overscroll-y-contain"
        role="region"
        aria-label="방 목록"
      >
        {rooms.length > 0 ? (
          rooms.map((room) => {
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
                {isCompleted ? <p className="mt-1 text-xs text-zinc-600">일정이 확정된 방</p> : null}
              </Link>
            );
          })
        ) : (
          <p className="text-sm text-app-muted">아직 생성된 방이 없습니다.</p>
        )}
      </div>
    </section>
  );
}
