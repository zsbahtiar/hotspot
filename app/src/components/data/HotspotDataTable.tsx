import { useState, useEffect, useMemo } from "react";
import { utils, writeFile } from "xlsx";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import { extractTime } from "@/core/utils/formatters";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateRangePicker } from "@/components/ui/date-range-picker-final";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { HotspotFeature, HotspotData } from "@/core/models/hotspot";
import type { AccumulatedData } from "@/core/models/hotspot";

const USE_MOCK_DATA = true;

const MOCK_HOTSPOT_DATA: HotspotFeature[] = [
  {
    type: "Feature",
    geometry: { type: "Point", coordinates: [95.3238, 5.5483] },
    properties: {
      time: new Date("2025-01-15").toISOString().split("T")[0],
      hotspot_time: "2025-01-15T08:30:00",
      hotspot_count: 5,
      satellite: "Terra",
      confidence: "high",
      location: {
        pulau: "Sumatera",
        provinsi: "Aceh",
        kab_kota: "Banda Aceh",
        kecamatan: "Kuta Alam",
        desa: "Mulia",
      },
    },
  },
  {
    type: "Feature",
    geometry: { type: "Point", coordinates: [98.6722, 3.5952] },
    properties: {
      time: new Date("2025-01-15").toISOString().split("T")[0],
      hotspot_time: "2025-01-15T09:15:00",
      hotspot_count: 3,
      satellite: "Aqua",
      confidence: "medium",
      location: {
        pulau: "Sumatera",
        provinsi: "Sumatera Utara",
        kab_kota: "Medan",
        kecamatan: "Medan Kota",
        desa: "Pasar Baru",
      },
    },
  },
  {
    type: "Feature",
    geometry: { type: "Point", coordinates: [109.3425, -0.0263] },
    properties: {
      time: new Date("2025-01-15").toISOString().split("T")[0],
      hotspot_time: "2025-01-15T10:00:00",
      hotspot_count: 8,
      satellite: "SNPP",
      confidence: "high",
      location: {
        pulau: "Kalimantan",
        provinsi: "Kalimantan Barat",
        kab_kota: "Pontianak",
        kecamatan: "Pontianak Kota",
        desa: "Sungai Bangkong",
      },
    },
  },
];

