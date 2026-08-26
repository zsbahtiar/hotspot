// Derives dim_period fields from an ISO date string "YYYY-MM-DD",
// mirroring transformer._create_dim_period (Python polars).
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export interface PeriodFields {
  date_value: string;
  year_value: number;
  semester_value: number;
  quarter_value: number;
  month_value: number;
  month_name: string;
  week_value: number;
}

// ISO-8601 week number (polars dt.week() semantics).
function isoWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // Mon=0
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // nearest Thursday
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  return 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 864e5));
}

export function derivePeriod(dateValue: string): PeriodFields {
  const [y, m, day] = dateValue.split("-").map((s) => parseInt(s, 10));
  const d = new Date(Date.UTC(y, m - 1, day));
  const month = m;
  return {
    date_value: dateValue,
    year_value: y,
    semester_value: month <= 6 ? 1 : 2,
    quarter_value: Math.floor((month - 1) / 3) + 1,
    month_value: month,
    month_name: MONTH_NAMES[month - 1],
    week_value: isoWeek(d),
  };
}
