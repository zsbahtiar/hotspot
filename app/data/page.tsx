"use client";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import React, { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import DatePicker, { Value, DateObject } from "react-multi-date-picker";

type HotspotFeature = {
  geometry: {
    coordinates: [number, number];
    type: string;
  };
  properties: {
    confidence: string;
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

type AccumulatedHotspot = {
  Tanggal: string;
  Satelit: string;
  Confidence: string;
  Provinsi: string;
  Kabupaten: string;
  "Jumlah Hotspot": number;
};

type SortKey =
  | keyof HotspotFeature["properties"] | keyof HotspotFeature["properties"]["location"] | "hotspot_count"
  | "Tanggal"| "Waktu" | "Satelit" | "Confidence" | "Jumlah Hotspot"| "Desa"
  | "Kecamatan" | "Kabupaten" | "Provinsi" | "Pulau";
type SortDirection = "asc" | "desc";

const extractTime = (dateTimeString: string): string => {
  if (!dateTimeString) return '';
  const dateObj = new Date(dateTimeString);
  if (!isNaN(dateObj.getTime())) {
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    const seconds = String(dateObj.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }

  const spaceSplit = dateTimeString.split(' ');
  if (spaceSplit.length > 1) {
    const timePart = spaceSplit[1];
    return timePart.slice(0, 8);
  }
  if (dateTimeString.includes('T')) {
    return dateTimeString.slice(11, 19);
  }
  return '';
};


export default function DataTable() {
  const [data, setData] = useState<HotspotData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [dates, setDates] = useState<(Value | null)[]>([]);
  const [filterMode, setFilterMode] = useState<"day" | "month" | "year">("day");
  const [selectedConfidence, setSelectedConfidence] = useState<string[]>([]);
  const [selectedSatellites, setSelectedSatellites] = useState<string[]>([]);
  const [exportFormat, setExportFormat] = useState<"xlsx" | "csv">("xlsx");
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<"detail" | "akumulasi">("detail");
  const itemsPerPage = 20;
  const [sortConfig, setSortConfig] = useState<{
    key: SortKey | null;
    direction: SortDirection;
  }>({ key: null, direction: "asc" });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/hotspot`
        );
        const result: HotspotData = await response.json();
        setData(result);

        const today = new Date().toISOString().split("T")[0];
        if (filterMode === "day") {
          setDates([today]);
        } else if (filterMode === "month") {
          setDates([today.slice(0, 7)]);
        }
      } catch (error) {
        console.error("Error fetching hotspot data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [filterMode]);

  const changeFilterMode = (mode: "day" | "month" | "year") => {
    setFilterMode(mode);
    const today = new Date().toISOString().split("T")[0];

    if (mode === "day") {
      setDates([today]);
    } else if (mode === "month") {
      setDates([today.slice(0, 7)]);
    } else {
      setDates([]);
    }
    setCurrentPage(1);
  };

  const toggleConfidence = (confidence: string) => {
    setSelectedConfidence((prev) => {
      const newSelection = prev.includes(confidence)
        ? prev.filter((c) => c !== confidence)
        : [...prev, confidence];
      setCurrentPage(1);
      return newSelection;
    });
  };

  const toggleSatellite = (satellite: string) => {
    setSelectedSatellites((prev) => {
      const newSelection = prev.includes(satellite)
        ? prev.filter((s) => s !== satellite)
        : [...prev, satellite];
      setCurrentPage(1);
      return newSelection;
    });
  };

  const getUniqueSatellites = () => {
    if (!data) return [];
    const satellites = new Set<string>();
    data.features.forEach((feature) => {
      satellites.add(feature.properties.satellite);
    });
    return Array.from(satellites);
  };

  const filteredHotspots = useMemo(() => {
    let currentFilteredData =
      data?.features?.filter((feature: HotspotFeature) => {
        const featureTimeStr = feature.properties.time;
        const featureDate = featureTimeStr.slice(0, 10);
        const featureMonth = featureTimeStr.slice(0, 7);
        const featureYear = featureTimeStr.slice(0, 4);

        // Filter tanggal
        if (dates && dates.length > 0) {
          const selectedDatesFormatted = dates.map((d: Value | null) => {
            if (d === null) return '';
            if (typeof d === "string") return d;

            if (d instanceof DateObject) {
              if (filterMode === "day") return d.format("YYYY-MM-DD");
              if (filterMode === "month") return d.format("YYYY-MM");
              if (filterMode === "year") return d.format("YYYY");
            }

            if (d instanceof Date && !isNaN(d.getTime())) {
              const year = d.getFullYear();
              const month = (d.getMonth() + 1).toString().padStart(2, '0');
              const day = d.getDate().toString().padStart(2, '0');
              if (filterMode === "day") return `${year}-${month}-${day}`;
              if (filterMode === "month") return `${year}-${month}`;
              if (filterMode === "year") return `${year}`;
            }
            return ''; 
            }).filter(Boolean);
          

          if (filterMode === "day") {
            if (!selectedDatesFormatted.includes(featureDate)) return false;
          } else if (filterMode === "month") {
            if (!selectedDatesFormatted.includes(featureMonth)) return false;
          } else if (filterMode === "year") {
            if (!selectedDatesFormatted.includes(featureYear)) return false;
          }
        } else if (filterMode === "year") {
          return false;
        }

        // Filter confidence
        if (
          selectedConfidence.length > 0 && !selectedConfidence.includes(feature.properties.confidence)
        ) {
          return false;
        }

        // Filter satellite
        if (
          selectedSatellites.length > 0 && !selectedSatellites.includes(feature.properties.satellite)
        ) {
          return false;
        }

        // Filter pencarian
        if (searchText) {
          const search = searchText.toLowerCase();
          const loc = feature.properties.location;
          return (
            loc.desa.toLowerCase().includes(search) ||
            loc.kecamatan.toLowerCase().includes(search) ||
            loc.kab_kota.toLowerCase().includes(search) ||
            loc.provinsi.toLowerCase().includes(search) ||
            loc.pulau.toLowerCase().includes(search)
          );
        }
        return true;
      }) || [];

    // Sorting
    if (sortConfig.key !== null && viewMode === "detail") {
      currentFilteredData.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortConfig.key) {
          case "Tanggal":
            aValue = a.properties.time;
            bValue = b.properties.time;
            break;
          case "Waktu":
            aValue = extractTime(a.properties.hotspot_time);
            bValue = extractTime(b.properties.hotspot_time);
            break;
          case "Satelit":
            aValue = a.properties.satellite;
            bValue = b.properties.satellite;
            break;
          case "Confidence":
            const confidenceOrder = { high: 3, medium: 2, low: 1 };
            aValue =
              confidenceOrder[
                a.properties.confidence as "high" | "medium" | "low"] || 0;
            bValue =
              confidenceOrder[
                b.properties.confidence as "high" | "medium" | "low"] || 0;
            break;
          case "Jumlah Hotspot":
            aValue = a.properties.hotspot_count;
            bValue = b.properties.hotspot_count;
            break;
          case "Desa":
            aValue = a.properties.location.desa;
            bValue = b.properties.location.desa;
            break;
          case "Kecamatan":
            aValue = a.properties.location.kecamatan;
            bValue = b.properties.location.kecamatan;
            break;
          case "Kabupaten":
            aValue = a.properties.location.kab_kota;
            bValue = b.properties.location.kab_kota;
            break;
          case "Provinsi":
            aValue = a.properties.location.provinsi;
            bValue = b.properties.location.provinsi;
            break;
          case "Pulau":
            aValue = a.properties.location.pulau;
            bValue = b.properties.location.pulau;
            break;
          default:
            if (sortConfig.key) {
                aValue = (a as any)[sortConfig.key] || "";
                bValue = (b as any)[sortConfig.key] || "";
            } else {
                aValue = "";
                bValue = "";
            }
            break;
        }

        if (aValue < bValue) {
          return sortConfig.direction === "asc" ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === "asc" ? 1 : -1;
        }
        return 0;
      });
    }
    return currentFilteredData;
  }, [
    data, dates, filterMode, searchText, selectedConfidence, selectedSatellites, sortConfig, viewMode
  ]);

  // Data Akumulasi
  const accumulatedHotspots = useMemo(() => {
    const accData: { [key: string]: AccumulatedHotspot } = {};

    filteredHotspots.forEach((feature) => {
      const date = feature.properties.hotspot_time.slice(0, 10);
      const satellite = feature.properties.satellite;
      const confidence = feature.properties.confidence;
      const provinsi = feature.properties.location.provinsi;
      const kab_kota = feature.properties.location.kab_kota;

      const key = `${date}-${satellite}-${confidence}-${provinsi}-${kab_kota}`;

      if (accData[key]) {
        accData[key]["Jumlah Hotspot"] += feature.properties.hotspot_count;
      } else {
        accData[key] = {
          Tanggal: date,
          Satelit: satellite,
          Confidence: confidence,
          Provinsi: provinsi,
          Kabupaten: kab_kota,
          "Jumlah Hotspot": feature.properties.hotspot_count,
        };
      }
    });

    let result = Object.values(accData);

    // Sorting
    if (sortConfig.key !== null && viewMode === "akumulasi") {
      result.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortConfig.key) {
          case "Tanggal":
            aValue = a.Tanggal;
            bValue = b.Tanggal;
            break;
          case "Satelit":
            aValue = a.Satelit;
            bValue = b.Satelit;
            break;
          case "Confidence":
            const confidenceOrder = { high: 3, medium: 2, low: 1 };
            aValue =
              confidenceOrder[
                a.Confidence as "high" | "medium" | "low"] || 0;
            bValue =
              confidenceOrder[
                b.Confidence as "high" | "medium" | "low"] || 0;
            break;
          case "Jumlah Hotspot":
            aValue = a["Jumlah Hotspot"];
            bValue = b["Jumlah Hotspot"];
            break;
          case "Kabupaten":
            aValue = a.Kabupaten;
            bValue = b.Kabupaten;
            break;
          case "Provinsi":
            aValue = a.Provinsi;
            bValue = b.Provinsi;
            break;
          default:
            if (sortConfig.key) {
                aValue = (a as any)[sortConfig.key] || "";
                bValue = (b as any)[sortConfig.key] || "";
            } else {
                aValue = "";
                bValue = "";
            }
            break;
        }

        if (aValue < bValue) {
          return sortConfig.direction === "asc" ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === "asc" ? 1 : -1;
        }
        return 0;
      });
    }

    return result;
  }, [filteredHotspots, sortConfig, viewMode]);

  const dataToDisplay = viewMode === "detail" ? filteredHotspots : accumulatedHotspots;
  const totalPages = Math.ceil(dataToDisplay.length / itemsPerPage);
  const currentData = dataToDisplay.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const requestSort = (key: SortKey) => {
    let direction: SortDirection = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  const getSortIndicator = (key: SortKey) => {
    if (sortConfig.key === key) {
      return sortConfig.direction === "asc" ? " ▲" : " ▼";
    }
    return "";
  };

  const exportData = () => {
    if (!dataToDisplay || dataToDisplay.length === 0) {
      alert("Tidak ada data untuk diunduh.");
      return;
    }

    const fileNamePrefix = `hotspot_data_${new Date().getTime()}`;

    const detailDataFormatted = filteredHotspots.map((feature) => ({
      Tanggal: feature.properties.hotspot_time.slice(0, 10),
      Waktu: extractTime(feature.properties.hotspot_time),
      Satelit: feature.properties.satellite,
      Confidence: feature.properties.confidence,
      "Jumlah Hotspot": feature.properties.hotspot_count,
      Desa: feature.properties.location.desa,
      Kecamatan: feature.properties.location.kecamatan,
      Kabupaten: feature.properties.location.kab_kota,
      Provinsi: feature.properties.location.provinsi,
      Pulau: feature.properties.location.pulau,
      Latitude: feature.geometry.coordinates[1],
      Longitude: feature.geometry.coordinates[0],
    }));

    const accumulatedDataFormatted = accumulatedHotspots.map((item) => ({
      Tanggal: item.Tanggal,
      Satelit: item.Satelit,
      Confidence: item.Confidence,
      Provinsi: item.Provinsi,
      Kabupaten: item.Kabupaten,
      "Jumlah Hotspot": item["Jumlah Hotspot"],
    }));

    if (exportFormat === "xlsx") {
      const wb = XLSX.utils.book_new();

      const wsDetail = XLSX.utils.json_to_sheet(detailDataFormatted);
      XLSX.utils.book_append_sheet(wb, wsDetail, "Data Detail Hotspot");

      const wsAkumulasi = XLSX.utils.json_to_sheet(accumulatedDataFormatted);
      XLSX.utils.book_append_sheet(wb, wsAkumulasi, "Data Akumulasi Hotspot");

      XLSX.writeFile(wb, `${fileNamePrefix}.xlsx`);
    } else {
      const headersDetail = Object.keys(detailDataFormatted[0]).join(",");
      const csvDetail = [
        headersDetail,
        ...detailDataFormatted.map((row) =>
          Object.values(row).map((val) => `"${val}"`).join(",")
        ),
      ].join("\n");

      const blobDetail = new Blob([csvDetail], { type: "text/csv;charset=utf-8;" });
      const urlDetail = URL.createObjectURL(blobDetail);
      const aDetail = document.createElement("a");
      aDetail.href = urlDetail;
      aDetail.download = `${fileNamePrefix}_detail.csv`;
      aDetail.click();
      URL.revokeObjectURL(urlDetail);

      const headersAkumulasi = Object.keys(accumulatedDataFormatted[0]).join(",");
      const csvAkumulasi = [
        headersAkumulasi,
        ...accumulatedDataFormatted.map((row) =>
          Object.values(row).map((val) => `"${val}"`).join(",")
        ),
      ].join("\n");

      const blobAkumulasi = new Blob([csvAkumulasi], { type: "text/csv;charset=utf-8;" });
      const urlAkumulasi = URL.createObjectURL(blobAkumulasi);
      const aAkumulasi = document.createElement("a");
      aAkumulasi.href = urlAkumulasi;
      aAkumulasi.download = `${fileNamePrefix}_akumulasi.csv`;
      aAkumulasi.click();
      URL.revokeObjectURL(urlAkumulasi);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Data Hotspot</h1>
        <div className="flex flex-col md:flex-row gap-6">
          <div className="md:w-1/4 space-y-6 p-4 bg-white rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Filter Data</h2>

            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Tampilan Data:
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setViewMode("detail");
                    setCurrentPage(1);
                  }}
                  className={`px-4 py-2 rounded ${
                    viewMode === "detail"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 text-gray-800"
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
                    viewMode === "akumulasi"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 text-gray-800"
                  }`}
                >
                  Akumulasi
                </button>
              </div>
            </div>

            {/* Filter Mode */}
            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Mode Filter Tanggal:
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => changeFilterMode("day")}
                  className={`px-4 py-2 rounded ${
                    filterMode === "day"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 text-gray-800"
                  }`}
                >
                  Harian
                </button>
                <button
                  onClick={() => changeFilterMode("month")}
                  className={`px-4 py-2 rounded ${
                    filterMode === "month"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 text-gray-800"
                  }`}
                >
                  Bulanan
                </button>
                <button
                  onClick={() => changeFilterMode("year")}
                  className={`px-4 py-2 rounded ${
                    filterMode === "year"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 text-gray-800"
                  }`}
                >
                  Tahunan
                </button>
              </div>
            </div>

            {/* Date Picker */}
            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Pilih{" "}
                {filterMode === "day"
                  ? "Tanggal"
                  : filterMode === "month"
                  ? "Bulan"
                  : "Tahun"}
                :
              </label>
              <DatePicker
                multiple
                value={dates}
                onChange={(newDates) => {
                  setDates(newDates);
                  setCurrentPage(1);
                }}
                format={
                  filterMode === "day"
                    ? "YYYY-MM-DD"
                    : filterMode === "month"
                    ? "YYYY-MM"
                    : "YYYY"
                }
                {...(filterMode === "month" && { onlyMonthPicker: true })}
                {...(filterMode === "year" && { onlyYearPicker: true })}
                className="border p-2 rounded w-full"
              />
            </div>

            {/* Search Input */}
            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Cari Lokasi:
              </label>
              <input
                type="text"
                placeholder="Cari desa, kecamatan, kota, provinsi, atau pulau..."
                value={searchText}
                onChange={(e) => {
                  setSearchText(e.target.value);
                  setCurrentPage(1);
                }}
                className="border p-2 rounded w-full focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Confidence Filter */}
            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Confidence:
              </label>
              <div className="flex flex-wrap gap-2">
                {["high", "medium", "low"].map((confidence) => (
                  <button
                    key={confidence}
                    onClick={() => toggleConfidence(confidence)}
                    className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      selectedConfidence.includes(confidence)
                        ? confidence === "high"
                          ? "bg-red-500 text-white"
                          : confidence === "medium"
                          ? "bg-yellow-500 text-white"
                          : "bg-green-500 text-white"
                        : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                    }`}
                  >
                    {confidence}
                  </button>
                ))}
              </div>
            </div>

            {/* Satellite Filter */}
            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Satelit:
              </label>
              <div className="flex flex-wrap gap-2">
                {getUniqueSatellites().map((satellite) => (
                  <button
                    key={satellite}
                    onClick={() => toggleSatellite(satellite)}
                    className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      selectedSatellites.includes(satellite)
                        ? "bg-blue-500 text-white"
                        : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                    }`}
                  >
                    {satellite}
                  </button>
                ))}
              </div>
            </div>

            {/* Export Options */}
            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Format Export:
              </label>
              <select
                value={exportFormat}
                onChange={(e) =>
                  setExportFormat(e.target.value as "xlsx" | "csv")
                }
                className="border p-2 rounded w-full focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="xlsx">Excel</option>
                <option value="csv">CSV</option>
              </select>
            </div>

            <button
              onClick={exportData}
              disabled={
                (filterMode === "year" &&
                  !dates?.length &&
                  !searchText &&
                  selectedConfidence.length === 0 &&
                  selectedSatellites.length === 0) ||
                dataToDisplay.length === 0
              }
              className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              Download Data
            </button>
          </div>

          {/* Data Table */}
          <div className="md:w-3/4">
            {loading ? (
              <div className="text-center py-8">
                <p className="text-lg text-gray-600">Loading data...</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                {filterMode === "year" && !dates?.length && !searchText && selectedConfidence.length === 0 && selectedSatellites.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    Silakan pilih filter untuk menampilkan data.
                  </div>
                ) : dataToDisplay.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    Tidak ada data yang sesuai dengan filter yang dipilih.
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 table-fixed">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">
                              No
                            </th>
                            <th
                              className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24 cursor-pointer hover:bg-gray-100"
                              onClick={() => requestSort("Tanggal")}
                            >
                              Tanggal{getSortIndicator("Tanggal")}
                            </th>
                            {viewMode === "detail" && (
                              <th
                                className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24 cursor-pointer hover:bg-gray-100"
                                onClick={() => requestSort("Waktu")}
                              >
                                Waktu{getSortIndicator("Waktu")}
                              </th>
                            )}
                            <th
                              className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24 cursor-pointer hover:bg-gray-100"
                              onClick={() => requestSort("Satelit")}
                            >
                              Satelit{getSortIndicator("Satelit")}
                            </th>
                            <th
                              className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24 cursor-pointer hover:bg-gray-100"
                              onClick={() => requestSort("Confidence")}
                            >
                              Confidence{getSortIndicator("Confidence")}
                            </th>
                            <th
                              className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28 cursor-pointer hover:bg-gray-100"
                              onClick={() => requestSort("Jumlah Hotspot")}
                            >
                              Jumlah Hotspot
                              {getSortIndicator("Jumlah Hotspot")}
                            </th>
                            {viewMode === "detail" && (
                              <>
                                <th
                                  className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32 cursor-pointer hover:bg-gray-100"
                                  onClick={() => requestSort("Desa")}
                                >
                                  Desa{getSortIndicator("Desa")}
                                </th>
                                <th
                                  className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32 cursor-pointer hover:bg-gray-100"
                                  onClick={() => requestSort("Kecamatan")}
                                >
                                  Kecamatan{getSortIndicator("Kecamatan")}
                                </th>
                              </>
                            )}
                            <th
                              className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-36 cursor-pointer hover:bg-gray-100"
                              onClick={() => requestSort("Kabupaten")}
                            >
                              Kabupaten/Kota{getSortIndicator("Kabupaten")}
                            </th>
                            <th
                              className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32 cursor-pointer hover:bg-gray-100"
                              onClick={() => requestSort("Provinsi")}
                            >
                              Provinsi{getSortIndicator("Provinsi")}
                            </th>
                            {viewMode === "detail" && (
                              <>
                                <th
                                  className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28 cursor-pointer hover:bg-gray-100"
                                  onClick={() => requestSort("Pulau")}
                                >
                                  Pulau{getSortIndicator("Pulau")}
                                </th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                                  Latitude
                                </th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                                  Longitude
                                </th>
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {currentData.map((item, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-2 py-2 whitespace-nowrap text-xs">
                                {(currentPage - 1) * itemsPerPage + index + 1}
                              </td>
                              {viewMode === "detail" ? (
                                <>
                                  <td className="px-2 py-2 whitespace-nowrap text-xs">
                                    {(item as HotspotFeature).properties.hotspot_time.slice(0, 10)}
                                  </td>
                                  <td className="px-2 py-2 whitespace-nowrap text-xs">
                                    {extractTime((item as HotspotFeature).properties.hotspot_time)}
                                  </td>
                                  <td className="px-2 py-2 whitespace-nowrap text-xs">
                                    {(item as HotspotFeature).properties.satellite}
                                  </td>
                                  <td className="px-2 py-2 whitespace-nowrap text-xs">
                                    <span
                                      className={`px-2 py-1 rounded-full text-xs font-semibold ${
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
                                  <td className="px-2 py-2 whitespace-nowrap text-xs">
                                    {(item as HotspotFeature).properties.hotspot_count}
                                  </td>
                                  <td className="px-2 py-2 whitespace-nowrap text-xs">
                                    {(item as HotspotFeature).properties.location.desa}
                                  </td>
                                  <td className="px-2 py-2 whitespace-nowrap text-xs">
                                    {(item as HotspotFeature).properties.location.kecamatan}
                                  </td>
                                  <td className="px-2 py-2 whitespace-nowrap text-xs">
                                    {(item as HotspotFeature).properties.location.kab_kota}
                                  </td>
                                  <td className="px-2 py-2 whitespace-nowrap text-xs">
                                    {(item as HotspotFeature).properties.location.provinsi}
                                  </td>
                                  <td className="px-2 py-2 whitespace-nowrap text-xs">
                                    {(item as HotspotFeature).properties.location.pulau}
                                  </td>
                                  <td className="px-2 py-2 whitespace-nowrap text-xs">
                                    {(item as HotspotFeature).geometry.coordinates[1]}
                                  </td>
                                  <td className="px-2 py-2 whitespace-nowrap text-xs">
                                    {(item as HotspotFeature).geometry.coordinates[0]}
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="px-2 py-2 whitespace-nowrap text-xs">
                                    {(item as AccumulatedHotspot).Tanggal}
                                  </td>
                                  <td className="px-2 py-2 whitespace-nowrap text-xs">
                                    {(item as AccumulatedHotspot).Satelit}
                                  </td>
                                  <td className="px-2 py-2 whitespace-nowrap text-xs">
                                    <span
                                      className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                        (item as AccumulatedHotspot).Confidence === "high"
                                          ? "bg-red-100 text-red-800"
                                          : (item as AccumulatedHotspot).Confidence === "medium"
                                          ? "bg-yellow-100 text-yellow-800"
                                          : "bg-green-100 text-green-800"
                                      }`}
                                    >
                                      {(item as AccumulatedHotspot).Confidence}
                                    </span>
                                  </td>
                                  <td className="px-2 py-2 whitespace-nowrap text-xs">
                                    {(item as AccumulatedHotspot)["Jumlah Hotspot"]}
                                  </td>
                                  <td className="px-2 py-2 whitespace-nowrap text-xs">
                                    {(item as AccumulatedHotspot).Kabupaten}
                                  </td>
                                  <td className="px-2 py-2 whitespace-nowrap text-xs">
                                    {(item as AccumulatedHotspot).Provinsi}
                                  </td>
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination  */}
                    {totalPages > 1 && (
                      <div className="flex justify-center items-center gap-2 py-4 border-t border-gray-200 bg-gray-50">
                        <button
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage === 1}
                          className="px-3 py-1 rounded-md bg-blue-500 text-white disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-600"
                        >
                          Previous
                        </button>
                        <span className="text-gray-700">
                          Page {currentPage} of {totalPages}
                        </span>
                        <button
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={currentPage === totalPages}
                          className="px-3 py-1 rounded-md bg-blue-500 text-white disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-600"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}