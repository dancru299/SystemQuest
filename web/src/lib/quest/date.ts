import { addDays, differenceInCalendarDays, parseISO, subDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

export const DEFAULT_TIMEZONE = "Asia/Ho_Chi_Minh";

export function todayInTimezone(timezone = DEFAULT_TIMEZONE) {
  return formatInTimeZone(new Date(), timezone, "yyyy-MM-dd");
}

export function expectedQuestDay(startDate: string | null, timezone: string) {
  if (!startDate) return 1;
  const today = parseISO(todayInTimezone(timezone));
  return Math.max(1, differenceInCalendarDays(today, parseISO(startDate)) + 1);
}

export function startDateForCurrentQuestDay(
  currentDayNumber: number,
  timezone: string,
) {
  const today = parseISO(todayInTimezone(timezone));
  return formatInTimeZone(subDays(today, currentDayNumber - 1), timezone, "yyyy-MM-dd");
}

export function startDatePlusDays(startDate: string, days: number) {
  return formatInTimeZone(addDays(parseISO(startDate), days), DEFAULT_TIMEZONE, "yyyy-MM-dd");
}

