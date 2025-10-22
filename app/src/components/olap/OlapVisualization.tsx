import Map from "@/components/map/MapComponent";
import ModalTime from "@/components/map/TimeFilterModal";
import L from "leaflet";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { IChart, QueryData } from "@/core/models/query";
import type { DrillDownLevel, LocationData } from "@/core/models/location";
import { OlapService } from "@/core/services/olapService";
import useSWR from "swr";
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
import { CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
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

const USE_MOCK_DATA = true;

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

const fetcher = async (url: string) => {
  if (USE_MOCK_DATA) {
    if (url.includes("/api/location")) {
      return MOCK_ALL_LOCATIONS;
    }
    return {};
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("An error occurred while fetching the data.");
  }
  return response.json();
};

const olapFetcher = async ([endpoint, params]: [string, QueryData]) => {
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
  return await OlapService.query(endpoint, params);
};

const OlapComponent = () => {
  const hasFetched = useRef(false);
  const scrollTargetId = useRef<string | null>(null);
  const [mapKey, setMapKey] = useState(Date.now());
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [mapBounds, setMapBounds] = useState<L.LatLngBoundsExpression | null>(
    null,
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

  const { data: olapApiData } = useSWR(
    `${import.meta.env.PUBLIC_API_URL}/api/hotspot`,
    fetcher,
    { revalidateOnFocus: false },
  );

  const { data: locationApiData } = useSWR(
    `${import.meta.env.PUBLIC_API_URL}/api/location`,
    fetcher,
    { revalidateOnFocus: false },
  );

  const locationQueryParams = useMemo(() => {
    return { dimension: "location" };
  }, []);

  const { data: locationQueryData, isLoading: isLocationLoading } = useSWR(
    hasFetched.current ? null : ["location", locationQueryParams],
    olapFetcher,
    { revalidateOnFocus: false },
  );

  const confidenceQueryParams = useMemo(() => {
    return { dimension: "confidence" };
  }, []);

  const { data: confidenceQueryData } = useSWR(
    ["confidence", confidenceQueryParams],
    olapFetcher,
    { revalidateOnFocus: false },
  );

  const satelliteQueryParams = useMemo(() => {
    return { dimension: "satelite" };
  }, []);

  const { data: satelliteQueryData } = useSWR(
    ["satelite", satelliteQueryParams],
    olapFetcher,
    { revalidateOnFocus: false },
  );

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

  const { data: filteredData, isLoading: isFilteredLoading } = useSWR(
    hasFetched.current || Object.keys(olapData.query || {}).length > 0
      ? ["location", filteredQueryParams]
      : null,
    olapFetcher,
    { revalidateOnFocus: false },
  );

  const { data: drillDownData, isLoading: isDrillDownLoading } = useSWR(
    drillDownQuery ? ["location", drillDownQuery] : null,
    olapFetcher,
    { revalidateOnFocus: false },
  );

  const calculateThresholds = useCallback((values: number[]) => {
    const filteredValues = values.filter((val) => val > 0);
    const min = filteredValues.length > 0 ? Math.min(...filteredValues) : 0;
    const max = filteredValues.length > 0 ? Math.max(...filteredValues) : 1;

    let threshold1, threshold2;
    if (max - min < 3) {
      const step = Math.ceil((max - min) / 3) || 1;
      threshold1 = min + step;
      threshold2 = min + step * 2;
    } else {
      const range = max - min;
      threshold1 = min + range / 3;
      threshold2 = min + (range * 2) / 3;
    }

    return { min, threshold1, threshold2, max };
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
    if (olapApiData) {
      setOlapData(olapApiData);
    }
  }, [olapApiData]);

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
      const chart: IChart = {
        labels: [],
        values: [],
      };

      const newData: Data[] = [];
      (locationQueryData as [string, number][]).forEach((d) => {
        chart.labels.push(d[0]);
        chart.values.push(d[1]);

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
      setChart(chart);
      hasFetched.current = true;
    }
  }, [locationQueryData, setChart]);

  useEffect(() => {
    if (confidenceQueryData) {
      setDataConfidence(confidenceQueryData as OlapData[]);
    }
  }, [confidenceQueryData]);

  useEffect(() => {
    if (satelliteQueryData) {
      setDataSatelite(satelliteQueryData as OlapData[]);
    }
  }, [satelliteQueryData]);

  useEffect(() => {
    if (filteredData && hasFetched.current) {
      setDrillDownQuery(null);
      setDrillDownIndexes([]);
      const chart: IChart = {
        labels: [],
        values: [],
      };

      const newData: Data[] = [];
      if (Array.isArray(filteredData) && filteredData.length > 0) {
        (filteredData as [string, number][]).forEach((d) => {
          if (!Array.isArray(d) || d.length < 2) {
            return;
          }

          chart.labels.push(d[0]);
          chart.values.push(d[1]);

          newData.push({
            data: d[0],
            total: d[1],
            modal: false,
            query: {
              pulau: d[0],
              ...filteredQueryParams,
            },
            child: [],
            isOpen: false,
          });
        });
      }

      setData(newData);
      setChart(chart);
    }
  }, [filteredData, filteredQueryParams, setChart]);

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

      setChart(chart);
    }
  }, [
    drillDownData,
    allLocationData,
    drillDownIndexes,
    drillDownQuery,
    setChart,
  ]);

  useEffect(() => {
    setIsLoading(isLocationLoading || isFilteredLoading || isDrillDownLoading);
  }, [isLocationLoading, isFilteredLoading, isDrillDownLoading]);

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
            break;
          case "kota":
            queryForDrill.provinsi = itemClicked.data.toString();
            break;
          case "kecamatan":
            queryForDrill.kota = itemClicked.data.toString();
            break;
          case "desa":
            queryForDrill.kecamatan = itemClicked.data.toString();
            break;
        }
        getDrilldownData(indexes, queryForDrill, nextDrillType);

        setOlapData({ query: queryForDrill });
        setHotspotCountQuery(queryForDrill);
        setDrillDownLevel(nextDrillType);
        setMapBounds(null); // Reset bounds
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
    });
    setDrillDownLevel("pulau");
    setMapBounds(null);
    setSelectedLocation(undefined);
    setMapKey(Date.now());
    hasFetched.current = false;

    setHotspotCountQuery({});
    setHotspotLocationsQuery({});

    setActiveMapLayer("hotspot-count");
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
      };
    } else {
      return {
        confidence: globalFilters.confidence?.toLowerCase(),
        satelite: globalFilters.satelite?.toLowerCase(),
        time: globalFilters.time,
        filterMode: globalFilters.filterMode,
        selectedDate: globalFilters.selectedDate,
      };
    }
  }, [globalFilters, activeMapLayer]);

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
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
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

      <div className="flex flex-1 flex-col md:flex-row overflow-hidden mt-16">
        {/* Sidebar */}
        <div
          className={`${isSidebarOpen ? "block" : "hidden"} ${
            activeMapLayer === "hotspot-locations" ? "!hidden" : "md:block"
          } w-full md:w-[320px] lg:w-[360px] bg-background border-r border-border flex flex-col overflow-y-auto shadow-sm`}
        >
          {/* FILTERS */}

          {/* FILTERS HEADER */}
          <div className="p-4 border-b border-border bg-muted/50">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-foreground">Filters</h2>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setIsSidebarOpen(false)}
                aria-label="Tutup Panel"
              >
                <FontAwesomeIcon
                  icon={faXmark}
                  className="text-muted-foreground"
                />
              </Button>
            </div>
          </div>

          {/* FILTERS CONTENT */}
          <div
            className={`px-6 py-4 space-y-4 border-b border-border ${
              activeMapLayer === "hotspot-locations"
                ? "opacity-60 pointer-events-none"
                : ""
            }`}
          >
            {/* Confidence Level */}
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

            {/* Satellite */}
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

            {/* Filter Periode Waktu */}
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
                onClick={() => openModalTime([], {}, "pulau")}
                disabled={activeMapLayer === "hotspot-locations"}
              >
                {globalFilters.time.tahun ? (
                  <div className="flex flex-col items-start w-full">
                    <div className="font-semibold text-sm">
                      {globalFilters.time.tahun}
                    </div>
                    <div className="flex flex-wrap gap-1 text-xs text-muted-foreground mt-1">
                      {globalFilters.time.semester && (
                        <span className="bg-muted px-1.5 py-0.5 rounded">
                          Semester {globalFilters.time.semester}
                        </span>
                      )}
                      {globalFilters.time.kuartal && (
                        <span className="bg-muted px-1.5 py-0.5 rounded">
                          Kuartal {globalFilters.time.kuartal}
                        </span>
                      )}
                      {globalFilters.time.bulan && (
                        <span className="bg-muted px-1.5 py-0.5 rounded">
                          Bulan {globalFilters.time.bulan}
                        </span>
                      )}
                      {globalFilters.time.minggu && (
                        <span className="bg-muted px-1.5 py-0.5 rounded">
                          Minggu {globalFilters.time.minggu}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <span className="text-muted-foreground">
                    Pilih Periode Waktu
                  </span>
                )}
              </Button>
            </div>

            {/* Filter Tanggal Spesifik */}
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
              <div className="relative">
                <Popover
                  modal={false}
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
                    className="w-auto p-0"
                    align="start"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                  >
                    <Calendar
                      mode="single"
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
                      initialFocus
                      className="pointer-events-auto"
                    />
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

            {/* Reset Button */}
            <Button
              variant="secondary"
              className="w-full"
              onClick={resetAllFilters}
            >
              Reset Semua Filter
            </Button>
          </div>

          {/* Location List */}
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
                  className="text-gray-600 mb-2"
                />
              </div>
            ) : data && data.length > 0 ? (
              data.map((item, i) => (
                <div key={i} id={`location-item-${i}`} className="mb-3">
                  {/* Pulau */}
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

                  {/* Provinsi */}
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

                        {/* Kota */}
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

                              {/* Kecamatan */}
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

                                    {/* Desa */}
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

        {/* Right Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Map Section */}
          <div
            className={`relative text-foreground ${
              activeMapLayer === "hotspot-locations"
                ? "h-full flex-grow"
                : "h-[55vh] md:h-[65%]"
            }`}
          >
            <div className="absolute inset-0">
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
                  drillDownData && drillDownIndexes.length > 0
                    ? (drillDownData as [string, number][])
                    : filteredData && hasFetched.current
                      ? (filteredData as [string, number][])
                      : (locationQueryData as [string, number][])
                }
                drillDownLevel={drillDownLevel}
                onDrillDownChange={handleDrillDownChange}
                onLayerChange={(layer) => {
                  setActiveMapLayer(layer);
                  if (layer === "hotspot-locations") {
                    setIsSidebarOpen(false);
                    setHotspotLocationsQuery({});
                  } else {
                    if (window.innerWidth < 768) {
                      setIsSidebarOpen(true);
                    }
                    setHotspotCountQuery(olapData.query || {});
                  }
                }}
                className={`${
                  activeMapLayer === "hotspot-locations" ? "h-full w-full" : ""
                }`}
                style={{
                  height: "100%",
                  width: "100%",
                  margin: 0,
                  padding: 0,
                }}
                filters={memoizedFilters}
                defaultZoom={activeMapLayer === "hotspot-locations" ? 5 : 4}
              />
              <Button
                size="icon"
                className="md:hidden absolute bottom-3 right-3 z-[500] rounded-full w-10 h-10 shadow-md"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                aria-label={
                  isSidebarOpen ? "Sembunyikan Panel" : "Tampilkan Panel"
                }
              >
                <FontAwesomeIcon
                  icon={isSidebarOpen ? faAngleLeft : faAngleRight}
                  className="text-sm"
                />
              </Button>
            </div>
          </div>

          {/* Chart Section */}
          <div
            className={`h-[45vh] md:h-[35%] bg-card border-t border-border z-20 overflow-hidden
            ${activeMapLayer === "hotspot-locations" ? "hidden" : ""}`}
          >
            {" "}
            <div className="h-full p-4 md:p-6 flex flex-col">
              <div className="flex justify-between items-center mb-3">
                <h2 className="font-semibold text-card-foreground text-lg">
                  Hotspot Chart
                </h2>
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                    {drillDownLevel
                      ? `Level: ${
                          drillDownLevel === "kota"
                            ? "Kabupaten/Kota"
                            : drillDownLevel.charAt(0).toUpperCase() +
                              drillDownLevel.slice(1)
                        }`
                      : "Level: Nasional"}
                  </span>
                </div>
              </div>
              <div className="flex-1 min-h-0">
                {isLoading ? (
                  <div className="min-h-full flex flex-col justify-center items-center bg-muted/30">
                    <FontAwesomeIcon
                      icon={faSpinner}
                      spin
                      size="3x"
                      className="text-gray-600 mb-4"
                    />
                  </div>
                ) : !barChartData ||
                  !barChartData.labels ||
                  barChartData.labels.length === 0 ? (
                  <div className="min-h-full flex flex-col justify-center items-center bg-muted/30">
                    <p className="text-muted-foreground text-md">
                      Tidak ada data
                    </p>
                  </div>
                ) : (
                  <div className="relative h-full">
                    <Bar
                      data={barChartData}
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
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Time */}
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
