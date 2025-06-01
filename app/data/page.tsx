"use client";
import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import DatePicker, { DateObject } from "react-multi-date-picker";
import { utils, writeFile } from "xlsx";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";

type HotspotFeature = {
  geometry: {
    coordinates: [number, number];
    type: string;
  };
  properties: {
    confidence: "high" | "medium" | "low";
    hotspot_count: number;
    location: {
      pulau: string;
      provinsi: string;
      kecamatan: string;
      kab_kota: string;
      desa: string;
    };
    satellite: string;
    time: string;
    hotspot_time: string;
  };
};

type HotspotData = {
  features: HotspotFeature[];
};

type AccumulatedData = {
  tanggal: string;
  satelit: string;
  confidence: "high" | "medium" | "low";
  provinsi: string;
  kabupaten: string;
  jumlah: number;
};

export default function HotspotTable() {
  const [data, setData] = useState<HotspotFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dates, setDates] = useState<DateObject[]>([]);
  const [selectedConfidence, setSelectedConfidence] = useState<string[]>([]);
  const [selectedSatellites, setSelectedSatellites] = useState<string[]>([]);
  const [exportFormat, setExportFormat] = useState<"xlsx" | "csv">("xlsx");
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<"detail" | "akumulasi">("detail");
  const itemsPerPage = 10;
  const getLatestDate = (hotspots: HotspotFeature[]) => {
    if (!hotspots || hotspots.length === 0) return null;
    const sorted = [...hotspots].sort((a, b) =>
    new Date(b.properties.time).getTime() - new Date(a.properties.time).getTime());

    return sorted[0].properties.time.split('T')[0];
  };
   
  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/hotspot`);
        const result: HotspotData = await response.json();
        setData(result.features);

        const latestDate = getLatestDate(result.features);
        if (latestDate) {
          setDates([new DateObject(latestDate)]);
        }
      } catch (error) {
        console.error("Error fetching hotspot data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Filter data
  const filteredData = data.filter((item) => {
    // Filter by search
    const searchMatch =
      item.properties.location.desa.toLowerCase().includes(search.toLowerCase()) ||
      item.properties.location.kecamatan.toLowerCase().includes(search.toLowerCase()) ||
      item.properties.location.kab_kota.toLowerCase().includes(search.toLowerCase()) ||
      item.properties.location.provinsi.toLowerCase().includes(search.toLowerCase()) ||
      item.properties.location.pulau.toLowerCase().includes(search.toLowerCase());

    // Filter by date
    const dateMatch =
      dates.length === 0 ||
      dates.some((date) => item.properties.time.includes(date.toString().split("T")[0]));

    // Filter by confidence
    const confidenceMatch =
      selectedConfidence.length === 0 || selectedConfidence.includes(item.properties.confidence);

    // Filter by satellite
    const satelliteMatch =
      selectedSatellites.length === 0 || selectedSatellites.includes(item.properties.satellite);

    return searchMatch && dateMatch && confidenceMatch && satelliteMatch;
  });

  // Accumulated data
  const accumulatedData = filteredData.reduce<AccumulatedData[]>((acc, item) => {
    const tanggal = item.properties.time;
    const satelit = item.properties.satellite;
    const confidence = item.properties.confidence;
    const provinsi = item.properties.location.provinsi;
    const kabupaten = item.properties.location.kab_kota;

    const existing = acc.find(
      (x) =>
        x.tanggal === tanggal &&
        x.satelit === satelit &&
        x.confidence === confidence &&
        x.provinsi === provinsi &&
        x.kabupaten === kabupaten
    );

    if (existing) {
      existing.jumlah += item.properties.hotspot_count;
    } else {
      acc.push({
        tanggal: tanggal,
        satelit: satelit,
        confidence: confidence,
        provinsi: provinsi,
        kabupaten: kabupaten,
        jumlah: item.properties.hotspot_count,
      });
    }
    return acc;
  }, []);

  const satellites = [...new Set(data.map((item) => item.properties.satellite))];

  // Pagination
  const displayData = viewMode === "detail" ? filteredData : accumulatedData;
  const totalPages = Math.ceil(displayData.length / itemsPerPage);
  const currentItems = displayData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Export data
  const exportData = () => {
    const exportContent =
      viewMode === "detail"
        ? filteredData.map((item) => ({
            Tanggal: item.properties.time,
            Waktu: item.properties.hotspot_time,
            Satelit: item.properties.satellite,
            Confidence: item.properties.confidence,
            Jumlah: item.properties.hotspot_count,
            Pulau: item.properties.location.pulau,
            Provinsi: item.properties.location.provinsi,
            Kabupaten: item.properties.location.kab_kota,
            Kecamatan: item.properties.location.kecamatan,
            Desa: item.properties.location.desa,
            Latitude: item.geometry.coordinates[1],
            Longitude: item.geometry.coordinates[0]
          }))
        : accumulatedData.map((item) => ({
            Tanggal: item.tanggal,
            Satelit: item.satelit,
            Confidence: item.confidence,
            Provinsi: item.provinsi,
            Kabupaten: item.kabupaten,
            Jumlah: item.jumlah,
          }));

    if (exportContent.length === 0) {
      alert("Tidak ada data untuk diekspor.");
      return;
    }

    if (exportFormat === "xlsx") {
      const ws = utils.json_to_sheet(exportContent);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, "Hotspot Data");
      writeFile(wb, `hotspot_${viewMode}.xlsx`);
    } else {
      // CSV export
      const headers = Object.keys(exportContent[0]).join(",");
      const csv = [headers, ...exportContent.map((row) => Object.values(row).join(","))].join(
        "\n"
      );

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `hotspot_${viewMode}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-gray-50">
        <FontAwesomeIcon icon={faSpinner} spin size="3x" className="text-blue-500 mb-4" />
        <p className="text-gray-700 text-lg">Loading data hotspot, mohon tunggu...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Data Hotspot</h1>

        {/* Filter Section */}
        <div className="bg-white p-4 rounded-lg shadow-md mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* View Mode */}
            <div>
              <label className="block text-sm font-medium mb-1">Tampilan</label>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setViewMode("detail");
                    setCurrentPage(1);
                  }}
                  className={`px-4 py-2 rounded ${
                    viewMode === "detail" ? "bg-blue-500 text-white" : "bg-gray-200"
                  }`}
                >
                  Detail
                </button>
                <button
                  onClick={() => {
                    setViewMode("akumulasi");
                    setCurrentPage(1);
                  }}
                  className={`px-4 py-2 rounded ${
                    viewMode === "akumulasi" ? "bg-blue-500 text-white" : "bg-gray-200"
                  }`}
                >
                  Akumulasi
                </button>
              </div>
            </div>

            {/* Export Options */}
            <div>
              <label className="block text-sm font-medium mb-1">Format Ekspor</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setExportFormat("xlsx")}
                  className={`px-4 py-2 rounded ${
                    exportFormat === "xlsx" ? "bg-green-500 text-white" : "bg-gray-200"
                  }`}
                >
                  Excel
                </button>
                <button
                  onClick={() => setExportFormat("csv")}
                  className={`px-4 py-2 rounded ${
                    exportFormat === "csv" ? "bg-green-500 text-white" : "bg-gray-200"
                  }`}
                >
                  CSV
                </button>
                <button
                  onClick={exportData}
                  disabled={displayData.length === 0}
                  className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-400"
                >
                  Ekspor
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search Input */}
            <div>
              <label className="block text-sm font-medium mb-1">Cari Lokasi</label>
              <input
                type="text"
                placeholder="Cari lokasi..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full p-2 border rounded"
              />
            </div>

            {/* Date Picker */}
            <div>
              <label className="block text-sm font-medium mb-1">Tanggal</label>
              <DatePicker
                multiple
                value={dates}
                onChange={(dateObjects: DateObject[]) => {
                  setDates(dateObjects);
                  setCurrentPage(1);
                }}
                format="YYYY-MM-DD"
                inputClass="w-full p-2 border rounded"
              />
            </div>

            {/* Confidence Filter */}
            <div>
              <label className="block text-sm font-medium mb-1">Confidence</label>
              <div className="flex flex-wrap gap-2">
                {["high", "medium", "low"].map((conf) => (
                  <button
                    key={conf}
                    onClick={() => {
                      setSelectedConfidence((prev) =>
                        prev.includes(conf) ? prev.filter((c) => c !== conf) : [...prev, conf]
                      );
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-1 text-xs rounded-full ${
                      selectedConfidence.includes(conf)
                        ? conf === "high"
                          ? "bg-red-500 text-white"
                          : conf === "medium"
                          ? "bg-yellow-500 text-white"
                          : "bg-green-500 text-white"
                        : "bg-gray-200"
                    }`}
                  >
                    {conf.charAt(0).toUpperCase() + conf.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Satellite Filter */}
            <div>
              <label className="block text-sm font-medium mb-1">Satelit</label>
              <div className="flex flex-wrap gap-2">
                {satellites.map((sat) => (
                  <button
                    key={sat}
                    onClick={() => {
                      setSelectedSatellites((prev) =>
                        prev.includes(sat) ? prev.filter((s) => s !== sat) : [...prev, sat]
                      );
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-1 text-xs rounded-full ${
                      selectedSatellites.includes(sat) ? "bg-blue-500 text-white" : "bg-gray-200"
                    }`}
                  >
                    {sat}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left">No</th>
                  {viewMode === "detail" ? (
                    <>
                      <th className="px-4 py-2 text-left">Tanggal</th>
                      <th className="px-4 py-2 text-left">Waktu</th>
                      <th className="px-4 py-2 text-left">Satelit</th>
                      <th className="px-4 py-2 text-left">Confidence</th>
                      <th className="px-4 py-2 text-left">Jumlah</th>
                      <th className="px-4 py-2 text-left">Pulau</th>
                      <th className="px-4 py-2 text-left">Provinsi</th>
                      <th className="px-4 py-2 text-left">Kabupaten/Kota</th>
                      <th className="px-4 py-2 text-left">Kecamatan</th>
                      <th className="px-4 py-2 text-left">Desa</th>
                      <th className="px-4 py-2 text-left">Koordinat</th>
                    </>
                  ) : (
                    <>
                      <th className="px-4 py-2 text-left">Tanggal</th>
                      <th className="px-4 py-2 text-left">Satelit</th>
                      <th className="px-4 py-2 text-left">Confidence</th>
                      <th className="px-4 py-2 text-left">Provinsi</th>
                      <th className="px-4 py-2 text-left">Kabupaten/Kota</th>
                      <th className="px-4 py-2 text-left">Jumlah</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {currentItems.length > 0 ? (
                  currentItems.map((item, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2">{(currentPage - 1) * itemsPerPage + index + 1}</td>

                      {viewMode === "detail" ? (
                        <>
                          <td className="px-4 py-2">{(item as HotspotFeature).properties.time}</td>
                          <td className="px-4 py-2">{(item as HotspotFeature).properties.hotspot_time}</td>
                          <td className="px-4 py-2">{(item as HotspotFeature).properties.satellite}</td>
                          <td className="px-4 py-2">
                            <span
                              className={`px-2 py-1 rounded-full text-xs ${
                                (item as HotspotFeature).properties.confidence === "high"
                                  ? "bg-red-100 text-red-800"
                                  : (item as HotspotFeature).properties.confidence === "medium"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-green-100 text-green-800"
                              }`}
                            >
                              {(item as HotspotFeature).properties.confidence}
                            </span>
                          </td>
                          <td className="px-4 py-2">{(item as HotspotFeature).properties.hotspot_count}</td>
                          <td className="px-4 py-2">{(item as HotspotFeature).properties.location.pulau}</td>
                          <td className="px-4 py-2">{(item as HotspotFeature).properties.location.provinsi}</td>
                          <td className="px-4 py-2">{(item as HotspotFeature).properties.location.kab_kota}</td>
                          <td className="px-4 py-2">{(item as HotspotFeature).properties.location.kecamatan}</td>
                          <td className="px-4 py-2">{(item as HotspotFeature).properties.location.desa}</td>
                          <td className="px-4 py-2">
                            {(item as HotspotFeature).geometry.coordinates[1]},{" "}
                            {(item as HotspotFeature).geometry.coordinates[0]}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-2">{(item as AccumulatedData).tanggal}</td>
                          <td className="px-4 py-2">{(item as AccumulatedData).satelit}</td>
                          <td className="px-4 py-2">
                            <span
                              className={`px-2 py-1 rounded-full text-xs ${
                                (item as AccumulatedData).confidence === "high"
                                  ? "bg-red-100 text-red-800"
                                  : (item as AccumulatedData).confidence === "medium"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-green-100 text-green-800"
                              }`}
                            >
                              {(item as AccumulatedData).confidence}
                            </span>
                          </td>
                          <td className="px-4 py-2">{(item as AccumulatedData).provinsi}</td>
                          <td className="px-4 py-2">{(item as AccumulatedData).kabupaten}</td>
                          <td className="px-4 py-2">{(item as AccumulatedData).jumlah}</td>
                        </>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={viewMode === "detail" ? 12 : 7}
                      className="px-4 py-6 text-center text-gray-500"
                    >
                      Tidak ada data yang ditemukan
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center p-4 border-t">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
              >
                Sebelumnya
              </button>
              <span>
                Halaman {currentPage} dari {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
              >
                Selanjutnya
              </button>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}