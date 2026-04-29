"use client";

import { useState } from "react";
import { calendarCookieRetryStorageKey } from "./CalendarAccessRetry";

type JoinFormProps = {
  roomId: string;
};

function nicknameStorageKey(roomId: string) {
  return `meeting-scheduler:nickname:${roomId}`;
}

export function JoinForm({ roomId }: JoinFormProps) {
  const [nickname, setNickname] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return window.localStorage.getItem(nicknameStorageKey(roomId)) ?? "";
  });
  const [submitting, setSubmitting] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  return (
    <form
      className="grid gap-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setClientError(null);
        const trimmed = nickname.trim();
        window.localStorage.setItem(nicknameStorageKey(roomId), trimmed);
        sessionStorage.removeItem(calendarCookieRetryStorageKey(roomId));

        const body = new FormData();
        body.set("nickname", trimmed);

        setSubmitting(true);
        try {
          const res = await fetch(`/rooms/${roomId}/join`, {
            method: "POST",
            body,
            credentials: "include",
            headers: { Accept: "application/json" },
          });

          let data: { ok: boolean; error?: string; redirect?: string };
          try {
            data = (await res.json()) as { ok: boolean; error?: string; redirect?: string };
          } catch {
            setClientError("응답을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.");
            setSubmitting(false);
            return;
          }

          if (!data.ok || !data.redirect) {
            setClientError(data.error ?? "참여에 실패했습니다. 다시 시도해 주세요.");
            setSubmitting(false);
            return;
          }

          // 일부 모바일/WebView는 fetch 응답의 Set-Cookie 커밋 직후 곧바로 이동하면
          // 다음 문서 요청에 쿠키가 안 실리는 경우가 있어 한 틱 늦춤.
          const target = data.redirect;
          setTimeout(() => {
            window.location.assign(target);
          }, 50);
        } catch {
          setClientError("네트워크 오류가 났습니다. 연결을 확인해 주세요.");
          setSubmitting(false);
        }
      }}
    >
      <label className="grid gap-1">
        <span className="text-sm font-medium">닉네임</span>
        <input
          name="nickname"
          type="text"
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          placeholder="예: 길동"
          minLength={2}
          maxLength={20}
          required
          disabled={submitting}
          className="h-11 rounded-xl border border-violet-100 px-3 text-sm outline-none focus:ring-2 focus:ring-violet-300 disabled:opacity-60"
        />
      </label>

      {clientError ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{clientError}</p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="h-11 rounded-xl bg-app-primary text-sm font-semibold text-white disabled:opacity-60"
      >
        {submitting ? "처리 중…" : "참여하기"}
      </button>
    </form>
  );
}
