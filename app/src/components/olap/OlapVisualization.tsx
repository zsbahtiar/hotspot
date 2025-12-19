import Map from "@/components/map/MapComponent";
import ModalTime from "@/components/map/TimeFilterModal";
import L from "leaflet";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { IChart, QueryData } from "@/core/models/query";
import type { DrillDownLevel, LocationData } from "@/core/models/location";
import type { HotspotFeatureGeo } from "@/core/models/hotspot";
import { OlapService, getProvinceCodeByName, getCityCodeByName, getDistrictCodeByName, type LocationFilters } from "@/core/services/olapService";
import { hotspotService } from "@/core/services/hotspotService";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, X, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { id as idLocale } from "react-day-picker/locale";
import { cn } from "@/lib/utils";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Legend,
  Chart,
  Tooltip as ChartTooltip,
} from "chart.js";
import type {
  ChartEvent,
  TooltipItem,
  ChartOptions,
  ChartData,
  InteractionItem,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronDown,
  faChevronUp,
  faAngleLeft,
  faAngleRight,
  faSpinner,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { Tooltip as ReactTooltip } from "react-tooltip";
import { formatNumber } from "@/core/utils/formatters";
import type { TimeFilters } from "@/core/models/time";
import { scaleThreshold } from "d3-scale";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Legend,
  ChartTooltip,
  ChartDataLabels,
);

interface Data {
  data: string | number;
  query: QueryData & { lat?: number; lng?: number };
  modal: boolean;
  total: number;
  child: Data[];
  isOpen?: boolean;
}

type OlapData = [string, number];

const USE_MOCK_DATA = false;

const MOCK_LOCATION_DATA = [
  ["Sumatera", 1250],
  ["Jawa", 380],
  ["Kalimantan", 2100],
  ["Sulawesi", 560],
  ["Papua", 890],
];

const MOCK_CONFIDENCE_DATA: OlapData[] = [
  ["Nominal", 3450],
  ["Low", 1230],
  ["High", 500],
];

const MOCK_SATELLITE_DATA: OlapData[] = [
  ["Terra", 2180],
  ["Aqua", 1850],
  ["SNPP", 1150],
];

const MOCK_ALL_LOCATIONS: LocationData[] = [
  {
    pulau: "Sumatera",
    provinsi: "Aceh",
    kab_kota: "Banda Aceh",
    kecamatan: "",
    desa: "",
    lat: 5.5483,
    lng: 95.3238,
  },
  {
    pulau: "Sumatera",
    provinsi: "Sumatera Utara",
    kab_kota: "Medan",
    kecamatan: "",
    desa: "",
    lat: 3.5952,
    lng: 98.6722,
  },
  {
    pulau: "Sumatera",
    provinsi: "Riau",
    kab_kota: "Pekanbaru",
    kecamatan: "",
    desa: "",
    lat: 0.5071,
    lng: 101.4478,
  },
  {
    pulau: "Jawa",
    provinsi: "DKI Jakarta",
    kab_kota: "Jakarta Pusat",
    kecamatan: "",
    desa: "",
    lat: -6.2088,
    lng: 106.8456,
  },
  {
    pulau: "Jawa",
    provinsi: "Jawa Barat",
    kab_kota: "Bandung",
    kecamatan: "",
    desa: "",
    lat: -6.9175,
    lng: 107.6191,
  },
  {
    pulau: "Jawa",
    provinsi: "Jawa Tengah",
    kab_kota: "Semarang",
    kecamatan: "",
    desa: "",
    lat: -6.9667,
    lng: 110.4167,
  },
  {
    pulau: "Kalimantan",
    provinsi: "Kalimantan Barat",
    kab_kota: "Pontianak",
    kecamatan: "",
    desa: "",
    lat: -0.0263,
    lng: 109.3425,
  },
  {
    pulau: "Kalimantan",
    provinsi: "Kalimantan Tengah",
    kab_kota: "Palangkaraya",
    kecamatan: "",
    desa: "",
    lat: -2.209,
    lng: 113.9213,
  },
  {
    pulau: "Kalimantan",
    provinsi: "Kalimantan Timur",
    kab_kota: "Balikpapan",
    kecamatan: "",
    desa: "",
    lat: -1.2379,
    lng: 116.8529,
  },
  {
    pulau: "Sulawesi",
    provinsi: "Sulawesi Utara",
    kab_kota: "Manado",
    kecamatan: "",
    desa: "",
    lat: 1.4748,
    lng: 124.8421,
  },
  {
    pulau: "Sulawesi",
    provinsi: "Sulawesi Selatan",
    kab_kota: "Makassar",
    kecamatan: "",
    desa: "",
    lat: -5.1477,
    lng: 119.4327,
  },
  {
    pulau: "Papua",
    provinsi: "Papua",
    kab_kota: "Jayapura",
    kecamatan: "",
    desa: "",
    lat: -2.592,
    lng: 140.6682,
  },
];

const olapFetcher = async ([endpoint, params, filters]: [string, QueryData, LocationFilters?]) => {
  if (USE_MOCK_DATA) {
    if (endpoint === "location" && params.dimension === "location") {
      return MOCK_LOCATION_DATA;
    }
    if (endpoint === "confidence") {
      return MOCK_CONFIDENCE_DATA;
    }
    if (endpoint === "satelite") {
      return MOCK_SATELLITE_DATA;
    }
    return [];
  }
  return await OlapService.query(endpoint, params, filters);
};

