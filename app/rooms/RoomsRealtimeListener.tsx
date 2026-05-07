"use client";

import { useEffect, useRef } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const DEBOUNCE_MS = 250;
const POLL_MS_FAST = 30000;
const POLL_MS_SLOW = 90000;

export function RoomsRealtimeListener() {
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
        window.dispatchEvent(new CustomEvent("rooms-list-revalidate"));
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
      .channel("rooms-list-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, scheduleRefresh)
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
  }, []);

  return null;
}
