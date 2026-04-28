"use client";

type Props = { roomId: string };

export function DeleteRoomForm({ roomId }: Props) {
  return (
    <form
      className="mt-3"
      method="post"
      action={`/api/rooms/${roomId}/manage`}
      onSubmit={(event) => {
        if (
          !confirm(
            "이 모임을 완전히 삭제할까요? 참여자·일정 데이터가 모두 지워지며 복구할 수 없습니다.",
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="action" value="delete_room" />
      <button
        type="submit"
        className="h-10 w-full rounded-xl border border-red-200 bg-red-50 text-sm font-medium text-red-800"
      >
        모임 전체 삭제
      </button>
    </form>
  );
}
