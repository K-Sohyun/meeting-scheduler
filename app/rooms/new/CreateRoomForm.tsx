"use client";

import { useState } from "react";

type RoomType = "single" | "travel";

type CreateRoomFormProps = {
  roomType: RoomType;
  buttonLabel: string;
};

export function CreateRoomForm({ roomType, buttonLabel }: CreateRoomFormProps) {
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      className="grid gap-4"
      method="post"
      action="/rooms/new/create"
      onSubmit={() => {
        setSubmitting(true);
      }}
    >
      <input type="hidden" name="type" value={roomType} />
      <div className="grid gap-4">
        <label className="grid gap-1">
          <span className="text-sm font-semibold">방 이름</span>
          <input
            name="name"
            type="text"
            placeholder="예: 맛집 도장 깨기 원정대"
            required
            className="h-11 rounded-xl border border-violet-100 px-3 text-sm outline-none focus:ring-2 focus:ring-violet-300"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-semibold">선택 범위 시작일</span>
          <input
            name="dateRangeStart"
            type="date"
            required
            className="h-11 rounded-xl border border-violet-100 px-3 text-sm outline-none focus:ring-2 focus:ring-violet-300"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-semibold">선택 범위 종료일</span>
          <input
            name="dateRangeEnd"
            type="date"
            required
            className="h-11 rounded-xl border border-violet-100 px-3 text-sm outline-none focus:ring-2 focus:ring-violet-300"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-semibold">예상 인원수</span>
          <input
            name="expectedParticipantCount"
            type="number"
            min={1}
            max={200}
            defaultValue={5}
            required
            className="h-11 rounded-xl border border-violet-100 px-3 text-sm outline-none focus:ring-2 focus:ring-violet-300"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-semibold">방 비밀번호 (선택)</span>
          <input
            name="roomPassword"
            type="password"
            placeholder="미입력 시 공개 링크로 참여"
            minLength={4}
            maxLength={30}
            className="h-11 rounded-xl border border-violet-100 px-3 text-sm outline-none focus:ring-2 focus:ring-violet-300"
          />
        </label>

        {roomType === "travel" ? (
          <label className="grid gap-1">
            <span className="text-sm font-semibold">N박</span>
            <input
              name="nights"
              type="number"
              min={1}
              max={30}
              defaultValue={2}
              required
              className="h-11 rounded-xl border border-violet-100 px-3 text-sm outline-none focus:ring-2 focus:ring-violet-300"
            />
          </label>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-app-primary text-sm font-semibold text-white disabled:opacity-60"
      >
        {submitting ? (
          <>
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-violet-100 border-t-white"
              aria-hidden
            />
            생성 중...
          </>
        ) : (
          buttonLabel
        )}
      </button>
    </form>
  );
}
