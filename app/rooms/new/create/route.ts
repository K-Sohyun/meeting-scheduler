import { addDays, isBefore, parseISO } from "date-fns";
import { NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { ERROR_MESSAGES } from "@/lib/error-messages";
import { getRoomCreatorCookieName } from "@/lib/room-creator";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const optionalNightsField = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }
  return value;
}, z.coerce.number().int().min(1).max(30).optional());

const participantCountField = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }
  return value;
}, z.coerce.number().int().min(1).max(200));

const optionalStringField = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }
  return value;
}, z.string().optional());

const createRoomSchema = z
  .object({
    type: z.enum(["single", "travel"]),
    name: z.string().trim().min(2, "방 이름은 2자 이상 입력해 주세요."),
    dateRangeStart: z.string().min(1, "시작일을 입력해 주세요."),
    dateRangeEnd: z.string().min(1, "종료일을 입력해 주세요."),
    nights: optionalNightsField,
    expectedParticipantCount: participantCountField,
    roomPassword: optionalStringField
      .transform((value) => value?.trim())
      .refine((value) => !value || value.length >= 4, {
        message: "비밀번호는 최소 4자 이상이어야 합니다.",
      })
      .refine((value) => !value || value.length <= 30, {
        message: "비밀번호는 30자 이하로 입력해 주세요.",
      }),
  })
  .superRefine((data, ctx) => {
    const start = parseISO(data.dateRangeStart);
    const end = parseISO(data.dateRangeEnd);
    if (isBefore(end, start)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dateRangeEnd"],
        message: "종료일은 시작일 이후여야 합니다.",
      });
    }

    if (data.type === "travel") {
      if (!data.nights) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["nights"],
          message: "여행 모임은 N박 입력이 필요합니다.",
        });
      } else {
        const requiredLastDate = addDays(start, data.nights);
        if (isBefore(end, requiredLastDate)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["dateRangeEnd"],
            message: `여행 모임은 최소 ${data.nights + 1}일 범위가 필요합니다.`,
          });
        }
      }
    }
  });

function buildRedirectUrl(request: Request, params: Record<string, string>) {
  const url = new URL("/rooms/new", request.url);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return url;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const parseResult = createRoomSchema.safeParse({
    type: formData.get("type"),
    name: formData.get("name"),
    dateRangeStart: formData.get("dateRangeStart"),
    dateRangeEnd: formData.get("dateRangeEnd"),
    nights: formData.get("nights"),
    expectedParticipantCount: formData.get("expectedParticipantCount"),
    roomPassword: formData.get("roomPassword"),
  });

  const type = formData.get("type");
  const roomType = type === "travel" ? "travel" : "single";

  if (!parseResult.success) {
    const firstMessage = parseResult.error.issues[0]?.message ?? "입력값을 확인해 주세요.";
    return NextResponse.redirect(
      buildRedirectUrl(request, { type: roomType, error: firstMessage }),
      303,
    );
  }

  try {
    const supabase = createSupabaseServerClient();
    const payload = parseResult.data;
    const roomPasswordHash = payload.roomPassword
      ? createHash("sha256").update(payload.roomPassword).digest("hex")
      : null;
    const creatorClaimToken = randomUUID();

    const { data, error } = await supabase
      .from("rooms")
      .insert({
        name: payload.name,
        type: payload.type,
        nights: payload.type === "travel" ? payload.nights : null,
        date_range_start: payload.dateRangeStart,
        date_range_end: payload.dateRangeEnd,
        expected_participant_count: payload.expectedParticipantCount,
        password_hash: roomPasswordHash,
        creator_claim_token: creatorClaimToken,
      })
      .select("id")
      .single();

    if (error || !data) {
      throw error ?? new Error("방 생성에 실패했습니다.");
    }

    const res = NextResponse.redirect(new URL(`/rooms?created=${data.id}`, request.url), 303);
    res.cookies.set(getRoomCreatorCookieName(data.id), creatorClaimToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch {
    return NextResponse.redirect(
      buildRedirectUrl(request, {
        type: roomType,
        error: ERROR_MESSAGES.roomCreate.failed,
      }),
      303,
    );
  }
}
