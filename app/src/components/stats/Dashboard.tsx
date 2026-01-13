import { useMemo, lazy, Suspense } from "react";
import type { HotspotDataGeo } from "@/core/models/hotspot";
import { formatNumber, extractTime, formatDate, translateWeatherCondition } from "@/core/utils/formatters";
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
  const year = currentYear ?? 2025;

  const ytdDateRange = useMemo(() => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const formatWithTimezone = (date: Date) => {
      const offset = -date.getTimezoneOffset();
      const sign = offset >= 0 ? '+' : '-';
      const hours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0');
      const minutes = String(Math.abs(offset) % 60).padStart(2, '0');
      const tzOffset = `${sign}${hours}:${minutes}`;

      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hour = String(date.getHours()).padStart(2, '0');
      const min = String(date.getMinutes()).padStart(2, '0');
      const sec = String(date.getSeconds()).padStart(2, '0');

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
    const backendStats = summaryRes?.data?.stats;
    const topProvincesData = summaryData?.top_provinces || [];
    const todayStats = summaryRes?.data?.today_stats;

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

      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-background">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold mb-6 text-foreground tracking-tight">
              Data Hotspot Terkini
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Monitoring hotspot kebakaran hutan dan lahan Indonesia bersumber
              dari&nbsp;
              <a
                href="https://firms.modaps.eosdis.nasa.gov/"
                target="_blank"
                rel="nofollow noopener noreferrer"
                className="text-primary hover:underline font-medium"
                title="NASA Fire Information for Resource Management System"
              >
                NASA FIRMS
              </a>{" "}
              dan&nbsp;
              <a
                href="https://www.visualcrossing.com/"
                target="_blank"
                rel="nofollow noopener noreferrer"
                className="text-primary hover:underline font-medium"
                title="Visual Crossing Weather Data & API"
              >
                Visual Crossing
              </a>
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-0 lg:divide-x divide-border">
            {/* Data Terbaru */}
            <div className="lg:pr-8">
              <div className="mb-6">
                <h3 className="text-foreground text-xl font-semibold">
                  Data Terbaru
                </h3>
                <p className="text-sm text-muted-foreground">
                  Update terkini
                </p>
              </div>

              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="w-8 h-8 border-2 border-muted border-t-primary rounded-full animate-spin mb-4"></div>
                  <p className="text-muted-foreground text-lg font-medium">
                    Memuat data...
                  </p>
                </div>
              ) : latestHotspots.length > 0 ? (
                <div className="space-y-4">
                  {latestHotspots.map((hotspot, index) => (
                    <div
                      key={index}
                      className={`py-5 ${
                        index < latestHotspots.length - 1 ? "border-b border-border" : ""
                      }`}
                    >
                      <div className="grid grid-cols-[100px_1fr] gap-x-4 gap-y-3 text-sm">
                        <span className="font-medium text-muted-foreground uppercase tracking-wide">
                          Tanggal
                        </span>
                        <span className="text-foreground font-medium text-right">
                          {formatDate(hotspot.acquired_at)}
                        </span>

                        <span className="font-medium text-muted-foreground uppercase tracking-wide">
                          Waktu
                        </span>
                        <span className="text-foreground font-medium text-right">
                          {extractTime(hotspot.acquired_at)}
                        </span>

                        <span className="font-medium text-muted-foreground uppercase tracking-wide">
                          Sumber
                        </span>
                        <span className="text-foreground font-medium text-right">
                          {hotspot.satellite_name || "N/A"}
                        </span>

                        <span className="font-medium text-muted-foreground uppercase tracking-wide">
                          Lokasi
                        </span>
                        <span className="text-foreground text-right leading-relaxed">
                          {hotspot.subdistrict_name || "N/A"}, {hotspot.district_name || "N/A"}
                          <br />
                          {hotspot.city_name || "N/A"}, {hotspot.province_name || "N/A"}
                        </span>

                        <span className="font-medium text-muted-foreground uppercase tracking-wide">
                          Confidence
                        </span>
                        <span className="text-foreground font-medium text-right">
                          {hotspot.confidence_class === "HIGH" ? (
                            <Badge variant="destructive">HIGH</Badge>
                          ) : (
                            hotspot.confidence_class || "NOMINAL"
                          )}
                        </span>
                      </div>
                      {hotspot.weather_conditions && (
                        <div className="mt-3">
                          <div className="grid grid-cols-[100px_1fr] gap-x-4 gap-y-2 text-sm">
                            <span className="font-medium text-muted-foreground uppercase tracking-wide">
                              Cuaca
                            </span>
                            <span className="text-foreground font-medium text-right">
                              {translateWeatherCondition(hotspot.weather_conditions)}
                            </span>

                            <span className="text-muted-foreground">Suhu</span>
                            <span className="text-foreground text-right">{hotspot.temperature}°C</span>

                            <span className="text-muted-foreground">Kelembaban</span>
                            <span className="text-foreground text-right">{hotspot.humidity}%</span>

                            <span className="text-muted-foreground">Angin</span>
                            <span className="text-foreground text-right">{hotspot.wind_speed} km/h</span>

                            <span className="text-muted-foreground">Hujan</span>
                            <span className="text-foreground text-right">{hotspot.precipitation} mm</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="w-16 h-16 bg-secondary rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="w-8 h-8 text-muted-foreground"
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
                  <p className="text-muted-foreground font-medium">
                    Tidak ada data hotspot
                  </p>
                </div>
              )}
            </div>

            {/* Statistik Hotspot */}
            <div className="lg:pl-8 pt-8 lg:pt-0 border-t lg:border-t-0 border-border">
              <div className="mb-6">
                <h3 className="text-foreground text-xl font-semibold">
                  Statistik Hotspot
                </h3>
                <p className="text-sm text-muted-foreground">
                  Analitik data hotspot Tahun <span suppressHydrationWarning>{year}</span>
                </p>
              </div>

              {/* Chart */}
              <div className="bg-secondary rounded-xl h-64 flex items-center justify-center mb-6">
                <Suspense fallback={<ChartSkeleton />}>
                  <ChartComponent
                    chartData={chartData}
                    isLoading={isLoading}
                  />
                </Suspense>
              </div>

              {/* Top Provinsi & Kabupaten */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="border-l-4 border-primary pl-4">
                  <h5 className="text-sm font-medium text-foreground mb-2">
                    Top Provinsi
                  </h5>
                  <div className="space-y-1">
                    {summaryData?.top_provinces?.length > 0 &&
                      summaryData.top_provinces.map((province) => (
                        <div key={province.name} className="flex justify-between text-xs">
                          <span className="text-muted-foreground">{province.name}</span>
                          <span className="font-medium text-foreground">{province.count}</span>
                        </div>
                      ))}
                  </div>
                </div>
                <div className="border-l-4 border-primary pl-4">
                  <h5 className="text-sm font-medium text-foreground mb-2">
                    Top Kabupaten
                  </h5>
                  <div className="space-y-1">
                    {summaryData?.top_cities?.length > 0 &&
                      summaryData.top_cities.map((city) => (
                        <div key={city.name} className="flex justify-between text-xs">
                          <span className="text-muted-foreground">{city.name}</span>
                          <span className="font-medium text-foreground">{city.count}</span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>

              {/* Analisis Waktu */}
              <div className="border-l-4 border-primary pl-4 mb-6">
                <h5 className="text-sm font-medium text-foreground mb-3">
                  Analisis Waktu
                </h5>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium text-foreground mb-1">Periode</div>
                    <div className="text-xs text-muted-foreground">
                      {summaryData?.monthly?.length > 0 ? (() => {
                        const firstMonth = new Date(summaryData.monthly[0].month);
                        const lastMonth = new Date(summaryData.monthly[summaryData.monthly.length - 1].month);
                        const startDate = new Date(firstMonth.getFullYear(), firstMonth.getMonth(), 1);
                        const endDate = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);
                        return `${startDate.toLocaleDateString("id-ID")} - ${endDate.toLocaleDateString("id-ID")}`;
                      })() : "Tidak ada data"}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-foreground mb-1">Rata-rata per Hari</div>
                    <div className="text-xs text-muted-foreground">
                      {summaryData?.monthly?.length > 0 ? (() => {
                        const totalHotspots = summaryData.monthly.reduce((sum, month) => sum + month.total, 0);
                        const firstMonth = new Date(summaryData.monthly[0].month);
                        const startDate = new Date(firstMonth.getFullYear(), firstMonth.getMonth(), 1);
                        const endDate = new Date();
                        const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
                        return Math.round(totalHotspots / daysDiff);
                      })() : 0} hotspot
                    </div>
                  </div>
                </div>
              </div>

              {/* Distribusi Bulanan */}
              <div className="mb-6">
                <h5 className="text-sm font-medium text-foreground mb-3">
                  Distribusi Bulanan
                </h5>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {summaryData?.monthly?.length > 0 ? (
                    summaryData.monthly.map((monthData) => {
                      const date = new Date(monthData.month);
                      const monthIndex = date.getMonth();
                      const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
                      const displayMonth = monthNames[monthIndex];

                      return (
                        <div key={monthData.month} className="bg-secondary p-2 rounded">
                          <div className="text-xs text-muted-foreground">{displayMonth}</div>
                          <div className="text-sm font-medium text-foreground">{monthData.total}</div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="col-span-3 text-center py-4 text-muted-foreground text-sm">
                      Tidak ada data
                    </div>
                  )}
                </div>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="text-center py-4 border-b border-r border-border">
                  <div className="text-2xl font-bold text-primary">
                    {stats.totalHotspots ? formatNumber(stats.totalHotspots) : "-"}
                  </div>
                  <div className="text-sm text-muted-foreground">Jumlah Hotspot</div>
                </div>
                <div className="text-center py-4 border-b border-border">
                  <div className="text-2xl font-bold text-primary">
                    {stats.highConfidence ? formatNumber(stats.highConfidence) : "-"}
                  </div>
                  <div className="text-sm text-muted-foreground">Confidence Tinggi</div>
                </div>
                <div className="text-center py-4 border-r border-border">
                  <div className="text-lg font-bold text-primary">
                    {stats.topLocation ? stats.topLocation : "-"}
                  </div>
                  <div className="text-sm text-muted-foreground">Lokasi Tertinggi</div>
                </div>
                <div className="text-center py-4">
                  <div className="text-2xl font-bold text-primary">
                    {stats.affectedProvinces ? stats.affectedProvinces : "-"}
                  </div>
                  <div className="text-sm text-muted-foreground">Provinsi Terdampak</div>
                </div>
              </div>

              {/* Distribusi Confidence Level */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-foreground mb-3">
                  Distribusi Confidence Level
                </h4>
                <div className="space-y-2">
                  {[
                    { level: "Tinggi", range: "80-100%", bgColor: "#ef4444", dotClass: "bg-red-500", confidence: "high" },
                    { level: "Sedang", range: "30-79%", bgColor: "#eab308", dotClass: "bg-yellow-500", confidence: "medium" },
                    { level: "Rendah", range: "0-29%", bgColor: "#22c55e", dotClass: "bg-green-500", confidence: "low" },
                  ].map((item) => {
                    const count = summaryData?.confidence?.[item.confidence.toUpperCase()] ||
                      hotspotData.features?.filter((f) => f.properties.confidence === item.confidence).length || 0;

                    const confidenceData = summaryData?.confidence || {};
                    const backendHigh = (confidenceData.HIGH || 0) + (confidenceData.NOMINAL || 0);
                    const backendMedium = confidenceData.MEDIUM || 0;
                    const backendLow = confidenceData.LOW || 0;

                    const maxCount = Math.max(backendHigh, backendMedium, backendLow);
                    const lineWidth = maxCount > 0 ? (count / maxCount) * 100 : 0;

                    return (
                      <div key={item.confidence} className="flex items-center">
                        <div className="flex items-center space-x-2 min-w-0 flex-1">
                          <div className={`w-3 h-3 rounded-full flex-shrink-0 ${item.dotClass}`}></div>
                          <span className="text-sm text-muted-foreground truncate">
                            {item.level} ({item.range})
                          </span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <div className="w-64 bg-secondary rounded-full h-3 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500 ease-out"
                              style={{ width: `${lineWidth}%`, backgroundColor: item.bgColor }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium text-foreground min-w-[3ch] text-right">
                            {count}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sumber Satelit */}
              <div>
                <h4 className="text-sm font-medium text-foreground mb-3">
                  Sumber Satelit
                </h4>
                <div className="space-y-2">
                  {(() => {
                    const satelliteColors: Record<string, { bgColor: string; dotClass: string }> = {
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
                        <div className="text-center py-4 text-muted-foreground text-sm">
                          Tidak ada data satelit
                        </div>
                      );
                    }

                    const maxCount = Math.max(...satelliteEntries.map(([, count]) => count));

                    return satelliteEntries.map(([name, count]) => {
                      const colors = satelliteColors[name] || { bgColor: "#6b7280", dotClass: "bg-gray-500" };
                      const lineWidth = maxCount > 0 ? (count / maxCount) * 100 : 0;

                      return (
                        <div key={name} className="flex items-center">
                          <div className="flex items-center space-x-2 min-w-0 flex-1">
                            <div className={`w-3 h-3 rounded-full flex-shrink-0 ${colors.dotClass}`}></div>
                            <span className="text-sm text-muted-foreground truncate">{name}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <div className="w-64 bg-secondary rounded-full h-3 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${lineWidth}%`, backgroundColor: colors.bgColor }}
                              ></div>
                            </div>
                            <span className="text-sm font-medium text-foreground min-w-[3ch] text-right">
                              {count}
                            </span>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Suspense fallback={<StatsSkeleton />}>
        <StatsSection stats={stats} isLoading={isLoading} />
      </Suspense>

      {showMitigation && (
        <Suspense fallback={<CardSkeleton count={3} />}>
          <MitigationSection />
        </Suspense>
      )}
    </div>
  );
};

export default Main;
