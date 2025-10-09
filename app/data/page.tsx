"use client";

import { useState, useEffect, useMemo } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import DatePicker, { DateObject } from "react-multi-date-picker";
import { utils, writeFile } from "xlsx";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import { extractTime } from "../core/utilities/formatters";
import {
  HotspotFeature,
  HotspotData,
  AccumulatedData,
} from "../core/model/hotspot";

export default function HotspotTable() {
  const [data, setData] = useState<HotspotFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dates, setDates] = useState<DateObject[]>([new DateObject()]);
  const [selectedConfidence, setSelectedConfidence] = useState<string[]>([]);
  const [selectedSatellites, setSelectedSatellites] = useState<string[]>([]);
  const [exportFormat, setExportFormat] = useState<"xlsx" | "csv">("xlsx");
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<"detail" | "akumulasi">("akumulasi");
  const itemsPerPage = 10;
  const [sortBy, setSortBy] = useState<string>("properties.hotspot_time");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const getLatestDate = (hotspots: HotspotFeature[]) => {
    if (!hotspots || hotspots.length === 0) return null;
    const sorted = [...hotspots].sort(
      (a, b) =>
        new Date(b.properties.hotspot_time).getTime() -
        new Date(a.properties.hotspot_time).getTime()
    );
    return sorted[0].properties.time.split("T")[0];
  };

  // Fetch data hotspot
  useEffect(() => {
    const getDataHotspot = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/hotspot`
        );
        const result: HotspotData = await response.json();
        setData(result.features);

        const latestDate = getLatestDate(result.features);
        if (latestDate) {
          setDates([new DateObject(latestDate)]);
        } else {
          setDates([new DateObject()]);
        }
      } catch {
        setDates([new DateObject()]);
      } finally {
        setLoading(false);
      }
    };
    getDataHotspot();
  }, []);

  // Filter data hotspot
  const filteredData = useMemo(() => { 
    return data.filter((item) => {
    // Filter SEARCH
    const searchMatch =
      item.properties.location.desa
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      item.properties.location.kecamatan
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      item.properties.location.kab_kota
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      item.properties.location.provinsi
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      item.properties.location.pulau
        .toLowerCase()
        .includes(search.toLowerCase());

    // Filter DATE
    const dateMatch =
      dates.length === 0 ||
      dates.some((date) => {
        const dateStr = date.format("YYYY-MM-DD");
        const itemDate = item.properties.time.split("T")[0];

        return dateStr === itemDate;
      });

    // Filter CONFIDENCE
    const confidenceMatch =
      selectedConfidence.length === 0 ||
      selectedConfidence.includes(item.properties.confidence);

    // Filter SATELLITE
    const satelliteMatch =
      selectedSatellites.length === 0 ||
      selectedSatellites.includes(item.properties.satellite);

    return searchMatch && dateMatch && confidenceMatch && satelliteMatch;
  });
  }, [data, search, dates, selectedConfidence, selectedSatellites]); 

  const accumulatedData = useMemo(() => {
    return filteredData.reduce<AccumulatedData[]>(
    (acc, item) => {
      const tanggal = item.properties.time;
      const satelit = item.properties.satellite;
      const confidence = item.properties.confidence;
      const provinsi = item.properties.location.provinsi;
      const kota = item.properties.location.kab_kota;

      const existing = acc.find(
        (x) =>
          x.tanggal === tanggal &&
          x.satelit === satelit &&
          x.confidence === confidence &&
          x.provinsi === provinsi &&
          x.kota === kota
      );

      if (existing) {
        existing.jumlah += item.properties.hotspot_count;
      } else {
        acc.push({
          tanggal: tanggal,
          satelit: satelit,
          confidence: confidence,
          provinsi: provinsi,
          kota: kota,
          jumlah: item.properties.hotspot_count,
        });
      }
      return acc;
    },
    []
  );
  }, [filteredData]);

  const satellites = useMemo(() => [
    ...new Set(data.map((item) => item.properties.satellite)),
  ], [data]);

  // Sorting data
  function getNested(obj: Record<string, unknown>, path: string): unknown {
    return path.split(".").reduce((o: unknown, k: string) => {
      return o && typeof o === "object"
        ? (o as Record<string, unknown>)[k]
        : undefined;
    }, obj);
  }

  const displayData = viewMode === "detail" ? filteredData : accumulatedData;
  const sortedData = useMemo(() => {
    const sortableData = [...displayData];
    if (!sortBy) return sortableData;

    return sortableData.sort((a, b) => {
      const aValueRaw = getNested(a, sortBy);
      const bValueRaw = getNested(b, sortBy);
      
      let aValueTyped: number | string;
      let bValueTyped: number | string;

      if (sortBy === "properties.time" || sortBy === "tanggal") {
        aValueTyped = typeof aValueRaw === "string" ? new Date(aValueRaw).getTime() : 0;
        bValueTyped = typeof bValueRaw === "string" ? new Date(bValueRaw).getTime() : 0;
      } else if (sortBy === "jumlah" || sortBy === "properties.hotspot_count") {
        aValueTyped = Number(aValueRaw);
        bValueTyped = Number(bValueRaw);
      } else {
        aValueTyped = String(aValueRaw).toLowerCase();
        bValueTyped = String(bValueRaw).toLowerCase();
      }

      if (aValueTyped < bValueTyped) return sortOrder === "asc" ? -1 : 1;
      if (aValueTyped > bValueTyped) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [displayData, sortBy, sortOrder]);


  // Pagination
  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const currentItems = sortedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Export data
  const exportData = () => {
    const exportContent =
      viewMode === "detail"
        ? filteredData.map((item) => ({
            Tanggal: item.properties.time,
            Waktu: extractTime(item.properties.hotspot_time),
            Pulau: item.properties.location.pulau,
            Provinsi: item.properties.location.provinsi,
            Kota: item.properties.location.kab_kota,
            Kecamatan: item.properties.location.kecamatan,
            Desa: item.properties.location.desa,
            Satelit: item.properties.satellite,
            Confidence: item.properties.confidence,
            Jumlah: item.properties.hotspot_count,
            Latitude: item.geometry.coordinates[1],
            Longitude: item.geometry.coordinates[0],
          }))
        : accumulatedData.map((item) => ({
            Tanggal: item.tanggal,
            Satelit: item.satelit,
            Confidence: item.confidence,
            Provinsi: item.provinsi,
            Kota: item.kota,
            Jumlah: item.jumlah,
          }));

    let dateStr;

    if (dates.length === 0) {
      dateStr = new Date().toISOString().split("T")[0];
    } else if (dates.length === 1) {
      dateStr = dates[0].format("YYYY-MM-DD");
    } else {
      const sortedDates = [...dates].sort(
        (a, b) =>
          new Date(a.format("YYYY-MM-DD")).getTime() -
          new Date(b.format("YYYY-MM-DD")).getTime()
      );
      dateStr = `${sortedDates[0].format("YYYY-MM-DD")}_to_${sortedDates[
        sortedDates.length - 1
      ].format("YYYY-MM-DD")}`;
    }

    if (exportFormat === "xlsx") {
      const ws = utils.json_to_sheet(exportContent);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, "Hotspot Data");
      writeFile(wb, `hotspot_${viewMode}_data_${dateStr}.xlsx`);
    } else {
      // CSV export
      const headers = Object.keys(exportContent[0]).join(",");
      const csv = [
        headers,
        ...exportContent.map((row) => Object.values(row).join(",")),
      ].join("\n");

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `hotspot_${viewMode}_data_${dateStr}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-gray-50">
        <FontAwesomeIcon
          icon={faSpinner}
          spin
          size="3x"
          className="text-green-600 mb-4"
        />
        <p className="text-gray-700 text-lg">
          Memuat data hotspot, mohon tunggu...
        </p>
      </div>
    );
  }

