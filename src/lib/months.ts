import { addMonths, format } from "date-fns";

export function getCurrentMonthValue() {
  return format(new Date(), "yyyy-MM");
}

export function formatMonthLabel(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);

  return format(new Date(year, monthNumber - 1, 1), "MMMM yyyy");
}

export function shiftMonthValue(month: string, delta: number) {
  const [year, monthNumber] = month.split("-").map(Number);

  return format(addMonths(new Date(year, monthNumber - 1, 1), delta), "yyyy-MM");
}
