import Map from "../Maps";
import ModalTime from "../Modals/ModalTime";
import L from "leaflet";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { IChart, QueryData } from "../../core/model/query";
import { DrillDownLevel } from "../../core/model/location";
import { OlapService } from "../../core/services/OlapService";
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
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronDown,
  faChevronUp,
  faAngleLeft,
  faAngleRight,
  faSpinner,
} from "@fortawesome/free-solid-svg-icons";
import { Tooltip as ReactTooltip } from "react-tooltip";
import { formatNumber } from "../../core/utilities/formatters";
import { LocationData } from "../../core/model/location";
import { TimeFilters, getTimeParamsFromDate } from "../../core/model/time";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Legend,
  ChartTooltip
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
  const [olapData, setOlapData] = useState({});
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

  const fetchOlapData = useCallback(async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/hotspot`
      );
      const data = await response.json();
      setOlapData(data);
    } catch (error) {
      console.error("Error fetching OLAP data:", error);
    }
  }, []);

  useEffect(() => {
    const fetchAllLocations = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/location`);
        const data: LocationData[] = await response.json();
        setAllLocationData(data);
      } catch (error) {
        console.error("Error fetching all location data:", error);
      }
    };
    fetchAllLocations();
  }, []);

  const setChart = useCallback((data: IChart) => {
    const chartData: ChartData<"bar"> = {
      labels: data.labels,
      datasets: [
        { data: data.values, label: "Titik Panas", backgroundColor: "#898989" },
      ],
    };
    setBarChartData(chartData);
  }, []);

  const getDataLocation = useCallback(
    async (target: string) => {
      try {
        const queryParams: QueryData = {
          dimension: target,
        };

        const res = (await OlapService.query("location", queryParams)) as [string, number][];

        const chart: IChart = {
          labels: [],
          values: [],
        };

        if (Array.isArray(res) && res.length > 0) {
          const newData: Data[] = [];
          res.forEach((d: [string, number]) => {
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
        } else {
          setData([]);
          setBarChartData(null);
          console.warn("No data returned for location query.");
        }
      } catch (err) {
        console.error("Error fetching data:", err);
        setData([]);
        setBarChartData(null);
        setIsLoading(false);
      }
    },
    [setChart, setIsLoading, setData]
  );

  const applyGlobalFilters = useCallback(async () => {
    try {
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
          ...(globalFilters.time.minggu && {
            minggu: globalFilters.time.minggu,
          }),
        };
      } else if (
        globalFilters.filterMode === "date" &&
        globalFilters.selectedDate
      ) {
        timeParams = getTimeParamsFromDate(globalFilters.selectedDate);
      }
      const params = {
        dimension: "location",
        ...(globalFilters.confidence && {
          confidence: globalFilters.confidence,
        }),
        ...(globalFilters.satelite && { satelite: globalFilters.satelite }),
        ...timeParams,
      };

      setData([]);
      setBarChartData(null);
      setIsLoading(true);

      const res = (await OlapService.query("location", params)) as OlapData[];

      if (!Array.isArray(res)) {
        throw new Error("Invalid response format: expected array");
      }

      const chart: IChart = {
        labels: [],
        values: [],
      };

      const newData: Data[] = [];
      if (res.length > 0) {
        res.forEach((d: [string, number]) => {
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
              ...params,
            },
            child: [],
            isOpen: false,
          });
        });
      }

      setData(newData);
      setChart(chart);
    } catch (err) {
      console.error("Error applying global filters:", err);
      setData([]);
      setBarChartData(null);
    } finally {
      setIsLoading(false);
    }
  }, [
    globalFilters.confidence,
    globalFilters.satelite,
    globalFilters.time,
    globalFilters.filterMode,
    globalFilters.selectedDate,
    setIsLoading,
    setData,
    setChart,
  ]);

  const resetAllFilters = () => {
    setGlobalFilters({
      confidence: undefined,
      satelite: undefined,
      time: {},
      filterMode: undefined,
      selectedDate: undefined,
    });
    getDataLocation("location");
    setDrillDownLevel("pulau");

    setMapBounds(null);
    setSelectedLocation(undefined);
    setMapKey(Date.now());
  };

  const memoizedFilters = useMemo(() => ({
    confidence: globalFilters.confidence?.toLowerCase(),
    satelite: globalFilters.satelite?.toLowerCase(),
    time: globalFilters.time,
    filterMode: globalFilters.filterMode,
    selectedDate: globalFilters.selectedDate,
  }), [globalFilters]);

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
      console.warn("Wilayah tidak ditemukan");
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
    if (
      tipe === "provinsi" ||
      tipe === "kota" ||
      tipe === "kecamatan" ||
      tipe === "desa"
    ) {
      setDrillDownLevel(levelMap[tipe]);
    } else {
      console.warn(
        `Unexpected 'tipe' value: ${tipe}. Cannot set drillDownLevel.`
      );
    }
    setIsLoading(true);
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
      timeParams = getTimeParamsFromDate(globalFilters.selectedDate);
    }
    const filteredQuery = {
      ...query,
      ...(globalFilters.confidence && { confidence: globalFilters.confidence }),
      ...(globalFilters.satelite && { satelite: globalFilters.satelite }),
      ...timeParams,
      dimension: "location",
    };

    OlapService.query("location", filteredQuery)
      .then((res: unknown) => {
        const typedRes = res as [string, number][];
        const chart: IChart = {
          labels: [],
          values: [],
        };

        const hasil: Data[] = [];
        if (Array.isArray(typedRes) && typedRes.length > 0) {
          typedRes.forEach((d: [string, number]) => {
            if (!Array.isArray(d) || d.length < 2) {
              console.warn("Invalid drilldown data item:", d);
              return;
            }
            const param = {
              ...filteredQuery,
              [tipe]: d[0],
            };

            chart.labels.push(d[0]);
            chart.values.push(d[1]);

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

          indexes.forEach((index, i) => {
            if (!currentLevel[index]) {
              console.error(
                `Index ${index} not found at level ${i} during setData update.`
              );
              return prevData;
            }
            if (i === indexes.length - 1) {
              currentLevel[index].child = hasil;
              currentLevel[index].isOpen = true;
            } else {
              currentLevel = currentLevel[index].child;
            }
          });
          return newData;
        });
        setChart(chart);
      })
      .catch((err) => {
        console.error(err);
        setData([]);
        setBarChartData(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const handleSelect = (
    itemClicked: Data,
    indexes: number[],
    nextDrillType: DrillDownLevel
  ) => {
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
    
    const targetId = `location-item-${indexes.join("-")}`;
    scrollTargetId.current = targetId;

    setData((prevData) => {
      const newData = JSON.parse(JSON.stringify(prevData));
      let currentLevel: Data[] = newData;
      let targetItem: Data | undefined;

      for (let i = 0; i < indexes.length; i++) {
        const index = indexes[i];
        if (!currentLevel[index]) {
          console.error(`Index ${index} not found at level ${i} during setData update.`);
          return prevData;
        }
        if (i === indexes.length - 1) {
          targetItem = currentLevel[index];
          targetItem.isOpen = !targetItem.isOpen;
        }
        currentLevel = currentLevel[index].child;
      }

      // DRILLDOWN
      if (targetItem && targetItem.isOpen && targetItem.child.length === 0) {
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
          default:
            break;
        }
        getDrilldownData(indexes, queryForDrill, nextDrillType);
        setDrillDownLevel(nextDrillType as DrillDownLevel);
        setOlapData({ query: queryForDrill });
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
      }

      // ROLLUP
      if (targetItem && !targetItem.isOpen) {
        if (indexes.length === 1) {
          const bounds = L.latLngBounds(L.latLng(-11, 94), L.latLng(6, 141));
          setMapBounds(bounds);
          setDrillDownLevel("pulau");
          setOlapData({ query: {} });
          setSelectedLocation(undefined);
          setChart({
            labels: newData.map((item: Data) => item.data),
            values: newData.map((item: Data) => item.total),
          });
        } else {
          const levelMapping: DrillDownLevel[] = [
            "pulau",
            "provinsi",
            "kota",
            "kecamatan",
            "desa",
          ];

          const currentLevelIndex = indexes.length - 1;
          const currentLevel = levelMapping[currentLevelIndex];

          const currentQuery = { ...targetItem.query };

          if (!currentQuery[currentLevel]) {
            currentQuery[currentLevel] = targetItem.data.toString();
          }

          let lat = targetItem.query.lat;
          let lng = targetItem.query.lng;
          if (lat === undefined || lng === undefined) {
            lat = -2.5;
            lng = 118;
          }
          setOlapData({ query: currentQuery });
          setDrillDownLevel(currentLevel);
          setSelectedLocation({
            lat: lat,
            lng: lng,
            ...currentQuery,
          });

          handleSelection({
            wilayah: targetItem.data,
            lat,
            lng,
          });

          let parentItem: Data | undefined;
          let parentLevel: Data[] = newData;

          if (indexes.length > 1) {
            const parentPath = indexes.slice(0, -1);
            for (let i = 0; i < parentPath.length; i++) {
              if (i === parentPath.length - 1) {
                parentItem = parentLevel[parentPath[i]];
              } else {
                parentLevel = parentLevel[parentPath[i]].child;
              }
            }

            if (parentItem) {
              setChart({
                labels: parentItem.child.map((item: Data) => item.data),
                values: parentItem.child.map((item: Data) => item.total),
              });
            }
          }
        }
      }
      return newData;
    });
  };

  const getSatelliteData = useCallback((query: QueryData, tipe: DrillDownLevel) => {
    if (activeMapLayer !== "hotspot-locations") {
      const q = { ...query, dimension: "satelite" };
      setIsLoading(true);

      switch (tipe) {
        case "pulau":
          q.pulau = "";
          q.point = query.pulau;
          break;
        case "provinsi":
          q.provinsi = "";
          q.point = query.provinsi;
          break;
        case "kota":
          q.kota = "";
          q.point = query.kota;
          break;
        case "kecamatan":
          q.kecamatan = "";
          q.point = query.kecamatan;
          break;
        case "desa":
          q.point = query.desa;
          break;
      }
      q.satelite = "";

      OlapService.query("satelite", q).then((res) => {
        setIsLoading(false);
        setDataSatelite(res as OlapData[]);
      }).catch(err => {
        console.error("Error fetching satellite data:", err);
        setDataSatelite([]);
        setIsLoading(false);
      });
    }
  },[activeMapLayer]);

  const getConfidenceData = useCallback((query: QueryData, tipe: DrillDownLevel) => {
    if (activeMapLayer !== "hotspot-locations") {
      const q = { ...query, dimension: "confidence" };
      setIsLoading(true);

      switch (tipe) {
        case "pulau":
          q.pulau = "";
          q.point = query.pulau;
          break;
        case "provinsi":
          q.provinsi = "";
          q.point = query.provinsi;
          break;
        case "kota":
          q.kota = "";
          q.point = query.kota;
          break;
        case "kecamatan":
          q.kecamatan = "";
          q.point = query.kecamatan;
          break;
        case "desa":
          q.point = query.desa;
          break;
      }
      q.confidence = "";

      OlapService.query("confidence", q).then((res) => {
        setIsLoading(false);
        setDataConfidence(res as OlapData[]);
      }).catch(err => {
        console.error("Error fetching confidence data:", err);
        setDataConfidence([]);
        setIsLoading(false);
      });
    }
  },[activeMapLayer]);

  useEffect(() => {
    if (!hasFetched.current) {
      getDataLocation("location");
      fetchOlapData();
      getConfidenceData({}, "pulau");
      getSatelliteData({}, "pulau");
      hasFetched.current = true;
    }
  }, [getDataLocation, fetchOlapData, getConfidenceData, getSatelliteData]);
  
  useEffect(() => {
    if (!isLoading && scrollTargetId.current) {
      const element = document.getElementById(scrollTargetId.current);
      if (element) {
        element.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }
      scrollTargetId.current = null;
    }
  }, [data, isLoading]);

  useEffect(() => {
    if (hasFetched.current) {
      applyGlobalFilters();
    }
  }, [
    globalFilters.confidence,
    globalFilters.satelite,
    globalFilters.time,
    globalFilters.filterMode,
    globalFilters.selectedDate,
    applyGlobalFilters,
    hasFetched,
  ]);

  const openModalTime = (index: number[], query: QueryData, tipe: DrillDownLevel) => {
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

  useEffect(() => {
    getConfidenceData({}, "pulau");
    getSatelliteData({}, "pulau");
  }, []);

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

  const barChartOptions: ChartConfiguration["options"] = useMemo(() => ({
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
    },
    onClick: handleChartClick,
  }), [handleChartClick, setSelectedHotspot]);

  const getStatusColor = (confidence: string | null | undefined) => {
    if (confidence === "high") {
      return "bg-red-500";
    } else if (confidence === "medium") {
      return "bg-yellow-500";
    } else if (confidence === "low") {
      return "bg-green-500";
    } else {
      return "bg-gray-300";
    }
  };

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
      <div className="flex flex-1 flex-col md:flex-row overflow-hidden mt-16">
        <button
          className="md:hidden p-2 bg-blue-100 text-blue-800 font-medium flex items-center justify-center"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        >
          {isSidebarOpen ? "Hide Sidebar" : "Show Sidebar"}
          <FontAwesomeIcon
            icon={isSidebarOpen ? faAngleLeft : faAngleRight}
            className="ml-2"
          />
        </button>

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
            <h2 className="text-md font-semibold text-black mb-2">Filters</h2>
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
                    data-tooltip-content="Filter ini memungkinkan Anda memilih periode waktu (tahun, semester, kuartal, bulan, dan minggu) untuk melihat distribusi hotspot pada peta sesuai rentang waktu yang diinginkan."
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
                        {globalFilters.time.hari && (
                          <span>Hari {globalFilters.time.hari}</span>
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
                    data-tooltip-content="Filter ini memungkinkan Anda memilih tanggal spesifik untuk melihat data hotspot pada hari tersebut."
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
            <h2 className="text-md font-semibold text-black">Location</h2>
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
                      <span
                        className={`px-2 py-0.5 rounded-full text-white text-xs ${getStatusColor(
                          item.query.confidence
                        )}`}
                      >
                        {item.query.confidence ?? "Confidence"}
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
                      <div key={j} id={`location-item-${i}-${j}`} className="mt-2 ml-4">
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
                            <span
                              className={`px-2 py-0.5 rounded-full text-white text-xs ${getStatusColor(
                                provinsi.query.confidence
                              )}`}
                            >
                              {provinsi.query.confidence ?? "Confidence"}
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
                            <div key={k} id={`location-item-${i}-${j}-${k}`} className="mt-2 ml-4">
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
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-white text-xs ${getStatusColor(
                                      kota.query.confidence
                                    )}`}
                                  >
                                    {kota.query.confidence ?? "Confidence"}
                                  </span>
                                </div>
                                <div className="mt-1 text-xs text-gray-500 truncate">
                                  Pulau: {item.data} | Provinsi: {provinsi.data}
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
                                  <div key={l} id={`location-item-${i}-${j}-${k}-${l}`} className="mt-2 ml-4">
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
                                        <span
                                          className={`px-2 py-0.5 rounded-full text-white text-xs ${getStatusColor(
                                            kecamatan.query.confidence
                                          )}`}
                                        >
                                          {kecamatan.query.confidence ??
                                            "Confidence"}
                                        </span>
                                      </div>
                                      <div className="mt-1 text-xs text-gray-500 truncate">
                                        Pulau: {item.data} | Provinsi:{" "}
                                        {provinsi.data} | Kota: {kota.data}
                                      </div>
                                      <div className="mt-2 flex items-center justify-end">
                                        <span className="text-gray-700 text-xs font-medium bg-gray-100 px-2 py-0.5 rounded">
                                          Total: {formatNumber(kecamatan.total)}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Desa */}
                                    {kecamatan.isOpen &&
                                      kecamatan.child &&
                                      kecamatan.child.map((desa, m) => (
                                        <div key={m} id={`location-item-${i}-${j}-${k}-${l}-${m}`} className="mt-2 ml-4">
                                          <div className="bg-white rounded-lg shadow-xs p-3 border-l-4 border-red-500 hover:shadow-sm transition">
                                            <div className="flex justify-between items-center">
                                              <span
                                                className="font-semibold text-black text-sm cursor-pointer hover:text-blue-600 transition"
                                                onClick={() =>
                                                  handleSelect(
                                                    desa,
                                                    [i, j, k, l, m],
                                                    "desa"
                                                  )
                                                }
                                              >
                                                {desa.data}{" "}
                                              </span>
                                              <span
                                                className={`px-2 py-0.5 rounded-full text-white text-xs ${getStatusColor(
                                                  desa.query.confidence
                                                )}`}
                                              >
                                                {desa.query.confidence ??
                                                  "Confidence"}
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
                style={{ height: "100%", width: "100%", margin: 0, padding: 0 }}
                filters={memoizedFilters}
              />
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
                    <p className="text-gray-500 text-md">Loading data...</p>
                  </div>
                ) : !barChartData ||
                  !barChartData.labels ||
                  barChartData.labels.length === 0 ? (
                  <div className="min-h-full flex flex-col justify-center items-center bg-gray-50">
                    <p className="text-gray-500 text-md">
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
                                tooltipItem: TooltipItem<"bar">
                              ) {
                                setSelectedHotspot(tooltipItem.raw as number);
                                return `Jumlah Hotspot: ${formatNumber(
                                  tooltipItem.raw as number
                                )}`;
                              },
                            },
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