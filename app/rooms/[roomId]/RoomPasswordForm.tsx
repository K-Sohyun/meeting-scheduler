import { InlineMessage } from "@/components/ui/InlineMessage";

type RoomPasswordFormProps = {
  roomId: string;
  roomName: string;
  redirectTo: string;
  wrongPassword: boolean;
};

export function RoomPasswordForm({
  roomId,
  roomName,
  redirectTo,
  wrongPassword,
}: RoomPasswordFormProps) {
  return (
    <div className="mt-5 rounded-2xl bg-app-card p-5 shadow-sm">
      <h2 className="text-base font-semibold">비밀번호로 보호된 방입니다</h2>
      <p className="mt-1 text-sm text-app-muted">방 제목: {roomName}</p>
      {wrongPassword ? (
        <InlineMessage tone="error" className="mt-3">
          비밀번호가 일치하지 않아요. 다시 입력해 주세요.
        </InlineMessage>
      ) : null}
      <form
        className="mt-4 grid gap-3"
        method="post"
        action={`/api/rooms/${roomId}/unlock`}
      >
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <label className="grid gap-1">
          <span className="text-sm font-medium">방 비밀번호</span>
          <input
            name="password"
            type="password"
            required
            minLength={1}
            autoComplete="off"
            className="h-11 rounded-xl border border-violet-100 px-3 text-sm outline-none focus:ring-2 focus:ring-violet-300"
          />
        </label>
        <button
          type="submit"
          className="h-11 rounded-xl bg-app-primary text-sm font-semibold text-white"
        >
          입장하기
        </button>
      </form>
    </div>
  );
}
