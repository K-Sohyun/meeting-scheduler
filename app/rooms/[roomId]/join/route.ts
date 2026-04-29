import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { normalizeNickname } from "@/lib/nickname";
import { getRoomCreatorCookieName } from "@/lib/room-creator";
import { getParticipantCookieName } from "@/lib/participant-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const joinSchema = z.object({
  roomId: z.string().uuid(),
  nickname: z
    .string()
    .transform((value) => normalizeNickname(value))
    .refine((value) => value.length >= 2, { message: "닉네임은 2자 이상 입력해 주세요." })
    .refine((value) => value.length <= 20, { message: "닉네임은 20자 이하로 입력해 주세요." }),
});

const cookieBase = {
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

function wantsJoinJson(request: NextRequest) {
  const accept = request.headers.get("accept") ?? "";
  return accept.includes("application/json");
}

function buildRedirectUrl(request: Request, roomId: string, params: Record<string, string>) {
  const url = new URL(`/rooms/${roomId}`, request.url);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return url;
}

function setParticipantSessionCookies(
  response: NextResponse,
  roomId: string,
  participantId: string,
  creatorCookieMatches: boolean,
) {
  response.cookies.set(getParticipantCookieName(roomId), participantId, {
    ...cookieBase,
    maxAge: 60 * 60 * 24 * 30,
  });
  if (creatorCookieMatches) {
    response.cookies.set(getRoomCreatorCookieName(roomId), "", {
      ...cookieBase,
      maxAge: 0,
    });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await context.params;
  const formData = await request.formData();
  const participantCookie = request.cookies.get(getParticipantCookieName(roomId))?.value;
  const asJson = wantsJoinJson(request);

  const parseResult = joinSchema.safeParse({
    roomId,
    nickname: formData.get("nickname"),
  });

  if (!parseResult.success) {
    const message = parseResult.error.issues[0]?.message ?? "닉네임을 확인해 주세요.";
    if (asJson) {
      return NextResponse.json({ ok: false as const, error: message }, { status: 400 });
    }
    return NextResponse.redirect(buildRedirectUrl(request, roomId, { error: message }), 303);
  }

  try {
    const supabase = createSupabaseServerClient();
    const payload = parseResult.data;

    const { data: sameRoom } = await supabase
      .from("participants")
      .select("id, nickname")
      .eq("room_id", payload.roomId);

    const normalizedTarget = payload.nickname.toLowerCase();
    const existing = (sameRoom ?? []).find(
      (row) => normalizeNickname(row.nickname).toLowerCase() === normalizedTarget,
    );

    let participantId: string;
    let rejoined = Boolean(existing);
    if (existing) {
      // 동일 닉 재진입은 기존 쿠키 보유자만 허용(타 브라우저의 닉 탈취 방지)
      if (participantCookie !== existing.id) {
        const dupMsg = "이미 사용 중인 닉네임입니다. 다른 닉네임을 사용해 주세요.";
        if (asJson) {
          return NextResponse.json({ ok: false as const, error: dupMsg }, { status: 409 });
        }
        return NextResponse.redirect(
          buildRedirectUrl(request, roomId, {
            error: dupMsg,
          }),
          303,
        );
      }
      participantId = existing.id;
    } else {
      const { data, error } = await supabase
        .from("participants")
        .insert({
          room_id: payload.roomId,
          nickname: payload.nickname,
        })
        .select("id")
        .single();

      if (error?.code === "23505") {
        const { data: again } = await supabase
          .from("participants")
          .select("id, nickname")
          .eq("room_id", payload.roomId);
        const found = (again ?? []).find(
          (row) => normalizeNickname(row.nickname).toLowerCase() === normalizedTarget,
        );
        if (!found) {
          throw error;
        }
        participantId = found.id;
        rejoined = true;
      } else if (error || !data) {
        throw error ?? new Error("참여자 저장 실패");
      } else {
        participantId = data.id;
      }
    }

    const { data: roomForOwner, error: roomForOwnerError } = await supabase
      .from("rooms")
      .select("owner_participant_id, creator_claim_token")
      .eq("id", payload.roomId)
      .single();
    if (roomForOwnerError || !roomForOwner) {
      throw roomForOwnerError ?? new Error("방 정보를 불러올 수 없습니다.");
    }

    const claimCookie = request.cookies.get(getRoomCreatorCookieName(roomId))?.value;
    const stored = roomForOwner.creator_claim_token;
    const hasStoredToken = Boolean(stored && String(stored).length > 0);
    const creatorCookieMatches = hasStoredToken && claimCookie === stored;

    let shouldSetOwner = false;
    if (roomForOwner.owner_participant_id == null) {
      if (!hasStoredToken) {
        // 레거시(컬럼/값 없음): 첫 유효 join이 모임장
        shouldSetOwner = true;
      } else if (creatorCookieMatches) {
        shouldSetOwner = true;
      }
    }

    if (shouldSetOwner) {
      const { error: claimOwnerError } = await supabase
        .from("rooms")
        .update({ owner_participant_id: participantId })
        .eq("id", payload.roomId)
        .is("owner_participant_id", null);
      if (claimOwnerError) {
        throw claimOwnerError;
      }
    }

    const nextUrl = buildRedirectUrl(request, roomId, {
      joined: "1",
      rejoin: rejoined ? "1" : "0",
      view: "calendar",
    });
    const redirectPath = `${nextUrl.pathname}${nextUrl.search}`;

    if (asJson) {
      const res = NextResponse.json({
        ok: true as const,
        redirect: redirectPath,
      });
      setParticipantSessionCookies(res, roomId, participantId, creatorCookieMatches);
      return res;
    }

    const response = NextResponse.redirect(nextUrl, 303);
    setParticipantSessionCookies(response, roomId, participantId, creatorCookieMatches);
    return response;
  } catch {
    const fallback = "참여 처리 중 오류가 발생했어요.";
    if (asJson) {
      return NextResponse.json({ ok: false as const, error: fallback }, { status: 500 });
    }
    return NextResponse.redirect(
      buildRedirectUrl(request, roomId, {
        error: fallback,
      }),
      303,
    );
  }
}
