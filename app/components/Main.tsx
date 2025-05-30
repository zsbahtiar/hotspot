'use client';

import Link from "next/link";
import { useState, useEffect } from "react";
import { Chart as ChartJS, ArcElement, Tooltip, Legend , CategoryScale, LinearScale, BarElement} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(ArcElement, 
  Tooltip, 
  Legend, 
  CategoryScale, 
  LinearScale, 
  BarElement
);

interface HotspotFeature {
  properties: {
    time: string;
    hotspot_time: string;
    satellite?: string;
    confidence?: string;
    location?: {
      desa?: string;
      kecamatan?: string;
      kab_kota?: string;
      provinsi?: string;
      pulau?: string;
    };
  };
}

interface HotspotData {
  features: HotspotFeature[];
}

const Main = () => {
  const [hotspotData, setHotspotData] = useState<HotspotData>({ features: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHotspotData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/hotspot`);
        if (!response.ok) {
          throw new Error(`Failed to fetch data: ${response.status}`);
        }
        const data = await response.json();
        setHotspotData(data);
      } catch (err: unknown) {
        console.error("Error fetching hotspot data:", err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };
    fetchHotspotData();
  }, []);

  const todayHotspots = hotspotData.features?.filter(f => {
    const today = new Date().toISOString().split('T')[0];
    const hotspotDate = new Date(f.properties.time).toISOString().split('T')[0];
    return hotspotDate === today;
  }) || [];

   const getIslandDistribution = (): [string, number][] => {
    const islandCounts: Record<string, number> = hotspotData.features?.reduce((acc, feature) => {
      const island = feature.properties.location?.pulau || 'Unknown';
      acc[island] = (acc[island] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return islandCounts ? Object.entries(islandCounts) : [];
  };

  const islandDistribution = getIslandDistribution();

  const chartData = {
    labels: islandDistribution.map(([island]) => island),
    datasets: [
      {
        label: 'Jumlah Hotspot',
        data: islandDistribution.map(([_, count]) => count),
        backgroundColor: [
          'rgba(255, 99, 132, 0.7)',
          'rgba(54, 162, 235, 0.7)',
          'rgba(255, 206, 86, 0.7)',
          'rgba(75, 192, 192, 0.7)',
          'rgba(153, 102, 255, 0.7)',
          'rgba(255, 159, 64, 0.7)',
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(153, 102, 255, 1)',
          'rgba(255, 159, 64, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  const stats = {
    totalHotspots: hotspotData.features?.length || 0,
    highConfidence: hotspotData.features?.filter(f => f.properties.confidence === 'high').length || 0,
    affectedProvinces: new Set(hotspotData.features?.map(f => f.properties.location?.provinsi).filter(Boolean)).size,
    todayHotspots: todayHotspots.length,
    todayHighConfidence: todayHotspots.filter(f => f.properties.confidence === 'high').length,
    todayAffectedProvinces: new Set(todayHotspots.map(f => f.properties.location?.provinsi).filter(Boolean)).size,
    topIsland: hotspotData.features?.reduce((acc: Record<string, number>, feature) => {
      const island = feature.properties.location?.pulau || 'Unknown';
      acc[island] = (acc[island] || 0) + 1;
      return acc;
    }, {})
  };

  const topIsland = stats.topIsland 
    ? Object.entries(stats.topIsland).sort((a, b) => b[1] - a[1])[0]?.[0] 
    : 'N/A';

  const latestHotspots = [...(hotspotData.features || [])]
    .sort((a, b) => new Date(b.properties.time).getTime() - new Date(a.properties.time).getTime())
    .slice(0, 5);

  const formatDate = (dateString: string): string => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const extractTime = (dateTimeString: string): string => {
    if (!dateTimeString) return 'N/A'; 

    try {
      const dateObj = new Date(dateTimeString);

      if (!isNaN(dateObj.getTime())) {
        const hours = String(dateObj.getHours()).padStart(2, '0');
        const minutes = String(dateObj.getMinutes()).padStart(2, '0');
        const seconds = String(dateObj.getSeconds()).padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
      }

      let timePart = '';
      
      const spaceSplit = dateTimeString.split(' ');
      if (spaceSplit.length > 1) {
        timePart = spaceSplit[1];
      } 
      else if (dateTimeString.includes('T')) {
        timePart = dateTimeString.slice(11, 19);
      }

      if (timePart) {
        const cleanTime = timePart.split('.')[0];
        const timeComponents = cleanTime.split(/[:.]/);

        if (timeComponents.length === 3) {
          const [h, m, s] = timeComponents;
          return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }
      }
      return 'N/A';
    } catch (error) {
      console.error("Error formatting time in extractTime:", error);
      return 'N/A';
    }
  };

  return (
    <div className="bg-white">
      {/* Hero Section */}
      <section className="relative w-full h-screen min-h-[600px] pt-24">
        <div className="absolute inset-0">
          <img
            src="/assets/kebakaran2.png"
            alt="Kebakaran Hutan"
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-black/30"></div>
        </div>

        <div className="relative z-10 w-full max-w-6xl mx-auto h-full flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 text-center">
          <div className="max-w-3xl">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              <span className="text-white">Sistem Pemantauan</span> <span className="text-green-400">Hotspot</span> <span className="text-white">Karhutla</span> 
            </h1>
            <p className="text-xl sm:text-2xl mb-8 text-gray-200">
              Situs penyedia titik panas karhutla bersumber dari SiPongi+ menggunakan teknologi Spatial Online Analytical Processing yang mempermudah pengguna dalam menganalisis titik panas karhutla pada suatu wilayah melalui visualisasi grafik dan peta.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/olaps">
                <button className="text-white bg-green-600 hover:bg-green-700 px-8 py-4 rounded-full text-lg font-semibold transition-colors duration-300 shadow-lg hover:shadow-green-500/30">
                  Pantau Peta Hotspot
                </button>
              </Link>
              <Link href="/about">
                <button className="text-white bg-transparent border-2 border-white hover:bg-white/10 px-8 py-4 rounded-full text-lg font-semibold transition-colors duration-300">
                  Tentang Sistem OLAP
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Info Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-gray-900">
              Informasi <span className="text-green-600">Hotspot</span> Terkini
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Data real-time hotspot kebakaran hutan dan lahan di Indonesia
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-8">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
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
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold ml-3 text-gray-900">Hotspot Terbaru</h3>
                </div>
                
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                  </div>
                ) : latestHotspots.length > 0 ? (
                  <div className="space-y-4">
                     {latestHotspots.map((hotspot, index) => (
                      <div key={index} className={`pb-4 ${index < latestHotspots.length - 1 ? 'border-b' : ''}`}>
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-gray-500">Tanggal</span>
                        <span className="text-gray-500">
                          {formatDate(hotspot.properties.time)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-gray-500">Waktu</span>
                        <span className="text-gray-500">
                          {extractTime(hotspot.properties.hotspot_time)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-gray-500">Sumber</span>
                        <span className="text-gray-500">
                          {hotspot.properties.satellite || 'NASA-Modis'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-gray-500">Lokasi</span>
                        <span className="text-right text-gray-500">
                          {hotspot.properties.location?.desa || 'N/A'}, {hotspot.properties.location?.kecamatan || 'N/A'}<br/>
                          {hotspot.properties.location?.kab_kota || 'N/A'}, {hotspot.properties.location?.provinsi || 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-gray-500">Confidence</span>
                        <span className={`text-right ${
                          hotspot.properties.confidence === 'high' 
                            ? 'text-red-500 font-bold' 
                            : 'text-gray-500'
                        }`}>
                          {hotspot.properties.confidence?.toUpperCase() || 'MEDIUM'}
                        </span>
                      </div>
                    </div>
                  ))}
                  </div>
                ) : (
                  <div className="text-gray-500 p-4">Tidak ada data hotspot</div>
                )}
              </div>
            </div>
            
            {/* Grafik dan Statistik */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300">
              <div className="p-6">
                <div className="flex items-center mb-4">
                  <div className="p-3 rounded-full bg-blue-100 text-blue-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold ml-3 text-gray-900">Statistik Hotspot</h3>
                </div>
                
                {/* Grafik */}
                <div className="bg-gray-100 rounded-lg h-64 flex items-center justify-center mb-6">
                  {isLoading ? (
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                  ) : hotspotData.features?.length > 0 ? (
                    <div className="w-full h-full p-4">
                      <Bar 
                        data={chartData}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: {
                              position: 'bottom',
                              labels: {
                                boxWidth: 12,
                                padding: 20
                              }
                            },
                            tooltip: {
                              callbacks: {
                                label: function(context) {
                                  return `${context.label}: ${context.raw} hotspot`;
                                }
                              }
                            }
                          }
                        }}
                      />
                    </div>
                  ) : (
                    <p className="text-gray-500">Tidak ada data untuk grafik</p>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-green-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {stats.totalHotspots}
                    </div>
                    <div className="text-sm text-gray-600">Jumlah Hotspot</div>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {stats.highConfidence}
                    </div>
                    <div className="text-sm text-gray-600">Confidence Tinggi</div>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {topIsland}
                    </div>
                    <div className="text-sm text-gray-600">Lokasi Tertinggi</div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {stats.affectedProvinces}
                    </div>
                    <div className="text-sm text-gray-600">Provinsi Terdampak</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-green-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 text-center">
            <div className="p-6">
              <div className="text-4xl font-bold mb-2">
                {isLoading ? '...' : stats.todayHotspots}
              </div>
              <div className="text-lg">Hotspot Hari Ini</div>
            </div>
            <div className="p-6">
              <div className="text-4xl font-bold mb-2">
                {isLoading ? '...' : stats.todayAffectedProvinces}
              </div>
              <div className="text-lg">Provinsi Terdampak Hari ini</div>
            </div>
            <div className="p-6">
              <div className="text-4xl font-bold mb-2">
                {isLoading ? '...' : stats.todayHighConfidence}
              </div>
              <div className="text-lg"> Confidence Tinggi Hari Ini</div>
            </div>
          </div>
        </div>
      </section>

      {/* Mitigasi Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-gray-900">
              Upaya <span className="text-green-600">Mitigasi</span> Kebakaran
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Penyelenggaraan pencegahan, pemadaman, dan penanganan pasca karhutla berdasarkan Permen LHK Nomor 32 Tahun 2016
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300">
              <div className="text-green-600 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900">Pencegahan</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-green-500 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Pemberdayaan masyarakat</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-green-500 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Penyadartahuan pengurangan resiko karhutla</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-green-500 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Kesiapsiagaan</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-green-500 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Pelaksanaan peringatan dini</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-green-500 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Patroli pencegahan</span>
                </li>
              </ul>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300">
              <div className="text-green-600 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900">Pemadaman</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-green-500 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Deteksi dini</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-green-500 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Pemadaman awal</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-green-500 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Koordinasi pemadaman</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-green-500 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Mobilisasi pemadaman</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-green-500 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Pemadaman lanjutan</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-green-500 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Demobilisasi pemadaman</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-green-500 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Evakuasi dan penyelamatan</span>
                </li>
              </ul>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300">
              <div className="text-green-600 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900">Penanganan Pasca Karhutla</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-green-500 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Pengawasan areal bekas terbakar</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-green-500 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Inventarisasi luas karhutla</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-green-500 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Penaksiran kerugian</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-green-500 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Koordinasi penanganan pasca karhutla</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Main;