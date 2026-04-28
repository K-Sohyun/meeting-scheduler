"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type RoomRealtimeListenerProps = {
  roomId: string;
};

/**
 * `schedules` / `participants` 변경 시 서버 데이터를 다시 불러옵니다.
 * Supabase 대시보드 → Database → Tables → `schedules`, `participants` → Realtime ON
 */
export function RoomRealtimeListener({ roomId }: RoomRealtimeListenerProps) {
  const router = useRouter();

  useEffect(() => {
    let client: ReturnType<typeof createSupabaseBrowserClient>;
    try {
      client = createSupabaseBrowserClient();
    } catch {
      return;
    }

    const refresh = () => {
      router.refresh();
    };

    const ch = client
      .channel(`room-${roomId}-updates`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "schedules", filter: `room_id=eq.${roomId}` },
        refresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "participants",
          filter: `room_id=eq.${roomId}`,
        },
        refresh,
      )
      .subscribe();

    return () => {
      void client.removeChannel(ch);
    };
  }, [roomId, router]);

  return null;
}
