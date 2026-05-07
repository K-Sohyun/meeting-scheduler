"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type RoomRealtimeListenerProps = {
  roomId: string;
  /** full: RSC `router.refresh` + 결과 SWR용 이벤트 · light: 이벤트만(캘린더·중복 Realtime 방지) */
  variant?: "full" | "light";
  /** light 변형에서도 필요한 경우 RSC를 즉시 갱신(예: 방장의 모집 마감 버튼 노출) */
  refreshOnLight?: boolean;
};

const DEBOUNCE_MS = 250;
/** Realtime 연결 전·실패 시에만 물어봄 (분당 ~2회) */
const POLL_MS_FAST = 30000;
/** Realtime이 붙은 뒤는 이벤트가 주력이므로 안전망만 매우 길게 (분당 ~0.7회) */
const POLL_MS_SLOW = 90000;

/**
 * `schedules` / `participants` 변경 시 서버 데이터를 다시 불러옵니다.
 * Supabase Realtime이 켜져 있으면 변경은 이벤트로 처리하고, 폴링은 느리게만 돕니다.
 * 탭이 안 보일 때는 폴링하지 않습니다.
 *
 * `variant=light`(캘린더): 전체 RSC 갱신 없이 `room-results-revalidate`만 보냅니다.
 */
export function RoomRealtimeListener({
  roomId,
  variant = "full",
  refreshOnLight = false,
}: RoomRealtimeListenerProps) {
  const router = useRouter();
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    let client: ReturnType<typeof createSupabaseBrowserClient>;
    try {
      client = createSupabaseBrowserClient();
    } catch {
      return;
    }

    const scheduleRefresh = (forceRscRefresh = false) => {
      if (refreshTimerRef.current !== undefined) {
        clearTimeout(refreshTimerRef.current);
      }
      refreshTimerRef.current = setTimeout(() => {
        refreshTimerRef.current = undefined;
        window.dispatchEvent(
          new CustomEvent("room-results-revalidate", { detail: { roomId } }),
        );
        if (variant !== "light" || refreshOnLight || forceRscRefresh) {
          router.refresh();
        }
      }, DEBOUNCE_MS);
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        scheduleRefresh();
      }
    };
    const onOnline = () => scheduleRefresh();

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
        { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
        () => scheduleRefresh(true),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "schedules", filter: `room_id=eq.${roomId}` },
        () => scheduleRefresh(false),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "participants",
          filter: `room_id=eq.${roomId}`,
        },
        () => scheduleRefresh(false),
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
    window.addEventListener("online", onOnline);

    return () => {
      if (refreshTimerRef.current !== undefined) {
        clearTimeout(refreshTimerRef.current);
      }
      if (pollId !== undefined) {
        window.clearInterval(pollId);
      }
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      void client.removeChannel(ch);
    };
  }, [refreshOnLight, roomId, router, variant]);

  return null;
}
