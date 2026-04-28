import { NextRequest, NextResponse } from "next/server";
import { endOfMonth, format } from "date-fns";
import { z } from "zod";
import { getHolidaysInRange } from "@/lib/holidays";

const querySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const parseResult = querySchema.safeParse({
    year: searchParams.get("year"),
    month: searchParams.get("month"),
  });

  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: "Invalid query. year(2000~2100), month(1~12)이 필요합니다.",
      },
      { status: 400 },
    );
  }

  const { year, month } = parseResult.data;
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = format(endOfMonth(new Date(year, month - 1, 1)), "yyyy-MM-dd");

  try {
    const holidays = await getHolidaysInRange(startDate, endDate);
    return NextResponse.json({ holidays });
  } catch (error) {
    const message = error instanceof Error ? error.message : "공휴일 조회에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
