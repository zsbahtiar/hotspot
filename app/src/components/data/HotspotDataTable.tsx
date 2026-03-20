import { useState, useEffect, useMemo } from "react";
import { utils, writeFile } from "xlsx";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import { extractTime, translateWeatherCondition } from "@/core/utils/formatters";
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
import { ChevronLeft, ChevronRight } from "lucide-react";
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
import { hotspotService } from "@/core/services/hotspotService";

const USE_MOCK_DATA = false;

const MOCK_HOTSPOT_DATA: HotspotFeature[] = Array.from(
  { length: 100 },
  (_, i) => {
    const provinces = [
      {
        pulau: "Sumatera",
        provinsi: "Aceh",
        kab_kota: "Banda Aceh",
        kecamatan: "Kuta Alam",
        desa: "Mulia",
        coords: [95.3238, 5.5483],
      },
      {
        pulau: "Sumatera",
        provinsi: "Sumatera Utara",
        kab_kota: "Medan",
        kecamatan: "Medan Kota",
        desa: "Pasar Baru",
        coords: [98.6722, 3.5952],
      },
      {
        pulau: "Sumatera",
        provinsi: "Sumatera Barat",
        kab_kota: "Padang",
        kecamatan: "Padang Utara",
        desa: "Lolong Belanti",
        coords: [100.3543, -0.9471],
      },
      {
        pulau: "Sumatera",
        provinsi: "Riau",
        kab_kota: "Pekanbaru",
        kecamatan: "Tampan",
        desa: "Sidomulyo Barat",
        coords: [101.4478, 0.5071],
      },
      {
        pulau: "Sumatera",
        provinsi: "Jambi",
        kab_kota: "Jambi",
        kecamatan: "Jambi Selatan",
        desa: "Legok",
        coords: [103.6102, -1.6102],
      },
      {
        pulau: "Sumatera",
        provinsi: "Sumatera Selatan",
        kab_kota: "Palembang",
        kecamatan: "Ilir Timur I",
        desa: "Bukit Baru",
        coords: [104.7754, -2.9761],
      },
      {
        pulau: "Sumatera",
        provinsi: "Bengkulu",
        kab_kota: "Bengkulu",
        kecamatan: "Teluk Segara",
        desa: "Pasar Bengkulu",
        coords: [102.2656, -3.7928],
      },
      {
        pulau: "Sumatera",
        provinsi: "Lampung",
        kab_kota: "Bandar Lampung",
        kecamatan: "Tanjung Karang",
        desa: "Enggal",
        coords: [105.2663, -5.4286],
      },
      {
        pulau: "Jawa",
        provinsi: "Banten",
        kab_kota: "Tangerang",
        kecamatan: "Cipondoh",
        desa: "Poris Plawad",
        coords: [106.6894, -6.1162],
      },
      {
        pulau: "Jawa",
        provinsi: "DKI Jakarta",
        kab_kota: "Jakarta Pusat",
        kecamatan: "Menteng",
        desa: "Gondangdia",
        coords: [106.8271, -6.1751],
      },
      {
        pulau: "Jawa",
        provinsi: "Jawa Barat",
        kab_kota: "Bandung",
        kecamatan: "Coblong",
        desa: "Dago",
        coords: [107.6191, -6.9175],
      },
      {
        pulau: "Jawa",
        provinsi: "Jawa Tengah",
        kab_kota: "Semarang",
        kecamatan: "Semarang Tengah",
        desa: "Pandansari",
        coords: [110.4203, -6.9734],
      },
      {
        pulau: "Jawa",
        provinsi: "DI Yogyakarta",
        kab_kota: "Sleman",
        kecamatan: "Mlati",
        desa: "Sendangadi",
        coords: [110.3695, -7.7972],
      },
      {
        pulau: "Jawa",
        provinsi: "Jawa Timur",
        kab_kota: "Surabaya",
        kecamatan: "Sukolilo",
        desa: "Keputih",
        coords: [112.7508, -7.2575],
      },
      {
        pulau: "Kalimantan",
        provinsi: "Kalimantan Barat",
        kab_kota: "Pontianak",
        kecamatan: "Pontianak Kota",
        desa: "Sungai Bangkong",
        coords: [109.3425, -0.0263],
      },
      {
        pulau: "Kalimantan",
        provinsi: "Kalimantan Tengah",
        kab_kota: "Palangka Raya",
        kecamatan: "Jekan Raya",
        desa: "Menteng",
        coords: [113.9213, -0.7893],
      },
      {
        pulau: "Kalimantan",
        provinsi: "Kalimantan Selatan",
        kab_kota: "Banjarmasin",
        kecamatan: "Banjarmasin Tengah",
        desa: "Kelayan Timur",
        coords: [114.5906, -3.3186],
      },
      {
        pulau: "Kalimantan",
        provinsi: "Kalimantan Timur",
        kab_kota: "Samarinda",
        kecamatan: "Samarinda Ulu",
        desa: "Air Hitam",
        coords: [117.1436, -0.5022],
      },
      {
        pulau: "Kalimantan",
        provinsi: "Kalimantan Utara",
        kab_kota: "Tarakan",
        kecamatan: "Tarakan Tengah",
        desa: "Karang Balik",
        coords: [117.6333, 3.3],
      },
      {
        pulau: "Sulawesi",
        provinsi: "Sulawesi Utara",
        kab_kota: "Manado",
        kecamatan: "Wenang",
        desa: "Calaca",
        coords: [124.8405, 1.4748],
      },
      {
        pulau: "Sulawesi",
        provinsi: "Sulawesi Tengah",
        kab_kota: "Palu",
        kecamatan: "Palu Barat",
        desa: "Pantoloan",
        coords: [119.8707, -0.8999],
      },
      {
        pulau: "Sulawesi",
        provinsi: "Sulawesi Selatan",
        kab_kota: "Makassar",
        kecamatan: "Tamalate",
        desa: "Jongaya",
        coords: [119.4327, -5.1477],
      },
      {
        pulau: "Sulawesi",
        provinsi: "Sulawesi Tenggara",
        kab_kota: "Kendari",
        kecamatan: "Mandonga",
        desa: "Anduonohu",
        coords: [122.4991, -3.9689],
      },
      {
        pulau: "Bali",
        provinsi: "Bali",
        kab_kota: "Denpasar",
        kecamatan: "Denpasar Selatan",
        desa: "Sanur",
        coords: [115.2126, -8.6705],
      },
      {
        pulau: "Nusa Tenggara",
        provinsi: "Nusa Tenggara Barat",
        kab_kota: "Mataram",
        kecamatan: "Mataram",
        desa: "Cakranegara",
        coords: [116.1169, -8.5833],
      },
      {
        pulau: "Nusa Tenggara",
        provinsi: "Nusa Tenggara Timur",
        kab_kota: "Kupang",
        kecamatan: "Oebobo",
        desa: "Fontein",
        coords: [123.5889, -10.1718],
      },
      {
        pulau: "Maluku",
        provinsi: "Maluku",
        kab_kota: "Ambon",
        kecamatan: "Sirimau",
        desa: "Uritetu",
        coords: [128.1808, -3.6954],
      },
      {
        pulau: "Papua",
        provinsi: "Papua",
        kab_kota: "Jayapura",
        kecamatan: "Jayapura Utara",
        desa: "Gurabesi",
        coords: [140.6719, -2.5924],
      },
    ];

    const satellites = ["VIIRS", "MODIS", "Terra", "Aqua", "SNPP"];
    const confidences = ["high", "medium", "low"];

    const loc = provinces[i % provinces.length];
    const date = new Date(2025, 0, 1);
    date.setDate(date.getDate() - Math.floor(i / 2));

    const hour = 8 + (i % 12);
    const minute = (i * 15) % 60;

    return {
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [
          loc.coords[0] + (Math.random() - 0.5) * 0.1,
          loc.coords[1] + (Math.random() - 0.5) * 0.1,
        ],
      },
      properties: {
        time: date.toISOString().split("T")[0],
        hotspot_time: `${date.toISOString().split("T")[0]}T${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}:00`,
        hotspot_count: Math.floor(Math.random() * 10) + 1,
        satellite: satellites[i % satellites.length],
        confidence: confidences[i % confidences.length],
        location: {
          pulau: loc.pulau,
          provinsi: loc.provinsi,
          kab_kota: loc.kab_kota,
          kecamatan: loc.kecamatan,
          desa: loc.desa,
        },
      },
    };
  },
);

