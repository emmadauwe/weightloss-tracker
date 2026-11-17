import { differenceInCalendarWeeks, format, parseISO, startOfWeek } from "date-fns";
import { nl } from "date-fns/locale";
import type { Entry } from "./weight-store";

export function weeklyWeightChanges(entries: Entry[]) {
  const weeks = new Map<string, { total: number; count: number }>();
  for (const entry of entries) {
    const date = format(startOfWeek(parseISO(entry.date), { weekStartsOn: 1 }), "yyyy-MM-dd");
    const week = weeks.get(date) ?? { total: 0, count: 0 };
    weeks.set(date, { total: week.total + entry.weight, count: week.count + 1 });
  }
  const averages = Array.from(weeks.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, week]) => ({
    date, average: week.total / week.count, count: week.count,
  }));
  return averages.flatMap((week, index) => {
    const previous = averages[index - 1];
    if (!previous) return [];
    const elapsedWeeks = differenceInCalendarWeeks(parseISO(week.date), parseISO(previous.date), { weekStartsOn: 1 });
    return [{ date: week.date, label: format(parseISO(week.date), "d MMM", { locale: nl }),
      change: (week.average - previous.average) / elapsedWeeks, count: week.count, elapsedWeeks }];
  });
}