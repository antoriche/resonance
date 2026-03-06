import dayjs from "dayjs";
import advancedFormat from "dayjs/plugin/advancedFormat";

dayjs.extend(advancedFormat);

/**
 * If date is today, return "Today"
 * if date is yesterday, return "Yesterday"
 * if date is earlier in the same week, return "{day of week}"
 * if date is earlier in the same year, return "{month} {day}" - e.g. "Mar. 3"
 * else return "{month} {day}, {year}" - e.g. "Mar. 3, 2023"
 */
export function relativeDate(date: Date, now: Date = new Date()): string {
  const dayjsDate = dayjs(date);
  const dayjsNow = dayjs(now);

  if (dayjsDate.isSame(dayjsNow, "day")) {
    return "Today";
  } else if (dayjsDate.isSame(dayjsNow.subtract(1, "day"), "day")) {
    return "Yesterday";
  } else if (dayjsDate.isSame(dayjsNow, "week")) {
    return dayjsDate.format("dddd");
  } else if (dayjsDate.isSame(dayjsNow, "year")) {
    return dayjsDate.format("MMM. D");
  } else {
    return dayjsDate.format("MMM. D, YYYY");
  }
}
