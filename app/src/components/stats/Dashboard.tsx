import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import type { HotspotDataGeo } from "@/core/models/hotspot";
import { formatNumber, extractTime, formatDate } from "@/core/utils/formatters";
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
}

const Main = ({ showHero = true, showMitigation = true }: MainProps) => {
  const [hotspotData, setHotspotData] = useState<HotspotDataGeo>({
    features: [],
    type: "FeatureCollection",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Mock data untuk development dengan data yang lebih beragam
    const generateMockHotspots = () => {
      const locations = [
        {
          pulau: "Kalimantan",
          provinsi: "Kalimantan Tengah",
          kab_kota: "Kabupaten Palangka Raya",
          kecamatan: "Kecamatan Bukit Batu",
          desa: "Desa Tahai",
        },
        {
          pulau: "Sumatera",
          provinsi: "Sumatera Selatan",
          kab_kota: "Kabupaten Ogan Komering Ilir",
          kecamatan: "Kecamatan Pedamaran",
          desa: "Desa Pedamaran I",
        },
        {
          pulau: "Sumatera",
          provinsi: "Riau",
          kab_kota: "Kabupaten Bengkalis",
          kecamatan: "Kecamatan Mandau",
          desa: "Desa Balik Alam",
        },
        {
          pulau: "Sumatera",
          provinsi: "Jambi",
          kab_kota: "Kabupaten Muaro Jambi",
          kecamatan: "Kecamatan Maro Sebo",
          desa: "Desa Kasang",
        },
        {
          pulau: "Kalimantan",
          provinsi: "Kalimantan Barat",
          kab_kota: "Kabupaten Ketapang",
          kecamatan: "Kecamatan Sandai",
          desa: "Desa Sandai",
        },
        {
          pulau: "Papua",
          provinsi: "Papua",
          kab_kota: "Kabupaten Merauke",
          kecamatan: "Kecamatan Muting",
          desa: "Desa Muting",
        },
        {
          pulau: "Nusa Tenggara",
          provinsi: "Nusa Tenggara Timur",
          kab_kota: "Kabupaten Sumba Timur",
          kecamatan: "Kecamatan Kambera",
          desa: "Desa Kawangu",
        },
        {
          pulau: "Sulawesi",
          provinsi: "Sulawesi Selatan",
          kab_kota: "Kabupaten Bone",
          kecamatan: "Kecamatan Tellu Siattinge",
          desa: "Desa Poleonro",
        },
      ];

      const satellites = ["NASA-SNPP", "NASA-MODIS", "NASA-NOAA20"];
      const confidences = ["high", "medium", "low"];

      const features = [];
      const startDate = new Date("2024-01-01");

      // Generate 50 mock hotspots sepanjang tahun
      for (let i = 0; i < 50; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + Math.floor(i * 7)); // Setiap minggu

        // Tambahkan beberapa hotspot untuk hari ini (lebih agresif)
        if (i >= 45) { // 5 hotspot terakhir untuk hari ini
          const today = new Date();
          date.setTime(today.getTime() - Math.floor(Math.random() * 2) * 60 * 60 * 1000); // Random dalam 2 jam terakhir
        }

        const location =
          locations[Math.floor(Math.random() * locations.length)];

        features.push({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [
              95 + Math.random() * 25, // Longitude Indonesia
              -11 + Math.random() * 13, // Latitude Indonesia
            ],
          },
          properties: {
            time: date.toISOString(),
            hotspot_time: date.toISOString(),
            // Higher confidence untuk hotspot terbaru (lebih agresif)
            confidence: i >= 45
              ? Math.random() > 0.3 ? 'high' : 'medium' // 70% high, 30% medium untuk 5 terakhir
              : confidences[Math.floor(Math.random() * confidences.length)],
            satellite:
              satellites[Math.floor(Math.random() * satellites.length)],
            location: location,
          },
        });
      }

      return { type: "FeatureCollection", features };
    };

    const mockHotspotData = generateMockHotspots();
    setHotspotData(mockHotspotData);
    setIsLoading(false);
  }, []);

  const todayHotspots = useMemo(
    () =>
      hotspotData.features?.filter((f) => {
        const today = new Date().toISOString().split("T")[0];
        const hotspotDate = new Date(f.properties.time)
          .toISOString()
          .split("T")[0];
        return hotspotDate === today;
      }) || [],
    [hotspotData.features],
  );

  const monthlyHotspotTrends = useMemo(() => {
    interface MonthCount {
      total: number;
      highConfidence: number;
    }

    const monthCounts: Record<string, MonthCount> = {};

    hotspotData.features?.forEach((feature) => {
      if (feature.properties.time) {
        const date = new Date(feature.properties.time);
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
    });
    return Object.entries(monthCounts).sort((a, b) => {
      const [monthA, yearA] = a[0].split(" ");
      const [monthB, yearB] = b[0].split(" ");

      if (yearA !== yearB) {
        return parseInt(yearA) - parseInt(yearB);
      }
      return monthNames.indexOf(monthA) - monthNames.indexOf(monthB);
    });
  }, [hotspotData.features]);

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

  const stats = useMemo(
    () => ({
      totalHotspots: hotspotData.features?.length || 0,
      highConfidence:
        hotspotData.features?.filter((f) => f.properties.confidence === "high")
          .length || 0,
      affectedProvinces: new Set(
        hotspotData.features
          ?.map((f) => f.properties.location?.provinsi)
          .filter(Boolean),
      ).size,
      todayHotspots: todayHotspots.length,
      todayHighConfidence: todayHotspots.filter(
        (f) => f.properties.confidence === "high",
      ).length,
      todayAffectedProvinces: new Set(
        todayHotspots
          .map((f) => f.properties.location?.provinsi)
          .filter(Boolean),
      ).size,
      topIsland: hotspotData.features?.reduce(
        (acc: Record<string, number>, feature) => {
          const island = feature.properties.location?.pulau || "Unknown";
          acc[island] = (acc[island] || 0) + 1;
          return acc;
        },
        {},
      ),
    }),
    [hotspotData.features, todayHotspots],
  );

  const topIsland = stats.topIsland
    ? Object.entries(stats.topIsland).sort((a, b) => b[1] - a[1])[0]?.[0]
    : "N/A";

  const latestHotspots = useMemo(() => {
    return [...(hotspotData.features || [])]
      .sort((a, b) => {
        if (!a.properties.hotspot_time && !b.properties.hotspot_time) return 0;
        if (!a.properties.hotspot_time) return 1;
        if (!b.properties.hotspot_time) return -1;

        return (
          new Date(b.properties.hotspot_time).getTime() -
          new Date(a.properties.hotspot_time).getTime()
        );
      })
      .slice(0, 5);
  }, [hotspotData.features]);

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
                <p className="dark:text-gray-400 text-sm text-gray-500">Update terkini</p>
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
                            {formatDate(hotspot.properties.time)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center mb-3">
                          <span className="dark:text-gray-300 font-medium text-gray-700 text-sm uppercase tracking-wide">
                            Waktu
                          </span>
                          <span className="dark:text-white text-gray-900 font-medium">
                            {extractTime(hotspot.properties.hotspot_time)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center mb-3">
                          <span className="dark:text-gray-300 font-medium text-gray-700 text-sm uppercase tracking-wide">
                            Sumber
                          </span>
                          <span className="dark:text-white text-gray-900 font-medium">
                            {hotspot.properties.satellite || "NASA-Modis"}
                          </span>
                        </div>
                        <div className="mb-4">
                          <span className="dark:text-gray-300 font-medium text-gray-700 text-sm uppercase tracking-wide block mb-2">
                            Lokasi
                          </span>
                          <span className="dark:text-white text-gray-900 text-sm leading-relaxed block">
                            {hotspot.properties.location?.desa || "N/A"},{" "}
                            {hotspot.properties.location?.kecamatan || "N/A"}
                          </span>
                          <span className="dark:text-white text-gray-900 text-sm leading-relaxed block">
                            {hotspot.properties.location?.kab_kota || "N/A"},{" "}
                            {hotspot.properties.location?.provinsi || "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="dark:text-gray-300 font-medium text-gray-700 text-sm uppercase tracking-wide">
                            Confidence
                          </span>
                          <Badge
                            variant={
                              hotspot.properties.confidence === "high"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {hotspot.properties.confidence?.toUpperCase() ||
                              "MEDIUM"}
                          </Badge>
                        </div>
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
                <p className="dark:text-gray-400 text-sm text-gray-500">Analitik data hotspot</p>
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
                        const provinceCounts: Record<string, number> = {};
                        hotspotData.features?.forEach((f) => {
                          const prov = f.properties.location?.provinsi;
                          if (prov)
                            provinceCounts[prov] =
                              (provinceCounts[prov] || 0) + 1;
                        });
                        return Object.entries(provinceCounts)
                          .sort((a, b) => b[1] - a[1])
                          .slice(0, 3)
                          .map(([prov, count]) => (
                            <div
                              key={prov}
                              className="flex justify-between text-xs"
                            >
                              <span className="dark:text-gray-300 text-gray-600">{prov}</span>
                              <span className="dark:text-white font-medium text-gray-900">
                                {count}
                              </span>
                            </div>
                          ));
                      })()}
                    </div>
                  </div>
                  <div className="dark:bg-gray-700 dark:border-gray-600 bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <h5 className="dark:text-white text-sm font-medium text-gray-700 mb-2">
                      Top Kabupaten
                    </h5>
                    <div className="space-y-1">
                      {(() => {
                        const kabCounts: Record<string, number> = {};
                        hotspotData.features?.forEach((f) => {
                          const kab = f.properties.location?.kab_kota;
                          if (kab) kabCounts[kab] = (kabCounts[kab] || 0) + 1;
                        });
                        return Object.entries(kabCounts)
                          .sort((a, b) => b[1] - a[1])
                          .slice(0, 3)
                          .map(([kab, count]) => (
                            <div
                              key={kab}
                              className="flex justify-between text-xs"
                            >
                              <span className="dark:text-gray-300 text-gray-600">{kab}</span>
                              <span className="dark:text-white font-medium text-gray-900">
                                {count}
                              </span>
                            </div>
                          ));
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
                          if (
                            hotspotData.features &&
                            hotspotData.features.length > 0
                          ) {
                            const dates = hotspotData.features.map(
                              (f) => new Date(f.properties.time),
                            );
                            const minDate = new Date(
                              Math.min(...dates.map((d) => d.getTime())),
                            );
                            const maxDate = new Date(
                              Math.max(...dates.map((d) => d.getTime())),
                            );
                            return `${minDate.toLocaleDateString("id-ID")} - ${maxDate.toLocaleDateString("id-ID")}`;
                          }
                          return "Tidak ada data";
                        })()}
                      </div>
                    </div>
                    <div>
                      <div className="dark:text-white text-sm font-medium text-gray-900 mb-1">
                        Rata-rata per Hari
                      </div>
                      <div className="text-xs text-gray-600">
                        {(() => {
                          if (
                            hotspotData.features &&
                            hotspotData.features.length > 0
                          ) {
                            const dates = hotspotData.features.map((f) =>
                              new Date(f.properties.time).toDateString(),
                            );
                            const uniqueDays = new Set(dates).size;
                            return Math.round(
                              hotspotData.features.length / uniqueDays,
                            );
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
                      const monthCounts: Record<string, number> = {};
                      hotspotData.features?.forEach((f) => {
                        const month = new Date(
                          f.properties.time,
                        ).toLocaleDateString("id-ID", { month: "short" });
                        monthCounts[month] = (monthCounts[month] || 0) + 1;
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
                            <div className="dark:text-gray-300 text-xs text-gray-600">{month}</div>
                            <div className="dark:text-white text-sm font-medium text-gray-900">
                              {count}
                            </div>
                          </div>
                        ));
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
                    <div className="dark:text-gray-300 text-sm text-gray-600">Jumlah Hotspot</div>
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
                      {topIsland ? topIsland : "-"}
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
                      const count =
                        hotspotData.features?.filter(
                          (f) => f.properties.confidence === item.confidence,
                        ).length || 0;
                      const maxCount = Math.max(
                        hotspotData.features?.filter(
                          (f) => f.properties.confidence === "high",
                        ).length || 0,
                        hotspotData.features?.filter(
                          (f) => f.properties.confidence === "medium",
                        ).length || 0,
                        hotspotData.features?.filter(
                          (f) => f.properties.confidence === "low",
                        ).length || 0,
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
                    {[
                      {
                        name: "SNPP",
                        bgColor: "#3b82f6",
                        dotClass: "bg-blue-500",
                      },
                      {
                        name: "MODIS",
                        bgColor: "#8b5cf6",
                        dotClass: "bg-purple-500",
                      },
                      {
                        name: "NOAA20",
                        bgColor: "#06b6d4",
                        dotClass: "bg-cyan-500",
                      },
                    ].map((satellite) => {
                      const count =
                        hotspotData.features?.filter((f) =>
                          f.properties.satellite?.includes(satellite.name),
                        ).length || 0;
                      const maxCount = Math.max(
                        hotspotData.features?.filter((f) =>
                          f.properties.satellite?.includes("SNPP"),
                        ).length || 0,
                        hotspotData.features?.filter((f) =>
                          f.properties.satellite?.includes("MODIS"),
                        ).length || 0,
                        hotspotData.features?.filter((f) =>
                          f.properties.satellite?.includes("NOAA20"),
                        ).length || 0,
                      );
                      const lineWidth =
                        maxCount > 0 ? (count / maxCount) * 100 : 0;

                      return (
                        <div key={satellite.name} className="flex items-center">
                          <div className="flex items-center space-x-2 min-w-0 flex-1">
                            <div
                              className={`w-3 h-3 rounded-full flex-shrink-0 ${satellite.dotClass}`}
                            ></div>
                            <span className="dark:text-gray-300 text-sm text-gray-600 truncate">
                              {satellite.name}
                            </span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <div className="w-64 dark:bg-gray-600 bg-gray-200 rounded-full h-3 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500 ease-out"
                                style={{
                                  width: `${lineWidth}%`,
                                  backgroundColor: satellite.bgColor,
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

                {/* Spatial Analysis */}
                <div className="mt-6 p-4 dark:bg-gray-700 dark:border-gray-600 bg-gray-50 rounded-lg border border-gray-200">
                  <h5 className="dark:text-white text-sm font-medium text-gray-700 mb-3">
                    Analisis Spasial
                  </h5>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="dark:text-white text-sm font-medium text-gray-900 mb-1">
                        Pulau Terdampak
                      </div>
                      <div className="dark:text-gray-300 text-xs text-gray-600">
                        {(() => {
                          const islands = new Set(
                            hotspotData.features
                              ?.map((f) => f.properties.location?.pulau)
                              .filter(Boolean),
                          );
                          return `${islands.size} pulau`;
                        })()}
                      </div>
                    </div>
                    <div>
                      <div className="dark:text-white text-sm font-medium text-gray-900 mb-1">
                        Konsentrasi Tertinggi
                      </div>
                      <div className="dark:text-gray-300 text-xs text-gray-600">
                        {(() => {
                          const provCounts: Record<string, number> = {};
                          hotspotData.features?.forEach((f) => {
                            const prov = f.properties.location?.provinsi;
                            if (prov)
                              provCounts[prov] = (provCounts[prov] || 0) + 1;
                          });
                          const topProv = Object.entries(provCounts).sort(
                            (a, b) => b[1] - a[1],
                          )[0];
                          return topProv
                            ? `${topProv[0]} (${Math.round((topProv[1] / (hotspotData.features?.length || 1)) * 100)}%)`
                            : "N/A";
                        })()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Data Summary */}
                <div className="mt-6 p-4 dark:bg-gray-700 dark:border-gray-600 bg-gray-50 rounded-lg border border-gray-200">
                  <h5 className="dark:text-white text-sm font-medium text-gray-700 mb-3">
                    Ringkasan Data
                  </h5>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="dark:text-white text-lg font-bold text-gray-900">
                        {(() => {
                          const today = new Date().toISOString().split('T')[0];
                          return hotspotData.features?.filter(f =>
                            f.properties.time.startsWith(today)
                          ).length || 0;
                        })()}
                      </div>
                      <div className="dark:text-gray-300 text-xs text-gray-600">Hari Ini</div>
                    </div>
                    <div>
                      <div className="dark:text-white text-lg font-bold text-gray-900">
                        {(() => {
                          const uniqueDates = new Set(
                            hotspotData.features?.map(f =>
                              f.properties.time.split('T')[0]
                            )
                          );
                          return uniqueDates.size;
                        })()}
                      </div>
                      <div className="dark:text-gray-300 text-xs text-gray-600">Hari Aktif</div>
                    </div>
                    <div>
                      <div className="dark:text-white text-lg font-bold text-gray-900">
                        {(() => {
                          const uniqueKabs = new Set(
                            hotspotData.features?.map(f =>
                              f.properties.location?.kab_kota
                            ).filter(Boolean)
                          );
                          return uniqueKabs.size;
                        })()}
                      </div>
                      <div className="dark:text-gray-300 text-xs text-gray-600">Kabupaten</div>
                    </div>
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