function sortHeader(label: string, col: string) {
  return (
    <th
      className="px-4 py-2 text-left cursor-pointer select-none"
      onClick={() => {
        if (sortBy === col)
          setSortOrder(sortOrder === "asc" ? "desc" : "asc");
        else {
          setSortBy(col);
          setSortOrder("asc");
        }
      }}
    >
      <div className="flex items-center">
        <span>{label}</span>
        <span className="inline-block ml-1 text-xs">
          {sortBy === col ? (
            sortOrder === "asc" ? (
              <span className="text-blue-600">▲</span>
            ) : (
              <span className="text-blue-600">▼</span>
            )
          ) : (
            <span className="text-gray-300 text-[15px]">⬍</span>
          )}
        </span>
      </div>
    </th>
  );
}

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow w-[92vw] mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Data Hotspot</h1>

        {/* Filter */}
        <div className="bg-white p-4 rounded-lg shadow-md mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* View Mode */}
            <div>
              <label className="block text-sm font-medium mb-1">Tampilan</label>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setViewMode("akumulasi");
                    setCurrentPage(1);
                  }}
                  className={`px-4 py-2 rounded ${
                    viewMode === "akumulasi"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200"
                  }`}
                >
                  Akumulasi
                </button>
                <button
                  onClick={() => {
                    setViewMode("detail");
                    setCurrentPage(1);
                  }}
                  className={`px-4 py-2 rounded ${
                    viewMode === "detail"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200"
                  }`}
                >
                  Detail
                </button>
              </div>
            </div>

            {/* Export */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Format Data
              </label>
              <div className="flex gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setExportFormat("xlsx")}
                  className={`px-4 py-2 rounded border ${
                    exportFormat === "xlsx"
                      ? "border-green-600 bg-green-50 text-green-700 font-bold"
                      : "border-gray-300 bg-white text-gray-700"
                  }`}
                >
                  Excel (.xlsx)
                </button>
                <button
                  type="button"
                  onClick={() => setExportFormat("csv")}
                  className={`px-4 py-2 rounded border ${
                    exportFormat === "csv"
                      ? "border-green-600 bg-green-50 text-green-700 font-bold"
                      : "border-gray-300 bg-white text-gray-700"
                  }`}
                >
                  CSV (.csv)
                </button>
                <button
                  type="button"
                  onClick={exportData}
                  disabled={!currentItems.length}
                  className={`px-4 py-2 rounded font-semibold ${
                    !currentItems.length
                      ? "bg-blue-300 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700"
                  } text-white`}
                >
                  Unduh Data
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search Input */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Cari Lokasi
              </label>
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
              <label className="block text-sm font-medium mb-1">
                Confidence
              </label>
              <div className="flex flex-wrap gap-2">
                {["high", "medium", "low"].map((conf) => (
                  <button
                    key={conf}
                    onClick={() => {
                      setSelectedConfidence((prev) =>
                        prev.includes(conf)
                          ? prev.filter((c) => c !== conf)
                          : [...prev, conf]
                      );
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-1 text-xs rounded-full ${
                      selectedConfidence.includes(conf)
                        ? conf === "high"
                          ? "bg-red-100 text-black font-medium"
                          : conf === "medium"
                          ? "bg-yellow-100 text-black font-medium"
                          : "bg-green-100 text-black font-medium"
                        : conf === "high"
                          ? "bg-red-50 text-gray-700"
                          : conf === "medium"
                          ? "bg-yellow-50 text-gray-700"
                          : "bg-green-50 text-gray-700"
                    }`}
                  >
                    {conf.charAt(0).toLowerCase() + conf.slice(1)}
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
                        prev.includes(sat)
                          ? prev.filter((s) => s !== sat)
                          : [...prev, sat]
                      );
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-1 text-xs rounded-full ${
                      selectedSatellites.includes(sat)
                        ? "bg-blue-200 text-black font-medium"
                        : "bg-blue-100 text-gray-700"
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
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left">No</th>
                  {viewMode === "detail" ? (
                    <>
                      {sortHeader("Tanggal", "properties.time")}
                      {sortHeader("Waktu", "properties.hotspot_time")}
                      {sortHeader("Pulau", "properties.location.pulau")}
                      {sortHeader("Provinsi", "properties.location.provinsi")}
                      {sortHeader(
                        "Kabupaten/Kota",
                        "properties.location.kab_kota"
                      )}
                      {sortHeader("Kecamatan", "properties.location.kecamatan")}
                      {sortHeader("Desa", "properties.location.desa")}
                      {sortHeader("Satelit", "properties.satellite")}
                      {sortHeader("Confidence", "properties.confidence")}
                      {sortHeader("Jumlah", "properties.hotspot_count")}
                      {sortHeader("Koordinat", "geometry.coordinates")}
                    </>
                  ) : (
                    <>
                      {sortHeader("Tanggal", "tanggal")}
                      {sortHeader("Satelit", "satelit")}
                      {sortHeader("Confidence", "confidence")}
                      {sortHeader("Provinsi", "provinsi")}
                      {sortHeader("Kabupaten/Kota", "kota")}
                      {sortHeader("Jumlah", "jumlah")}
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {currentItems.length > 0 ? (
                  currentItems.map((item, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2">
                        {(currentPage - 1) * itemsPerPage + index + 1}
                      </td>

                      {viewMode === "detail" ? (
                        <>
                          <td className="px-4 py-2">
                            {(item as HotspotFeature).properties.time}
                          </td>
                          <td className="px-4 py-2">
                            {extractTime((item as HotspotFeature).properties.hotspot_time)}
                          </td>
                           <td className="px-4 py-2">
                            {(item as HotspotFeature).properties.location.pulau}
                          </td>
                          <td className="px-4 py-2">
                            {
                              (item as HotspotFeature).properties.location
                                .provinsi
                            }
                          </td>
                          <td className="px-4 py-2">
                            {
                              (item as HotspotFeature).properties.location
                                .kab_kota
                            }
                          </td>
                          <td className="px-4 py-2">
                            {
                              (item as HotspotFeature).properties.location
                                .kecamatan
                            }
                          </td>
                          <td className="px-4 py-2">
                            {(item as HotspotFeature).properties.location.desa}
                          </td>
                          <td className="px-4 py-2">
                            {(item as HotspotFeature).properties.satellite}
                          </td>
                          <td className="px-4 py-2">
                            <span
                              className={`px-2 py-1 rounded-full text-xs ${
                                (item as HotspotFeature).properties
                                  .confidence === "high"
                                  ? "bg-red-100 text-black"
                                  : (item as HotspotFeature).properties
                                      .confidence === "medium"
                                  ? "bg-yellow-100 text-black"
                                  : "bg-green-100 text-black"
                              }`}
                            >
                              {(item as HotspotFeature).properties.confidence}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            {(item as HotspotFeature).properties.hotspot_count}
                          </td>
                          <td className="px-4 py-2">
                            {(item as HotspotFeature).geometry.coordinates[1]},{" "}
                            {(item as HotspotFeature).geometry.coordinates[0]}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-2">
                            {(item as AccumulatedData).tanggal}
                          </td>
                          <td className="px-4 py-2">
                            {(item as AccumulatedData).satelit}
                          </td>
                          <td className="px-4 py-2">
                            <span
                              className={`px-2 py-1 rounded-full text-xs ${
                                (item as AccumulatedData).confidence === "high"
                                  ? "bg-red-100 text-black"
                                  : (item as AccumulatedData).confidence ===
                                    "medium"
                                  ? "bg-yellow-100 text-black"
                                  : "bg-green-100 text-black"
                              }`}
                            >
                              {(item as AccumulatedData).confidence}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            {(item as AccumulatedData).provinsi}
                          </td>
                          <td className="px-4 py-2">
                            {(item as AccumulatedData).kota}
                          </td>
                          <td className="px-4 py-2">
                            {(item as AccumulatedData).jumlah}
                          </td>
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

              <div className="flex gap-1 flex-wrap">
                {[...Array(totalPages)].map((_, idx) => (
                  <button
                    key={idx + 1}
                    onClick={() => setCurrentPage(idx + 1)}
                    className={`px-3 py-1 rounded ${currentPage === idx + 1
                      ? "bg-blue-600 text-white font-bold"
                      : "bg-gray-200 text-gray-700"
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>

              <button
                onClick={() =>
                  setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                }
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