export type Time = | "tahun" | "semester" | "kuartal" | "bulan"| "minggu";

export interface TimeFilters {
  tahun?: string;
  semester?: string;
  kuartal?: string;
  bulan?: string;
  minggu?: string;
  hari?: string;
}

export const monthNames = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export const dayNames = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];

export const getTimeParamsFromDate = (dateString: string) => {
  const date = new Date(dateString);
  const tahun = date.getFullYear().toString();
  const bulan = monthNames[date.getMonth()];
  const hari = dayNames[date.getDay()];
  const minggu = Math.ceil(date.getDate() / 7).toString();
  const kuartal = Math.ceil((date.getMonth() + 1) / 3).toString();
  const semester = date.getMonth() < 6 ? "1" : "2";

  return {
    tahun: tahun,
    semester: semester,
    quartal: kuartal,
    bulan: bulan,
    minggu: minggu,
    hari: hari,
  };
};