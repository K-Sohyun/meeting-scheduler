"use client";

import {
  addMonths,
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getDay,
  isAfter,
  isBefore,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ko } from "date-fns/locale";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { InlineMessage } from "@/components/ui/InlineMessage";
import { ToastPopup } from "@/components/ui/ToastPopup";

type Holiday = {
  date: string;
  name: string;
};

type RoomInfo = {
  id: string;
  type: "single" | "travel";
  nights: number | null;
  dateRangeStart: string;
  dateRangeEnd: string;
};

type ScheduleStatus = "best" | "ok";
type ScheduleMap = Record<string, ScheduleStatus>;
type MessageTone = "success" | "error" | "info" | "neutral";

type ScheduleCalendarProps = {
  room: RoomInfo;
  participant: {
    id: string;
    nickname: string;
  };
  holidays: Holiday[];
  readOnly: boolean;
};

const statusLabel: Record<ScheduleStatus, string> = {
  best: "선호",
  ok: "가능",
};

function cycleStatus(current?: ScheduleStatus): ScheduleStatus | undefined {
  if (current === "ok") {
    return "best";
  }
  if (current === "best") {
    return undefined;
  }
  return "ok";
}

function buildTravelSelection(startDate: string, nights: number): ScheduleMap {
  const start = parseISO(startDate);
  const result: ScheduleMap = {};

  for (let offset = 0; offset <= nights; offset += 1) {
    const date = format(addDays(start, offset), "yyyy-MM-dd");
    result[date] = "best";
  }

  return result;
}

function mergeTravelSelection(current: ScheduleMap, startDate: string, nights: number): {
  next: ScheduleMap;
  added: number;
} {
  const range = buildTravelSelection(startDate, nights);
  const next = { ...current };
  let added = 0;
  for (const [date, status] of Object.entries(range)) {
    if (next[date] !== status) {
      added += 1;
    }
    next[date] = status;
  }
  return { next, added };
}

function removeTravelChunkContaining(current: ScheduleMap, date: string): ScheduleMap {
  if (!current[date]) {
    return { ...current };
  }
  const next = { ...current };
  const pivot = parseISO(date);

  for (let offset = 0; ; offset += 1) {
    const d = format(addDays(pivot, -offset), "yyyy-MM-dd");
    if (!next[d]) {
      break;
    }
    delete next[d];
  }
  for (let offset = 1; ; offset += 1) {
    const d = format(addDays(pivot, offset), "yyyy-MM-dd");
    if (!next[d]) {
      break;
    }
    delete next[d];
  }
  return next;
}

function removeTravelChunksOverlappingRange(
  current: ScheduleMap,
  startDate: string,
  nights: number,
): ScheduleMap {
  let next = { ...current };
  const start = parseISO(startDate);
  for (let offset = 0; offset <= nights; offset += 1) {
    const date = format(addDays(start, offset), "yyyy-MM-dd");
    if (next[date]) {
      next = removeTravelChunkContaining(next, date);
    }
  }
  return next;
}

function isTravelChunkStart(current: ScheduleMap, date: string): boolean {
  if (!current[date]) {
    return false;
  }
  const prevDate = format(addDays(parseISO(date), -1), "yyyy-MM-dd");
  return !current[prevDate];
}

