"use client";

import { useState } from "react";

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

  return (
    <form
      className="grid gap-3"
      action={`/rooms/${roomId}/join`}
      method="post"
      onSubmit={() => {
        window.localStorage.setItem(nicknameStorageKey(roomId), nickname.trim());
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
          className="h-11 rounded-xl border border-violet-100 px-3 text-sm outline-none focus:ring-2 focus:ring-violet-300"
        />
      </label>

      <button
        type="submit"
        className="h-11 rounded-xl bg-app-primary text-sm font-semibold text-white"
      >
        참여하기
      </button>
    </form>
  );
}
