import { useMemo, useEffect, lazy, Suspense, useState } from "react";
import type { HotspotDataGeo } from "@/core/models/hotspot";
import {
  formatNumber,
  extractTime,
  formatDate,
  translateWeatherCondition,
} from "@/core/utils/formatters";
import { useLatestHotspots, useSummary } from "@/core/hooks/useHotspotQueries";
import { Tooltip } from "react-tooltip";
import { monthNames } from "@/core/models/time";
import { satelliteLabel } from "@/lib/utils";
import {
  ChartSkeleton,
  CardSkeleton,
} from "@/components/common/LoadingSkeletons";

const MitigationSection = lazy(
  () => import("@/components/stats/MitigationSection"),
);
const ChartComponent = lazy(() => import("@/components/stats/Chart"));

interface ReportedHotspotsSectionProps {
  latestHotspots: any[];
  summaryData: {
    top_provinces: { name: string; count: number }[];
    top_cities: { name: string; count: number }[];
    monthly: any[];
    confidence: Record<string, number>;
    satellites: Record<string, number>;
  };
  isLoading: boolean;
}

const ReportedHotspotsSection = ({
  latestHotspots,
  summaryData,
  isLoading,
}: ReportedHotspotsSectionProps) => {
  const [viewMode, setViewMode] = useState<"provinsi" | "kabupaten">(
    "provinsi",
  );

  const tableData =
    viewMode === "provinsi"
      ? summaryData.top_provinces
      : summaryData.top_cities;
  const totalHotspots = tableData.reduce((sum, item) => sum + item.count, 0);

  return (
    <section className="py-10 px-6 bg-[#faf8f5] dark:bg-background">
      <div className="max-w-[1100px] mx-auto">
        {}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-extrabold text-[#192d17] dark:text-[#f3f7f1]">
              10 Daerah Hotspot Tertinggi 2026
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-lg border border-[#d4ddd0] dark:border-[#2a3a28] p-0.5 bg-white dark:bg-[#1a221a]">
              <button
                onClick={() => setViewMode("provinsi")}
                className={`px-4 py-1.5 text-[0.72rem] font-semibold rounded-md transition-all ${
                  viewMode === "provinsi"
                    ? "bg-[#192d17] text-white"
                    : "text-[#6b7a64] hover:text-[#192d17] dark:hover:text-[#f3f7f1]"
                }`}
              >
                BY PROVINSI
              </button>
              <button
                onClick={() => setViewMode("kabupaten")}
                className={`px-4 py-1.5 text-[0.72rem] font-semibold rounded-md transition-all ${
                  viewMode === "kabupaten"
                    ? "bg-[#192d17] text-white"
                    : "text-[#6b7a64] hover:text-[#192d17] dark:hover:text-[#f3f7f1]"
                }`}
              >
                BY KABUPATEN
              </button>
            </div>
            <span className="text-[0.72rem] text-[#6b7a64]">
              {tableData.length} data
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#121812] rounded-xl border border-[#d4ddd0] dark:border-[#2a3a28] overflow-hidden">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-[#d4ddd0] border-t-[#3d6b35] rounded-full animate-spin mb-3"></div>
              <p className="text-[#6b7a64] text-sm">Memuat data...</p>
            </div>
          ) : tableData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#f9faf8] dark:bg-[#1a221a] border-b border-[#d4ddd0] dark:border-[#2a3a28]">
                    <th className="text-left py-3 px-5 text-[0.65rem] font-semibold uppercase tracking-wider text-[#6b7a64]">
                      {viewMode === "provinsi" ? "PROVINSI" : "KABUPATEN"}
                    </th>
                    <th className="text-right py-3 px-5 text-[0.65rem] font-semibold uppercase tracking-wider text-[#6b7a64]">
                      HOTSPOT
                    </th>
                    <th className="text-right py-3 px-5 text-[0.65rem] font-semibold uppercase tracking-wider text-[#6b7a64]">
                      RUNNING TOTAL
                    </th>
                    <th className="text-right py-3 px-5 text-[0.65rem] font-semibold uppercase tracking-wider text-[#6b7a64]">
                      PERSENTASE
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let runningTotal = 0;
                    return tableData.map((item, index) => {
                      runningTotal += item.count;
                      const percentage =
                        totalHotspots > 0
                          ? (item.count / totalHotspots) * 100
                          : 0;
                      const isHighImpact = percentage > 10;

                      return (
                        <tr
                          key={item.name}
                          className={`border-b border-[#e8ece6] dark:border-[#2a3a28] last:border-b-0 hover:bg-[#f3f6f2] dark:hover:bg-[#1a221a] transition-colors ${
                            isHighImpact ? "bg-[#fef8ed] dark:bg-[#3d3520]" : ""
                          }`}
                        >
                          <td className="py-4 px-5">
                            <div
                              className={`flex items-start gap-3 ${isHighImpact ? "border-l-4 border-[#e4991b] pl-3 -ml-1" : ""}`}
                            >
                              <div>
                                <p className="text-sm font-bold text-[#192d17] dark:text-[#f3f7f1]">
                                  {item.name}
                                </p>
                                <p className="text-[0.72rem] text-[#6b7a64]">
                                  {viewMode === "provinsi"
                                    ? "Indonesia"
                                    : "Provinsi"}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-5 text-right">
                            <span className="text-sm font-bold text-[#192d17] dark:text-[#f3f7f1]">
                              {formatNumber(item.count)}
                            </span>
                            <span
                              className={`ml-2 px-1.5 py-0.5 text-[0.6rem] font-semibold rounded ${
                                isHighImpact
                                  ? "bg-[#c07f10]/10 text-[#c07f10]"
                                  : "bg-[#6b7a64]/10 text-[#6b7a64]"
                              }`}
                            >
                              {isHighImpact ? "HIGH" : "NORMAL"}
                            </span>
                          </td>
                          <td className="py-4 px-5 text-right text-sm text-[#6b7a64]">
                            {formatNumber(runningTotal)}
                          </td>
                          <td className="py-4 px-5 text-right">
                            <span
                              className={`text-sm font-bold ${
                                percentage > 20
                                  ? "text-[#c07f10]"
                                  : percentage > 10
                                    ? "text-[#e4991b]"
                                    : "text-[#3d6b35]"
                              }`}
                            >
                              {percentage.toFixed(1)}%
                            </span>
                            <p className="text-[0.65rem] text-[#6b7a64]">
                              of {formatNumber(totalHotspots)}
                            </p>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-[#6b7a64] text-sm">Tidak ada data</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

interface LatestHotspotsSectionProps {
  latestHotspots: any[];
  isLoading: boolean;
}

const LatestHotspotsSection = ({
  latestHotspots,
  isLoading,
}: LatestHotspotsSectionProps) => {
  return (
    <section className="py-10 px-6 bg-[#f3f6f2] dark:bg-[#1a221a]">
      <div className="max-w-[1100px] mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-[#6b7a64] mb-1">
              UPDATE · TERKINI
            </p>
            <h2 className="text-xl font-extrabold text-[#192d17] dark:text-[#f3f7f1]">
              Data Hotspot Terbaru
            </h2>
          </div>
          <a
            href="/data"
            className="text-[0.75rem] font-semibold text-[#3d6b35] hover:text-[#2a4a26] dark:text-[#8fc483] dark:hover:text-[#a8d49f] transition-colors"
          >
            Lihat Semua →
          </a>
        </div>

        {}
        <div className="bg-white dark:bg-[#121812] rounded-xl border border-[#d4ddd0] dark:border-[#2a3a28] overflow-hidden">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-[#d4ddd0] border-t-[#3d6b35] rounded-full animate-spin mb-3"></div>
              <p className="text-[#6b7a64] text-sm">Memuat data...</p>
            </div>
          ) : latestHotspots.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#f9faf8] dark:bg-[#1a221a] border-b border-[#d4ddd0] dark:border-[#2a3a28]">
                    <th className="text-left py-3 px-5 text-[0.65rem] font-semibold uppercase tracking-wider text-[#6b7a64]">
                      LOKASI
                    </th>
                    <th className="text-left py-3 px-5 text-[0.65rem] font-semibold uppercase tracking-wider text-[#6b7a64]">
                      WAKTU
                    </th>
                    <th className="text-left py-3 px-5 text-[0.65rem] font-semibold uppercase tracking-wider text-[#6b7a64]">
                      SATELIT
                    </th>
                    <th className="text-right py-3 px-5 text-[0.65rem] font-semibold uppercase tracking-wider text-[#6b7a64]">
                      CONFIDENCE
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {latestHotspots.map((hotspot, index) => {
                    const isHigh = hotspot.confidence_class === "HIGH";
                    return (
                      <tr
                        key={index}
                        className={`border-b border-[#e8ece6] dark:border-[#2a3a28] last:border-b-0 hover:bg-[#f3f6f2] dark:hover:bg-[#1a221a] transition-colors ${
                          isHigh ? "bg-[#fef8ed] dark:bg-[#3d3520]" : ""
                        }`}
                      >
                        <td className="py-4 px-5">
                          <div
                            className={`${isHigh ? "border-l-4 border-[#e4991b] pl-3 -ml-1" : ""}`}
                          >
                            <p className="text-sm font-bold text-[#192d17] dark:text-[#f3f7f1]">
                              {hotspot.city_name || "N/A"},{" "}
                              {hotspot.province_name || "N/A"}
                            </p>
                            <p className="text-[0.72rem] text-[#6b7a64]">
                              {hotspot.subdistrict_name || ""}
                              {hotspot.district_name
                                ? `, ${hotspot.district_name}`
                                : ""}
                            </p>
                          </div>
                        </td>
                        <td className="py-4 px-5">
                          <p className="text-sm text-[#192d17] dark:text-[#f3f7f1]">
                            {formatDate(hotspot.acquired_at)}
                          </p>
                          <p className="text-[0.72rem] text-[#6b7a64]">
                            {extractTime(hotspot.acquired_at)}
                          </p>
                        </td>
                        <td className="py-4 px-5">
                          <span className="text-sm font-medium text-[#3d6b35] dark:text-[#8fc483]">
                            {hotspot.satellite_name
                              ? satelliteLabel(hotspot.satellite_name)
                              : "N/A"}
                          </span>
                        </td>
                        <td className="py-4 px-5 text-right">
                          <span
                            className={`px-2 py-1 text-[0.65rem] font-semibold rounded ${
                              hotspot.confidence_class === "HIGH"
                                ? "bg-[#c07f10]/10 text-[#c07f10]"
                                : hotspot.confidence_class === "MEDIUM"
                                  ? "bg-[#6b7a64]/10 text-[#6b7a64]"
                                  : "bg-[#3d6b35]/10 text-[#3d6b35]"
                            }`}
                          >
                            {hotspot.confidence_class || "NOMINAL"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-[#6b7a64] text-sm">
                Tidak ada data hotspot terbaru
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

interface MainProps {
  showHero?: boolean;
  showMitigation?: boolean;
  currentYear?: number;
}

const Main = ({
  showHero = true,
  showMitigation = true,
  currentYear,
}: MainProps) => {
  const year = currentYear ?? 2025;

  const ytdDateRange = useMemo(() => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    const endOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999,
    );

    const formatWithTimezone = (date: Date) => {
      const offset = -date.getTimezoneOffset();
      const sign = offset >= 0 ? "+" : "-";
      const hours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0");
      const minutes = String(Math.abs(offset) % 60).padStart(2, "0");
      const tzOffset = `${sign}${hours}:${minutes}`;

      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hour = String(date.getHours()).padStart(2, "0");
      const min = String(date.getMinutes()).padStart(2, "0");
      const sec = String(date.getSeconds()).padStart(2, "0");

      return `${year}-${month}-${day}T${hour}:${min}:${sec}${tzOffset}`;
    };

    return {
      start_date: formatWithTimezone(startOfYear),
      end_date: formatWithTimezone(endOfToday),
    };
  }, []);

  const { data: summaryRes, isLoading: summaryLoading } = useSummary({
    province_limit: 10,
    city_limit: 10,
    ...ytdDateRange,
  });
  const { data: latestHotspotsRes, isLoading: latestLoading } =
    useLatestHotspots(5);

  const isLoading = summaryLoading || latestLoading;

  const hotspotData: HotspotDataGeo = {
    type: "FeatureCollection",
    features: [],
  };

  const summaryData = {
    top_provinces: summaryRes?.data?.top_provinces || [],
    top_cities: summaryRes?.data?.top_cities || [],
    monthly: summaryRes?.data?.monthly_stats || [],
    confidence: (summaryRes?.data?.confidence_distribution || []).reduce(
      (acc, item) => {
        acc[item.name] = item.count;
        return acc;
      },
      {} as Record<string, number>,
    ),
    satellites: (summaryRes?.data?.satellite_distribution || []).reduce(
      (acc, item) => {
        acc[item.name] = item.count;
        return acc;
      },
      {} as Record<string, number>,
    ),
  };

  const monthlyHotspotTrends = useMemo(() => {
    if (summaryData?.monthly?.length > 0) {
      const monthNames = [
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

      return summaryData.monthly.map((item) => {
        const date = new Date(item.month);
        const monthIndex = date.getMonth();
        const displayMonth = monthNames[monthIndex];

        return [
          displayMonth,
          {
            total: item.total,
            highConfidence: item.high_confidence,
          },
        ];
      });
    } else {
      interface MonthCount {
        total: number;
        highConfidence: number;
      }

      const monthCounts: Record<string, MonthCount> = {};

      hotspotData.features?.forEach((feature) => {
        if (feature.properties.time) {
          const date = new Date(feature.properties.time);
          const featureYear = date.getFullYear();

          if (featureYear === currentYear) {
            const monthYear = date.toLocaleString("id-ID", {
              month: "long",
              year: "numeric",
            });

            if (!monthCounts[monthYear]) {
              monthCounts[monthYear] = {
                total: 0,
                highConfidence: 0,
              };
            }
            monthCounts[monthYear].total += 1;

            if (feature.properties.confidence === "high") {
              monthCounts[monthYear].highConfidence += 1;
            }
          }
        }
      });
      return Object.entries(monthCounts).sort((a, b) => {
        const [monthA, yearA] = a[0].split(" ");
        const [monthB, yearB] = b[0].split(" ");

        if (yearA !== yearB) {
          return parseInt(yearA) - parseInt(yearB);
        }
        return monthNames.indexOf(monthA) - monthNames.indexOf(monthB);
      });
    }
  }, [hotspotData.features, summaryData]);

  const cumulativeData = useMemo(() => {
    let runningTotal = 0;
    return monthlyHotspotTrends.map(([month, counts]) => {
      runningTotal += counts.total;
      return { month, cumulative: runningTotal };
    });
  }, [monthlyHotspotTrends]);

  const chartData = useMemo(
    () => ({
      labels: cumulativeData.map((d) => {
        const shortMonths: Record<string, string> = {
          Januari: "Jan",
          Februari: "Feb",
          Maret: "Mar",
          April: "Apr",
          Mei: "Mei",
          Juni: "Jun",
          Juli: "Jul",
          Agustus: "Agu",
          September: "Sep",
          Oktober: "Okt",
          November: "Nov",
          Desember: "Des",
        };
        return shortMonths[d.month] || d.month;
      }),
      datasets: [
        {
          label: "Akumulasi Hotspot",
          data: cumulativeData.map((d) => d.cumulative),
          borderColor: "#3d6b35",
          backgroundColor: "rgba(61, 107, 53, 0.12)",
          borderWidth: 2,
          pointBackgroundColor: "#3d6b35",
          pointBorderColor: "#ffffff",
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.4,
          fill: "origin",
        },
      ],
    }),
    [cumulativeData],
  );

  const stats = useMemo(() => {
    const backendStats = summaryRes?.data?.stats;
    const topProvincesData = summaryData?.top_provinces || [];
    const todayStats = summaryRes?.data?.today_stats;
    const yesterdayStats = summaryRes?.data?.yesterday_stats;

    const topProvince = topProvincesData[0]?.name || "N/A";

    return {
      totalHotspots: backendStats?.total_hotspots || 0,
      highConfidence: backendStats?.high_confidence || 0,
      affectedProvinces: backendStats?.affected_provinces || 0,
      topLocation: topProvince,
      todayHotspots: todayStats?.today_hotspots || 0,
      todayHighConfidence: todayStats?.today_high_confidence || 0,
      todayAffectedProvinces: todayStats?.today_affected_provinces || 0,
      yesterdayHotspots: yesterdayStats?.yesterday_hotspots || 0,
    };
  }, [summaryData, summaryRes]);

  useEffect(() => {
    const totalCounter = document.getElementById("total-counter");
    const todayCounter = document.getElementById("today-counter");
    const lastUpdate = document.getElementById("last-update");
    const totalReports = document.getElementById("total-reports");
    const todayChange = document.getElementById("today-change");
    const heroChart = document.getElementById("hero-chart-container");

    if (totalCounter && stats.totalHotspots) {
      totalCounter.textContent = formatNumber(stats.totalHotspots);
    }
    if (todayCounter && stats.todayHotspots !== undefined) {
      todayCounter.textContent = formatNumber(stats.todayHotspots);
    }
    if (lastUpdate) {
      lastUpdate.textContent = new Date().toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    }
    if (totalReports && summaryData?.monthly?.length) {
      const total = summaryData.monthly.reduce((sum, m) => sum + m.total, 0);
      totalReports.textContent = formatNumber(total);
    }
    if (todayChange) {
      const today = stats.todayHotspots;
      const yesterday = stats.yesterdayHotspots;
      const diff = today - yesterday;
      const pct =
        yesterday > 0
          ? Math.round((diff / yesterday) * 100)
          : today > 0
            ? 100
            : 0;
      const sign = diff > 0 ? "+" : "";
      todayChange.textContent = `${sign}${formatNumber(diff)} (${sign}${pct}%)`;
      // More hotspots is worse: up = warning (orange), down = good (green).
      const arrow = document.getElementById("today-change-arrow");
      if (arrow) {
        arrow.textContent = diff > 0 ? "▲" : diff < 0 ? "▼" : "▬";
        arrow.className =
          diff > 0
            ? "text-[#e4991b] text-sm"
            : diff < 0
              ? "text-[#5fb87a] text-sm"
              : "text-[#b8c8b1] text-sm";
      }
    }
    if (heroChart) {
      heroChart.style.display = "none";
    }
  }, [stats, summaryData]);

  const latestHotspots = latestHotspotsRes?.data?.hotspots || [];

  return (
    <div className="bg-background">
      <Tooltip
        id="confidence-tooltip"
        style={{
          backgroundColor: "hsl(var(--foreground))",
          color: "hsl(var(--background))",
          maxWidth: "250px",
          fontSize: "12px",
          zIndex: 9999,
        }}
      />
      {showHero && (
        <section className="relative w-full min-h-screen flex items-center justify-center">
          <div className="absolute inset-0">
            <img
              src="/assets/kebakaran2.webp"
              alt="Kebakaran Hutan"
              className="w-full h-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent"></div>
            <div className="absolute inset-0 bg-black/20"></div>
          </div>

          <div className="relative z-10 max-w-4xl mx-auto px-6 py-16 text-center">
            <h1 className="text-6xl font-bold mb-4 text-white drop-shadow-2xl">
              <span>Sistem Pemantauan</span>
              <br />
              <span>Hotspot Karhutla</span>
            </h1>

            <p className="text-xl text-white/95 mb-8 max-w-2xl mx-auto drop-shadow-lg">
              Situs penyedia titik panas karhutla bersumber dari NASA FIRMS
              menggunakan teknologi Spatial Online Analytical Processing yang
              mempermudah pengguna dalam menganalisis titik panas karhutla pada
              suatu wilayah melalui visualisasi
            </p>

            <div className="flex flex-col sm:flex-row gap-6 justify-center mb-16">
              <a
                href="/map"
                className="inline-flex items-center justify-center px-8 py-4 bg-white/10 backdrop-blur-sm text-white font-semibold rounded-lg shadow-lg hover:bg-white/20 hover:shadow-xl transition-all duration-200 border border-white/20"
                title="Lihat Peta Persebaran Hotspot Karhutla"
              >
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                  />
                </svg>
                Lihat Peta
              </a>
              <a
                href="/data"
                className="inline-flex items-center justify-center px-8 py-4 border-2 border-white/60 text-white font-semibold rounded-lg hover:bg-white hover:text-foreground transition-all duration-200"
                title="Lihat Data Tabel Hotspot Karhutla"
              >
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 17v1a1 1 0 001 1h4a1 1 0 001-1v-1m3-2V8a2 2 0 00-2-2H8a2 2 0 00-2 2v6m10 0v1a1 1 0 01-1 1H9a1 1 0 01-1-1v-1m4-4V4a1 1 0 00-1-1h-2a1 1 0 00-1 1v4"
                  />
                </svg>
                Lihat Data
              </a>
            </div>
          </div>
        </section>
      )}

      <section className="py-12 px-6 bg-[#faf8f5] dark:bg-background">
        <div className="max-w-[1100px] mx-auto">
          {}
          <div className="mb-8">
            <h2 className="text-2xl font-extrabold text-[#192d17] dark:text-[#f3f7f1] mb-3 leading-tight">
              Tren Titik Panas
            </h2>
            <p className="text-[0.85rem] text-[#6b7a64] leading-relaxed max-w-2xl">
              Data titik panas yang terdeteksi dari satelit NASA FIRMS.
              Monitoring untuk pencegahan kebakaran hutan dan lahan di
              Indonesia.
            </p>
          </div>

          {}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            {}
            <div className="bg-white dark:bg-[#121812] rounded-xl border border-[#d4ddd0] dark:border-[#2a3a28] p-5 shadow-sm h-full">
              <div className="mb-3">
                <p className="text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-[#6b7a64] mb-1">
                  TRENDLINE
                </p>
                <p className="text-sm font-bold text-[#192d17] dark:text-[#f3f7f1]">
                  Akumulasi Titik Panas
                </p>
              </div>
              <div className="h-52">
                <Suspense fallback={<ChartSkeleton />}>
                  <ChartComponent chartData={chartData} isLoading={isLoading} />
                </Suspense>
              </div>
              <p className="text-[0.7rem] text-[#9ca896] mt-3">
                Jan {year} –{" "}
                {new Date().toLocaleDateString("id-ID", { month: "short" })}{" "}
                {year}
              </p>

              {}
              <div className="mt-5 pt-5 border-t border-[#e8ece6] dark:border-[#2a3a28]">
                <p className="text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-[#6b7a64] mb-3">
                  Distribusi Confidence Level
                </p>
                <div className="space-y-2.5">
                  {(() => {
                    const confidenceData = [
                      {
                        key: "HIGH",
                        label: "Tinggi",
                        range: "80–100%",
                        color: "#c07f10",
                      },
                      {
                        key: "MEDIUM",
                        label: "Sedang",
                        range: "30–79%",
                        color: "#e4991b",
                      },
                      {
                        key: "LOW",
                        label: "Rendah",
                        range: "0–29%",
                        color: "#709663",
                      },
                    ];
                    const totalConfidence = Object.values(
                      summaryData.confidence,
                    ).reduce((a, b) => a + b, 0);

                    return confidenceData.map(
                      ({ key, label, range, color }) => {
                        const count = summaryData.confidence[key] || 0;
                        const percentage =
                          totalConfidence > 0
                            ? (count / totalConfidence) * 100
                            : 0;

                        return (
                          <div key={key} className="flex items-center gap-3">
                            <div className="flex items-center gap-2 w-28">
                              <span
                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: color }}
                              ></span>
                              <span className="text-[0.72rem] text-[#4a5648] dark:text-[#b8c8b1]">
                                {label} ({range})
                              </span>
                            </div>
                            <div className="flex-1 h-4 bg-[#f3f6f2] dark:bg-[#1a221a] rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${percentage}%`,
                                  backgroundColor: color,
                                }}
                              ></div>
                            </div>
                            <span className="text-[0.75rem] font-bold text-[#192d17] dark:text-[#f3f7f1] w-14 text-right">
                              {formatNumber(count)}
                            </span>
                          </div>
                        );
                      },
                    );
                  })()}
                </div>
              </div>
            </div>

            {}
            <div className="bg-white dark:bg-[#121812] rounded-xl border border-[#d4ddd0] dark:border-[#2a3a28] overflow-hidden shadow-sm flex flex-col h-full">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#e8ece6] dark:border-[#2a3a28]">
                <div>
                  <p className="text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-[#6b7a64] mb-1">
                    UPDATE · TERKINI
                  </p>
                  <p className="text-sm font-bold text-[#192d17] dark:text-[#f3f7f1]">
                    Data Hotspot Terbaru
                  </p>
                </div>
                <a
                  href="/data"
                  className="text-[0.72rem] font-semibold text-[#3d6b35] hover:text-[#2a4a26] dark:text-[#8fc483] dark:hover:text-[#a8d49f] transition-colors"
                >
                  Lihat Semua →
                </a>
              </div>
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-16 flex-1">
                  <div className="w-5 h-5 border-2 border-[#d4ddd0] border-t-[#3d6b35] rounded-full animate-spin mb-2"></div>
                  <p className="text-[#6b7a64] text-[0.75rem]">
                    Memuat data...
                  </p>
                </div>
              ) : latestHotspots.length > 0 ? (
                <div className="divide-y divide-[#e8ece6] dark:divide-[#2a3a28] flex-1 flex flex-col">
                  {latestHotspots.slice(0, 5).map((hotspot, index) => {
                    const isHigh = hotspot.confidence_class === "HIGH";
                    return (
                      <div
                        key={index}
                        className={`px-5 py-4 hover:bg-[#f3f6f2] dark:hover:bg-[#1a221a] transition-colors flex-1 flex items-center ${
                          isHigh ? "bg-[#fef8ed] dark:bg-[#3d3520]" : ""
                        }`}
                      >
                        <div
                          className={`w-full ${isHigh ? "border-l-3 border-[#e4991b] pl-3 -ml-1" : ""}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-[0.8rem] font-bold text-[#192d17] dark:text-[#f3f7f1] truncate">
                                {hotspot.city_name || "N/A"},{" "}
                                {hotspot.province_name || "N/A"}
                              </p>
                              <p className="text-[0.68rem] text-[#6b7a64] truncate">
                                {formatDate(hotspot.acquired_at)} ·{" "}
                                {extractTime(hotspot.acquired_at)}
                              </p>
                            </div>
                            <span
                              className={`flex-shrink-0 px-1.5 py-0.5 text-[0.6rem] font-semibold rounded ${
                                hotspot.confidence_class === "HIGH"
                                  ? "bg-[#c07f10]/10 text-[#c07f10]"
                                  : hotspot.confidence_class === "MEDIUM"
                                    ? "bg-[#6b7a64]/10 text-[#6b7a64]"
                                    : "bg-[#3d6b35]/10 text-[#3d6b35]"
                              }`}
                            >
                              {hotspot.confidence_class || "NOMINAL"}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-16 flex-1 flex items-center justify-center">
                  <p className="text-[#6b7a64] text-[0.8rem]">Tidak ada data</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <ReportedHotspotsSection
        latestHotspots={latestHotspots}
        summaryData={summaryData}
        isLoading={isLoading}
      />

      {showMitigation && (
        <Suspense fallback={<CardSkeleton count={3} />}>
          <MitigationSection />
        </Suspense>
      )}
    </div>
  );
};

export default Main;