const OlapComponent = () => {
  const hasFetched = useRef(false);
  const scrollTargetId = useRef<string | null>(null);
  const [mapKey, setMapKey] = useState(Date.now());
  const [isLoading, setIsLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth < 768;
    }
    return false;
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth >= 768;
    }
    return false;
  });
  const [mapBounds, setMapBounds] = useState<L.LatLngBoundsExpression | null>(
    L.latLngBounds(L.latLng(-11, 94), L.latLng(6, 141)),
  );
  const [selectedLocation, setSelectedLocation] = useState<LocationData>();
  const [drillDownLevel, setDrillDownLevel] = useState<DrillDownLevel>("pulau");
  const [activeMapLayer, setActiveMapLayer] = useState<
    "hotspot-count" | "hotspot-locations"
  >("hotspot-count");
  const [data, setData] = useState<Data[]>([]);
  const [dataConfidence, setDataConfidence] = useState<OlapData[]>([]);
  const [dataSatelite, setDataSatelite] = useState<OlapData[]>([]);
  const [barChartData, setBarChartData] = useState<ChartData<"bar"> | null>(
    null,
  );
  const [olapData, setOlapData] = useState<{ query?: QueryData }>({});
  const [, setSelectedHotspot] = useState<number | null>(null);
  const [allLocationData, setAllLocationData] = useState<LocationData[]>([]);
  const [globalFilters, setGlobalFilters] = useState({
    confidence: undefined as string | undefined,
    satelite: undefined as string | undefined,
    time: {} as TimeFilters,
    filterMode: undefined as "period" | "date" | undefined,
    selectedDate: undefined as string | undefined,
    province_code: undefined as string | undefined,
    city_code: undefined as string | undefined,
    district_code: undefined as string | undefined,
    subdistrict_code: undefined as string | undefined,
  });
  const [modalTime, setModalTime] = useState({
    isOpen: false,
    index: [] as number[],
    query: {} as QueryData,
    tipe: "pulau" as DrillDownLevel,
  });
  const [drillDownQuery, setDrillDownQuery] = useState<QueryData | null>(null);
  const [drillDownIndexes, setDrillDownIndexes] = useState<number[]>([]);
  const [, setHotspotCountQuery] = useState({});
  const [hotspotLocationsQuery, setHotspotLocationsQuery] = useState({});
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isDatePickerOpenMobile, setIsDatePickerOpenMobile] = useState(false);
  const [isChartCollapsed, setIsChartCollapsed] = useState(false);
  const [filteredHotspotData, setFilteredHotspotData] = useState<HotspotFeatureGeo[]>([]);
  const [isMapLoading, setIsMapLoading] = useState(false);

  const handleHotspotDataChange = useCallback((data: HotspotFeatureGeo[]) => {
    setFilteredHotspotData(data);
  }, []);

  const handleLoadingChange = useCallback((loading: boolean) => {
    setIsMapLoading(loading);
  }, []);

  const { data: locationApiData } = useQuery({
    queryKey: ["olap-location"],
    queryFn: async () => {
      if (USE_MOCK_DATA) {
        return MOCK_ALL_LOCATIONS;
      }
      const response = await hotspotService.getLocations();
      const provinces = response.data.provinces || [];

      const locationData: LocationData[] = provinces.map((prov) => ({
        lat: prov.lat,
        lng: prov.lng,
        pulau: prov.pulau || "",
        provinsi: prov.name,
        kab_kota: "",
        kecamatan: "",
        desa: "",
      }));

      return locationData;
    },
    refetchOnWindowFocus: false,
  });

  const locationQueryParams = useMemo(() => {
    return { dimension: "location" };
  }, []);

  const { data: locationQueryData, isLoading: isLocationLoading } = useQuery({
    queryKey: ["location", locationQueryParams],
    queryFn: () => olapFetcher(["location", locationQueryParams]),
    enabled: !hasFetched.current,
    refetchOnWindowFocus: false,
  });

  const { data: filterOptionsData } = useQuery({
    queryKey: ["filter-options"],
    queryFn: () => hotspotService.getFilterOptions(),
    refetchOnWindowFocus: false,
  });

  const locationFilters = useMemo((): LocationFilters => {
    const filters: LocationFilters = {};

    if (globalFilters.confidence) {
      filters.confidence = globalFilters.confidence;
    }
    if (globalFilters.satelite) {
      filters.satellite = globalFilters.satelite;
    }

    if (globalFilters.filterMode === "period") {
      if (globalFilters.time.tahun) filters.year = parseInt(globalFilters.time.tahun, 10);
      if (globalFilters.time.semester) filters.semester = parseInt(globalFilters.time.semester, 10);
      if (globalFilters.time.kuartal) filters.quarter = parseInt(globalFilters.time.kuartal, 10);
      if (globalFilters.time.bulan) filters.month = parseInt(globalFilters.time.bulan, 10);
      if (globalFilters.time.minggu) filters.week = parseInt(globalFilters.time.minggu, 10);
    } else if (globalFilters.filterMode === "date" && globalFilters.selectedDate) {
      filters.start_date = globalFilters.selectedDate;
      filters.end_date = globalFilters.selectedDate;
    }

    return filters;
  }, [
    globalFilters.confidence,
    globalFilters.satelite,
    globalFilters.time,
    globalFilters.filterMode,
    globalFilters.selectedDate,
  ]);

  const filteredQueryParams = useMemo(() => {
    let timeParams = {};

    if (globalFilters.filterMode === "period") {
      timeParams = {
        ...(globalFilters.time.tahun && { tahun: globalFilters.time.tahun }),
        ...(globalFilters.time.semester && {
          semester: globalFilters.time.semester,
        }),
        ...(globalFilters.time.kuartal && {
          kuartal: globalFilters.time.kuartal,
        }),
        ...(globalFilters.time.bulan && { bulan: globalFilters.time.bulan }),
        ...(globalFilters.time.minggu && { minggu: globalFilters.time.minggu }),
      };
    } else if (
      globalFilters.filterMode === "date" &&
      globalFilters.selectedDate
    ) {
      timeParams = { selectedDate: globalFilters.selectedDate };
    }

    return {
      dimension: "location",
      ...(globalFilters.confidence && { confidence: globalFilters.confidence }),
      ...(globalFilters.satelite && { satelite: globalFilters.satelite }),
      ...timeParams,
    };
  }, [
    globalFilters.confidence,
    globalFilters.satelite,
    globalFilters.time,
    globalFilters.filterMode,
    globalFilters.selectedDate,
  ]);

  const { data: filteredData, isLoading: isFilteredLoading } = useQuery({
    queryKey: ["location", filteredQueryParams, locationFilters],
    queryFn: () => olapFetcher(["location", filteredQueryParams, locationFilters]),
    enabled: hasFetched.current || Object.keys(olapData.query || {}).length > 0,
    refetchOnWindowFocus: false,
  });

  const { data: drillDownData, isLoading: isDrillDownLoading } = useQuery({
    queryKey: ["location-sidebar-drilldown", drillDownQuery],
    queryFn: () => olapFetcher(["location", drillDownQuery!]),
    enabled: !!drillDownQuery,
    refetchOnWindowFocus: false,
  });

  const { data: filteredDrillDownData, isLoading: isFilteredDrillDownLoading } = useQuery({
    queryKey: ["location-filtered-drilldown", drillDownQuery, locationFilters],
    queryFn: () => olapFetcher(["location", drillDownQuery!, locationFilters]),
    enabled: !!drillDownQuery && Object.keys(locationFilters).length > 0,
    refetchOnWindowFocus: false,
  });

  const calculateThresholds = useCallback((values: number[]) => {
    const filteredValues = values.filter((val) => val > 0);
    const min = filteredValues.length > 0 ? Math.min(...filteredValues) : 0;
    const max = filteredValues.length > 0 ? Math.max(...filteredValues) : 1;

    return {
      min,
      threshold1: 10000,
      threshold2: 100000,
      max,
    };
  }, []);

  const getBarColors = useCallback(
    (values: number[]) => {
      const { threshold1, threshold2 } = calculateThresholds(values);
      const colorScale = scaleThreshold<number, string>()
        .domain([threshold1, threshold2])
        .range(["#FFCDD2", "#EF5350", "#B71C1C"]);

      return values.map((value) => colorScale(value));
    },
    [calculateThresholds],
  );

  const setChart = useCallback(
    (data: IChart) => {
      const chartData: ChartData<"bar"> = {
        labels: data.labels,
        datasets: [
          {
            data: data.values,
            label: "Titik Panas",
            backgroundColor: getBarColors(data.values),
          },
        ],
      };
      setBarChartData(chartData);
    },
    [getBarColors],
  );

  useEffect(() => {
    const handleResize = () => {
      const isDesktop = window.innerWidth >= 768;
      setIsMobile(!isDesktop);
      setIsSidebarOpen(isDesktop && activeMapLayer !== "hotspot-locations");
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [activeMapLayer]);

  useEffect(() => {
    if (locationApiData) {
      setAllLocationData(locationApiData);
    }
  }, [locationApiData]);

  useEffect(() => {
    if (
      locationQueryData &&
      Array.isArray(locationQueryData) &&
      !hasFetched.current
    ) {
      const newData: Data[] = [];
      (locationQueryData as [string, number][]).forEach((d) => {
        newData.push({
          data: d[0],
          total: d[1],
          modal: false,
          query: { pulau: d[0] as string },
          child: [],
          isOpen: false,
        });
      });

      setData(newData);
      hasFetched.current = true;
    }
  }, [locationQueryData]);

  useEffect(() => {
    if (
      locationQueryData &&
      Array.isArray(locationQueryData) &&
      locationQueryData.length > 0 &&
      drillDownIndexes.length === 0
    ) {
      const chart: IChart = {
        labels: [],
        values: [],
      };

      (locationQueryData as [string, number][]).forEach((d) => {
        chart.labels.push(d[0]);
        chart.values.push(d[1]);
      });

      setChart(chart);
    }
  }, [locationQueryData, drillDownIndexes.length, setChart]);

  useEffect(() => {
    if (filterOptionsData?.data) {
      const confidenceData: OlapData[] = filterOptionsData.data.confidence.map(
        (conf) => [conf.name, 0]
      );
      const satelliteData: OlapData[] = filterOptionsData.data.satellites.map(
        (sat) => [sat.name, 0]
      );
      setDataConfidence(confidenceData);
      setDataSatelite(satelliteData);
    }
  }, [filterOptionsData]);

  useEffect(() => {
    if (filteredData && Array.isArray(filteredData) && filteredData.length > 0) {
      const chart: IChart = {
        labels: [],
        values: [],
      };

      (filteredData as [string, number][]).forEach((d) => {
        if (!Array.isArray(d) || d.length < 2) {
          return;
        }
        chart.labels.push(d[0]);
        chart.values.push(d[1]);
      });

      setChart(chart);
      if (!hasFetched.current) {
        hasFetched.current = true;
      }
    }
  }, [filteredData, setChart]);

  useEffect(() => {
    const fetchDrillDownLocations = async () => {
      if (!drillDownQuery || USE_MOCK_DATA) return;

      const query = drillDownQuery as QueryData & { tipe?: DrillDownLevel };
      const tipe = query.tipe;

      let params: {
        province_code?: string;
        city_code?: string;
        district_code?: string;
      } = {};

      if (tipe === "kota" && query.provinsi) {
        params = {};
      }

      try {
        const response = await hotspotService.getLocations(params);
        const newLocations: LocationData[] = [];

        if (response.data.provinces) {
          response.data.provinces.forEach((prov) => {
            newLocations.push({
              lat: prov.lat,
              lng: prov.lng,
              pulau: prov.pulau || "",
              provinsi: prov.name,
              kab_kota: "",
              kecamatan: "",
              desa: "",
            });
          });
        }
        if (response.data.cities) {
          response.data.cities.forEach((city) => {
            newLocations.push({
              lat: city.lat,
              lng: city.lng,
              pulau: "",
              provinsi: "",
              kab_kota: city.name,
              kecamatan: "",
              desa: "",
            });
          });
        }
        if (response.data.districts) {
          response.data.districts.forEach((district) => {
            newLocations.push({
              lat: district.lat,
              lng: district.lng,
              pulau: "",
              provinsi: "",
              kab_kota: "",
              kecamatan: district.name,
              desa: "",
            });
          });
        }
        if (response.data.subdistricts) {
          response.data.subdistricts.forEach((subdistrict) => {
            newLocations.push({
              lat: subdistrict.lat,
              lng: subdistrict.lng,
              pulau: "",
              provinsi: "",
              kab_kota: "",
              kecamatan: "",
              desa: subdistrict.name,
            });
          });
        }

        setAllLocationData((prev) => {
          const existingNames = new Set(
            prev.map((loc) =>
              loc.desa || loc.kecamatan || loc.kab_kota || loc.provinsi,
            ),
          );
          const filtered = newLocations.filter((loc) => {
            const name =
              loc.desa || loc.kecamatan || loc.kab_kota || loc.provinsi;
            return !existingNames.has(name);
          });
          return [...prev, ...filtered];
        });
      } catch (error) {
        console.error("Failed to fetch drill-down locations:", error);
      }
    };

    fetchDrillDownLocations();
  }, [drillDownQuery]);

  useEffect(() => {
    if (drillDownData && drillDownIndexes.length > 0 && drillDownQuery) {
      const chart: IChart = {
        labels: [],
        values: [],
      };

      const hasil: Data[] = [];
      if (Array.isArray(drillDownData) && drillDownData.length > 0) {
        (drillDownData as [string, number][]).forEach((d) => {
          if (!Array.isArray(d) || d.length < 2) {
            return;
          }
          const name = d[0];
          const total = d[1];

          chart.labels.push(name);
          chart.values.push(total);

          const drillDownTipe = (
            drillDownQuery as QueryData & { tipe?: DrillDownLevel }
          )?.tipe;
          const locationDetail = allLocationData.find((loc) => {
            if (drillDownTipe === "provinsi") return loc.provinsi === name;
            if (drillDownTipe === "kota") return loc.kab_kota === name;
            if (drillDownTipe === "kecamatan") return loc.kecamatan === name;
            if (drillDownTipe === "desa") return loc.desa === name;
            return false;
          });

          const param = {
            ...drillDownQuery,
            [(drillDownQuery as QueryData & { tipe?: DrillDownLevel })
              ?.tipe as string]: name,
            lat: locationDetail?.lat,
            lng: locationDetail?.lng,
          };

          hasil.push({
            data: d[0],
            total: d[1],
            modal: false,
            query: param,
            child: [],
            isOpen: false,
          });
        });
      }

      setData((prevData) => {
        const newData = JSON.parse(JSON.stringify(prevData));
        let currentLevel: Data[] = newData;

        drillDownIndexes.forEach((index, i) => {
          if (!currentLevel[index]) {
            return prevData;
          }
          if (i === drillDownIndexes.length - 1) {
            currentLevel[index].child = hasil;
            currentLevel[index].isOpen = true;
          } else {
            currentLevel = currentLevel[index].child;
          }
        });
        return newData;
      });
    }
  }, [
    drillDownData,
    allLocationData,
    drillDownIndexes,
    drillDownQuery,
  ]);

  useEffect(() => {
    if (drillDownIndexes.length > 0 && drillDownQuery) {
      const hasFilters = Object.keys(locationFilters).length > 0;
      const sourceData = hasFilters ? filteredDrillDownData : drillDownData;

      if (sourceData && Array.isArray(sourceData) && sourceData.length > 0) {
        const chart: IChart = {
          labels: [],
          values: [],
        };

        (sourceData as [string, number][]).forEach((d) => {
          if (!Array.isArray(d) || d.length < 2) {
            return;
          }
          chart.labels.push(d[0]);
          chart.values.push(d[1]);
        });

        setChart(chart);
      }
    }
  }, [
    filteredDrillDownData,
    drillDownData,
    drillDownIndexes,
    drillDownQuery,
    locationFilters,
    setChart,
  ]);

  useEffect(() => {
    setIsLoading(isLocationLoading || isFilteredLoading || isDrillDownLoading);
  }, [isLocationLoading, isFilteredLoading, isDrillDownLoading]);

  const effectiveMapLoading = useMemo(() => {
    if (activeMapLayer === "hotspot-count") {
      return isFilteredLoading || isFilteredDrillDownLoading;
    }
    return isMapLoading;
  }, [activeMapLayer, isFilteredLoading, isFilteredDrillDownLoading, isMapLoading]);

  useEffect(() => {
    if (isLoading || !scrollTargetId.current) {
      return;
    }
    const element = document.getElementById(scrollTargetId.current);
    if (!element) {
      return;
    }
    const indexes = scrollTargetId.current
      .replace("location-item-", "")
      .split("-")
      .map((s) => parseInt(s, 10));
    let currentItem = null;
    let items = data;
    for (const index of indexes) {
      if (items && items[index]) {
        currentItem = items[index];
        items = currentItem.child;
      } else {
        currentItem = null;
        break;
      }
    }

    if (currentItem && currentItem.isOpen && currentItem.child.length === 0) {
      return;
    }
    element.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
    scrollTargetId.current = null;
  }, [data, isLoading]);

  const handleSelection = async (selectedData: {
    wilayah?: string | number;
    name?: string;
    lat?: number;
    lng?: number;
  }) => {
    if (!selectedData || (!selectedData.wilayah && !selectedData.name)) {
      return;
    }
    const wilayahDicari = selectedData.wilayah || selectedData.name;
    const matchingLocations = allLocationData.filter(
      (loc: LocationData) =>
        loc.pulau === wilayahDicari ||
        loc.provinsi === wilayahDicari ||
        loc.kab_kota === wilayahDicari ||
        loc.kecamatan === wilayahDicari ||
        loc.desa === wilayahDicari,
    );

    if (matchingLocations.length === 0) {
      if (selectedData.lat && selectedData.lng) {
        setSelectedLocation({
          lat: selectedData.lat,
          lng: selectedData.lng,
        });
      } else {
      }
      return;
    }

    if (matchingLocations.length === 1) {
      setSelectedLocation(matchingLocations[0]);
      return;
    }

    const avgLat =
      matchingLocations.reduce(
        (sum: number, loc: LocationData) => sum + loc.lat,
        0,
      ) / matchingLocations.length;
    const avgLng =
      matchingLocations.reduce(
        (sum: number, loc: LocationData) => sum + loc.lng,
        0,
      ) / matchingLocations.length;
    setSelectedLocation({ lat: avgLat, lng: avgLng });
  };

  const handleDrillDownChange = (newLevel: DrillDownLevel) => {
    setDrillDownLevel(newLevel);
  };

  const getDrilldownData = (
    indexes: number[],
    query: QueryData,
    tipe: DrillDownLevel,
  ) => {
    const levelMap: Record<string, DrillDownLevel> = {
      provinsi: "provinsi",
      kota: "kota",
      kecamatan: "kecamatan",
      desa: "desa",
    };

    if (
      tipe === "provinsi" ||
      tipe === "kota" ||
      tipe === "kecamatan" ||
      tipe === "desa"
    ) {
      setDrillDownLevel(levelMap[tipe]);
    } else {
    }

    setBarChartData(null);

    let timeParams = {};
    if (globalFilters.filterMode === "period") {
      timeParams = {
        ...(globalFilters.time.tahun && { tahun: globalFilters.time.tahun }),
        ...(globalFilters.time.semester && {
          semester: globalFilters.time.semester,
        }),
        ...(globalFilters.time.kuartal && {
          kuartal: globalFilters.time.kuartal,
        }),
        ...(globalFilters.time.bulan && { bulan: globalFilters.time.bulan }),
        ...(globalFilters.time.minggu && { minggu: globalFilters.time.minggu }),
        ...(globalFilters.time.hari && { hari: globalFilters.time.hari }),
      };
    } else if (
      globalFilters.filterMode === "date" &&
      globalFilters.selectedDate
    ) {
      timeParams = { selectedDate: globalFilters.selectedDate };
    }

    const filteredQuery = {
      ...query,
      ...(globalFilters.confidence && { confidence: globalFilters.confidence }),
      ...(globalFilters.satelite && { satelite: globalFilters.satelite }),
      ...timeParams,
      dimension: "location",
      tipe: tipe,
    };

    setDrillDownQuery(filteredQuery);
    setDrillDownIndexes(indexes);
  };

  const handleSelect = (
    itemClicked: Data,
    indexes: number[],
    nextDrillType: DrillDownLevel,
  ) => {
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
    const targetId = `location-item-${indexes.join("-")}`;
    scrollTargetId.current = targetId;

    setData((prevData) => {
      const newData = JSON.parse(JSON.stringify(prevData));

      let targetItem: Data | undefined;
      let parentItem: Data | undefined;
      let currentLevelItems: Data[] = newData;

      indexes.forEach((index, i) => {
        if (i < indexes.length - 1) {
          parentItem = currentLevelItems[index];
          currentLevelItems = parentItem.child;
        } else {
          targetItem = currentLevelItems[index];
        }
      });

      if (!targetItem) return prevData;

      currentLevelItems.forEach((item) => {
        if (item.data !== targetItem!.data) {
          item.isOpen = false;
        }
      });

      targetItem.isOpen = !targetItem.isOpen;

      if (targetItem.isOpen) {
        const queryForDrill = { ...itemClicked.query };
        switch (nextDrillType) {
          case "provinsi":
            queryForDrill.pulau = itemClicked.data.toString();
            setGlobalFilters(prev => ({ ...prev, province_code: undefined, city_code: undefined, district_code: undefined, subdistrict_code: undefined }));
            break;
          case "kota":
            queryForDrill.provinsi = itemClicked.data.toString();
            const provinceCode = getProvinceCodeByName(itemClicked.data.toString());
            setGlobalFilters(prev => ({ ...prev, province_code: provinceCode, city_code: undefined, district_code: undefined, subdistrict_code: undefined }));
            break;
          case "kecamatan":
            queryForDrill.kota = itemClicked.data.toString();
            const cityCode = getCityCodeByName(itemClicked.data.toString());
            setGlobalFilters(prev => ({ ...prev, city_code: cityCode, district_code: undefined, subdistrict_code: undefined }));
            break;
          case "desa":
            queryForDrill.kecamatan = itemClicked.data.toString();
            const districtCode = getDistrictCodeByName(itemClicked.data.toString());
            setGlobalFilters(prev => ({ ...prev, district_code: districtCode, subdistrict_code: undefined }));
            break;
        }
        getDrilldownData(indexes, queryForDrill, nextDrillType);

        setOlapData({ query: queryForDrill });
        setHotspotCountQuery(queryForDrill);
        setDrillDownLevel(nextDrillType);
        setMapBounds(null);
        setSelectedLocation({
          lat: itemClicked.query.lat ?? -2.5,
          lng: itemClicked.query.lng ?? 118,
          ...queryForDrill,
        });
        handleSelection({
          wilayah: itemClicked.data,
          lat: itemClicked.query.lat,
          lng: itemClicked.query.lng,
        });
      } else {
        if (!parentItem) {
          setDrillDownLevel("pulau");
          setOlapData({ query: {} });
          setSelectedLocation(undefined);
          setMapBounds(L.latLngBounds(L.latLng(-11, 94), L.latLng(6, 141)));

          setDrillDownQuery(null);
          setDrillDownIndexes([]);

          setChart({
            labels: newData.map((item: Data) => item.data),
            values: newData.map((item: Data) => item.total),
          });
        } else {
          const parentIndexes = indexes.slice(0, -1);
          const parentDrillDownType =
            nextDrillType === "provinsi"
              ? "pulau"
              : nextDrillType === "kota"
                ? "provinsi"
                : nextDrillType === "kecamatan"
                  ? "kota"
                  : "kecamatan";

          setDrillDownLevel(parentDrillDownType);
          setOlapData({ query: parentItem.query });
          setSelectedLocation({
            lat: parentItem.query.lat ?? -2.5,
            lng: parentItem.query.lng ?? 118,
            ...parentItem.query,
          });
          handleSelection({
            wilayah: parentItem.data,
            lat: parentItem.query.lat,
            lng: parentItem.query.lng,
          });

          if (parentItem.child && parentItem.child.length > 0) {
            setChart({
              labels: parentItem.child.map((item: Data) => item.data),
              values: parentItem.child.map((item: Data) => item.total),
            });
          }
          getDrilldownData(
            parentIndexes,
            parentItem.query,
            parentDrillDownType,
          );
        }
      }
      return newData;
    });
  };

  const resetAllFilters = () => {
    setGlobalFilters({
      confidence: undefined,
      satelite: undefined,
      time: {},
      filterMode: undefined,
      selectedDate: undefined,
      province_code: undefined,
      city_code: undefined,
      district_code: undefined,
      subdistrict_code: undefined,
    });
    setDrillDownLevel("pulau");
    setMapBounds(null);
    setSelectedLocation(undefined);
    setMapKey(Date.now());
    hasFetched.current = false;

    setHotspotCountQuery({});
    setHotspotLocationsQuery({});

    setActiveMapLayer("hotspot-count");

    setDrillDownIndexes([]);

    setData((prevData) =>
      prevData.map((item) => ({
        ...item,
        isOpen: false,
        child: [],
      }))
    );
  };

  const memoizedFilters = useMemo(() => {
    if (activeMapLayer === "hotspot-locations") {
      return {
        selectedDate: undefined,
        filterMode: undefined,
        pulau: undefined,
        provinsi: undefined,
        kota: undefined,
        kecamatan: undefined,
        desa: undefined,
        confidence: undefined,
        satelite: undefined,
        time: {},
        province_code: undefined,
        city_code: undefined,
        district_code: undefined,
        subdistrict_code: undefined,
      };
    } else {
      return {
        confidence: globalFilters.confidence?.toLowerCase(),
        satelite: globalFilters.satelite?.toLowerCase(),
        time: globalFilters.time,
        filterMode: globalFilters.filterMode,
        selectedDate: globalFilters.selectedDate,
        province_code: globalFilters.province_code,
        city_code: globalFilters.city_code,
        district_code: globalFilters.district_code,
        subdistrict_code: globalFilters.subdistrict_code,
      };
    }
  }, [globalFilters, activeMapLayer]);

  const aggregatedChartData = useMemo(() => {
    if (!filteredHotspotData || filteredHotspotData.length === 0) return null;

    const counts: Record<string, number> = {};

    filteredHotspotData.forEach((feature) => {
      const location = feature.properties?.location as {
        pulau?: string;
        provinsi?: string;
        kab_kota?: string;
        kecamatan?: string;
        desa?: string;
        province_name?: string;
        city_name?: string;
        district_name?: string;
        subdistrict_name?: string;
      } | undefined;
      let key = "";

      switch (drillDownLevel) {
        case "pulau":
          key = location?.pulau || "Unknown";
          break;
        case "provinsi":
          key = location?.provinsi || location?.province_name || "Unknown";
          break;
        case "kota":
          key = location?.kab_kota || location?.city_name || "Unknown";
          break;
        case "kecamatan":
          key = location?.kecamatan || location?.district_name || "Unknown";
          break;
        case "desa":
          key = location?.desa || location?.subdistrict_name || "Unknown";
          break;
        default:
          key = location?.pulau || "Unknown";
      }

      if (key && key !== "Unknown") {
        counts[key] = (counts[key] || 0) + 1;
      }
    });

    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));

    return sorted.length > 0 ? sorted : null;
  }, [filteredHotspotData, drillDownLevel]);

  const hasActiveFilters = useMemo(() => {
    return (
      globalFilters.confidence ||
      globalFilters.satelite ||
      globalFilters.selectedDate ||
      Object.keys(globalFilters.time).length > 0 ||
      globalFilters.province_code ||
      globalFilters.city_code ||
      globalFilters.district_code
    );
  }, [globalFilters]);

  const displayChartData = useMemo((): ChartData<"bar"> | null => {
    if (activeMapLayer === "hotspot-count") {
      return barChartData;
    }

    if (hasActiveFilters) {
      if (aggregatedChartData && aggregatedChartData.length > 0) {
        const labels = aggregatedChartData.map((d) => d.name);
        const values = aggregatedChartData.map((d) => d.count);
        return {
          labels,
          datasets: [
            {
              data: values,
              label: "Titik Panas",
              backgroundColor: getBarColors(values),
            },
          ],
        };
      }
      return null;
    }
    return barChartData;
  }, [activeMapLayer, hasActiveFilters, aggregatedChartData, barChartData, getBarColors]);

  const openModalTime = (
    index: number[],
    query: QueryData,
    tipe: DrillDownLevel,
  ) => {
    if (activeMapLayer !== "hotspot-locations") {
      setModalTime({
        isOpen: true,
        index,
        query,
        tipe,
      });
    }
  };

  const closeModalTime = () => {
    setModalTime({
      isOpen: false,
      index: [],
      query: {},
      tipe: "pulau",
    });
  };

  const handleFilterTime = async (filterData: {
    data: QueryData;
    index: number[];
    tipe: DrillDownLevel;
  }) => {
    const timeFilters = {
      tahun: filterData.data.tahun || undefined,
      semester: filterData.data.semester || undefined,
      kuartal: filterData.data.kuartal || undefined,
      bulan: filterData.data.bulan || undefined,
      minggu: filterData.data.minggu || undefined,
      hari: filterData.data.hari || undefined,
    };

    setGlobalFilters((prev) => ({
      ...prev,
      time: timeFilters,
      filterMode: "period",
      selectedDate: undefined,
    }));

    if (activeMapLayer === "hotspot-count") {
      setHotspotCountQuery((prev) => ({
        ...prev,
        ...timeFilters,
        filterMode: "period",
      }));
    }
    closeModalTime();
  };

  const handleChartClick = useCallback(
    (event: ChartEvent, elements: InteractionItem[], chart: Chart) => {
      if (activeMapLayer !== "hotspot-locations" && elements.length > 0) {
        const index = elements[0].index;
        const label = chart.data.labels?.[index] as string;

        let selectedItem = null;

        const findItem = (items: Data[], name: string): Data | null => {
          for (const item of items) {
            if (item.data === name) return item;
            if (item.child && item.child.length > 0) {
              const found = findItem(item.child, name);
              if (found) return found;
            }
          }
          return null;
        };

        selectedItem = findItem(data, label);

        if (selectedItem) {
          const location = {
            lat: selectedItem.query.lat || -2.5,
            lng: selectedItem.query.lng || 118,
          };

          setSelectedLocation(location);

          if (selectedItem.query.desa) {
            setDrillDownLevel("desa");
          } else if (selectedItem.query.kecamatan) {
            setDrillDownLevel("kecamatan");
          } else if (selectedItem.query.kota) {
            setDrillDownLevel("kota");
          } else if (selectedItem.query.provinsi) {
            setDrillDownLevel("provinsi");
          } else {
            setDrillDownLevel("pulau");
          }
          setOlapData((prev) => ({
            ...prev,
            query: selectedItem?.query || {},
          }));
        }
      }
    },
    [activeMapLayer, data],
  );

  const barChartOptions: ChartOptions<"bar"> = useMemo(
    () => ({
      responsive: true,
      indexAxis: "x",
      scales: {
        x: {},
        y: {
          min: 0,
        },
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          enabled: true,
          mode: "index",
          intersect: false,
          callbacks: {
            label: function (tooltipItem) {
              setSelectedHotspot(tooltipItem.raw as number);
              return `Jumlah Hotspot: ${formatNumber(tooltipItem.raw as number)}`;
            },
          },
        },
        datalabels: {
          display: true,
          color: (context: any) => {
            const isDark = document.documentElement.classList.contains("dark");
            return isDark ? "#e5e7eb" : "#1f2937";
          },
          anchor: "end",
          align: "end",
          offset: 4,
          formatter: (value) => formatNumber(value),
          font: {
            weight: "bold",
            size: 9,
          },
          clamp: true,
        },
      },
      onClick: handleChartClick,
    }),
    [handleChartClick, setSelectedHotspot],
  );

  useEffect(() => {
    if (
      activeMapLayer === "hotspot-count" &&
      (globalFilters.selectedDate || Object.keys(globalFilters.time).length > 0)
    ) {
    }
  }, [activeMapLayer, globalFilters.selectedDate, globalFilters.time]);

  return (
    <div className="min-h-screen md:h-screen w-full flex flex-col bg-background">
      <ReactTooltip
        id="time-filter-info"
        className="!z-[1001] !max-w-[250px] !break-words !whitespace-pre-line"
      />
      <ReactTooltip
        id="date-filter-info"
        className="!z-[1001] !max-w-[250px] !break-words !whitespace-pre-line"
      />
      <ReactTooltip
        id="location-info"
        className="!z-[1001] !max-w-[250px] !break-words !whitespace-pre-line"
      />

      <div className="flex flex-1 flex-col md:flex-row md:overflow-hidden">
        <div
          className={`${
            activeMapLayer === "hotspot-locations"
              ? "!hidden"
              : "hidden md:flex"
          } md:w-[320px] lg:w-[360px] bg-background border-r border-border flex-col overflow-y-auto relative`}
          style={{ zIndex: 10 }}
        >
          <div className="p-4 border-b border-border bg-muted/50">
            <h2 className="text-lg font-bold text-foreground">Filters</h2>
          </div>

          <div
            className={`px-6 py-4 space-y-4 border-b border-border ${
              activeMapLayer === "hotspot-locations"
                ? "opacity-60 pointer-events-none"
                : ""
            }`}
          >
            <div className="space-y-2">
              <Label
                htmlFor="confidence-filter"
                className="text-sm font-medium flex items-center"
              >
                Confidence Level
              </Label>
              <Select
                value={globalFilters.confidence || "all"}
                onValueChange={(value) =>
                  setGlobalFilters({
                    ...globalFilters,
                    confidence: value === "all" ? undefined : value,
                  })
                }
                disabled={activeMapLayer === "hotspot-locations"}
              >
                <SelectTrigger id="confidence-filter" className="w-full">
                  <SelectValue placeholder="Semua Confidence" />
                </SelectTrigger>
                <SelectContent className="z-[9999] bg-popover">
                  <SelectItem value="all">Semua Confidence</SelectItem>
                  {dataConfidence &&
                    dataConfidence.map((conf: OlapData, i: number) => (
                      <SelectItem key={i} value={String(conf[0])}>
                        {String(conf[0])}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="satellite-filter" className="text-sm font-medium">
                Satellite
              </Label>
              <Select
                value={globalFilters.satelite || "all"}
                onValueChange={(value) =>
                  setGlobalFilters({
                    ...globalFilters,
                    satelite: value === "all" ? undefined : value,
                  })
                }
                disabled={activeMapLayer === "hotspot-locations"}
              >
                <SelectTrigger id="satellite-filter" className="w-full">
                  <SelectValue placeholder="Semua Satelit" />
                </SelectTrigger>
                <SelectContent className="z-[9999] bg-popover">
                  <SelectItem value="all">Semua Satelit</SelectItem>
                  {dataSatelite &&
                    dataSatelite.map((sat: OlapData, i: number) => (
                      <SelectItem key={i} value={String(sat[0])}>
                        {String(sat[0])}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="time-period-filter"
                className="text-sm font-medium flex items-center gap-1"
              >
                Filter Periode Waktu
                <span
                  className="text-muted-foreground cursor-help text-xs"
                  data-tooltip-id="time-filter-info"
                  data-tooltip-content="Pilih periode waktu (tahun, semester, kuartal, bulan, dan minggu) untuk melihat distribusi hotspot pada peta sesuai rentang waktu yang diinginkan."
                  data-tooltip-place="top"
                >
                  ⓘ
                </span>
              </Label>
              <Button
                id="time-period-filter"
                variant="outline"
                className="w-full justify-start text-left font-normal"
                onClick={() => openModalTime([], globalFilters.time, "pulau")}
                disabled={activeMapLayer === "hotspot-locations"}
              >
                {globalFilters.time.tahun ? (
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="font-semibold">
                      {globalFilters.time.tahun}
                    </span>
                    {globalFilters.time.semester && (
                      <>
                        <span className="text-muted-foreground mx-0.5">•</span>
                        <span>S{globalFilters.time.semester}</span>
                      </>
                    )}
                    {globalFilters.time.kuartal && (
                      <>
                        <span className="text-muted-foreground mx-0.5">•</span>
                        <span>{globalFilters.time.kuartal}</span>
                      </>
                    )}
                    {globalFilters.time.bulan && (
                      <>
                        <span className="text-muted-foreground mx-0.5">•</span>
                        <span>{globalFilters.time.bulan}</span>
                      </>
                    )}
                    {globalFilters.time.minggu && (
                      <>
                        <span className="text-muted-foreground mx-0.5">•</span>
                        <span>W{globalFilters.time.minggu}</span>
                      </>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground">
                    Pilih Periode Waktu
                  </span>
                )}
              </Button>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="date-specific-filter"
                className="text-sm font-medium flex items-center gap-1"
              >
                Filter Tanggal Spesifik
                <span
                  className="text-muted-foreground cursor-help text-xs"
                  data-tooltip-id="date-filter-info"
                  data-tooltip-content="Pilih tanggal spesifik untuk melihat persebaran jumlah data hotspot pada hari tersebut."
                  data-tooltip-place="top"
                >
                  ⓘ
                </span>
              </Label>
              <div className="relative z-50">
                <Popover
                  modal={true}
                  open={isDatePickerOpen}
                  onOpenChange={setIsDatePickerOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      id="date-specific-filter"
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !globalFilters.selectedDate && "text-muted-foreground",
                      )}
                      disabled={activeMapLayer === "hotspot-locations"}
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsDatePickerOpen(true);
                      }}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {globalFilters.selectedDate ? (
                        format(
                          new Date(globalFilters.selectedDate),
                          "d MMMM yyyy",
                          {
                            locale: id,
                          },
                        )
                      ) : (
                        <span>Pilih tanggal</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-auto p-0 z-[99999]"
                    align="start"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                    sideOffset={5}
                    style={{ pointerEvents: "auto" }}
                  >
                    <div
                      className="pointer-events-auto"
                      style={{ pointerEvents: "auto" }}
                    >
                      <Calendar
                        mode="single"
                        locale={idLocale}
                        selected={
                          globalFilters.selectedDate
                            ? new Date(globalFilters.selectedDate)
                            : undefined
                        }
                        onSelect={(date) => {
                          const dateString = date
                            ? format(date, "yyyy-MM-dd")
                            : undefined;
                          setGlobalFilters({
                            ...globalFilters,
                            selectedDate: dateString,
                            filterMode: dateString ? "date" : undefined,
                            time: dateString ? {} : globalFilters.time,
                          });
                          setHotspotCountQuery((prev) => ({
                            ...prev,
                            selectedDate: dateString,
                            filterMode: dateString ? "date" : undefined,
                          }));
                          setIsDatePickerOpen(false);
                        }}
                        disabled={(date) => date > new Date()}
                        autoFocus
                        className="pointer-events-auto"
                      />
                    </div>
                  </PopoverContent>
                </Popover>
                {globalFilters.selectedDate && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => {
                      setGlobalFilters({
                        ...globalFilters,
                        selectedDate: undefined,
                        filterMode: undefined,
                      });
                      setHotspotCountQuery((prev) => ({
                        ...prev,
                        selectedDate: undefined,
                        filterMode: undefined,
                      }));
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {globalFilters.selectedDate && (
                <p className="text-xs text-primary font-medium">
                  Filter aktif:{" "}
                  {new Date(globalFilters.selectedDate).toLocaleDateString(
                    "id-ID",
                    {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    },
                  )}
                </p>
              )}
            </div>

                        <Button
              variant="secondary"
              className="w-full"
              onClick={resetAllFilters}
            >
              Reset Semua Filter
            </Button>
          </div>

                    <div className="px-4 py-3 border-b border-border bg-muted/30">
            <Label className="text-base font-bold text-foreground flex items-center gap-1">
              Location
              <span
                className="text-muted-foreground cursor-help text-xs font-normal"
                data-tooltip-id="location-info"
                data-tooltip-content="Klik nama lokasi untuk melihat detail (drill down) dan klik nama lokasi level sebelumnya untuk kembali ke level sebelumnya (roll up)."
                data-tooltip-place="top"
              >
                ⓘ
              </span>
            </Label>
          </div>
          <div
            className={`flex-1 overflow-y-auto px-3 py-2 ${
              activeMapLayer === "hotspot-locations"
                ? "opacity-60 pointer-events-none"
                : ""
            }`}
          >
            {isLoading ? (
              <div className="flex flex-col justify-center items-center h-full">
                <FontAwesomeIcon
                  icon={faSpinner}
                  spin
                  size="2x"
                  className="text-gray-600 dark:text-gray-400 mb-2"
                />
              </div>
            ) : data && data.length > 0 ? (
              data.map((item, i) => (
                <div key={i} id={`location-item-${i}`} className="mb-3">
                                    <div className="bg-card border-l-4 border-blue-500 p-3 rounded-lg shadow-xs hover:shadow-sm transition-shadow">
                    <div className="flex justify-between items-center">
                      <span
                        className="font-semibold text-sm text-foreground cursor-pointer hover:text-blue-600 transition"
                        onClick={() => handleSelect(item, [i], "provinsi")}
                      >
                        {item.data}{" "}
                        <FontAwesomeIcon
                          icon={item.isOpen ? faChevronUp : faChevronDown}
                          className="ml-1 text-xs"
                        />
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-end">
                      <span className="text-muted-foreground text-xs font-medium bg-muted px-2 py-0.5 rounded">
                        Total: {formatNumber(item.total)}
                      </span>
                    </div>
                  </div>

                                    {item.isOpen &&
                    item.child &&
                    item.child.map((provinsi, j) => (
                      <div
                        key={j}
                        id={`location-item-${i}-${j}`}
                        className="mt-2 ml-4"
                      >
                        <div className="bg-card rounded-lg shadow-xs p-3 border-l-4 border-green-500 hover:shadow-sm transition">
                          <div className="flex justify-between items-center">
                            <span
                              className="font-semibold text-foreground text-sm cursor-pointer hover:text-blue-600 transition"
                              onClick={() =>
                                handleSelect(provinsi, [i, j], "kota")
                              }
                            >
                              {provinsi.data}{" "}
                              <FontAwesomeIcon
                                icon={
                                  provinsi.isOpen ? faChevronUp : faChevronDown
                                }
                                className="ml-1 text-xs"
                              />
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground truncate">
                            Pulau: {item.data}
                          </div>
                          <div className="mt-2 flex items-center justify-end">
                            <span className="text-foreground text-xs font-medium bg-muted px-2 py-0.5 rounded">
                              Total: {formatNumber(provinsi.total)}
                            </span>
                          </div>
                        </div>

                                                {provinsi.isOpen &&
                          provinsi.child &&
                          provinsi.child.map((kota, k) => (
                            <div
                              key={k}
                              id={`location-item-${i}-${j}-${k}`}
                              className="mt-2 ml-4"
                            >
                              <div className="bg-card rounded-lg shadow-xs p-3 border-l-4 border-yellow-500 hover:shadow-sm transition">
                                <div className="flex justify-between items-center">
                                  <span
                                    className="font-semibold text-foreground text-sm cursor-pointer hover:text-blue-600 transition"
                                    onClick={() =>
                                      handleSelect(kota, [i, j, k], "kecamatan")
                                    }
                                  >
                                    {kota.data}{" "}
                                    <FontAwesomeIcon
                                      icon={
                                        kota.isOpen
                                          ? faChevronUp
                                          : faChevronDown
                                      }
                                      className="ml-1 text-xs"
                                    />
                                  </span>
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground truncate">
                                  Pulau: {item.data} | Provinsi: {provinsi.data}
                                </div>
                                <div className="mt-2 flex items-center justify-end">
                                  <span className="text-foreground text-xs font-medium bg-muted px-2 py-0.5 rounded">
                                    Total: {formatNumber(kota.total)}
                                  </span>
                                </div>
                              </div>

                                                            {kota.isOpen &&
                                kota.child &&
                                kota.child.map((kecamatan, l) => (
                                  <div
                                    key={l}
                                    id={`location-item-${i}-${j}-${k}-${l}`}
                                    className="mt-2 ml-4"
                                  >
                                    <div className="bg-card rounded-lg shadow-xs p-3 border-l-4 border-purple-500 hover:shadow-sm transition">
                                      <div className="flex justify-between items-center">
                                        <span
                                          className="font-semibold text-foreground text-sm cursor-pointer hover:text-blue-600 transition"
                                          onClick={() =>
                                            handleSelect(
                                              kecamatan,
                                              [i, j, k, l],
                                              "desa",
                                            )
                                          }
                                        >
                                          {kecamatan.data}{" "}
                                          <FontAwesomeIcon
                                            icon={
                                              kecamatan.isOpen
                                                ? faChevronUp
                                                : faChevronDown
                                            }
                                            className="ml-1 text-xs"
                                          />
                                        </span>
                                      </div>
                                      <div className="mt-1 text-xs text-muted-foreground truncate">
                                        Pulau: {item.data} | Provinsi:{" "}
                                        {provinsi.data} | Kota: {kota.data}
                                      </div>
                                      <div className="mt-2 flex items-center justify-end">
                                        <span className="text-foreground text-xs font-medium bg-muted px-2 py-0.5 rounded">
                                          Total: {formatNumber(kecamatan.total)}
                                        </span>
                                      </div>
                                    </div>

                                                                        {kecamatan.isOpen &&
                                      kecamatan.child &&
                                      kecamatan.child.map((desa, m) => (
                                        <div
                                          key={m}
                                          id={`location-item-${i}-${j}-${k}-${l}-${m}`}
                                          className="mt-2 ml-4"
                                        >
                                          <div className="bg-card rounded-lg shadow-xs p-3 border-l-4 border-red-500 hover:shadow-sm transition">
                                            <div className="flex justify-between items-center">
                                              <span
                                                className="font-semibold text-foreground text-sm cursor-pointer hover:text-blue-600 transition"
                                                onClick={() => {
                                                  if (window.innerWidth < 768) {
                                                    setIsSidebarOpen(false);
                                                  }

                                                  handleSelection({
                                                    wilayah: desa.data,
                                                    lat: desa.query.lat,
                                                    lng: desa.query.lng,
                                                  });
                                                  setChart({
                                                    labels: [
                                                      desa.data.toString(),
                                                    ],
                                                    values: [desa.total],
                                                  });
                                                  setOlapData({
                                                    query: desa.query,
                                                  });
                                                  setDrillDownLevel("desa");
                                                }}
                                              >
                                                {desa.data}{" "}
                                              </span>
                                            </div>
                                            <div className="mt-1 text-xs text-muted-foreground truncate">
                                              Pulau: {item.data} | Provinsi:{" "}
                                              {provinsi.data} | Kota:{" "}
                                              {kota.data} | Kecamatan:{" "}
                                              {kecamatan.data}
                                            </div>
                                            <div className="mt-2 flex items-center justify-end">
                                              <span className="text-foreground text-xs font-medium bg-muted px-2 py-0.5 rounded">
                                                Total:{" "}
                                                {formatNumber(desa.total)}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                  </div>
                                ))}
                            </div>
                          ))}
                      </div>
                    ))}
                </div>
              ))
            ) : (
              <div className="flex flex-col justify-center items-center h-full">
                <p className="text-muted-foreground text-md">Tidak ada data</p>
              </div>
            )}
          </div>
        </div>

                <div
          className={`w-full flex flex-col md:overflow-hidden ${
            activeMapLayer === "hotspot-locations" ? "flex-1" : "md:flex-1"
          }`}
        >
                    <div
            className={`relative text-foreground flex-shrink-0 mt-4 md:mt-0 ${
              activeMapLayer === "hotspot-locations"
                ? "h-full flex-grow"
                : "h-[60vh] min-h-[400px] md:h-[65%]"
            }`}
          >
            <div className="w-full h-full">
              <Map
                key={mapKey}
                bounds={mapBounds ?? undefined}
                selectedLocation={selectedLocation}
                olapData={
                  activeMapLayer === "hotspot-locations"
                    ? { query: hotspotLocationsQuery }
                    : { query: olapData.query }
                }
                locationData={
                  drillDownIndexes.length > 0
                    ? (Object.keys(locationFilters).length > 0
                        ? (filteredDrillDownData as [string, number][])
                        : (drillDownData as [string, number][]))
                    : (filteredData && Array.isArray(filteredData) && filteredData.length > 0
                        ? (filteredData as [string, number][])
                        : (locationQueryData as [string, number][]))
                }
                drillDownLevel={drillDownLevel}
                onDrillDownChange={handleDrillDownChange}
                onLayerChange={(layer) => {
                  setActiveMapLayer(layer);
                  if (layer === "hotspot-locations") {
                    setIsSidebarOpen(false);
                    setHotspotLocationsQuery({});
                  } else {
                    setHotspotCountQuery(olapData.query || {});
                  }
                }}
                activeLayer={activeMapLayer}
                className=""
                style={{
                  height: "100%",
                  width: "100%",
                  margin: 0,
                  padding: 0,
                }}
                filters={memoizedFilters}
                defaultZoom={
                  isMobile ? 13 : activeMapLayer === "hotspot-locations" ? 5 : 4
                }
                onHotspotDataChange={handleHotspotDataChange}
                onLoadingChange={handleLoadingChange}
              />
            </div>
          </div>

                    <div
            className={`${isChartCollapsed ? "h-[52px]" : "h-[280px] md:h-[35%]"} bg-card border-t-2 border-border flex-shrink-0 mt-0 transition-all duration-300
            ${activeMapLayer === "hotspot-locations" ? "hidden" : ""}`}
          >
            <div className="h-full p-3 md:p-6 flex flex-col">
              <div className="flex justify-between items-center mb-3 relative">
                <h2 className="font-semibold text-card-foreground text-lg">
                  Persebaran Jumlah Hotspot
                </h2>
                <div className="flex items-center space-x-2">
                  {!isChartCollapsed && (
                    <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-xs font-medium">
                      {drillDownLevel
                        ? `Level: ${
                            drillDownLevel === "kota"
                              ? "Kabupaten/Kota"
                              : drillDownLevel.charAt(0).toUpperCase() +
                                drillDownLevel.slice(1)
                          }`
                        : "Level: Nasional"}
                    </span>
                  )}
                  <button
                    onClick={() => setIsChartCollapsed(!isChartCollapsed)}
                    className="text-muted-foreground hover:text-foreground hover:bg-muted transition-colors p-2 rounded-md border border-border md:hidden"
                    aria-label={
                      isChartCollapsed ? "Expand chart" : "Collapse chart"
                    }
                  >
                    <FontAwesomeIcon
                      icon={isChartCollapsed ? faChevronDown : faChevronUp}
                      className="w-4 h-4"
                    />
                  </button>
                </div>
              </div>
              {!isChartCollapsed && (
                <div className="flex-1 min-h-0 relative">
                  {isLoading ? (
                    <div className="min-h-full flex flex-col justify-center items-center bg-muted/30">
                      <FontAwesomeIcon
                        icon={faSpinner}
                        spin
                        size="3x"
                        className="text-gray-600 dark:text-gray-400 mb-4"
                      />
                    </div>
                  ) : !displayChartData ||
                    !displayChartData.labels ||
                    displayChartData.labels.length === 0 ? (
                    <div className="min-h-full flex flex-col justify-center items-center bg-muted/30">
                      <p className="text-muted-foreground text-md">
                        Tidak ada data
                      </p>
                    </div>
                  ) : (
                    <div className="relative h-full">
                      <Bar
                        data={displayChartData}
                        options={{
                          ...barChartOptions,
                          maintainAspectRatio: false,
                          responsive: true,
                          onClick:
                            activeMapLayer === "hotspot-locations"
                              ? undefined
                              : handleChartClick,
                          plugins: {
                            legend: {
                              position: "top",
                              labels: {
                                font: {
                                  size: 11,
                                },
                                boxWidth: 12,
                                color:
                                  activeMapLayer === "hotspot-locations"
                                    ? "#999999"
                                    : undefined,
                              },
                            },
                            tooltip: {
                              enabled: activeMapLayer !== "hotspot-locations",
                              bodyFont: {
                                size: 11,
                              },
                              titleFont: {
                                size: 12,
                              },
                              callbacks: {
                                label: function (
                                  tooltipItem: TooltipItem<"bar">,
                                ) {
                                  setSelectedHotspot(tooltipItem.raw as number);
                                  return `Jumlah Hotspot: ${formatNumber(
                                    tooltipItem.raw as number,
                                  )}`;
                                },
                              },
                            },

                            datalabels: {
                              display: true,
                              color: (context: any) => {
                                const isDark =
                                  document.documentElement.classList.contains(
                                    "dark",
                                  );
                                return isDark ? "#e5e7eb" : "#1f2937";
                              },
                              anchor: "end",
                              align: "end",
                              offset: 1,
                              formatter: (value) => formatNumber(value),
                              font: {
                                weight: "bold",
                                size: 10,
                              },
                              clamp: true,
                            },
                          },
                          scales: {
                            x: {
                              grid: {
                                display: false,
                              },
                              ticks: {
                                font: {
                                  size: 10,
                                },
                                color:
                                  activeMapLayer === "hotspot-locations"
                                    ? "#999999"
                                    : undefined,
                              },
                            },
                            y: {
                              ticks: {
                                font: {
                                  size: 10,
                                },
                                precision: 0,
                                color:
                                  activeMapLayer === "hotspot-locations"
                                    ? "#999999"
                                    : undefined,
                                callback: function (value) {
                                  return value.toLocaleString("id-ID");
                                },
                              },
                            },
                          },
                        }}
                      />
                    </div>
                  )}

                                    {effectiveMapLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg z-10">
                      <div className="bg-white dark:bg-gray-800 rounded-lg px-6 py-4 flex items-center gap-3 shadow-lg">
                        <RefreshCw
                          width="24"
                          height="24"
                          className="text-primary animate-spin"
                        />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Memuat data...
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

                    <div
            className={`md:hidden bg-background border-t-2 border-border flex-shrink-0 min-h-[400px] ${
              activeMapLayer === "hotspot-locations" ? "hidden" : ""
            }`}
          >
                        <div className="px-4 py-3 border-b border-border bg-muted/50">
              <h2 className="text-base font-bold text-foreground">Filters</h2>
            </div>

                        <div className="px-4 py-4 space-y-4 border-b border-border">
                            <div className="space-y-2">
                <Label
                  htmlFor="confidence-filter-mobile"
                  className="text-sm font-medium flex items-center"
                >
                  Confidence Level
                </Label>
                <Select
                  value={globalFilters.confidence || "all"}
                  onValueChange={(value) =>
                    setGlobalFilters({
                      ...globalFilters,
                      confidence: value === "all" ? undefined : value,
                    })
                  }
                >
                  <SelectTrigger
                    id="confidence-filter-mobile"
                    className="w-full"
                  >
                    <SelectValue placeholder="Semua Confidence" />
                  </SelectTrigger>
                  <SelectContent className="z-[9999] bg-popover">
                    <SelectItem value="all">Semua Confidence</SelectItem>
                    {dataConfidence &&
                      dataConfidence.map((conf: OlapData, i: number) => (
                        <SelectItem key={i} value={String(conf[0])}>
                          {String(conf[0])}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

                            <div className="space-y-2">
                <Label
                  htmlFor="satellite-filter-mobile"
                  className="text-sm font-medium"
                >
                  Satellite
                </Label>
                <Select
                  value={globalFilters.satelite || "all"}
                  onValueChange={(value) =>
                    setGlobalFilters({
                      ...globalFilters,
                      satelite: value === "all" ? undefined : value,
                    })
                  }
                >
                  <SelectTrigger
                    id="satellite-filter-mobile"
                    className="w-full"
                  >
                    <SelectValue placeholder="Semua Satelit" />
                  </SelectTrigger>
                  <SelectContent className="z-[9999] bg-popover">
                    <SelectItem value="all">Semua Satelit</SelectItem>
                    {dataSatelite &&
                      dataSatelite.map((sat: OlapData, i: number) => (
                        <SelectItem key={i} value={String(sat[0])}>
                          {String(sat[0])}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

                            <div className="space-y-2">
                <Label
                  htmlFor="time-period-filter-mobile"
                  className="text-sm font-medium flex items-center gap-1"
                >
                  Filter Periode Waktu
                  <span
                    className="text-muted-foreground cursor-help text-xs"
                    data-tooltip-id="time-filter-info"
                    data-tooltip-content="Pilih periode waktu (tahun, semester, kuartal, bulan, dan minggu) untuk melihat distribusi hotspot pada peta sesuai rentang waktu yang diinginkan."
                    data-tooltip-place="top"
                  >
                    ⓘ
                  </span>
                </Label>
                <Button
                  id="time-period-filter-mobile"
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                  onClick={() => openModalTime([], globalFilters.time, "pulau")}
                >
                  {globalFilters.time.tahun ? (
                    <div className="flex items-center gap-1.5 text-sm">
                      <span className="font-semibold">
                        {globalFilters.time.tahun}
                      </span>
                      {globalFilters.time.semester && (
                        <>
                          <span className="text-muted-foreground mx-0.5">
                            •
                          </span>
                          <span>S{globalFilters.time.semester}</span>
                        </>
                      )}
                      {globalFilters.time.kuartal && (
                        <>
                          <span className="text-muted-foreground mx-0.5">
                            •
                          </span>
                          <span>{globalFilters.time.kuartal}</span>
                        </>
                      )}
                      {globalFilters.time.bulan && (
                        <>
                          <span className="text-muted-foreground mx-0.5">
                            •
                          </span>
                          <span>{globalFilters.time.bulan}</span>
                        </>
                      )}
                      {globalFilters.time.minggu && (
                        <>
                          <span className="text-muted-foreground mx-0.5">
                            •
                          </span>
                          <span>W{globalFilters.time.minggu}</span>
                        </>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">
                      Pilih Periode Waktu
                    </span>
                  )}
                </Button>
              </div>

                            <div className="space-y-2">
                <Label
                  htmlFor="date-specific-filter-mobile"
                  className="text-sm font-medium flex items-center gap-1"
                >
                  Filter Tanggal Spesifik
                  <span
                    className="text-muted-foreground cursor-help text-xs"
                    data-tooltip-id="date-filter-info"
                    data-tooltip-content="Pilih tanggal spesifik untuk melihat persebaran jumlah data hotspot pada hari tersebut."
                    data-tooltip-place="top"
                  >
                    ⓘ
                  </span>
                </Label>
                <div className="relative z-50">
                  <Popover
                    modal={true}
                    open={isDatePickerOpenMobile}
                    onOpenChange={setIsDatePickerOpenMobile}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        id="date-specific-filter-mobile"
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !globalFilters.selectedDate &&
                            "text-muted-foreground",
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsDatePickerOpenMobile(true);
                        }}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {globalFilters.selectedDate ? (
                          format(
                            new Date(globalFilters.selectedDate),
                            "d MMMM yyyy",
                            {
                              locale: id,
                            },
                          )
                        ) : (
                          <span>Pilih tanggal</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto p-0 z-[99999]"
                      align="start"
                      onOpenAutoFocus={(e) => e.preventDefault()}
                      sideOffset={5}
                      style={{ pointerEvents: "auto" }}
                    >
                      <div
                        className="pointer-events-auto"
                        style={{ pointerEvents: "auto" }}
                      >
                        <Calendar
                          mode="single"
                          locale={idLocale}
                          selected={
                            globalFilters.selectedDate
                              ? new Date(globalFilters.selectedDate)
                              : undefined
                          }
                          onSelect={(date) => {
                            const dateString = date
                              ? format(date, "yyyy-MM-dd")
                              : undefined;
                            setGlobalFilters({
                              ...globalFilters,
                              selectedDate: dateString,
                              filterMode: dateString ? "date" : undefined,
                              time: dateString ? {} : globalFilters.time,
                            });
                            setHotspotCountQuery((prev) => ({
                              ...prev,
                              selectedDate: dateString,
                              filterMode: dateString ? "date" : undefined,
                            }));
                            setIsDatePickerOpenMobile(false);
                          }}
                          disabled={(date) => date > new Date()}
                          autoFocus
                          className="pointer-events-auto"
                        />
                      </div>
                    </PopoverContent>
                  </Popover>
                  {globalFilters.selectedDate && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={() => {
                        setGlobalFilters({
                          ...globalFilters,
                          selectedDate: undefined,
                          filterMode: undefined,
                        });
                        setHotspotCountQuery((prev) => ({
                          ...prev,
                          selectedDate: undefined,
                          filterMode: undefined,
                        }));
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {globalFilters.selectedDate && (
                  <p className="text-xs text-primary font-medium">
                    Filter aktif:{" "}
                    {new Date(globalFilters.selectedDate).toLocaleDateString(
                      "id-ID",
                      {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      },
                    )}
                  </p>
                )}
              </div>

                            <Button
                variant="secondary"
                className="w-full"
                onClick={resetAllFilters}
              >
                Reset Semua Filter
              </Button>
            </div>

                        <div className="px-4 py-3 border-b border-border bg-muted/30">
              <Label className="text-base font-bold text-foreground flex items-center gap-1">
                Location
                <span
                  className="text-muted-foreground cursor-help text-xs font-normal"
                  data-tooltip-id="location-info"
                  data-tooltip-content="Klik nama lokasi untuk melihat detail (drill down) dan klik nama lokasi level sebelumnya untuk kembali ke level sebelumnya (roll up)."
                  data-tooltip-place="top"
                >
                  ⓘ
                </span>
              </Label>
            </div>
            <div className="px-3 py-2">
              {isLoading ? (
                <div className="flex flex-col justify-center items-center h-32">
                  <FontAwesomeIcon
                    icon={faSpinner}
                    spin
                    size="2x"
                    className="text-gray-600 dark:text-gray-400 mb-2"
                  />
                </div>
              ) : data && data.length > 0 ? (
                data.map((item, i) => (
                  <div
                    key={i}
                    id={`location-item-mobile-${i}`}
                    className="mb-3"
                  >
                                        <div className="bg-card border-l-4 border-blue-500 p-3 rounded-lg shadow-xs hover:shadow-sm transition-shadow">
                      <div className="flex justify-between items-center">
                        <span
                          className="font-semibold text-sm text-foreground cursor-pointer hover:text-blue-600 transition"
                          onClick={() => handleSelect(item, [i], "provinsi")}
                        >
                          {item.data}{" "}
                          <FontAwesomeIcon
                            icon={item.isOpen ? faChevronUp : faChevronDown}
                            className="ml-1 text-xs"
                          />
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-end">
                        <span className="text-muted-foreground text-xs font-medium bg-muted px-2 py-0.5 rounded">
                          Total: {formatNumber(item.total)}
                        </span>
                      </div>
                    </div>

                                        {item.isOpen &&
                      item.child &&
                      item.child.map((provinsi, j) => (
                        <div
                          key={j}
                          id={`location-item-mobile-${i}-${j}`}
                          className="mt-2 ml-4"
                        >
                          <div className="bg-card rounded-lg shadow-xs p-3 border-l-4 border-green-500 hover:shadow-sm transition">
                            <div className="flex justify-between items-center">
                              <span
                                className="font-semibold text-foreground text-sm cursor-pointer hover:text-blue-600 transition"
                                onClick={() =>
                                  handleSelect(provinsi, [i, j], "kota")
                                }
                              >
                                {provinsi.data}{" "}
                                <FontAwesomeIcon
                                  icon={
                                    provinsi.isOpen
                                      ? faChevronUp
                                      : faChevronDown
                                  }
                                  className="ml-1 text-xs"
                                />
                              </span>
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground truncate">
                              Pulau: {item.data}
                            </div>
                            <div className="mt-2 flex items-center justify-end">
                              <span className="text-foreground text-xs font-medium bg-muted px-2 py-0.5 rounded">
                                Total: {formatNumber(provinsi.total)}
                              </span>
                            </div>
                          </div>

                                                    {provinsi.isOpen &&
                            provinsi.child &&
                            provinsi.child.map((kota, k) => (
                              <div
                                key={k}
                                id={`location-item-mobile-${i}-${j}-${k}`}
                                className="mt-2 ml-4"
                              >
                                <div className="bg-card rounded-lg shadow-xs p-3 border-l-4 border-yellow-500 hover:shadow-sm transition">
                                  <div className="flex justify-between items-center">
                                    <span
                                      className="font-semibold text-foreground text-sm cursor-pointer hover:text-blue-600 transition"
                                      onClick={() =>
                                        handleSelect(
                                          kota,
                                          [i, j, k],
                                          "kecamatan",
                                        )
                                      }
                                    >
                                      {kota.data}{" "}
                                      <FontAwesomeIcon
                                        icon={
                                          kota.isOpen
                                            ? faChevronUp
                                            : faChevronDown
                                        }
                                        className="ml-1 text-xs"
                                      />
                                    </span>
                                  </div>
                                  <div className="mt-1 text-xs text-muted-foreground truncate">
                                    Pulau: {item.data} | Provinsi:{" "}
                                    {provinsi.data}
                                  </div>
                                  <div className="mt-2 flex items-center justify-end">
                                    <span className="text-foreground text-xs font-medium bg-muted px-2 py-0.5 rounded">
                                      Total: {formatNumber(kota.total)}
                                    </span>
                                  </div>
                                </div>

                                                                {kota.isOpen &&
                                  kota.child &&
                                  kota.child.map((kecamatan, l) => (
                                    <div
                                      key={l}
                                      id={`location-item-mobile-${i}-${j}-${k}-${l}`}
                                      className="mt-2 ml-4"
                                    >
                                      <div className="bg-card rounded-lg shadow-xs p-3 border-l-4 border-purple-500 hover:shadow-sm transition">
                                        <div className="flex justify-between items-center">
                                          <span
                                            className="font-semibold text-foreground text-sm cursor-pointer hover:text-blue-600 transition"
                                            onClick={() =>
                                              handleSelect(
                                                kecamatan,
                                                [i, j, k, l],
                                                "desa",
                                              )
                                            }
                                          >
                                            {kecamatan.data}{" "}
                                            <FontAwesomeIcon
                                              icon={
                                                kecamatan.isOpen
                                                  ? faChevronUp
                                                  : faChevronDown
                                              }
                                              className="ml-1 text-xs"
                                            />
                                          </span>
                                        </div>
                                        <div className="mt-1 text-xs text-muted-foreground truncate">
                                          Pulau: {item.data} | Provinsi:{" "}
                                          {provinsi.data} | Kota: {kota.data}
                                        </div>
                                        <div className="mt-2 flex items-center justify-end">
                                          <span className="text-foreground text-xs font-medium bg-muted px-2 py-0.5 rounded">
                                            Total:{" "}
                                            {formatNumber(kecamatan.total)}
                                          </span>
                                        </div>
                                      </div>

                                                                            {kecamatan.isOpen &&
                                        kecamatan.child &&
                                        kecamatan.child.map((desa, m) => (
                                          <div
                                            key={m}
                                            id={`location-item-mobile-${i}-${j}-${k}-${l}-${m}`}
                                            className="mt-2 ml-4"
                                          >
                                            <div className="bg-card rounded-lg shadow-xs p-3 border-l-4 border-red-500 hover:shadow-sm transition">
                                              <div className="flex justify-between items-center">
                                                <span
                                                  className="font-semibold text-foreground text-sm cursor-pointer hover:text-blue-600 transition"
                                                  onClick={() => {
                                                    if (
                                                      window.innerWidth < 768
                                                    ) {
                                                      setIsSidebarOpen(false);
                                                    }

                                                    handleSelection({
                                                      wilayah: desa.data,
                                                      lat: desa.query.lat,
                                                      lng: desa.query.lng,
                                                    });
                                                    setChart({
                                                      labels: [
                                                        desa.data.toString(),
                                                      ],
                                                      values: [desa.total],
                                                    });
                                                    setOlapData({
                                                      query: desa.query,
                                                    });
                                                    setDrillDownLevel("desa");
                                                  }}
                                                >
                                                  {desa.data}{" "}
                                                </span>
                                              </div>
                                              <div className="mt-1 text-xs text-muted-foreground truncate">
                                                Pulau: {item.data} | Provinsi:{" "}
                                                {provinsi.data} | Kota:{" "}
                                                {kota.data} | Kecamatan:{" "}
                                                {kecamatan.data}
                                              </div>
                                              <div className="mt-2 flex items-center justify-end">
                                                <span className="text-foreground text-xs font-medium bg-muted px-2 py-0.5 rounded">
                                                  Total:{" "}
                                                  {formatNumber(desa.total)}
                                                </span>
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                    </div>
                                  ))}
                              </div>
                            ))}
                        </div>
                      ))}
                  </div>
                ))
              ) : (
                <div className="flex flex-col justify-center items-center h-32">
                  <p className="text-muted-foreground text-md">
                    Tidak ada data
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

            {modalTime.isOpen && activeMapLayer !== "hotspot-locations" && (
        <ModalTime
          query={modalTime.query}
          value={modalTime.query.point || ""}
          index={modalTime.index}
          tipe={modalTime.tipe}
          onSelect={handleFilterTime}
          onClose={closeModalTime}
        />
      )}
    </div>
  );
};

export default OlapComponent;
