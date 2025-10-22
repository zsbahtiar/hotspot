import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";
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

const Main = () => {
  const [hotspotData, setHotspotData] = useState<HotspotDataGeo>({
    features: [],
    type: "FeatureCollection",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const getHotspotData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(
          `${import.meta.env.PUBLIC_API_URL}/api/hotspot`,
        );
        if (!response.ok) {
          throw new Error(`Failed to fetch data: ${response.status}`);
        }
        const data = await response.json();
        setHotspotData(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    };
    getHotspotData();
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
    <div className="bg-background">
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
      <section className="relative w-full h-screen min-h-[600px] pt-16">
        <div className="absolute inset-0 z-0">
          <img
            src="/assets/kebakaran2.webp"
            alt="Kebakaran Hutan"
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-black/30"></div>
        </div>

        <div className="relative z-10 w-full max-w-6xl mx-auto h-full flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 text-center">
          <div className="max-w-3xl">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight text-white">
              <span>Sistem Pemantauan</span> <span>Hotspot</span>{" "}
              <span>Karhutla</span>
            </h1>
            <p className="text-xl sm:text-2xl mb-8 text-gray-200">
              Situs penyedia titik panas karhutla bersumber dari SiPongi+
              menggunakan teknologi Spatial Online Analytical Processing yang
              mempermudah pengguna dalam menganalisis titik panas karhutla pada
              suatu wilayah melalui visualisasi{" "}
              <span className="italic">cross table</span>, grafik, dan peta.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="/map">
                <Button
                  size="lg"
                  className="px-8 py-4 text-lg font-semibold shadow-lg hover:shadow-gray-500/30"
                >
                  Pantau Peta Hotspot
                </Button>
              </a>
              <a href="/about">
                <Button
                  variant="outline"
                  size="lg"
                  className="px-8 py-4 text-lg bg-transparent font-semibold text-white hover:bg-white/30 hover:text-white"
                >
                  Tentang Sistem
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Info */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-foreground">
              Informasi Hotspot Terkini
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Data real-time hotspot kebakaran hutan dan lahan di Indonesia
              bersumber dari website&nbsp;
              <a
                href="https://sipongi.menlhk.go.id/sebaran-titik-panas"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                SIPONGI KEMENHUT
              </a>
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Hotspot Terbaru */}
            <Card className="hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-red-100 text-red-600">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z"
                      />
                    </svg>
                  </div>
                  <CardTitle className="ml-3">5 Data Hotspot Terbaru</CardTitle>
                </div>
              </CardHeader>

              <CardContent>
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <FontAwesomeIcon
                      icon={faSpinner}
                      spin
                      size="3x"
                      className="text-gray-600 mb-4"
                    />
                    <p className="text-card-foreground text-lg">
                      Memuat data...
                    </p>
                  </div>
                ) : latestHotspots.length > 0 ? (
                  <div className="space-y-4">
                    {latestHotspots.map((hotspot, index) => (
                      <div
                        key={index}
                        className={`pb-4 ${
                          index < latestHotspots.length - 1 ? "border-b" : ""
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-muted-foreground">
                            Tanggal
                          </span>
                          <span className="text-muted-foreground">
                            {formatDate(hotspot.properties.time)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-muted-foreground">
                            Waktu
                          </span>
                          <span className="text-muted-foreground">
                            {extractTime(hotspot.properties.hotspot_time)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-muted-foreground">
                            Sumber
                          </span>
                          <span className="text-muted-foreground">
                            {hotspot.properties.satellite || "NASA-Modis"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-muted-foreground">
                            Lokasi
                          </span>
                          <span className="text-right text-muted-foreground">
                            {hotspot.properties.location?.desa || "N/A"},{" "}
                            {hotspot.properties.location?.kecamatan || "N/A"}
                            <br />
                            {hotspot.properties.location?.kab_kota ||
                              "N/A"},{" "}
                            {hotspot.properties.location?.provinsi || "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-muted-foreground">
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
                  <div className="text-gray-500 p-4">
                    Tidak ada data hotspot
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Grafik dan Statistik */}
            <Card className="hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-blue-100 text-blue-600">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    </svg>
                  </div>
                  <CardTitle className="ml-3">Statistik Hotspot</CardTitle>
                </div>
              </CardHeader>

              <CardContent>
                {/* Grafik */}
                <div className="bg-muted rounded-lg h-64 flex items-center justify-center mb-6">
                  <Suspense fallback={<ChartSkeleton />}>
                    <ChartComponent
                      chartData={chartData}
                      isLoading={isLoading}
                    />
                  </Suspense>
                </div>
                {(() => {
                  const startDate = new Date("2015-01-01").getTime();
                  const currentDate = new Date().getTime();

                  const recentHotspots =
                    hotspotData.features?.filter((f) => {
                      const hotspotDate = new Date(f.properties.time).getTime();
                      return (
                        hotspotDate >= startDate && hotspotDate <= currentDate
                      );
                    }) || [];
                  if (recentHotspots.length > 0) {
                    return (
                      <div className="text-center text-sm text-muted-foreground mb-6 mt-2">
                        <p>
                          Data statistik tidak tersedia untuk periode{" "}
                          <span className="font-semibold">
                            1 Januari 2015 -{" "}
                            {new Date().toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })}
                          </span>
                        </p>
                      </div>
                    );
                  }
                })()}

                <div className="grid grid-cols-2 gap-4">
                  <Card className="text-center">
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-green-600">
                        {stats.totalHotspots
                          ? formatNumber(stats.totalHotspots)
                          : "-"}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Jumlah Hotspot
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="text-center">
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-orange-600">
                        {stats.highConfidence
                          ? formatNumber(stats.highConfidence)
                          : "-"}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center justify-center">
                        Confidence Tinggi
                        <span
                          className="ml-1.5 bg-muted text-muted-foreground rounded-full w-4 h-4 flex items-center justify-center text-xs font-bold cursor-help"
                          data-tooltip-id="confidence-tooltip"
                          data-tooltip-content="Tingkat kepercayaan (Confidence) adalah perkiraan dari satelit seberapa besar kemungkinan sebuah hotspot benar-benar merupakan kebakaran. Confidence tinggi berarti menunjukkan bahwa lokasi tersebut memiliki kemungkinan besar merupakan kebakaran hutan atau lahan yang nyata."
                        >
                          ⓘ
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="text-center">
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-blue-600">
                        {topIsland ? topIsland : "-"}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Lokasi Tertinggi
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="text-center">
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-purple-600">
                        {stats.affectedProvinces
                          ? stats.affectedProvinces
                          : "-"}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Provinsi Lokasi Hotspot
                      </div>
                    </CardContent>
                  </Card>
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
      <Suspense fallback={<CardSkeleton count={3} />}>
        <MitigationSection />
      </Suspense>
    </div>
  );
};

export default Main;
