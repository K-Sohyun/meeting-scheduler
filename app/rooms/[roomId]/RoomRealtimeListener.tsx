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

    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      if (refreshTimer !== undefined) {
        clearTimeout(refreshTimer);
      }
      /** DELETE 후 INSERT 등 연속 이벤트가 끝난 뒤 한 번만 갱신해, 중간 상태가 화면에 남지 않게 함 */
      refreshTimer = setTimeout(() => {
        refreshTimer = undefined;
        router.refresh();
      }, 200);
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
      if (refreshTimer !== undefined) {
        clearTimeout(refreshTimer);
      }
      void client.removeChannel(ch);
    };
  }, [roomId, router]);

  return null;
}