export function ScheduleCalendar({
  room,
  participant,
  holidays,
  readOnly,
}: ScheduleCalendarProps) {
  const router = useRouter();
  const [schedules, setSchedules] = useState<ScheduleMap>({});
  const [savedSchedules, setSavedSchedules] = useState<ScheduleMap>({});
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<MessageTone>("info");
  const [toastMessage, setToastMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [loadState, setLoadState] = useState<"loading" | "ok" | "unauthorized" | "error">(
    "loading",
  );
  const [currentMonth, setCurrentMonth] = useState<Date>(() =>
    startOfMonth(parseISO(room.dateRangeStart)),
  );

  const holidayMap = useMemo(
    () => new Map(holidays.map((holiday) => [holiday.date, holiday.name])),
    [holidays],
  );
  const roomStart = parseISO(room.dateRangeStart);
  const roomEnd = parseISO(room.dateRangeEnd);

  function clearMessage() {
    setMessage("");
    setMessageTone("info");
  }

  function showMessage(text: string, tone: MessageTone) {
    setMessage(text);
    setMessageTone(tone);
  }

  useEffect(() => {
    if (!toastMessage) {
      return;
    }
    const timeoutId = window.setTimeout(() => setToastMessage(""), 2500);
    return () => window.clearTimeout(timeoutId);
  }, [toastMessage]);

  useEffect(() => {
    async function fetchSchedules() {
      setLoadState("loading");
      clearMessage();
      const response = await fetch(`/api/rooms/${room.id}/schedules`, {
        credentials: "include",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        entries?: { date: string; status: ScheduleStatus }[];
      };

      if (response.status === 401) {
        setLoadState("unauthorized");
        showMessage(payload.error ?? "참여 세션이 없습니다. 닉네임으로 다시 참여해 주세요.", "error");
        setSchedules({});
        setSavedSchedules({});
        return;
      }

      if (!response.ok) {
        setLoadState("error");
        showMessage(payload.error ?? "일정 데이터를 불러오지 못했습니다.", "error");
        setSchedules({});
        setSavedSchedules({});
        return;
      }

      const map: ScheduleMap = {};
      (payload.entries ?? []).forEach((entry) => {
        map[entry.date] = entry.status;
      });
      setSchedules(map);
      setSavedSchedules(map);
      setLoadState("ok");
    }

    void fetchSchedules();
  }, [room.id]);

  async function persist(nextSchedules: ScheduleMap) {
    if (readOnly) {
      return;
    }
    setIsSaving(true);
    clearMessage();
    const entries = Object.entries(nextSchedules).map(([date, status]) => ({ date, status }));
    const response = await fetch(`/api/rooms/${room.id}/schedules`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entries,
      }),
    });

    setIsSaving(false);
    if (response.status === 401) {
      setLoadState("unauthorized");
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      showMessage(data.error ?? "참여 세션이 없습니다. 닉네임으로 다시 참여해 주세요.", "error");
      return;
    }
    if (!response.ok) {
      const data = (await response.json().catch(() => ({ error: "저장 실패" }))) as {
        error?: string;
      };
      showMessage(data.error ?? "일정 저장에 실패했습니다.", "error");
      return;
    }

    setSchedules(nextSchedules);
    setSavedSchedules(nextSchedules);
    showMessage("일정이 저장되었습니다.", "success");
    setToastMessage("일정이 저장되었습니다.");
    router.refresh();
    window.setTimeout(() => {
      router.refresh();
    }, 220);
  }

  function onDateClick(date: string) {
    if (isSaving || readOnly) {
      return;
    }

    if (room.type === "travel") {
      const nights = room.nights ?? 0;
      const start = parseISO(date);
      const end = addDays(start, nights);
      if (isAfter(end, roomEnd)) {
        showMessage(`여행 모임은 ${nights + 1}일 연속 선택이 가능한 시작일만 선택할 수 있어요.`, "error");
        return;
      }

      if (schedules[date] && isTravelChunkStart(schedules, date)) {
        const removed = removeTravelChunkContaining(schedules, date);
        setSchedules(removed);
        showMessage(`선택한 시작일의 여행 일정 ${nights + 1}일 구간을 해제했어요.`, "info");
        return;
      }

      const baseSchedules = schedules[date]
        ? removeTravelChunkContaining(schedules, date)
        : schedules;
      const cleaned = removeTravelChunksOverlappingRange(baseSchedules, date, nights);
      const merged = mergeTravelSelection(cleaned, date, nights);
      if (merged.added === 0) {
        showMessage("이미 포함된 여행 일정이에요.", "info");
        return;
      }
      setSchedules(merged.next);
      showMessage(`여행 일정 ${nights + 1}일 구간을 반영했어요. 저장 버튼을 눌러 주세요.`, "info");
      return;
    }

    const next = { ...schedules };
    const nextStatus = cycleStatus(next[date]);
    if (!nextStatus) {
      delete next[date];
    } else {
      next[date] = nextStatus;
    }
    setSchedules(next);
    showMessage("선택 내용을 확인한 뒤 저장 버튼을 눌러 주세요.", "info");
  }

  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(schedules) !== JSON.stringify(savedSchedules),
    [savedSchedules, schedules],
  );

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const canGoPrevMonth = isAfter(monthStart, startOfMonth(roomStart));
  const canGoNextMonth = isBefore(monthEnd, endOfMonth(roomEnd));

  if (loadState === "unauthorized") {
    return (
      <section className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-5">
        <h2 className="text-base font-semibold text-red-800">참여가 필요해요</h2>
        <p className="mt-2 text-sm text-red-800/90">{message}</p>
        <p className="mt-1 text-xs text-red-700/80">
          (이전에 쿠키 설정 방식이 달랐다면) 아래에서 다시 참여하면 캘린더가 열립니다.
        </p>
        <Link
          href={`/rooms/${room.id}`}
          className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-xl bg-app-primary text-sm font-semibold text-white"
        >
          닉네임으로 다시 참여하기
        </Link>
      </section>
    );
  }

  return (
    <section className="mt-5 rounded-2xl bg-app-card p-5 shadow-sm">
      <h2 className="text-base font-semibold">날짜 선택</h2>
      {room.type === "travel" ? (
        <p className="mt-1 text-sm text-app-muted">
          {participant.nickname}님의 캘린더입니다. <br />
          시작일 클릭 시 {room.nights ?? 0}박 {(room.nights ?? 0) + 1}일이 자동으로 선호로 선택됩니다.
        </p>
      ) : (
        <p className="mt-1 text-sm text-app-muted">
          {participant.nickname}님의 캘린더입니다. <br />
          날짜를 클릭하면 불가능(기본) → 가능 → 선호 순으로 변경됩니다.
        </p>
      )}
      {readOnly ? (
        <p className="mt-1 rounded-xl bg-zinc-100 px-3 py-2 text-sm text-zinc-700">
          모집이 마감되어 일정은 읽기 전용입니다.
        </p>
      ) : null}

      {loadState === "loading" ? (
        <p className="mt-3 text-sm text-app-muted">일정을 불러오는 중...</p>
      ) : null}
      {loadState === "error" && message ? (
        <InlineMessage tone="error" className="mt-3">
          {message}
        </InlineMessage>
      ) : null}
      {loadState === "ok" && message ? (
        <InlineMessage
          tone={
            messageTone === "success"
              ? "success"
              : messageTone === "error"
                ? "error"
                : messageTone === "neutral"
                  ? "neutral"
                  : "info"
          }
          className="mt-3"
        >
          {message}
        </InlineMessage>
      ) : null}

      <div className="mt-4 rounded-xl border border-violet-100 p-3">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setCurrentMonth((prev) => addMonths(prev, -1))}
            disabled={!canGoPrevMonth}
            className="rounded-md bg-app-primary-soft px-2 py-1 text-xs text-app-primary disabled:opacity-40"
          >
            이전달
          </button>
          <h3 className="text-sm font-semibold">{format(currentMonth, "yyyy년 M월", { locale: ko })}</h3>
          <button
            type="button"
            onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}
            disabled={!canGoNextMonth}
            className="rounded-md bg-app-primary-soft px-2 py-1 text-xs text-app-primary disabled:opacity-40"
          >
            다음달
          </button>
        </div>
        <div className="mb-2 grid grid-cols-7 text-center text-xs text-app-muted">
          {["일", "월", "화", "수", "목", "금", "토"].map((dayLabel) => (
            <span key={dayLabel}>{dayLabel}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const dateKey = format(day, "yyyy-MM-dd");
            const inRoomRange = !isBefore(day, roomStart) && !isAfter(day, roomEnd);
            const inCurrentMonth = isSameMonth(day, currentMonth);
            const holidayName = holidayMap.get(dateKey);
            const isSunday = getDay(day) === 0;
            const status = schedules[dateKey];

            let statusClass = "bg-white text-app-text";
            if (status === "ok") {
              statusClass = "bg-amber-100 text-amber-900";
            }
            if (status === "best") {
              statusClass = "bg-red-200 text-amber-800";
            }

            return (
              <button
                type="button"
                key={dateKey}
                disabled={
                  loadState !== "ok" || !inRoomRange || !inCurrentMonth || isSaving || readOnly
                }
                onClick={() => onDateClick(dateKey)}
                className={`min-h-[58px] rounded-lg border border-violet-100 px-1 py-1 text-left text-xs transition ${
                  inCurrentMonth ? statusClass : "bg-zinc-100 text-zinc-400"
                } ${!inRoomRange ? "opacity-40" : ""}`}
              >
                <div className={isSunday || holidayName ? "text-red-600" : ""}>
                  {format(day, "d")}
                </div>
                {holidayName ? <div className="truncate text-[10px] text-red-600">{holidayName}</div> : null}
                {status ? (
                  <div className="mt-1 truncate text-[10px] font-medium">
                    {statusLabel[status]}
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={readOnly || !hasUnsavedChanges || isSaving}
          onClick={() => void persist(schedules)}
          className="h-10 w-full rounded-xl bg-app-primary px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          {isSaving ? "저장 중..." : "저장하기"}
        </button>
        <button
          type="button"
          disabled={readOnly || !hasUnsavedChanges || isSaving}
          onClick={() => {
            setSchedules(savedSchedules);
            showMessage("마지막 저장 상태로 되돌렸습니다.", "neutral");
          }}
          className="h-10 w-full rounded-xl bg-app-primary-soft px-4 text-sm font-medium text-app-primary disabled:opacity-50"
        >
          변경 취소
        </button>
      </div>
      {toastMessage ? (
        <ToastPopup message={toastMessage} />
      ) : null}
    </section>
  );
}
