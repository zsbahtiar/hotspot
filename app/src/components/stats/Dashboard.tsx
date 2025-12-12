import { useMemo, lazy, Suspense } from "react";
import type { HotspotDataGeo } from "@/core/models/hotspot";
import { formatNumber, extractTime, formatDate } from "@/core/utils/formatters";
import {
  useLatestHotspots,
  useSummary,
} from "@/core/hooks/useHotspotQueries";
import { Tooltip } from "react-tooltip";
import { monthNames } from "@/core/models/time";
import {
  StatsSkeleton,
  ChartSkeleton,
  CardSkeleton,
} from "@/components/common/LoadingSkeletons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const StatsSection = lazy(() => import("@/components/stats/StatsSection"));
const MitigationSection = lazy(
  () => import("@/components/stats/MitigationSection"),
);
const ChartComponent = lazy(() => import("@/components/stats/Chart"));

interface MainProps {
  showHero?: boolean;
  showMitigation?: boolean;
  currentYear?: number;
}

const Main = ({ showHero = true, showMitigation = true, currentYear }: MainProps) => {
  // Use provided year from Astro SSR, or fallback to current year
  const year = currentYear || new Date().getFullYear();

  // Fetch all dashboard data in single request with concurrent backend queries
  const { data: summaryRes, isLoading: summaryLoading } = useSummary({
    province_limit: 10,
    city_limit: 10,
  });
  const { data: latestHotspotsRes, isLoading: latestLoading } =
    useLatestHotspots(5);

  const isLoading = summaryLoading || latestLoading;

  // Transform data to match existing structure
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
    // Use backend summary data when available, fallback to manual calculation
    if (summaryData?.monthly?.length > 0) {
      // Backend data format: [{month: "2015-01-01T00:00:00Z", total: 4064, high_confidence: 0}, ...]
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
        // Parse ISO date string to get month
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
      // Fallback to manual calculation from 2025 hotspot data only
      interface MonthCount {
        total: number;
        highConfidence: number;
      }

      const monthCounts: Record<string, MonthCount> = {};

      hotspotData.features?.forEach((feature) => {
        if (feature.properties.time) {
          const date = new Date(feature.properties.time);
          const featureYear = date.getFullYear();

          // Only process 2025 data
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

  const chartData = useMemo(
    () => ({
      labels: monthlyHotspotTrends.map(([month]) => month),
      datasets: [
        {
          label: "Jumlah Hotspot per Bulan",
          data: monthlyHotspotTrends.map(([, counts]) => counts.total),
          borderColor: "#22c55e",
          backgroundColor: "rgba(34, 197, 94, 0.1)",
          borderWidth: 2,
          pointBackgroundColor: "#22c55e",
          pointBorderColor: "#ffffff",
          pointBorderWidth: 1,
          pointRadius: 4,
          tension: 0.2,
          fill: true,
        },
        {
          label: "Confidence Tinggi",
          data: monthlyHotspotTrends.map(([, counts]) => counts.highConfidence),
          borderColor: "#ef4444",
          backgroundColor: "rgba(239, 68, 68, 0.1)",
          borderWidth: 2,
          pointBackgroundColor: "#ef4444",
          pointBorderColor: "#ffffff",
          pointBorderWidth: 1,
          pointRadius: 4,
          tension: 0.2,
          fill: true,
        },
      ],
    }),
    [monthlyHotspotTrends],
  );

  const stats = useMemo(() => {
    // All data from single summary response
    const backendStats = summaryRes?.data?.stats;
    const topProvincesData = summaryData?.top_provinces || [];
    const todayStats = summaryRes?.data?.today_stats;

    // Get top province as "lokasi tertinggi"
    const topProvince = topProvincesData[0]?.name || "N/A";

    return {
      totalHotspots: backendStats?.total_hotspots || 0,
      highConfidence: backendStats?.high_confidence || 0,
      affectedProvinces: backendStats?.affected_provinces || 0,
      topLocation: topProvince,
      todayHotspots: todayStats?.today_hotspots || 0,
      todayHighConfidence: todayStats?.today_high_confidence || 0,
      todayAffectedProvinces: todayStats?.today_affected_provinces || 0,
    };
  }, [summaryData, summaryRes]);


  // Get latest hotspots from API
  const latestHotspots = latestHotspotsRes?.data?.hotspots || [];

  return (
    <div className="bg-gray-50 dark:bg-gray-900">
      <Tooltip
        id="confidence-tooltip"
        style={{
          backgroundColor: "#2d3748",
          color: "#fff",
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
                className="inline-flex items-center justify-center px-8 py-4 border-2 border-white/60 text-white font-semibold rounded-lg hover:bg-white hover:text-gray-900 transition-all duration-200"
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

      {/* Info */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold mb-6 dark:text-white text-gray-900 tracking-tight">
              Data Hotspot Terkini
            </h2>
            <p className="text-xl dark:text-gray-300 text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Monitoring hotspot kebakaran hutan dan lahan Indonesia bersumber
              dari&nbsp;
              <a
                href="https://firms.modaps.eosdis.nasa.gov/"
                target="_blank"
                rel="nofollow noopener noreferrer"
                className="dark:text-blue-400 text-blue-600 hover:text-blue-700 dark:hover:text-blue-300 font-medium underline decoration-2 underline-offset-2"
                title="NASA Fire Information for Resource Management System"
              >
                NASA FIRMS
              </a>{" "}
              dan&nbsp;
              <a
                href="https://www.visualcrossing.com/"
                target="_blank"
                rel="nofollow noopener noreferrer"
                className="dark:text-blue-400 text-blue-600 hover:text-blue-700 dark:hover:text-blue-300 font-medium underline decoration-2 underline-offset-2"
                title="Visual Crossing Weather Data & API"
              >
                Visual Crossing
              </a>
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Hotspot Terbaru */}
            <Card className="dark:border-gray-700 dark:bg-gray-800 border border-gray-200 bg-white hover:shadow-lg transition-all duration-300 rounded-xl">
              <CardHeader className="dark:border-gray-700 px-6 py-4 border-b border-gray-100">
                <CardTitle className="dark:text-white text-gray-900 text-lg font-semibold">
                  Data Terbaru
                </CardTitle>
                <p className="dark:text-gray-400 text-sm text-gray-500">
                  Update terkini
                </p>
              </CardHeader>

              <CardContent className="p-6">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="w-8 h-8 dark:border-gray-500 dark:border-t-gray-400 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mb-4"></div>
                    <p className="dark:text-gray-300 text-gray-600 text-lg font-medium">
                      Memuat data...
                    </p>
                  </div>
                ) : latestHotspots.length > 0 ? (
                  <div className="space-y-6">
                    {latestHotspots.map((hotspot, index) => (
                      <div
                        key={index}
                        className={`dark:bg-gray-700 dark:border-gray-600 p-5 rounded-2xl bg-gray-50 border border-gray-100 hover:dark:bg-gray-600 hover:bg-gray-100 transition-all duration-200 ${
                          index < latestHotspots.length - 1 ? "" : ""
                        }`}
                      >
                        <div className="flex justify-between items-center mb-3">
                          <span className="dark:text-gray-300 font-medium text-gray-700 text-sm uppercase tracking-wide">
                            Tanggal
                          </span>
                          <span className="dark:text-white text-gray-900 font-medium">
                            {formatDate(hotspot.acquired_at)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center mb-3">
                          <span className="dark:text-gray-300 font-medium text-gray-700 text-sm uppercase tracking-wide">
                            Waktu
                          </span>
                          <span className="dark:text-white text-gray-900 font-medium">
                            {extractTime(hotspot.acquired_at)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center mb-3">
                          <span className="dark:text-gray-300 font-medium text-gray-700 text-sm uppercase tracking-wide">
                            Sumber
                          </span>
                          <span className="dark:text-white text-gray-900 font-medium">
                            {hotspot.satellite_name || "N/A"}
                          </span>
                        </div>
                        <div className="mb-4">
                          <span className="dark:text-gray-300 font-medium text-gray-700 text-sm uppercase tracking-wide block mb-2">
                            Lokasi
                          </span>
                          <span className="dark:text-white text-gray-900 text-sm leading-relaxed block">
                            {hotspot.subdistrict_name || "N/A"},{" "}
                            {hotspot.district_name || "N/A"}
                          </span>
                          <span className="dark:text-white text-gray-900 text-sm leading-relaxed block">
                            {hotspot.city_name || "N/A"},{" "}
                            {hotspot.province_name || "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center mb-3">
                          <span className="dark:text-gray-300 font-medium text-gray-700 text-sm uppercase tracking-wide">
                            Confidence
                          </span>
                          <Badge
                            variant={
                              hotspot.confidence_class === "HIGH"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {hotspot.confidence_class || "NOMINAL"}
                          </Badge>
                        </div>
                        {hotspot.weather_conditions && (
                          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                            <div className="flex justify-between items-center mb-2">
                              <span className="dark:text-gray-300 font-medium text-gray-700 text-sm uppercase tracking-wide">
                                Cuaca
                              </span>
                              <span className="dark:text-white text-gray-900 text-sm">
                                {hotspot.weather_conditions}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="dark:text-gray-400 text-gray-600">
                                  Suhu:
                                </span>
                                <span className="dark:text-white text-gray-900 ml-1">
                                  {hotspot.temperature}°C
                                </span>
                              </div>
                              <div>
                                <span className="dark:text-gray-400 text-gray-600">
                                  Kelembaban:
                                </span>
                                <span className="dark:text-white text-gray-900 ml-1">
                                  {hotspot.humidity}%
                                </span>
                              </div>
                              <div>
                                <span className="dark:text-gray-400 text-gray-600">
                                  Angin:
                                </span>
                                <span className="dark:text-white text-gray-900 ml-1">
                                  {hotspot.wind_speed} km/h
                                </span>
                              </div>
                              <div>
                                <span className="dark:text-gray-400 text-gray-600">
                                  Hujan:
                                </span>
                                <span className="dark:text-white text-gray-900 ml-1">
                                  {hotspot.precipitation} mm
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <svg
                        className="w-8 h-8 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                        />
                      </svg>
                    </div>
                    <p className="text-gray-500 font-medium">
                      Tidak ada data hotspot
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Grafik dan Statistik */}
            <Card className="dark:border-gray-700 dark:bg-gray-800 border border-gray-200 bg-white hover:shadow-lg transition-all duration-300 rounded-xl">
              <CardHeader className="dark:border-gray-700 px-6 py-4 border-b border-gray-100">
                <CardTitle className="dark:text-white text-gray-900 text-lg font-semibold">
                  Statistik Hotspot
                </CardTitle>
                <p className="dark:text-gray-400 text-sm text-gray-500" suppressHydrationWarning>
                  Analitik data hotspot Tahun {year}
                </p>
              </CardHeader>

              <CardContent className="p-6">
                {/* Grafik */}
                <div className="dark:bg-gray-700 dark:border-gray-600 bg-gray-50 rounded-xl h-64 flex items-center justify-center mb-6 border border-gray-200">
                  <Suspense fallback={<ChartSkeleton />}>
                    <ChartComponent
                      chartData={chartData}
                      isLoading={isLoading}
                    />
                  </Suspense>
                </div>

                {/* Top Locations */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="dark:bg-gray-700 dark:border-gray-600 bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <h5 className="dark:text-white text-sm font-medium text-gray-700 mb-2">
                      Top Provinsi
                    </h5>
                    <div className="space-y-1">
                      {(() => {
                        // Use backend summary data when available, fallback to manual calculation
                        if (summaryData?.top_provinces?.length > 0) {
                          return summaryData.top_provinces.map((province) => (
                            <div
                              key={province.name}
                              className="flex justify-between text-xs"
                            >
                              <span className="dark:text-gray-300 text-gray-600">
                                {province.name}
                              </span>
                              <span className="dark:text-white font-medium text-gray-900">
                                {province.count}
                              </span>
                            </div>
                          ));
                        }
                      })()}
                    </div>
                  </div>
                  <div className="dark:bg-gray-700 dark:border-gray-600 bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <h5 className="dark:text-white text-sm font-medium text-gray-700 mb-2">
                      Top Kabupaten
                    </h5>
                    <div className="space-y-1">
                      {(() => {
                        // Use backend summary data when available
                        if (summaryData?.top_cities?.length > 0) {
                          return summaryData.top_cities.map((city) => (
                            <div
                              key={city.name}
                              className="flex justify-between text-xs"
                            >
                              <span className="dark:text-gray-300 text-gray-600">
                                {city.name}
                              </span>
                              <span className="dark:text-white font-medium text-gray-900">
                                {city.count}
                              </span>
                            </div>
                          ));
                        }
                      })()}
                    </div>
                  </div>
                </div>

                {/* Time Analysis */}
                <div className="dark:bg-gray-700 dark:border-gray-600 bg-gray-50 rounded-lg p-4 border border-gray-200 mb-6">
                  <h5 className="dark:text-white text-sm font-medium text-gray-700 mb-3">
                    Analisis Waktu
                  </h5>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <div className="dark:text-white text-sm font-medium text-gray-900 mb-1">
                        Periode
                      </div>
                      <div className="dark:text-gray-300 text-xs text-gray-600">
                        {(() => {
                          if (summaryData?.monthly?.length > 0) {
                            // Get first and last month from monthly stats
                            const firstMonth = new Date(
                              summaryData.monthly[0].month,
                            );
                            const lastMonth = new Date(
                              summaryData.monthly[
                                summaryData.monthly.length - 1
                              ].month,
                            );

                            // Set to first day of first month and last day of last month
                            const startDate = new Date(
                              firstMonth.getFullYear(),
                              firstMonth.getMonth(),
                              1,
                            );
                            const endDate = new Date(
                              lastMonth.getFullYear(),
                              lastMonth.getMonth() + 1,
                              0,
                            ); // Last day of month

                            return `${startDate.toLocaleDateString("id-ID")} - ${endDate.toLocaleDateString("id-ID")}`;
                          }
                          return "Tidak ada data";
                        })()}
                      </div>
                    </div>
                    <div>
                      <div className="dark:text-white text-sm font-medium text-gray-900 mb-1">
                        Rata-rata per Hari
                      </div>
                      <div className="dark:text-gray-300 text-xs text-gray-600">
                        {(() => {
                          if (summaryData?.monthly?.length > 0) {
                            // Calculate total hotspots
                            const totalHotspots = summaryData.monthly.reduce(
                              (sum, month) => sum + month.total,
                              0,
                            );

                            // Calculate total days from first to last month
                            const firstMonth = new Date(
                              summaryData.monthly[0].month,
                            );
                            const lastMonth = new Date(
                              summaryData.monthly[
                                summaryData.monthly.length - 1
                              ].month,
                            );

                            const startDate = new Date(
                              firstMonth.getFullYear(),
                              firstMonth.getMonth(),
                              1,
                            );
                            const endDate = new Date(); // Today

                            const daysDiff = Math.ceil(
                              (endDate.getTime() - startDate.getTime()) /
                                (1000 * 60 * 60 * 24),
                            );

                            return Math.round(totalHotspots / daysDiff);
                          }
                          return 0;
                        })()}{" "}
                        hotspot
                      </div>
                    </div>
                  </div>
                </div>

                {/* Monthly Distribution */}
                <div className="dark:bg-gray-700 dark:border-gray-600 bg-gray-50 rounded-lg p-4 border border-gray-200 mb-6">
                  <h5 className="dark:text-white text-sm font-medium text-gray-700 mb-3">
                    Distribusi Bulanan
                  </h5>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {(() => {
                      // Use backend summary data when available, fallback to manual calculation
                      if (summaryData?.monthly?.length > 0) {
                        // Month names in Indonesian
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

                        return summaryData.monthly.map((monthData) => {
                          // Parse ISO datetime to get month index
                          const date = new Date(monthData.month);
                          const monthIndex = date.getMonth();
                          const displayMonth = monthNames[monthIndex];

                          return (
                            <div
                              key={monthData.month}
                              className="dark:bg-gray-800 dark:border-gray-600 bg-white p-2 rounded border border-gray-200"
                            >
                              <div className="dark:text-gray-300 text-xs text-gray-600">
                                {displayMonth}
                              </div>
                              <div className="dark:text-white text-sm font-medium text-gray-900">
                                {monthData.total}
                              </div>
                            </div>
                          );
                        });
                      } else {
                        // Fallback to manual calculation - only use 2025 data
                        const monthCounts: Record<string, number> = {};
                        const currentYear = new Date().getFullYear();

                        hotspotData.features?.forEach((f) => {
                          const date = new Date(f.properties.time);
                          const featureYear = date.getFullYear();

                          // Only process 2025 data
                          if (featureYear === currentYear) {
                            const month = date.toLocaleDateString("id-ID", {
                              month: "short",
                            });
                            monthCounts[month] = (monthCounts[month] || 0) + 1;
                          }
                        });
                        return Object.entries(monthCounts)
                          .sort((a, b) => {
                            const months = [
                              "Jan",
                              "Feb",
                              "Mar",
                              "Apr",
                              "May",
                              "Jun",
                              "Jul",
                              "Aug",
                              "Sep",
                              "Oct",
                              "Nov",
                              "Dec",
                            ];
                            return months.indexOf(a[0]) - months.indexOf(b[0]);
                          })
                          .map(([month, count]) => (
                            <div
                              key={month}
                              className="dark:bg-gray-800 dark:border-gray-600 bg-white p-2 rounded border border-gray-200"
                            >
                              <div className="dark:text-gray-300 text-xs text-gray-600">
                                {month}
                              </div>
                              <div className="dark:text-white text-sm font-medium text-gray-900">
                                {count}
                              </div>
                            </div>
                          ));
                      }
                    })()}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="dark:bg-gray-700 dark:border-gray-600 bg-gray-50 rounded-lg p-4 border border-gray-200 text-center">
                    <div className="dark:text-white text-2xl font-bold text-gray-900">
                      {stats.totalHotspots
                        ? formatNumber(stats.totalHotspots)
                        : "-"}
                    </div>
                    <div className="dark:text-gray-300 text-sm text-gray-600">
                      Jumlah Hotspot
                    </div>
                  </div>
                  <div className="dark:bg-gray-700 dark:border-gray-600 bg-gray-50 rounded-lg p-4 border border-gray-200 text-center">
                    <div className="dark:text-white text-2xl font-bold text-gray-900">
                      {stats.highConfidence
                        ? formatNumber(stats.highConfidence)
                        : "-"}
                    </div>
                    <div className="dark:text-gray-300 text-sm text-gray-600 flex items-center justify-center">
                      Confidence Tinggi
                    </div>
                  </div>
                  <div className="dark:bg-gray-700 dark:border-gray-600 bg-gray-50 rounded-lg p-4 border border-gray-200 text-center">
                    <div className="dark:text-white text-2xl font-bold text-gray-900">
                      {stats.topLocation ? stats.topLocation : "-"}
                    </div>
                    <div className="dark:text-gray-300 text-sm text-gray-600">
                      Lokasi Tertinggi
                    </div>
                  </div>
                  <div className="dark:bg-gray-700 dark:border-gray-600 bg-gray-50 rounded-lg p-4 border border-gray-200 text-center">
                    <div className="dark:text-white text-2xl font-bold text-gray-900">
                      {stats.affectedProvinces ? stats.affectedProvinces : "-"}
                    </div>
                    <div className="dark:text-gray-300 text-sm text-gray-600">
                      Provinsi Terdampak
                    </div>
                  </div>
                </div>

                {/* Confidence Breakdown */}
                <div className="mt-6">
                  <h4 className="dark:text-white text-sm font-medium text-gray-700 mb-3">
                    Distribusi Confidence Level
                  </h4>
                  <div className="space-y-2">
                    {[
                      {
                        level: "Tinggi",
                        range: "80-100%",
                        bgColor: "#ef4444",
                        dotClass: "bg-red-500",
                        confidence: "high",
                      },
                      {
                        level: "Sedang",
                        range: "30-79%",
                        bgColor: "#eab308",
                        dotClass: "bg-yellow-500",
                        confidence: "medium",
                      },
                      {
                        level: "Rendah",
                        range: "0-29%",
                        bgColor: "#22c55e",
                        dotClass: "bg-green-500",
                        confidence: "low",
                      },
                    ].map((item) => {
                      // Use backend summary data when available, fallback to manual calculation
                      const count =
                        summaryData?.confidence?.[
                          item.confidence.toUpperCase()
                        ] ||
                        hotspotData.features?.filter(
                          (f) => f.properties.confidence === item.confidence,
                        ).length ||
                        0;

                      const confidenceData = summaryData?.confidence || {};
                      const backendHigh =
                        (confidenceData.HIGH || 0) +
                        (confidenceData.NOMINAL || 0);
                      const backendMedium = confidenceData.MEDIUM || 0;
                      const backendLow = confidenceData.LOW || 0;

                      const manualHigh =
                        hotspotData.features?.filter(
                          (f) => f.properties.confidence === "high",
                        ).length || 0;
                      const manualMedium =
                        hotspotData.features?.filter(
                          (f) => f.properties.confidence === "medium",
                        ).length || 0;
                      const manualLow =
                        hotspotData.features?.filter(
                          (f) => f.properties.confidence === "low",
                        ).length || 0;

                      const maxCount = Math.max(
                        summaryData
                          ? Math.max(backendHigh, backendMedium, backendLow)
                          : Math.max(manualHigh, manualMedium, manualLow),
                      );
                      const lineWidth =
                        maxCount > 0 ? (count / maxCount) * 100 : 0;

                      return (
                        <div
                          key={item.confidence}
                          className="flex items-center"
                        >
                          <div className="flex items-center space-x-2 min-w-0 flex-1">
                            <div
                              className={`w-3 h-3 rounded-full flex-shrink-0 ${item.dotClass}`}
                            ></div>
                            <span className="dark:text-gray-300 text-sm text-gray-600 truncate">
                              {item.level} ({item.range})
                            </span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <div className="w-64 dark:bg-gray-600 bg-gray-200 rounded-full h-3 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500 ease-out"
                                style={{
                                  width: `${lineWidth}%`,
                                  backgroundColor: item.bgColor,
                                }}
                              ></div>
                            </div>
                            <span className="dark:text-white text-sm font-medium text-gray-900 min-w-[3ch] text-right">
                              {count}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Satellite Distribution */}
                <div className="mt-6">
                  <h4 className="dark:text-white text-sm font-medium text-gray-700 mb-3">
                    Sumber Satelit
                  </h4>
                  <div className="space-y-2">
                    {(() => {
                      // Define color mapping for satellites
                      const satelliteColors: Record<
                        string,
                        { bgColor: string; dotClass: string }
                      > = {
                        N: { bgColor: "#3b82f6", dotClass: "bg-blue-500" },
                        N20: { bgColor: "#06b6d4", dotClass: "bg-cyan-500" },
                        N21: { bgColor: "#10b981", dotClass: "bg-emerald-500" },
                        Aqua: { bgColor: "#8b5cf6", dotClass: "bg-purple-500" },
                        Terra: { bgColor: "#f59e0b", dotClass: "bg-amber-500" },
                      };

                      const satellitesData = summaryData?.satellites || {};
                      const satelliteEntries = Object.entries(satellitesData);

                      if (satelliteEntries.length === 0) {
                        return (
                          <div className="text-center py-4 text-gray-500 text-sm">
                            Tidak ada data satelit
                          </div>
                        );
                      }

                      const maxCount = Math.max(
                        ...satelliteEntries.map(([, count]) => count),
                      );

                      return satelliteEntries.map(([name, count]) => {
                        const colors =
                          satelliteColors[name] || {
                            bgColor: "#6b7280",
                            dotClass: "bg-gray-500",
                          };
                        const lineWidth =
                          maxCount > 0 ? (count / maxCount) * 100 : 0;

                        return (
                          <div key={name} className="flex items-center">
                            <div className="flex items-center space-x-2 min-w-0 flex-1">
                              <div
                                className={`w-3 h-3 rounded-full flex-shrink-0 ${colors.dotClass}`}
                              ></div>
                              <span className="dark:text-gray-300 text-sm text-gray-600 truncate">
                                {name}
                              </span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <div className="w-64 dark:bg-gray-600 bg-gray-200 rounded-full h-3 overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500 ease-out"
                                  style={{
                                    width: `${lineWidth}%`,
                                    backgroundColor: colors.bgColor,
                                  }}
                                ></div>
                              </div>
                              <span className="dark:text-white text-sm font-medium text-gray-900 min-w-[3ch] text-right">
                                {count}
                              </span>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Lazy Loaded Stats Section */}
      <Suspense fallback={<StatsSkeleton />}>
        <StatsSection stats={stats} isLoading={isLoading} />
      </Suspense>

      {/* Lazy Loaded Mitigation Section */}
      {showMitigation && (
        <Suspense fallback={<CardSkeleton count={3} />}>
          <MitigationSection />
        </Suspense>
      )}
    </div>
  );
};

export default Main;