export default function HotspotTable() {
  const [data, setData] = useState<HotspotFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dates, setDates] = useState<{ from: Date; to?: Date } | undefined>();
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
        new Date(a.properties.hotspot_time).getTime(),
    );
    return new Date(sorted[0].properties.time);
  };

  useEffect(() => {
    const getDataHotspot = async () => {
      try {
        if (USE_MOCK_DATA) {
          setData(MOCK_HOTSPOT_DATA);
          setLoading(false);
          return;
        }

        const response = await fetch(
          `${import.meta.env.PUBLIC_API_URL}/api/hotspot`,
        );
        const result: HotspotData = await response.json();
        setData(result.features);
      } finally {
        setLoading(false);
      }
    };
    getDataHotspot();
  }, []);

  const filteredData = useMemo(() => {
    return data.filter((item) => {
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

      const dateMatch =
        !dates ||
        !dates.from ||
        (item.properties.time >= dates.from.toISOString().split("T")[0] &&
          (!dates.to ||
            item.properties.time <= dates.to.toISOString().split("T")[0]));

      const confidenceMatch =
        selectedConfidence.length === 0 ||
        selectedConfidence.includes(item.properties.confidence);

      const satelliteMatch =
        selectedSatellites.length === 0 ||
        selectedSatellites.includes(item.properties.satellite);

      return searchMatch && dateMatch && confidenceMatch && satelliteMatch;
    });
  }, [data, search, dates, selectedConfidence, selectedSatellites]);

  const accumulatedData = useMemo(() => {
    return filteredData.reduce<AccumulatedData[]>((acc, item) => {
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
          x.kota === kota,
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
    }, []);
  }, [filteredData]);

  const satellites = useMemo(
    () => [...new Set(data.map((item) => item.properties.satellite))],
    [data],
  );

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
        aValueTyped =
          typeof aValueRaw === "string" ? new Date(aValueRaw).getTime() : 0;
        bValueTyped =
          typeof bValueRaw === "string" ? new Date(bValueRaw).getTime() : 0;
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

  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const currentItems = sortedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

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

    if (!dates) {
      dateStr = new Date().toISOString().split("T")[0];
    } else if (!dates.to) {
      dateStr = dates.from.toISOString().split("T")[0];
    } else {
      dateStr = `${dates.from.toISOString().split("T")[0]}_to_${dates.to.toISOString().split("T")[0]}`;
    }

    if (exportFormat === "xlsx") {
      const ws = utils.json_to_sheet(exportContent);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, "Hotspot Data");
      writeFile(wb, `hotspot_${viewMode}_data_${dateStr}.xlsx`);
    } else {
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
          className="text-gray-600 mb-4"
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
    <div className="min-h-screen flex flex-col flex-grow w-full max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
      <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-4 sm:mb-6">
        Data Hotspot
      </h1>

      {/* Filter */}
      <Card className="mb-4 sm:mb-6">
        <CardContent className="p-4 sm:p-5 lg:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* View Mode */}
            <div>
              <Label className="mb-2 text-sm font-medium">Tampilan</Label>
              <div className="flex gap-2">
                <Button
                  variant={viewMode === "akumulasi" ? "default" : "secondary"}
                  onClick={() => {
                    setViewMode("akumulasi");
                    setCurrentPage(1);
                  }}
                  className="text-sm flex-1 md:flex-none"
                >
                  Akumulasi
                </Button>
                <Button
                  variant={viewMode === "detail" ? "default" : "secondary"}
                  onClick={() => {
                    setViewMode("detail");
                    setCurrentPage(1);
                  }}
                  className="text-sm flex-1 md:flex-none"
                >
                  Detail
                </Button>
              </div>
            </div>

            {/* Export */}
            <div>
              <Label className="mb-2 text-sm font-medium">Format Data</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={exportFormat === "xlsx" ? "default" : "outline"}
                  onClick={() => setExportFormat("xlsx")}
                  className="text-sm"
                >
                  Excel (.xlsx)
                </Button>
                <Button
                  variant={exportFormat === "csv" ? "default" : "outline"}
                  onClick={() => setExportFormat("csv")}
                  className="text-sm"
                >
                  CSV (.csv)
                </Button>
                <Button
                  variant="outline"
                  onClick={exportData}
                  disabled={!currentItems.length}
                  className="text-sm"
                >
                  Unduh Data
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* Search Input */}
            <div>
              <Label htmlFor="search-location" className="mb-2 text-sm">
                Cari Lokasi
              </Label>
              <Input
                id="search-location"
                type="text"
                placeholder="Cari lokasi..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="text-sm"
              />
            </div>

            {/* Date Picker */}
            <div>
              <Label htmlFor="date-range-filter" className="mb-2 text-sm">
                Tanggal
              </Label>
              <DateRangePicker
                id="date-range-filter"
                value={dates}
                onChange={(date) => {
                  setDates(date);
                  setCurrentPage(1);
                }}
                placeholder="Pilih rentang tanggal"
                className="w-full text-sm"
              />
            </div>

            {/* Confidence Filter */}
            <div>
              <Label htmlFor="confidence-filter" className="mb-2 text-sm">
                Confidence
              </Label>
              <Select
                value={selectedConfidence[0] || "all"}
                onValueChange={(value) => {
                  setSelectedConfidence(value === "all" ? [] : [value]);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger id="confidence-filter" className="text-sm">
                  <SelectValue placeholder="Semua confidence" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua confidence</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Satellite Filter */}
            <div>
              <Label htmlFor="satellite-filter" className="mb-2 text-sm">
                Satelit
              </Label>
              <Select
                value={selectedSatellites[0] || "all"}
                onValueChange={(value) => {
                  setSelectedSatellites(value === "all" ? [] : [value]);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger id="satellite-filter" className="text-sm">
                  <SelectValue placeholder="Semua satelit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua satelit</SelectItem>
                  {satellites.map((sat) => (
                    <SelectItem key={sat} value={sat}>
                      {sat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4 py-2 text-left">No</TableHead>
                  {viewMode === "detail" ? (
                    <>
                      {sortHeader("Tanggal", "properties.time")}
                      {sortHeader("Waktu", "properties.hotspot_time")}
                      {sortHeader("Pulau", "properties.location.pulau")}
                      {sortHeader("Provinsi", "properties.location.provinsi")}
                      {sortHeader(
                        "Kabupaten/Kota",
                        "properties.location.kab_kota",
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentItems.length > 0 ? (
                  currentItems.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="px-4 py-2">
                        {(currentPage - 1) * itemsPerPage + index + 1}
                      </TableCell>

                      {viewMode === "detail" ? (
                        <>
                          <TableCell className="px-4 py-2">
                            {(item as HotspotFeature).properties.time}
                          </TableCell>
                          <TableCell className="px-4 py-2">
                            {extractTime(
                              (item as HotspotFeature).properties.hotspot_time,
                            )}
                          </TableCell>
                          <TableCell className="px-4 py-2">
                            {(item as HotspotFeature).properties.location.pulau}
                          </TableCell>
                          <TableCell className="px-4 py-2">
                            {
                              (item as HotspotFeature).properties.location
                                .provinsi
                            }
                          </TableCell>
                          <TableCell className="px-4 py-2">
                            {
                              (item as HotspotFeature).properties.location
                                .kab_kota
                            }
                          </TableCell>
                          <TableCell className="px-4 py-2">
                            {
                              (item as HotspotFeature).properties.location
                                .kecamatan
                            }
                          </TableCell>
                          <TableCell className="px-4 py-2">
                            {(item as HotspotFeature).properties.location.desa}
                          </TableCell>
                          <TableCell className="px-4 py-2">
                            {(item as HotspotFeature).properties.satellite}
                          </TableCell>
                          <TableCell className="px-4 py-2">
                            <Badge
                              variant={
                                (item as HotspotFeature).properties
                                  .confidence === "high"
                                  ? "destructive"
                                  : (item as HotspotFeature).properties
                                        .confidence === "medium"
                                    ? "secondary"
                                    : "outline"
                              }
                            >
                              {(item as HotspotFeature).properties.confidence}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-4 py-2">
                            {(item as HotspotFeature).properties.hotspot_count}
                          </TableCell>
                          <TableCell className="px-4 py-2">
                            {(item as HotspotFeature).geometry.coordinates[1]},{" "}
                            {(item as HotspotFeature).geometry.coordinates[0]}
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="px-4 py-2">
                            {(item as AccumulatedData).tanggal}
                          </TableCell>
                          <TableCell className="px-4 py-2">
                            {(item as AccumulatedData).satelit}
                          </TableCell>
                          <TableCell className="px-4 py-2">
                            <Badge
                              variant={
                                (item as AccumulatedData).confidence === "high"
                                  ? "destructive"
                                  : (item as AccumulatedData).confidence ===
                                      "medium"
                                    ? "secondary"
                                    : "outline"
                              }
                            >
                              {(item as AccumulatedData).confidence}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-4 py-2">
                            {(item as AccumulatedData).provinsi}
                          </TableCell>
                          <TableCell className="px-4 py-2">
                            {(item as AccumulatedData).kota}
                          </TableCell>
                          <TableCell className="px-4 py-2">
                            {(item as AccumulatedData).jumlah}
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={viewMode === "detail" ? 12 : 7}
                      className="px-4 py-6 text-center text-gray-500"
                    >
                      Tidak ada data yang ditemukan
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center p-4 border-t">
              <Button
                variant="outline"
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                Sebelumnya
              </Button>

              <div className="flex gap-1 flex-wrap">
                {[...Array(totalPages)].map((_, idx) => (
                  <Button
                    key={idx + 1}
                    variant={currentPage === idx + 1 ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(idx + 1)}
                  >
                    {idx + 1}
                  </Button>
                ))}
              </div>

              <Button
                variant="outline"
                onClick={() =>
                  setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                }
                disabled={currentPage === totalPages}
              >
                Selanjutnya
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
