"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

export function calendarCookieRetryStorageKey(roomId: string) {
  return `meeting-scheduler:calendar-cookie-retry:${roomId}`;
}

type CalendarAccessRetryProps = {
  roomId: string;
  /** 참여 직후 리다이렉트(`joined=1`)일 때만 1회 새로고침해 쿠키 지연을 흡수 */
  fromJoin: boolean;
  children: ReactNode;
};

export function CalendarAccessRetry({ roomId, fromJoin, children }: CalendarAccessRetryProps) {
  const router = useRouter();

  useEffect(() => {
    if (!fromJoin) return;
    if (typeof window === "undefined") return;

    const key = calendarCookieRetryStorageKey(roomId);
    if (sessionStorage.getItem(key) === "1") return;

    sessionStorage.setItem(key, "1");
    const id = window.setTimeout(() => {
      router.refresh();
    }, 150);

    return () => window.clearTimeout(id);
  }, [fromJoin, roomId, router]);

  return <>{children}</>;
}
