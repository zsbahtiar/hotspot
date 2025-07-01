import Map from "../Maps";
import ModalTime from "../Modals/ModalTime";
import L from "leaflet";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { IChart, QueryData } from "../../core/model/query";
import { DrillDownLevel } from "../../core/model/location";
import { OlapService } from "../../core/services/OlapService";
import useSWR from "swr";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Legend,
  ChartData,
  ChartEvent,
  Chart,
  ChartConfiguration,
  ActiveElement,
  Tooltip as ChartTooltip,
  TooltipItem,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import ChartDataLabels from 'chartjs-plugin-datalabels';
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
import { formatNumber } from "../../core/utilities/formatters";
import { LocationData } from "../../core/model/location";
import { TimeFilters } from "../../core/model/time";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Legend,
  ChartTooltip,
  ChartDataLabels
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

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('An error occurred while fetching the data.');
  }
  return response.json();
};

const olapFetcher = async ([endpoint, params]: [string, QueryData]) => {
  return await OlapService.query(endpoint, params);
};

const OlapComponent = () => {
  const hasFetched = useRef(false);
  const scrollTargetId = useRef<string | null>(null);
  const [mapKey, setMapKey] = useState(Date.now());
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [mapBounds, setMapBounds] = useState<L.LatLngBoundsExpression | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<LocationData>();
  const [drillDownLevel, setDrillDownLevel] = useState<DrillDownLevel>("pulau");
  const [activeMapLayer, setActiveMapLayer] = useState<"hotspot-count" | "hotspot-locations">("hotspot-count");
  const [data, setData] = useState<Data[]>([]);
  const [dataConfidence, setDataConfidence] = useState<OlapData[]>([]);
  const [dataSatelite, setDataSatelite] = useState<OlapData[]>([]);
  const [barChartData, setBarChartData] = useState<ChartData<"bar"> | null>(null);
  const [olapData, setOlapData] = useState<{query?: QueryData}>({});
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
  const [drillDownQuery, setDrillDownQuery] = useState<QueryData | null>(null)
  const [drillDownIndexes, setDrillDownIndexes] = useState<number[]>([]);

  // Fetch data 
  const { data: olapApiData } = useSWR(
    `${process.env.NEXT_PUBLIC_API_URL}/api/hotspot`,
    fetcher,
    { revalidateOnFocus: false }
  );

  const { data: locationApiData } = useSWR(
    `${process.env.NEXT_PUBLIC_API_URL}/api/location`,
    fetcher,
    { revalidateOnFocus: false }
  );

  const locationQueryParams = useMemo(() => {
    return { dimension: "location" };
  }, []);

  const { data: locationQueryData, isLoading: isLocationLoading } = useSWR(
    hasFetched.current ? null : ['location', locationQueryParams],
    olapFetcher,
    { revalidateOnFocus: false }
  );

  const confidenceQueryParams = useMemo(() => {
    return { dimension: "confidence" };
  }, []);

  const { data: confidenceQueryData } = useSWR(
    ['confidence', confidenceQueryParams],
    olapFetcher,
    { revalidateOnFocus: false }
  );

  const satelliteQueryParams = useMemo(() => {
    return { dimension: "satelite" };
  }, []);

  const { data: satelliteQueryData } = useSWR(
    ['satelite', satelliteQueryParams],
    olapFetcher,
    { revalidateOnFocus: false }
  );

  const filteredQueryParams = useMemo(() => {
    let timeParams = {};
    
    if (globalFilters.filterMode === "period") {
      timeParams = {
        ...(globalFilters.time.tahun && { tahun: globalFilters.time.tahun }),
        ...(globalFilters.time.semester && { semester: globalFilters.time.semester }),
        ...(globalFilters.time.kuartal && { kuartal: globalFilters.time.kuartal }),
        ...(globalFilters.time.bulan && { bulan: globalFilters.time.bulan }),
        ...(globalFilters.time.minggu && { minggu: globalFilters.time.minggu }),
      };
    } else if (globalFilters.filterMode === "date" && globalFilters.selectedDate) {
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

  // SWR hook
  const { data: filteredData, isLoading: isFilteredLoading } = useSWR(
    (hasFetched.current || Object.keys(olapData.query || {}).length > 0) 
      ? ['location', filteredQueryParams] 
      : null,
    olapFetcher,
    { revalidateOnFocus: false }
  );

  const { data: drillDownData, isLoading: isDrillDownLoading } = useSWR(
    drillDownQuery ? ['location', drillDownQuery] : null,
    olapFetcher,
    { revalidateOnFocus: false }
  );

  const setChart = useCallback((data: IChart) => {
    const chartData: ChartData<"bar"> = {
      labels: data.labels,
      datasets: [
        {
          data: data.values,
          label: "Titik Panas",
          backgroundColor: "#898989",
        },
      ],
    };
    setBarChartData(chartData);
  }, []);

  // Update data
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
    if (locationQueryData && Array.isArray(locationQueryData) && !hasFetched.current) {
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
            console.warn("Skipping invalid data item:", d);
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
            console.warn("Invalid drilldown data item:", d);
            return;
          }
          const name = d[0];
          const total = d[1];
        
          chart.labels.push(name);
          chart.values.push(total);

          const drillDownTipe = (drillDownQuery as QueryData & { tipe?: DrillDownLevel })?.tipe;
          const locationDetail = allLocationData.find(loc => {
            if (drillDownTipe === 'provinsi') return loc.provinsi === name;
            if (drillDownTipe === 'kota') return loc.kab_kota === name;
            if (drillDownTipe === 'kecamatan') return loc.kecamatan === name;
            if (drillDownTipe === 'desa') return loc.desa === name;
            return false;
          });

          const param = {
            ...drillDownQuery,
            [(drillDownQuery as QueryData & { tipe?: DrillDownLevel })?.tipe as string]: name,
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
            console.error(
              `Index ${index} not found at level ${i} during setData update.`
            );
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
  }, [drillDownData, allLocationData, drillDownIndexes, drillDownQuery, setChart]);

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
      const indexes = scrollTargetId.current.replace('location-item-', '').split('-').map(s => parseInt(s, 10));
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
      console.error("Tidak tersedia", selectedData);
      return;
    }
    const wilayahDicari = selectedData.wilayah || selectedData.name;
    const matchingLocations = allLocationData.filter(
      (loc: LocationData) =>
        loc.pulau === wilayahDicari ||
        loc.provinsi === wilayahDicari ||
        loc.kab_kota === wilayahDicari ||
        loc.kecamatan === wilayahDicari ||
        loc.desa === wilayahDicari
    );

    if (matchingLocations.length === 0) {
      if (selectedData.lat && selectedData.lng) {
        setSelectedLocation({
          lat: selectedData.lat,
          lng: selectedData.lng,
        });
      } else {
        console.warn("Wilayah tidak ditemukan dan tidak ada koordinat:", wilayahDicari);
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
        0
      ) / matchingLocations.length;
    const avgLng =
      matchingLocations.reduce(
        (sum: number, loc: LocationData) => sum + loc.lng,
        0
      ) / matchingLocations.length;
    setSelectedLocation({ lat: avgLat, lng: avgLng });
  };

  const handleDrillDownChange = (newLevel: DrillDownLevel) => {
    setDrillDownLevel(newLevel);
  };

  const getDrilldownData = (
    indexes: number[],
    query: QueryData,
    tipe: DrillDownLevel
  ) => {
    const levelMap: Record<string, DrillDownLevel> = {
      provinsi: "provinsi",
      kota: "kota",
      kecamatan: "kecamatan",
      desa: "desa",
    };
    
    if (tipe === "provinsi" || tipe === "kota" || tipe === "kecamatan" || tipe === "desa") {
      setDrillDownLevel(levelMap[tipe]);
    } else {
      console.warn(`Unexpected 'tipe' value: ${tipe}. Cannot set drillDownLevel.`);
    }
    
    setBarChartData(null);

    let timeParams = {};
    if (globalFilters.filterMode === "period") {
      timeParams = {
        ...(globalFilters.time.tahun && { tahun: globalFilters.time.tahun }),
        ...(globalFilters.time.semester && { semester: globalFilters.time.semester }),
        ...(globalFilters.time.kuartal && { kuartal: globalFilters.time.kuartal }),
        ...(globalFilters.time.bulan && { bulan: globalFilters.time.bulan }),
        ...(globalFilters.time.minggu && { minggu: globalFilters.time.minggu }),
        ...(globalFilters.time.hari && { hari: globalFilters.time.hari }),
      };
    } else if (globalFilters.filterMode === "date" && globalFilters.selectedDate) {
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
    nextDrillType: DrillDownLevel
  ) => {
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
    // Auto scroll
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

      currentLevelItems.forEach(item => {
        if (item.data !== targetItem!.data) {
          item.isOpen = false;
        }
      });
      
      targetItem.isOpen = !targetItem.isOpen;

      // DRILL DOWN
      if (targetItem.isOpen) {
        const queryForDrill = { ...itemClicked.query };
        switch (nextDrillType) {
          case "provinsi": queryForDrill.pulau = itemClicked.data.toString(); break;
          case "kota": queryForDrill.provinsi = itemClicked.data.toString(); break;
          case "kecamatan": queryForDrill.kota = itemClicked.data.toString(); break;
          case "desa": queryForDrill.kecamatan = itemClicked.data.toString(); break;
        }
        getDrilldownData(indexes, queryForDrill, nextDrillType);

        setOlapData({ query: queryForDrill });
        setDrillDownLevel(nextDrillType);
        setMapBounds(null); // Reset bounds
        setSelectedLocation({
          lat: itemClicked.query.lat ?? -2.5,
          lng: itemClicked.query.lng ?? 118,
          ...queryForDrill,
        });
        handleSelection({ wilayah: itemClicked.data, lat: itemClicked.query.lat, lng: itemClicked.query.lng });

      } 
      // ROLL UP
      else {
        // Tidak ada parent roll up ke level pulau
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
        } 
        // Ada parent, roll up ke level sebelumnya
        else {
          const parentIndexes = indexes.slice(0, -1);
          const parentDrillDownType = nextDrillType === 'provinsi' ? 'pulau' :
                                    nextDrillType === 'kota' ? 'provinsi' :
                                    nextDrillType === 'kecamatan' ? 'kota' : 'kecamatan';

          setDrillDownLevel(parentDrillDownType);
          setOlapData({ query: parentItem.query });
          setSelectedLocation({
            lat: parentItem.query.lat ?? -2.5,
            lng: parentItem.query.lng ?? 118,
            ...parentItem.query,
          });
          handleSelection({ wilayah: parentItem.data, lat: parentItem.query.lat, lng: parentItem.query.lng });

          if (parentItem.child && parentItem.child.length > 0) {
            setChart({
              labels: parentItem.child.map((item: Data) => item.data),
              values: parentItem.child.map((item: Data) => item.total),
            });
          }
          getDrilldownData(parentIndexes, parentItem.query, parentDrillDownType);
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
  };

  const memoizedFilters = useMemo(() => ({
    confidence: globalFilters.confidence?.toLowerCase(),
    satelite: globalFilters.satelite?.toLowerCase(),
    time: globalFilters.time,
    filterMode: globalFilters.filterMode,
    selectedDate: globalFilters.selectedDate,
  }), [globalFilters]);

  const openModalTime = (
    index: number[],
    query: QueryData,
    tipe: DrillDownLevel
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
    closeModalTime();
  };

  const handleChartClick = useCallback(
    (event: ChartEvent, elements: ActiveElement[], chart: Chart) => {
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
    [activeMapLayer, data]
  );

  const barChartOptions: ChartConfiguration["options"] = useMemo(
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
          display: true,
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
          color: 'black',
          anchor: 'end',
          align: 'end',
          offset: 4,
          formatter: (value) => formatNumber(value),
          font: {
            weight: 'bold',
            size: 9,
          },
          clamp: true,
        }
      },
      onClick: handleChartClick,
    }), [handleChartClick, setSelectedHotspot]);

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-50 overflow-hidden">
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
          className={`${
            isSidebarOpen ? "block" : "hidden"
          } md:block w-full md:w-80 bg-white border-r border-gray-200 flex flex-col overflow-y-auto
          ${
            activeMapLayer === "hotspot-locations" ? "hidden md:hidden" : ""
          } /* Hide sidebar completely when in hotspot-locations mode */`}
        >
          {/* FILTERS */}
          
        <div className="p-3 border-b border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center">
            <h2 className="text-md font-semibold text-black">Filters</h2>
            <button 
              className="md:hidden p-1 rounded-full hover:bg-gray-200 transition"
              onClick={() => setIsSidebarOpen(false)}
              aria-label="Tutup Panel"
            >
              <FontAwesomeIcon icon={faXmark} className="text-gray-600" />
            </button>
            </div>
            {/* Confidence */}
            <div
              className={`border-b border-gray-200 bg-gray-50 ${
                activeMapLayer === "hotspot-locations"
                  ? "opacity-60 pointer-events-none"
                  : ""
              }`}
            >
              <div className="mb-3">
                <label
                  htmlFor="confidence-filter"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Confidence Level
                </label>
                <select
                  id="confidence-filter"
                  className="w-full px-2 py-1 rounded border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-300 text-gray-700 text-sm"
                  value={globalFilters.confidence || ""}
                  onChange={(e) =>
                    setGlobalFilters({
                      ...globalFilters,
                      confidence: e.target.value || undefined,
                    })
                  }
                  disabled={activeMapLayer === "hotspot-locations"}
                >
                  <option value="">Semua Confidence</option>
                  {dataConfidence &&
                    dataConfidence.map((conf: OlapData, i: number) => (
                      <option key={i} value={conf[0]}>
                        {conf[0]}
                      </option>
                    ))}
                </select>
              </div>

              {/* Satellite */}
              <div className="mb-3">
                <label
                  htmlFor="satellite-filter"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Satellite
                </label>
                <select
                  id="satellite-filter"
                  className="w-full px-2 py-1 rounded border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-300 text-gray-700 text-sm"
                  value={globalFilters.satelite || ""}
                  onChange={(e) => {
                    if (e.target.value === "") {
                      setGlobalFilters({
                        ...globalFilters,
                        satelite: undefined,
                      });
                    } else {
                      setGlobalFilters({
                        ...globalFilters,
                        satelite: e.target.value || undefined,
                      });
                    }
                  }}
                  disabled={activeMapLayer === "hotspot-locations"}
                >
                  <option value="">Semua Satelit</option>
                  {dataSatelite &&
                    dataSatelite.map((sat: OlapData, i: number) => (
                      <option key={i} value={sat[0]}>
                        {sat[0]}
                      </option>
                    ))}
                </select>
              </div>

              {/* Periode Waktu */}
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Filter Periode Waktu
                  <span
                    className="ml-1 text-gray-700 cursor-help text-xs font-medium"
                    data-tooltip-id="time-filter-info"
                    data-tooltip-content="Pilih periode waktu (tahun, semester, kuartal, bulan, dan minggu) untuk melihat distribusi hotspot pada peta sesuai rentang waktu yang diinginkan."
                    data-tooltip-place="top"
                  >
                    {" "}
                    ⓘ
                  </span>
                </label>
                <button
                  className="w-full px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none text-sm transition"
                  onClick={() => openModalTime([], {}, "pulau")}
                  disabled={activeMapLayer === "hotspot-locations"}
                >
                  {globalFilters.time.tahun ? (
                    <div className="flex flex-col items-start">
                      <div className="font-medium">
                        {globalFilters.time.tahun}
                      </div>
                      <div className="flex space-x-2 text-xs opacity-90">
                        {globalFilters.time.semester && (
                          <span>Semester {globalFilters.time.semester}</span>
                        )}
                        {globalFilters.time.kuartal && (
                          <span>Kuartal {globalFilters.time.kuartal}</span>
                        )}
                        {globalFilters.time.bulan && (
                          <span>Bulan {globalFilters.time.bulan}</span>
                        )}
                        {globalFilters.time.minggu && (
                          <span>Minggu {globalFilters.time.minggu}</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    "Pilih Periode Waktu"
                  )}
                </button>
              </div>

              {/* Tanggal Spesifik */}
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Filter Tanggal Spesifik
                  <span
                    className="ml-1 text-gray-700 cursor-help text-xs font-medium"
                    data-tooltip-id="date-filter-info"
                    data-tooltip-content="Pilih tanggal spesifik untuk melihat persebaran jumlah data hotspot pada hari tersebut."
                    data-tooltip-place="top"
                  >
                    {" "}
                    ⓘ
                  </span>
                </label>
                <div className="flex items-center">
                  <input
                    type="date"
                    className="w-full px-2 py-1 rounded border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-300 text-gray-700 text-sm"
                    value={globalFilters.selectedDate || ""}
                    onChange={(e) => {
                      const date = e.target.value;
                      setGlobalFilters({
                        ...globalFilters,
                        selectedDate: date || undefined,
                        filterMode: date ? "date" : undefined,
                        time: date ? {} : globalFilters.time,
                      });
                    }}
                    max={new Date().toISOString().split("T")[0]}
                    disabled={activeMapLayer === "hotspot-locations"}
                  />
                </div>
                {globalFilters.selectedDate && (
                  <div className="mt-1 text-xs text-blue-600 font-medium">
                    Filter aktif:{" "}
                    {new Date(globalFilters.selectedDate).toLocaleDateString(
                      "id-ID",
                      {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      }
                    )}
                  </div>
                )}
              </div>

              {/* Reset Button */}
              <button
                className="w-full px-2 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 focus:outline-none text-sm transition"
                onClick={resetAllFilters}
              >
                Reset Semua Filter
              </button>
            </div>
          </div>

          {/* Location List */}
        <div className="p-3 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <label className="text-md font-semibold text-black">
            Location
            <span
              className="ml-1 text-gray-700 cursor-help text-xs font-medium"
              data-tooltip-id="location-info"
              data-tooltip-content="Klik nama lokasi untuk melihat detail (drill down) dan klik nama lokasi level sebelumnya untuk kembali ke level sebelumnya (roll up)."
              data-tooltip-place="top"
            >
              {" "}
              ⓘ
            </span>
          </label>
        </div>
          <div
            className={`flex-1 overflow-y-auto p-2 ${
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
                  className="text-green-600 mb-2"
                />
              </div>
            ) : data && data.length > 0 ? (
              data.map((item, i) => (
                <div key={i} id={`location-item-${i}`} className="mb-3">
                  {/* Pulau */}
                  <div className="bg-white rounded-lg shadow-xs p-3 border-l-4 border-blue-500 hover:shadow-sm transition">
                    <div className="flex justify-between items-center">
                      <span
                        className="font-semibold text-sm text-black cursor-pointer hover:text-blue-600 transition"
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
                      <span className="text-gray-700 text-xs font-medium bg-gray-100 px-2 py-0.5 rounded">
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
                        <div className="bg-white rounded-lg shadow-xs p-3 border-l-4 border-green-500 hover:shadow-sm transition">
                          <div className="flex justify-between items-center">
                            <span
                              className="font-semibold text-black text-sm cursor-pointer hover:text-blue-600 transition"
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
                          <div className="mt-1 text-xs text-gray-500 truncate">
                            Pulau: {item.data}
                          </div>
                          <div className="mt-2 flex items-center justify-end">
                            <span className="text-gray-700 text-xs font-medium bg-gray-100 px-2 py-0.5 rounded">
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
                              <div className="bg-white rounded-lg shadow-xs p-3 border-l-4 border-yellow-500 hover:shadow-sm transition">
                                <div className="flex justify-between items-center">
                                  <span
                                    className="font-semibold text-black text-sm cursor-pointer hover:text-blue-600 transition"
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
                                <div className="mt-1 text-xs text-gray-500 truncate">
                                  Pulau: {item.data} | Provinsi:{" "}
                                  {provinsi.data}
                                </div>
                                <div className="mt-2 flex items-center justify-end">
                                  <span className="text-gray-700 text-xs font-medium bg-gray-100 px-2 py-0.5 rounded">
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
                                    <div className="bg-white rounded-lg shadow-xs p-3 border-l-4 border-purple-500 hover:shadow-sm transition">
                                      <div className="flex justify-between items-center">
                                        <span
                                          className="font-semibold text-black text-sm cursor-pointer hover:text-blue-600 transition"
                                          onClick={() =>
                                            handleSelect(
                                              kecamatan,
                                              [i, j, k, l],
                                              "desa"
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
                                      <div className="mt-1 text-xs text-gray-500 truncate">
                                        Pulau: {item.data} | Provinsi:{" "}
                                        {provinsi.data} | Kota: {kota.data}
                                      </div>
                                      <div className="mt-2 flex items-center justify-end">
                                        <span className="text-gray-700 text-xs font-medium bg-gray-100 px-2 py-0.5 rounded">
                                          Total:{" "}
                                          {formatNumber(kecamatan.total)}
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
                                          <div className="bg-white rounded-lg shadow-xs p-3 border-l-4 border-red-500 hover:shadow-sm transition">
                                            <div className="flex justify-between items-center">
                                              <span
                                                className="font-semibold text-black text-sm cursor-pointer hover:text-blue-600 transition"
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
                                                    labels: [desa.data.toString()],
                                                    values: [desa.total],
                                                  });
                                                  setOlapData({ query: desa.query });
                                                  setDrillDownLevel("desa");
                                                }}
                                              >
                                                {desa.data}{" "}
                                              </span>
                                            </div>
                                            <div className="mt-1 text-xs text-gray-500 truncate">
                                              Pulau: {item.data} | Provinsi:{" "}
                                              {provinsi.data} | Kota:{" "}
                                              {kota.data} | Kecamatan:{" "}
                                              {kecamatan.data}
                                            </div>
                                            <div className="mt-2 flex items-center justify-end">
                                              <span className="text-gray-700 text-xs font-medium bg-gray-100 px-2 py-0.5 rounded">
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
                <p className="text-gray-500 text-md">Tidak ada data</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Map Section */}
          <div
            className={`relative text-black ${
              activeMapLayer === "hotspot-locations"
                ? "h-full flex-grow"
                : "h-[50vh] md:h-[70%]"
            }`}
          >
            <div className="absolute inset-0">
              <Map
                key={mapKey}
                bounds={mapBounds ?? undefined}
                selectedLocation={selectedLocation}
                olapData={olapData}
                locationData={
                  (drillDownData && drillDownIndexes.length > 0) 
                    ? (drillDownData as [string, number][])
                    : (filteredData && hasFetched.current)
                    ? (filteredData as [string, number][])
                    : (locationQueryData as [string, number][])
                }
                drillDownLevel={drillDownLevel}
                onDrillDownChange={handleDrillDownChange}
                onLayerChange={(layer) => {
                  setActiveMapLayer(layer);
                  if (layer === "hotspot-locations") {
                    setGlobalFilters((prev) => ({
                      ...prev,
                      time: {},
                      filterMode: undefined,
                      selectedDate: undefined,
                    }));
                    setIsSidebarOpen(false);
                  } else {
                    if (window.innerWidth < 768) {
                      setIsSidebarOpen(true);
                    }
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
              />
              <button
                className="md:hidden bg-blue-600 text-white flex items-center justify-center shadow-md absolute bottom-3 right-3 z-[500] rounded-full w-10 h-10"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                aria-label={isSidebarOpen ? "Sembunyikan Panel" : "Tampilkan Panel"}
              >
                <FontAwesomeIcon 
                  icon={isSidebarOpen ? faAngleLeft : faAngleRight} 
                  className="text-sm"
                />
              </button>
            </div>
          </div>

          {/* Chart Section */}
          <div
            className={`h-[50vh] md:h-[30%] bg-white border-t border-gray-200 z-20 overflow-hidden
            ${activeMapLayer === "hotspot-locations" ? "hidden" : ""}`}
          >
            {" "}
            <div className="h-full p-3 flex flex-col">
              <div className="flex justify-between items-center mb-2">
                <h2 className="font-semibold text-gray-700">Hotspot Chart</h2>
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
                  <div className="min-h-full flex flex-col justify-center items-center bg-gray-50">
                    <FontAwesomeIcon
                      icon={faSpinner}
                      spin
                      size="3x"
                      className="text-green-600 mb-4"
                    />
                  </div>
                ) : !barChartData ||
                  !barChartData.labels ||
                  barChartData.labels.length === 0 ? (
                  <div className="min-h-full flex flex-col justify-center items-center bg-gray-50">
                    <p className="text-gray-500 text-md">Tidak ada data</p>
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
                            enabled:
                              activeMapLayer !== "hotspot-locations",
                            bodyFont: {
                              size: 11,
                            },
                            titleFont: {
                              size: 12,
                            },
                            callbacks: {
                              label: function (
                                tooltipItem: TooltipItem<"bar">
                              ) {
                                setSelectedHotspot(tooltipItem.raw as number);
                                return `Jumlah Hotspot: ${formatNumber(
                                  tooltipItem.raw as number
                                )}`;
                              },
                            },
                          },
                          
                          datalabels: {
                            display: true,
                            color: 'black',
                            anchor: 'end',
                            align: 'end',
                            offset: 1,
                            formatter: (value) => formatNumber(value),
                            font: {
                              weight: 'bold',
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
                              callback: function(value) {
                                return value.toLocaleString('id-ID')
                              }
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