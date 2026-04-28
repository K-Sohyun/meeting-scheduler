import { eachMonthOfInterval, format, parseISO } from "date-fns";

export type Holiday = {
  date: string;
  name: string;
  isHoliday: true;
};

type HolidayApiItem = {
  locdate?: string | number;
  dateName?: string;
  isHoliday?: string | number;
};

function getHolidayApiKey() {
  const key = process.env.HOLIDAY_API_SERVICE_KEY;
  if (!key) {
    throw new Error("HOLIDAY_API_SERVICE_KEY is not set");
  }
  return key;
}

function normalizeDate(rawLocdate: string | number | undefined) {
  const value = String(rawLocdate ?? "");
  if (!/^\d{8}$/.test(value)) {
    return null;
  }

  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function toHoliday(item: HolidayApiItem): Holiday | null {
  if (String(item.isHoliday ?? "N") !== "Y") {
    return null;
  }

  const date = normalizeDate(item.locdate);
  if (!date) {
    return null;
  }

  return {
    date,
    name: item.dateName?.trim() || "공휴일",
    isHoliday: true,
  };
}

async function fetchHolidayMonth(year: number, month: number): Promise<Holiday[]> {
  const url = new URL(
    "https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo",
  );
  url.searchParams.set("serviceKey", getHolidayApiKey());
  url.searchParams.set("solYear", String(year));
  url.searchParams.set("solMonth", String(month).padStart(2, "0"));
  url.searchParams.set("numOfRows", "50");
  url.searchParams.set("_type", "json");

  const response = await fetch(url, {
    next: { revalidate: 60 * 60 * 24 },
  });

  if (!response.ok) {
    throw new Error(`Holiday API request failed with status ${response.status}`);
  }

  const data = (await response.json()) as {
    response?: { body?: { items?: { item?: HolidayApiItem | HolidayApiItem[] } } };
  };

  const rawItems = data.response?.body?.items?.item;
  const itemList = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
  return itemList.map(toHoliday).filter((item): item is Holiday => item !== null);
}

export async function getHolidaysInRange(
  startDate: string,
  endDate: string,
): Promise<Holiday[]> {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const months = eachMonthOfInterval({ start, end });

  const holidaysByDate = new Map<string, Holiday>();
  for (const monthDate of months) {
    const monthHolidays = await fetchHolidayMonth(
      Number(format(monthDate, "yyyy")),
      Number(format(monthDate, "M")),
    );

    monthHolidays.forEach((holiday) => {
      if (holiday.date >= startDate && holiday.date <= endDate) {
        holidaysByDate.set(holiday.date, holiday);
      }
    });
  }

  return [...holidaysByDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
