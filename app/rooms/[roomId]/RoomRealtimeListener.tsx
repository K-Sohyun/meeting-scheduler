"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type RoomRealtimeListenerProps = {
  roomId: string;
};

const DEBOUNCE_MS = 250;
/** Realtime 연결 전·실패 시에만 자주 물어봄 (분당 ~4회) */
const POLL_MS_FAST = 15000;
/** Realtime이 붙은 뒤는 이벤트가 주력이므로 안전망만 길게 (분당 ~1.3회) */
const POLL_MS_SLOW = 45000;

/**
 * `schedules` / `participants` 변경 시 서버 데이터를 다시 불러옵니다.
 * Supabase Realtime이 켜져 있으면 변경은 이벤트로 처리하고, 폴링은 느리게만 돕니다.
 * 탭이 안 보일 때는 폴링하지 않습니다.
 */
export function RoomRealtimeListener({ roomId }: RoomRealtimeListenerProps) {
  const router = useRouter();
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    let client: ReturnType<typeof createSupabaseBrowserClient>;
    try {
      client = createSupabaseBrowserClient();
    } catch {
      return;
    }

    const scheduleRefresh = () => {
      if (refreshTimerRef.current !== undefined) {
        clearTimeout(refreshTimerRef.current);
      }
      refreshTimerRef.current = setTimeout(() => {
        refreshTimerRef.current = undefined;
        router.refresh();
      }, DEBOUNCE_MS);
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        scheduleRefresh();
      }
    };

    let pollId: number | undefined;
    const setPollInterval = (ms: number) => {
      if (pollId !== undefined) {
        window.clearInterval(pollId);
        pollId = undefined;
      }
      pollId = window.setInterval(() => {
        if (document.visibilityState === "visible") {
          scheduleRefresh();
        }
      }, ms);
    };

    setPollInterval(POLL_MS_FAST);

    const ch = client
      .channel(`room-${roomId}-updates`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "schedules", filter: `room_id=eq.${roomId}` },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "participants",
          filter: `room_id=eq.${roomId}`,
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "travel_segment_starts",
          filter: `room_id=eq.${roomId}`,
        },
        scheduleRefresh,
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setPollInterval(POLL_MS_SLOW);
          return;
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setPollInterval(POLL_MS_FAST);
          scheduleRefresh();
        }
      });

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", scheduleRefresh);

    return () => {
      if (refreshTimerRef.current !== undefined) {
        clearTimeout(refreshTimerRef.current);
      }
      if (pollId !== undefined) {
        window.clearInterval(pollId);
      }
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", scheduleRefresh);
      void client.removeChannel(ch);
    };
  }, [roomId, router]);

  return null;
}
