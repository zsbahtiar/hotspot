import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import type { HotspotDataGeo } from "../core/model/hotspot";
import { formatNumber, extractTime, formatDate } from "../core/utilities/formatters";
import { Tooltip } from "react-tooltip";
import { monthNames } from "../core/model/time";
import { StatsSkeleton, ChartSkeleton, CardSkeleton } from "./LoadingSkeletons";

// Lazy load heavy components and chart libraries
const StatsSection = lazy(() => import('../components/StatsSection'));
const MitigationSection = lazy(() => import('../components/MitigationSection'));
const ChartComponent = lazy(() => import('../components/ChartComponent'));

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
          `${import.meta.env.PUBLIC_API_URL}/api/hotspot`
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

  const todayHotspots = useMemo(() => 
    hotspotData.features?.filter(f => {
      const today = new Date().toISOString().split("T")[0];
      const hotspotDate = new Date(f.properties.time).toISOString().split("T")[0];
      return hotspotDate === today;
    }) || [],
  [hotspotData.features]);

  const monthlyHotspotTrends = useMemo(() => {
    interface MonthCount {
      total: number;
      highConfidence: number;
    }
    
    const monthCounts: Record<string, MonthCount> = {};
  
    hotspotData.features?.forEach(feature => {
      if (feature.properties.time) {
        const date = new Date(feature.properties.time);
        const monthYear = date.toLocaleString('id-ID', { month: 'long', year: 'numeric' });
        
      if (!monthCounts[monthYear]) {
          monthCounts[monthYear] = {
            total: 0,
            highConfidence: 0
          };
        }
        monthCounts[monthYear].total += 1;
        
        if (feature.properties.confidence === 'high') {
          monthCounts[monthYear].highConfidence += 1;
        }
      }
    });
    return Object.entries(monthCounts).sort((a, b) => {
      const [monthA, yearA] = a[0].split(' ');
      const [monthB, yearB] = b[0].split(' ');
      
      if (yearA !== yearB) {
        return parseInt(yearA) - parseInt(yearB);
      }
      return monthNames.indexOf(monthA) - monthNames.indexOf(monthB);
    });
  }, [hotspotData.features]);

  const chartData = useMemo(() => ({
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
      }
    ],
  }), [monthlyHotspotTrends]);

  const stats = useMemo(() => ({
    totalHotspots: hotspotData.features?.length || 0,
    highConfidence:
      hotspotData.features?.filter((f) => f.properties.confidence === "high")
        .length || 0,
    affectedProvinces: new Set(
      hotspotData.features
        ?.map((f) => f.properties.location?.provinsi)
        .filter(Boolean)
    ).size,
    todayHotspots: todayHotspots.length,
    todayHighConfidence: todayHotspots.filter(
      (f) => f.properties.confidence === "high"
    ).length,
    todayAffectedProvinces: new Set(
      todayHotspots.map((f) => f.properties.location?.provinsi).filter(Boolean)
    ).size,
    topIsland: hotspotData.features?.reduce(
      (acc: Record<string, number>, feature) => {
        const island = feature.properties.location?.pulau || "Unknown";
        acc[island] = (acc[island] || 0) + 1;
        return acc;
      },
      {}
    ),
  }), [hotspotData.features, todayHotspots]); 

  const topIsland = stats.topIsland
    ? Object.entries(stats.topIsland).sort((a, b) => b[1] - a[1])[0]?.[0]
    : "N/A";

  const latestHotspots = useMemo(() => {
    return [...(hotspotData.features || [])].sort((a, b) => {
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
    <div className="bg-white">
      <Tooltip 
        id="confidence-tooltip"
        style={{ backgroundColor: "#2d3748", color: "#fff", maxWidth: '250px', fontSize: '12px', zIndex: 9999 }}
      />
      <section className="relative w-full h-screen min-h-[600px] pt-24">
        <div className="absolute inset-0">
          <img
            src="/assets/kebakaran2.webp"
            alt="Kebakaran Hutan"
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-black/30"></div>
        </div>

        <div className="relative z-10 w-full max-w-6xl mx-auto h-full flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 text-center">
          <div className="max-w-3xl">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              <span className="text-white">Sistem Pemantauan</span>{" "}
              <span className="text-green-400">Hotspot</span>{" "}
              <span className="text-white">Karhutla</span>
            </h1>
            <p className="text-xl sm:text-2xl mb-8 text-gray-200">
              Situs penyedia titik panas karhutla bersumber dari SiPongi+
              menggunakan teknologi Spatial Online Analytical Processing yang
              mempermudah pengguna dalam menganalisis titik panas karhutla pada
              suatu wilayah melalui visualisasi{" "}
              <span className="italic">cross table</span>, grafik, dan peta.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="/olaps">
                <button className="text-white bg-green-600 hover:bg-green-700 px-8 py-4 rounded-full text-lg font-semibold transition-colors duration-300 shadow-lg hover:shadow-green-500/30">
                  Pantau Peta Hotspot
                </button>
              </a>
              <a href="/about">
                <button className="text-white bg-transparent border-2 border-white hover:bg-white/10 px-8 py-4 rounded-full text-lg font-semibold transition-colors duration-300">
                  Tentang Sistem
                </button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Info */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-gray-900">
              Informasi <span className="text-green-600">Hotspot</span> Terkini
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Data real-time hotspot kebakaran hutan dan lahan di Indonesia bersumber dari website&nbsp;
              <a
                href="https://sipongi.menlhk.go.id/sebaran-titik-panas"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-800 hover:underline"
              >
                SIPONGI KEMENHUT
              </a>
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-8">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-red-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">
                    Gagal memuat data hotspot: {error}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Hotspot Terbaru */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300">
              <div className="p-6">
                <div className="flex items-center mb-4">
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
                  <h3 className="text-xl font-bold ml-3 text-gray-900">
                    5 Data Hotspot Terbaru
                  </h3>
                </div>

                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <FontAwesomeIcon
                      icon={faSpinner}
                      spin
                      size="3x"
                      className="text-green-600 mb-4"
                    />
                    <p className="text-gray-700 text-lg">Memuat data...</p>
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
                          <span className="font-medium text-gray-500">
                            Tanggal
                          </span>
                          <span className="text-gray-500">
                            {formatDate(hotspot.properties.time)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-gray-500">
                            Waktu
                          </span>
                          <span className="text-gray-500">
                            {extractTime(hotspot.properties.hotspot_time)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-gray-500">
                            Sumber
                          </span>
                          <span className="text-gray-500">
                            {hotspot.properties.satellite || "NASA-Modis"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-gray-500">
                            Lokasi
                          </span>
                          <span className="text-right text-gray-500">
                            {hotspot.properties.location?.desa || "N/A"},{" "}
                            {hotspot.properties.location?.kecamatan || "N/A"}
                            <br />
                            {hotspot.properties.location?.kab_kota ||
                              "N/A"},{" "}
                            {hotspot.properties.location?.provinsi || "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-gray-500">
                            Confidence
                          </span>
                          <span
                            className={`text-right ${
                              hotspot.properties.confidence === "high"
                                ? "text-red-500 font-bold"
                                : "text-gray-500"
                            }`}
                          >
                            {hotspot.properties.confidence?.toUpperCase() ||
                              "MEDIUM"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-500 p-4">
                    Tidak ada data hotspot
                  </div>
                )}
              </div>
            </div>

            {/* Grafik dan Statistik */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300">
              <div className="p-6">
                <div className="flex items-center mb-4">
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
                  <h3 className="text-xl font-bold ml-3 text-gray-900">
                    Statistik Hotspot
                  </h3>
                </div>

                {/* Grafik */}
                <div className="bg-gray-100 rounded-lg h-64 flex items-center justify-center mb-6">
                  <Suspense fallback={<ChartSkeleton />}>
                    <ChartComponent chartData={chartData} isLoading={isLoading} />
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

                  return (
                    <div className="text-center text-sm text-gray-600 mb-6 mt-2">
                      <p>
                        Data statistik mencakup{" "}
                        <span className="font-semibold">
                          {formatNumber(recentHotspots.length)} hotspot
                        </span>{" "}
                        dalam periode
                        <span className="font-semibold">
                          {" "}
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
                })()}

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-green-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {formatNumber(stats.totalHotspots)}
                    </div>
                    <div className="text-sm text-gray-600">Jumlah Hotspot</div>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {formatNumber(stats.highConfidence)}
                    </div>
                    <div className="text-sm text-gray-600 flex items-center justify-center">
                      Confidence Tinggi
                      <span 
                        className="ml-1.5 bg-gray-300 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs font-bold cursor-help"
                        data-tooltip-id="confidence-tooltip"
                        data-tooltip-content="Tingkat kepercayaan (Confidence) adalah perkiraan dari satelit seberapa besar kemungkinan sebuah hotspot benar-benar merupakan kebakaran. Confidence tinggi berarti menunjukkan bahwa lokasi tersebut memiliki kemungkinan besar merupakan kebakaran hutan atau lahan yang nyata."
                      >
                        ?
                      </span>
                    </div>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {topIsland}
                    </div>
                    <div className="text-sm text-gray-600">
                      Lokasi Tertinggi
                    </div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {stats.affectedProvinces}
                    </div>
                    <div className="text-sm text-gray-600">
                      Provinsi Lokasi Hotspot
                    </div>
                  </div>
                </div>
              </div>
            </div>
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