import { format, addMonths, parseISO, getDaysInMonth } from "date-fns";
export const today = () => format(new Date(), "yyyy-MM-dd");
export const thisMonth = () => today().slice(0, 7);
export const shiftMonth = (month: string, delta: number) =>
  format(addMonths(parseISO(`${month}-01`), delta), "yyyy-MM");
export const monthLabel = (month: string, short = false) =>
  format(parseISO(`${month}-01`), short ? "MMM yyyy" : "MMMM yyyy");
export const dayLabel = (date: string) =>
  format(parseISO(date), "EEEE, d MMMM");
export const daysInMonth = (month: string) =>
  getDaysInMonth(parseISO(`${month}-01`));
export const dateAt = (month: string, day: number) =>
  `${month}-${String(day).padStart(2, "0")}`;