export default function HotspotTable() {
  const [data, setData] = useState<HotspotFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dates, setDates] = useState<{ from: Date; to?: Date } | undefined>();
  const [selectedConfidence, setSelectedConfidence] = useState<string[]>([]);
  const [selectedSatellites, setSelectedSatellites] = useState<string[]>([]);
  const [exportFormat, setExportFormat] = useState<"xlsx" | "csv">("xlsx");
  const [viewMode, setViewMode] = useState<"detail" | "akumulasi">("detail");
  const [sortBy, setSortBy] = useState<string>("properties.hotspot_time");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [confidenceOptions, setConfidenceOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [satelliteOptions, setSatelliteOptions] = useState<Array<{ id: string; name: string }>>([]);

  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [prevCursors, setPrevCursors] = useState<string[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [apiPage, setApiPage] = useState(1);
  const PAGE_SIZE = 50;

  const getLatestDate = (hotspots: HotspotFeature[]) => {
    if (!hotspots || hotspots.length === 0) return null;
    const sorted = [...hotspots].sort(
      (a, b) =>
        new Date(b.properties.hotspot_time).getTime() -
        new Date(a.properties.hotspot_time).getTime(),
    );
    return new Date(sorted[0].properties.time);
  };

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

  const buildFilters = (cursorValue?: string) => {
    const filters: any = {
      limit: PAGE_SIZE,
    };

    if (cursorValue) {
      filters.cursor = cursorValue;
    }

    if (dates?.from) {
      const startOfDay = new Date(dates.from);
      startOfDay.setHours(0, 0, 0, 0);
      filters.start_date = formatWithTimezone(startOfDay);
    }
    if (dates?.to) {
      const endOfDay = new Date(dates.to);
      endOfDay.setHours(23, 59, 59, 999);
      filters.end_date = formatWithTimezone(endOfDay);
    } else if (dates?.from) {
      const endOfDay = new Date(dates.from);
      endOfDay.setHours(23, 59, 59, 999);
      filters.end_date = formatWithTimezone(endOfDay);
    }

    if (selectedConfidence.length > 0) {
      filters.confidence = selectedConfidence[0];
    }

    if (selectedSatellites.length > 0) {
      filters.satellite = selectedSatellites[0];
    }

    return filters;
  };

  const fetchData = async (cursorValue?: string, isNextPage = false, isPrevPage = false) => {
    setLoading(true);
    try {
      if (USE_MOCK_DATA) {
        setData(MOCK_HOTSPOT_DATA);
        setLoading(false);
        return;
      }

      const filters = buildFilters(cursorValue);
      const response = await hotspotService.getHotspotsGeoJSON(filters);
      const features = response.data.features as unknown as HotspotFeature[];
      setData(features);

      if (response.data.pagination) {
        setHasMore(response.data.pagination.has_next);
        setTotalCount(response.data.pagination.total_count);

        if (isNextPage && cursor) {
          setPrevCursors((prev) => [...prev, cursor]);
          setApiPage((prev) => prev + 1);
        } else if (isPrevPage) {
          setApiPage((prev) => Math.max(1, prev - 1));
        }

        setCursor(response.data.pagination.next_cursor);
      }
    } catch (error) {
      console.error("Failed to fetch hotspot data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCursor(undefined);
    setPrevCursors([]);
    setApiPage(1);
    setData([]);
    setTotalCount(0);
    setHasMore(false);
    fetchData();
  }, [dates, selectedConfidence, selectedSatellites]);

  const goToNextPage = () => {
    if (!hasMore || loading) return;
    fetchData(cursor, true, false);
  };

  const goToPrevPage = () => {
    if (prevCursors.length === 0 || loading) return;
    const newPrevCursors = [...prevCursors];
    const prevCursor = newPrevCursors.pop();
    setPrevCursors(newPrevCursors);

    const cursorToUse = newPrevCursors.length === 0 ? undefined : prevCursor;
    fetchData(cursorToUse, false, true);
  };

  const goToFirstPage = () => {
    if (apiPage === 1 || loading) return;
    setCursor(undefined);
    setPrevCursors([]);
    setApiPage(1);
    fetchData(undefined, false, false);
  };

  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const response = await hotspotService.getFilterOptions();
        setConfidenceOptions(response.data.confidence);
        setSatelliteOptions(response.data.satellites);
      } catch (error) {
        console.error("Failed to fetch filter options:", error);
      }
    };
    fetchFilterOptions();
  }, []);

  const filteredData = useMemo(() => {
    if (!search) return data;

    return data.filter((item) => {
      const searchLower = search.toLowerCase();
      return (
        item.properties.location.desa?.toLowerCase().includes(searchLower) ||
        item.properties.location.kecamatan?.toLowerCase().includes(searchLower) ||
        item.properties.location.kab_kota?.toLowerCase().includes(searchLower) ||
        item.properties.location.provinsi?.toLowerCase().includes(searchLower) ||
        item.properties.location.pulau?.toLowerCase().includes(searchLower)
      );
    });
  }, [data, search]);

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

  const exportData = () => {
    const exportContent =
      viewMode === "detail"
        ? filteredData.map((item) => ({
            Tanggal: new Date(item.properties.time).toLocaleDateString('id-ID', {
              day: '2-digit',
              month: 'short',
              year: 'numeric'
            }),
            Waktu: new Date(item.properties.hotspot_time).toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit'
            }),
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
            FRP: item.properties.frp || "-",
            Brightness: item.properties.brightness || "-",
            "Bright T31": item.properties.bright_t31 || "-",
            "Bright TI4": item.properties.bright_ti4 || "-",
            "Bright TI5": item.properties.bright_ti5 || "-",
          }))
        : accumulatedData.map((item) => ({
            Tanggal: new Date(item.tanggal).toLocaleDateString('id-ID', {
              day: '2-digit',
              month: 'short',
              year: 'numeric'
            }),
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

  function sortHeader(label: string, col: string) {
    return (
      <th
        className="px-3 py-3 text-left cursor-pointer select-none text-[0.65rem] font-semibold uppercase tracking-wider text-[#6b7a64] whitespace-nowrap"
        onClick={() => {
          if (sortBy === col)
            setSortOrder(sortOrder === "asc" ? "desc" : "asc");
          else {
            setSortBy(col);
            setSortOrder("asc");
          }
        }}
      >
        <div className="flex items-center gap-1">
          <span>{label}</span>
          <span className="text-[10px]">
            {sortBy === col ? (
              sortOrder === "asc" ? (
                <span className="text-[#3d6b35]">▲</span>
              ) : (
                <span className="text-[#3d6b35]">▼</span>
              )
            ) : (
              <span className="text-[#6b7a64]/40">⬍</span>
            )}
          </span>
        </div>
      </th>
    );
  }

  return (
    <div className="min-h-screen flex flex-col flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
      <h2 className="text-2xl font-extrabold text-[#192d17] dark:text-[#f3f7f1] mb-3 leading-tight">
        Data Hotspot
      </h2>

            <Card className="mb-4 sm:mb-6">
        <CardContent className="p-4 sm:p-5 lg:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
              <Label className="mb-2 text-sm font-medium">Tampilan</Label>
              <div className="flex gap-2">
                <Button
                  variant={viewMode === "akumulasi" ? "default" : "secondary"}
                  onClick={() => setViewMode("akumulasi")}
                  className="text-sm flex-1 md:flex-none"
                >
                  Akumulasi
                </Button>
                <Button
                  variant={viewMode === "detail" ? "default" : "secondary"}
                  onClick={() => setViewMode("detail")}
                  className="text-sm flex-1 md:flex-none"
                >
                  Detail
                </Button>
              </div>
            </div>

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
                  disabled={!sortedData.length}
                  className="text-sm"
                >
                  Unduh Data
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        <div>
              <Label htmlFor="search-location" className="mb-2 text-sm">
                Lokasi
              </Label>
              <Input
                id="search-location"
                type="text"
                placeholder="Cari lokasi..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="text-sm"
              />
            </div>

                        <div>
              <Label htmlFor="date-range-filter" className="mb-2 text-sm">
                Tanggal
              </Label>
              <DateRangePicker
                id="date-range-filter"
                value={dates}
                onChange={setDates}
                placeholder="Pilih rentang tanggal"
                className="w-full text-sm"
              />
            </div>

                        <div>
              <Label htmlFor="confidence-filter" className="mb-2 text-sm">
                Confidence
              </Label>
              <Select
                value={selectedConfidence[0] || "all"}
                onValueChange={(value) => setSelectedConfidence(value === "all" ? [] : [value])}
              >
                <SelectTrigger id="confidence-filter" className="text-sm">
                  <SelectValue placeholder="Semua confidence" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua confidence</SelectItem>
                  {confidenceOptions.map((conf) => (
                    <SelectItem key={conf.id} value={conf.id}>
                      {conf.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

                        <div>
              <Label htmlFor="satellite-filter" className="mb-2 text-sm">
                Satelit
              </Label>
              <Select
                value={selectedSatellites[0] || "all"}
                onValueChange={(value) => setSelectedSatellites(value === "all" ? [] : [value])}
              >
                <SelectTrigger id="satellite-filter" className="text-sm">
                  <SelectValue placeholder="Semua satelit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua satelit</SelectItem>
                  {satelliteOptions.map((sat) => (
                    <SelectItem key={sat.id} value={sat.id}>
                      {sat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

            <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="text-sm">
              <TableHeader>
                <TableRow className="bg-[#f9faf8] dark:bg-[#1a221a] border-b border-[#d4ddd0] dark:border-[#2a3a28]">
                  <TableHead className="px-3 py-3 text-left text-[0.65rem] font-semibold uppercase tracking-wider text-[#6b7a64] whitespace-nowrap">No</TableHead>
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
                      {sortHeader("Suhu", "properties.temperature")}
                      {sortHeader("Kelembaban", "properties.humidity")}
                      {sortHeader("Kondisi Cuaca", "properties.weather_conditions")}
                      {sortHeader("FRP", "properties.frp")}
                      {sortHeader("Brightness", "properties.brightness")}
                      {sortHeader("Bright T31", "properties.bright_t31")}
                      {sortHeader("Bright TI4", "properties.bright_ti4")}
                      {sortHeader("Bright TI5", "properties.bright_ti5")}
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
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={viewMode === "detail" ? 20 : 7}
                      className="px-4 py-12 text-center"
                    >
                      <div className="flex flex-col items-center justify-center">
                        <FontAwesomeIcon
                          icon={faSpinner}
                          spin
                          size="2x"
                          className="text-muted-foreground mb-3"
                        />
                        <p className="text-foreground">
                          Memuat data hotspot, mohon tunggu...
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : sortedData.length > 0 ? (
                  sortedData.map((item, index) => (
                    <TableRow key={index} className="border-b border-[#e8ece6] dark:border-[#2a3a28] hover:bg-[#f3f6f2] dark:hover:bg-[#1a221a] transition-colors">
                      <TableCell className="px-3 py-3 text-[#6b7a64] text-xs">
                        {(apiPage - 1) * PAGE_SIZE + index + 1}
                      </TableCell>

                      {viewMode === "detail" ? (
                        <>
                          <TableCell className="px-3 py-2.5 text-[0.8rem] text-[#192d17] dark:text-[#f3f7f1] whitespace-nowrap">
                            {new Date((item as HotspotFeature).properties.time).toLocaleDateString('id-ID', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </TableCell>
                          <TableCell className="px-3 py-2.5 text-[0.8rem] text-[#192d17] dark:text-[#f3f7f1] whitespace-nowrap">
                            {new Date((item as HotspotFeature).properties.hotspot_time).toLocaleTimeString('id-ID', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </TableCell>
                          <TableCell className="px-3 py-2.5 text-[0.8rem] text-[#192d17] dark:text-[#f3f7f1] whitespace-nowrap">
                            {(item as HotspotFeature).properties.location.pulau}
                          </TableCell>
                          <TableCell className="px-3 py-2.5 text-[0.8rem] text-[#192d17] dark:text-[#f3f7f1] whitespace-nowrap">
                            {
                              (item as HotspotFeature).properties.location
                                .provinsi
                            }
                          </TableCell>
                          <TableCell className="px-3 py-2.5 text-[0.8rem] text-[#192d17] dark:text-[#f3f7f1] whitespace-nowrap">
                            {
                              (item as HotspotFeature).properties.location
                                .kab_kota
                            }
                          </TableCell>
                          <TableCell className="px-3 py-2.5 text-[0.8rem] text-[#192d17] dark:text-[#f3f7f1] whitespace-nowrap">
                            {
                              (item as HotspotFeature).properties.location
                                .kecamatan
                            }
                          </TableCell>
                          <TableCell className="px-3 py-2.5 text-[0.8rem] text-[#192d17] dark:text-[#f3f7f1] whitespace-nowrap">
                            {(item as HotspotFeature).properties.location.desa}
                          </TableCell>
                          <TableCell className="px-3 py-2.5 text-[0.8rem] text-[#192d17] dark:text-[#f3f7f1] whitespace-nowrap">
                            {(item as HotspotFeature).properties.satellite}
                          </TableCell>
                          <TableCell className="px-3 py-2.5 text-[0.8rem] whitespace-nowrap">
                            <span className={cn(
                              "font-medium uppercase text-[0.7rem] tracking-wide",
                              (item as HotspotFeature).properties.confidence === "high" && "text-[#c07f10]",
                              (item as HotspotFeature).properties.confidence === "medium" && "text-[#3d6b35]",
                              (item as HotspotFeature).properties.confidence === "low" && "text-[#6b7a64]"
                            )}>
                              {(item as HotspotFeature).properties.confidence}
                            </span>
                          </TableCell>
                          <TableCell className="px-3 py-2.5 text-[0.8rem] text-[#192d17] dark:text-[#f3f7f1] whitespace-nowrap">
                            {(item as HotspotFeature).properties.hotspot_count}
                          </TableCell>
                          <TableCell className="px-3 py-2.5 text-[0.8rem] text-[#192d17] dark:text-[#f3f7f1] whitespace-nowrap">
                            {(item as HotspotFeature).geometry.coordinates[1]},{" "}
                            {(item as HotspotFeature).geometry.coordinates[0]}
                          </TableCell>
                          <TableCell className="px-3 py-2.5 text-[0.8rem] text-[#192d17] dark:text-[#f3f7f1] whitespace-nowrap">
                            {(item as HotspotFeature).properties.temperature !== undefined
                              ? `${(item as HotspotFeature).properties.temperature}°C`
                              : "-"}
                          </TableCell>
                          <TableCell className="px-3 py-2.5 text-[0.8rem] text-[#192d17] dark:text-[#f3f7f1] whitespace-nowrap">
                            {(item as HotspotFeature).properties.humidity !== undefined
                              ? `${(item as HotspotFeature).properties.humidity?.toFixed(1)}%`
                              : "-"}
                          </TableCell>
                          <TableCell className="px-3 py-2.5 text-[0.8rem] text-[#192d17] dark:text-[#f3f7f1] whitespace-nowrap">
                            {translateWeatherCondition((item as HotspotFeature).properties.weather_conditions)}
                          </TableCell>
                          <TableCell className="px-3 py-2.5 text-[0.8rem] text-[#192d17] dark:text-[#f3f7f1] whitespace-nowrap">
                            {(item as HotspotFeature).properties.frp
                              ? `${(item as HotspotFeature).properties.frp?.toFixed(1)} MW`
                              : "-"}
                          </TableCell>
                          <TableCell className="px-3 py-2.5 text-[0.8rem] text-[#192d17] dark:text-[#f3f7f1] whitespace-nowrap">
                            {(item as HotspotFeature).properties.brightness
                              ? `${(item as HotspotFeature).properties.brightness?.toFixed(1)} K`
                              : "-"}
                          </TableCell>
                          <TableCell className="px-3 py-2.5 text-[0.8rem] text-[#192d17] dark:text-[#f3f7f1] whitespace-nowrap">
                            {(item as HotspotFeature).properties.bright_t31
                              ? `${(item as HotspotFeature).properties.bright_t31?.toFixed(1)} K`
                              : "-"}
                          </TableCell>
                          <TableCell className="px-3 py-2.5 text-[0.8rem] text-[#192d17] dark:text-[#f3f7f1] whitespace-nowrap">
                            {(item as HotspotFeature).properties.bright_ti4
                              ? `${(item as HotspotFeature).properties.bright_ti4?.toFixed(1)} K`
                              : "-"}
                          </TableCell>
                          <TableCell className="px-3 py-2.5 text-[0.8rem] text-[#192d17] dark:text-[#f3f7f1] whitespace-nowrap">
                            {(item as HotspotFeature).properties.bright_ti5
                              ? `${(item as HotspotFeature).properties.bright_ti5?.toFixed(1)} K`
                              : "-"}
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="px-3 py-2.5 text-[0.8rem] text-[#192d17] dark:text-[#f3f7f1] whitespace-nowrap">
                            {new Date((item as AccumulatedData).tanggal).toLocaleDateString('id-ID', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </TableCell>
                          <TableCell className="px-3 py-2.5 text-[0.8rem] text-[#192d17] dark:text-[#f3f7f1] whitespace-nowrap">
                            {(item as AccumulatedData).satelit}
                          </TableCell>
                          <TableCell className="px-3 py-2.5 text-[0.8rem] whitespace-nowrap">
                            <span className={cn(
                              "font-medium uppercase text-[0.7rem] tracking-wide",
                              (item as AccumulatedData).confidence === "high" && "text-[#c07f10]",
                              (item as AccumulatedData).confidence === "medium" && "text-[#3d6b35]",
                              (item as AccumulatedData).confidence === "low" && "text-[#6b7a64]"
                            )}>
                              {(item as AccumulatedData).confidence}
                            </span>
                          </TableCell>
                          <TableCell className="px-3 py-2.5 text-[0.8rem] text-[#192d17] dark:text-[#f3f7f1] whitespace-nowrap">
                            {(item as AccumulatedData).provinsi}
                          </TableCell>
                          <TableCell className="px-3 py-2.5 text-[0.8rem] text-[#192d17] dark:text-[#f3f7f1] whitespace-nowrap">
                            {(item as AccumulatedData).kota}
                          </TableCell>
                          <TableCell className="px-3 py-2.5 text-[0.8rem] text-[#192d17] dark:text-[#f3f7f1] whitespace-nowrap">
                            {(item as AccumulatedData).jumlah}
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={viewMode === "detail" ? 20 : 7}
                      className="px-4 py-6 text-center text-muted-foreground"
                    >
                      Tidak ada data yang ditemukan
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

                    <div className="flex justify-between items-center px-5 py-4 border-t border-[#d4ddd0] dark:border-[#2a3a28] bg-[#f9faf8] dark:bg-[#1a221a]">
            {/* Page Info */}
            <div className="text-[0.75rem] text-[#6b7a64]">
              Halaman <span className="font-semibold text-[#192d17] dark:text-[#f3f7f1]">{apiPage}</span>
              {totalCount > 0 && (
                <span> · <span className="font-semibold text-[#192d17] dark:text-[#f3f7f1]">{totalCount.toLocaleString('id-ID')}</span> data</span>
              )}
            </div>

            {/* Pagination Buttons - Pill Style */}
            <div className="flex items-center gap-1 bg-[#f0f4ee] dark:bg-[#1a221a] rounded-full p-1 border border-[#d4ddd0] dark:border-[#2a3a28]">
              <button
                onClick={goToFirstPage}
                disabled={apiPage === 1 || loading}
                className="w-8 h-8 flex items-center justify-center rounded-full text-[#6b7a64] hover:bg-[#192d17] hover:text-[#f3f7f1] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[#6b7a64] disabled:cursor-not-allowed transition-all"
                title="Halaman Pertama"
              >
                <ChevronLeft className="h-4 w-4" />
                <ChevronLeft className="h-4 w-4 -ml-2.5" />
              </button>
              <button
                onClick={goToPrevPage}
                disabled={apiPage === 1 || loading}
                className="w-8 h-8 flex items-center justify-center rounded-full text-[#6b7a64] hover:bg-[#192d17] hover:text-[#f3f7f1] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[#6b7a64] disabled:cursor-not-allowed transition-all"
                title="Sebelumnya"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-3 text-[0.72rem] font-semibold text-[#192d17] dark:text-[#f3f7f1]">{apiPage}</span>
              <button
                onClick={goToNextPage}
                disabled={!hasMore || loading}
                className="w-8 h-8 flex items-center justify-center rounded-full text-[#6b7a64] hover:bg-[#192d17] hover:text-[#f3f7f1] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[#6b7a64] disabled:cursor-not-allowed transition-all"
                title="Selanjutnya"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
