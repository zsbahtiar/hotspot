import { useState, useEffect, useRef, useCallback } from "react";
import { IChart, QueryData, DrillDownLevel } from "../../core/model/query";
import { OlapService } from "../../core/services/OlapService";
import { Type } from "../Modals/ModalTime";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ChartData, ChartEvent, Chart, ChartConfiguration, ActiveElement } from "chart.js";
import { Bar } from "react-chartjs-2";
import Map from "../Maps";
import ModalTime from "../Modals/ModalTime";
import L from "leaflet";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faChevronUp, faAngleLeft, faAngleRight } from "@fortawesome/free-solid-svg-icons";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface Data {
  data: string | number;
  query: QueryData & { lat?: number; lng?: number };
  modal: boolean;
  total: number;
  child: Data[];
  isOpen?: boolean;
}

interface LocationData {
    lat: number;
    lng: number;
    pulau?: string;
    provinsi?: string;
    kab_kota?: string;
    kecamatan?: string;
    desa?: string;
}

interface TimeFilters {
  tahun?: string;
  semester?: string;
  kuartal?: string;
  bulan?: string;
  hari?: string;
}

type OlapData = [string, number];

const OlapComponent = () => {
  const hasFetched = useRef(false);
  const [, setShow] = useState(true);
  const [data, setData] = useState<Data[]>([]);
  const [dataConfidence, setDataConfidence] = useState<OlapData[]>([]);
  const [dataSatelite, setDataSatelite] = useState<OlapData[]>([]);
  const [barChartData, setBarChartData] = useState<ChartData<"bar"> | null>(null);
  const [mapBounds, setMapBounds] = useState<L.LatLngBoundsExpression | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<LocationData>();
  const [olapData, setOlapData] = useState({});
  const [drillDownLevel, setDrillDownLevel] = useState<DrillDownLevel>("pulau");
  const [, setSelectedHotspot] = useState<number | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [globalFilters, setGlobalFilters] = useState({
    confidence: undefined as string | undefined,
    satelite: undefined as string | undefined,   
    time: {} as TimeFilters,
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

  const setChart = useCallback((data: IChart) => {
    const chartData: ChartData<"bar"> = {
      labels: data.labels,
      datasets: [
        { data: data.values, label: "Titik Panas", backgroundColor: "#898989" },
      ],
    };
    setBarChartData(chartData);
  },[]);

  const applyGlobalFilters = useCallback(async () => {
    try {
      const timeParams = {
        ...(globalFilters.time.tahun && { tahun: globalFilters.time.tahun }),
        ...(globalFilters.time.semester && {
          semester: globalFilters.time.semester,
        }),
        ...(globalFilters.time.kuartal && {
          kuartal: globalFilters.time.kuartal,
        }),
        ...(globalFilters.time.bulan && { bulan: globalFilters.time.bulan }),
        ...(globalFilters.time.hari && { hari: globalFilters.time.hari }),
      };

      const params = {
        dimension: "location",
        ...(globalFilters.confidence && {
          confidence: globalFilters.confidence,
        }),
        ...(globalFilters.satelite && { satelite: globalFilters.satelite }),
        ...timeParams,
      };

      setData([]);
      setShow(true);

      const res = (await OlapService.query("location", params)) as [string, number][];

      if (!Array.isArray(res)) {
        throw new Error("Invalid response format: expected array");
      }

      const chart: IChart = {
        labels: [],
        values: [],
      };

      const newData: Data[] = [];
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

      setData(newData);
      setChart(chart);
      setShow(false);
    } catch (err) {
      console.error("Error applying global filters:", err);
      setShow(false);
    }
  }, [globalFilters.confidence, globalFilters.satelite, globalFilters.time, setShow, setData, setChart]);

  const resetAllFilters = () => {
    setGlobalFilters({
      confidence: undefined,
      satelite: undefined,
      time: {},
    });
    getDataLocation("location");
    setDrillDownLevel("pulau");

    const initialData = data.map((item) => ({
      ...item,
      child: [],
      isOpen: false,
    }));
    setData(initialData);

    const chart: IChart = {
      labels: initialData.map((pulau) => pulau.data),
      values: initialData.map((pulau) => pulau.total),
    };
    setChart(chart);

    const bounds = L.latLngBounds(L.latLng(-11, 94), L.latLng(6, 141));
    setMapBounds(bounds);
  };

  const handleSelection = async (selectedData: { wilayah?: string | number; name?: string; lat?: number; lng?: number }) => {
    if (!selectedData || (!selectedData.wilayah && !selectedData.name)) {
      console.error("Tidak tersedia", selectedData);
      return;
    }

    const wilayahDicari = selectedData.wilayah || selectedData.name;
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/location`
    );
    const locationData: LocationData[] = await response.json();

    const matchingLocations = locationData.filter(
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
      matchingLocations.reduce((sum: number, loc: LocationData) => sum + loc.lat, 0) /
      matchingLocations.length;
    const avgLng =
      matchingLocations.reduce((sum: number, loc: LocationData) => sum + loc.lng, 0) /
      matchingLocations.length;
    setSelectedLocation({ lat: avgLat, lng: avgLng });
  };

  const handleDrillDownChange = (newLevel: DrillDownLevel) => {
    setDrillDownLevel(newLevel);
  };

  const getChild = (indexes: number[], query: QueryData, tipe: Type) => {
    const levelMap: Record<string, DrillDownLevel> = {
      provinsi: "provinsi",
      kota: "kabupaten",
      kecamatan: "kecamatan",
      desa: "desa",
    };
    if (tipe === "provinsi" || tipe === "kota" || tipe === "kecamatan" || tipe === "desa") {
      setDrillDownLevel(levelMap[tipe]);
    } else {
        console.warn(`Unexpected 'tipe' value: ${tipe}. Cannot set drillDownLevel.`);
    }

    setShow(true);

    const filteredQuery = {
      ...query,
      ...(globalFilters.confidence && { confidence: globalFilters.confidence }),
      ...(globalFilters.satelite && { satelite: globalFilters.satelite }),
      ...(globalFilters.time.tahun && { tahun: globalFilters.time.tahun }),
      ...(globalFilters.time.semester && {
        semester: globalFilters.time.semester,
      }),
      ...(globalFilters.time.kuartal && {
        kuartal: globalFilters.time.kuartal,
      }),
      ...(globalFilters.time.bulan && { bulan: globalFilters.time.bulan }),
      ...(globalFilters.time.hari && { hari: globalFilters.time.hari }),
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

        setShow(false);
        setChart(chart);
      })
      .catch((err) => {
        console.error(err);
        setShow(false);
      });
  };

  const handleSelectt = (
    itemClicked: Data,
    indexes: number[],
    nextDrillType: Type
  ) => {
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }

    handleSelection({
      wilayah: itemClicked.data,
      lat: itemClicked.query.lat,
      lng: itemClicked.query.lng,
    });

    setData((prevData) => {
      const newData = JSON.parse(JSON.stringify(prevData));
      let currentLevel: Data[] = newData;
      let targetItem: Data | undefined;

      for (let i = 0; i < indexes.length; i++) {
        const index = indexes[i];
        if (!currentLevel[index]) {
          console.error(`Error: Index ${index} not found in data structure.`);
          return prevData;
        }
        if (i === indexes.length - 1) {
          targetItem = currentLevel[index];
          targetItem.isOpen = !targetItem.isOpen;
        }
        currentLevel = currentLevel[index].child;
      }

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
        getChild(indexes, queryForDrill, nextDrillType);
      }
      return newData;
    });

    setChart({ labels: [itemClicked.data], values: [itemClicked.total] });
  };

  const [modalTime, setModalTime] = useState<{
    isOpen: boolean;
    index: number[];
    query: QueryData;
    tipe: Type;
  }>({
    isOpen: false,
    index: [],
    query: {},
    tipe: "pulau",
  });
  
  const getDataLocation = useCallback(async (target: string) => {
    try {
      const queryParams: QueryData = {
        dimension: target,
      };
      
      const res = (await OlapService.query("location", queryParams)) as [string, number][];

      const chart: IChart = {
        labels: [],
        values: [],
      };

      if (Array.isArray(res)) {
        res.forEach((d: [string, number]) => {
          chart.labels.push(d[0]);
          chart.values.push(d[1]);

          setData((prevData) => [
            ...prevData,
            {
              data: d[0],
              total: d[1],
              modal: false,
              query: { pulau: d[0] as string },
              child: [],
              isOpen: false,
            },
          ]);
        });

        setShow(false);
        setChart(chart);
      } else {
        console.error("Data is not an array:", res);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      setShow(false);
    }
  }, [setChart, setShow, setData]);

  useEffect(() => {
    if (!hasFetched.current) {
      getDataLocation("location");
      fetchOlapData();
      hasFetched.current = true;
    }
  }, [getDataLocation, fetchOlapData]);

  useEffect(() => {
    if (hasFetched.current) {
      applyGlobalFilters();
    }
  }, [globalFilters.confidence, globalFilters.satelite, globalFilters.time, applyGlobalFilters, hasFetched]);

  const openModalTime = (index: number[], query: QueryData, tipe: Type) => {
    setModalTime({
      isOpen: true,
      index,
      query,
      tipe,
    });
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
    tipe: Type;
  }) => {
    const timeFilters = {
      tahun: filterData.data.tahun || undefined,
      semester: filterData.data.semester || undefined,
      kuartal: filterData.data.kuartal || undefined,
      bulan: filterData.data.bulan || undefined,
      hari: filterData.data.hari || undefined,
    };

    setGlobalFilters((prev) => ({
      ...prev,
      time: timeFilters,
    }));

    closeModalTime();
  };

  const getSatelite = (query: QueryData, tipe: Type) => {
    const q = { ...query, dimension: "satelite" };
    setShow(true);

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
      setShow(false);
      setDataSatelite(res as OlapData[]);
    });
  };

  const getConfidence = (query: QueryData, tipe: Type) => {
    const q = { ...query, dimension: "confidence" };
    setShow(true);

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
      setShow(false);
      setDataConfidence(res as OlapData[]);
    });
  };

  useEffect(() => {
    getConfidence({}, "pulau");
  }, []);

  const handleChartClick = (
    event: ChartEvent,
    elements: ActiveElement[],
    chart: Chart
  ) => {
    if (elements.length > 0) {
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
          setDrillDownLevel("kabupaten");
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
  };

  const barChartOptions: ChartConfiguration["options"] = {
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
        callbacks: {
          label: function (tooltipItem) {
            setSelectedHotspot(tooltipItem.raw as number);
            return `Jumlah Hotspot: ${tooltipItem.raw}`;
          },
        },
      },
    },
    onClick: handleChartClick,
  };

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
      {/* Main Content Area */}
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

        {/* Left Sidebar */}
        <div
          className={`${
            isSidebarOpen ? "block" : "hidden"
          } md:block w-full md:w-80 bg-white border-r border-gray-200 flex flex-col overflow-y-auto`}
        >
          {/* Filter Section */}
          <div className="p-3 border-b border-gray-200 bg-gray-50">
            <h2 className="text-md font-semibold text-black mb-2">Filters</h2>

            {/* Confidence Filter */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confidence Level
              </label>
              <select
                className="w-full px-2 py-1 rounded border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-300 text-gray-700 text-sm"
                value={globalFilters.confidence || ""}
                onChange={(e) =>
                  setGlobalFilters({
                    ...globalFilters,
                    confidence: e.target.value || undefined,
                  })
                }
              >
                <option value="">All Confidence</option>
                {dataConfidence &&
                  dataConfidence.map((conf: OlapData, i: number) => (
                    <option key={i} value={conf[0]}>
                      {conf[0]}
                    </option>
                  ))}
              </select>
            </div>

            {/* Satellite Filter */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Satellite
              </label>
              <select
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
                onClick={() => getSatelite({}, "pulau")}
              >
                <option value="">All Satellites</option>
                {dataSatelite &&
                  dataSatelite.map((sat: OlapData, i: number) => (
                    <option key={i} value={sat[0]}>
                      {sat[0]}
                    </option>
                  ))}
              </select>
            </div>

            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Filter Waktu Peta Distribusi Hotspot
              </label>
              <button
                className="w-full px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none text-sm transition"
                onClick={() => openModalTime([], {}, "pulau")}
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
                        <span>{globalFilters.time.kuartal}</span>
                      )}
                      {globalFilters.time.bulan && (
                        <span>Bulan {globalFilters.time.bulan}</span>
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

            {/* Reset Button */}
            <button
              className="w-full px-2 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 focus:outline-none text-sm transition"
              onClick={resetAllFilters}
            >
              Reset Semua Filter
            </button>
          </div>

          {/* Location List */}
          <div className="p-3 border-b border-gray-200 flex justify-between items-center bg-gray-50">
            <h2 className="text-md font-semibold text-black">Location</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {data && data.map((item, i) => (
              <div key={i} className="mb-3">
                  {/* Pulau */}
                  <div className="bg-white rounded-lg shadow-xs p-3 border-l-4 border-blue-500 hover:shadow-sm transition">
                    <div className="flex justify-between items-center">
                      <span
                        className="font-semibold text-sm text-black cursor-pointer hover:text-blue-600 transition"
                        onClick={() => handleSelectt(item, [i], "provinsi")}
                      >
                        {item.data}{" "}
                        <FontAwesomeIcon
                          icon={item.isOpen ? faChevronUp : faChevronDown}
                          className="ml-1 text-xs"
                        />
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-white text-xs ${getStatusColor(item.query.confidence)}`}
                      >
                        {item.query.confidence ?? "Confidence"}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-end">
                      <span className="text-gray-700 text-xs font-medium bg-gray-100 px-2 py-0.5 rounded">
                        Total: {item.total}
                      </span>
                    </div>
                  </div>

                  {/* Provinsi */}
                  {item.isOpen && item.child && item.child.map((provinsi, j) => (
                    <div key={j} className="mt-2 ml-4">
                      <div className="bg-white rounded-lg shadow-xs p-3 border-l-4 border-green-500 hover:shadow-sm transition">
                        <div className="flex justify-between items-center">
                          <span
                            className="font-semibold text-black text-sm cursor-pointer hover:text-blue-600 transition"
                            onClick={() =>
                              handleSelectt(provinsi, [i, j], "kota")
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
                            className={`px-2 py-0.5 rounded-full text-white text-xs ${getStatusColor(provinsi.query.confidence)}`}
                          >
                            {provinsi.query.confidence ?? "Confidence"}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-gray-500 truncate">
                          Pulau: {item.data}
                        </div>
                        <div className="mt-2 flex items-center justify-end">
                          <span className="text-gray-700 text-xs font-medium bg-gray-100 px-2 py-0.5 rounded">
                            Total: {provinsi.total}
                          </span>
                        </div>
                      </div>

                        {/* Kota */}
                        {provinsi.isOpen && provinsi.child && provinsi.child.map((kota, k) => (
                          <div key={k} className="mt-2 ml-4">
                            <div className="bg-white rounded-lg shadow-xs p-3 border-l-4 border-yellow-500 hover:shadow-sm transition">
                              <div className="flex justify-between items-center">
                                <span
                                  className="font-semibold text-black text-sm cursor-pointer hover:text-blue-600 transition"
                                  onClick={() =>
                                    handleSelectt(kota, [i, j, k], "kecamatan")
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
                                  className={`px-2 py-0.5 rounded-full text-white text-xs ${getStatusColor(kota.query.confidence)}`}
                                >
                                  {kota.query.confidence ?? "Confidence"}
                                </span>
                              </div>
                              <div className="mt-1 text-xs text-gray-500 truncate">
                                Pulau: {item.data} | Provinsi: {provinsi.data}
                              </div>
                              <div className="mt-2 flex items-center justify-end">
                                <span className="text-gray-700 text-xs font-medium bg-gray-100 px-2 py-0.5 rounded">
                                  Total: {kota.total}
                                </span>
                              </div>
                            </div>

                              {/* Kecamatan */}
                              {kota.isOpen && kota.child && kota.child.map((kecamatan, l) => (
                                <div key={l} className="mt-2 ml-4">
                                  <div className="bg-white rounded-lg shadow-xs p-3 border-l-4 border-purple-500 hover:shadow-sm transition">
                                    <div className="flex justify-between items-center">
                                      <span
                                        className="font-semibold text-black text-sm cursor-pointer hover:text-blue-600 transition"
                                        onClick={() =>
                                          handleSelectt(kecamatan, [i, j, k, l], "desa")
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
                                        className={`px-2 py-0.5 rounded-full text-white text-xs ${getStatusColor(kecamatan.query.confidence)}`}
                                      >
                                        {kecamatan.query.confidence ?? "Confidence"}
                                      </span>
                                    </div>
                                    <div className="mt-1 text-xs text-gray-500 truncate">
                                      Pulau: {item.data} | Provinsi:{" "} {provinsi.data} | Kota: {kota.data}
                                    </div>
                                    <div className="mt-2 flex items-center justify-end">
                                      <span className="text-gray-700 text-xs font-medium bg-gray-100 px-2 py-0.5 rounded">
                                        Total: {kecamatan.total}
                                      </span>
                                    </div>
                                  </div>

                                    {/* Desa */}
                                    {kecamatan.isOpen &&kecamatan.child && kecamatan.child.map((desa, m) => (
                                      <div key={m} className="mt-2 ml-4">
                                        <div className="bg-white rounded-lg shadow-xs p-3 border-l-4 border-red-500 hover:shadow-sm transition">
                                          <div className="flex justify-between items-center">
                                            <span
                                              className="font-semibold text-black text-sm cursor-pointer hover:text-blue-600 transition"
                                              onClick={() =>
                                                handleSelectt(desa, [i, j, k, l, m], "desa")
                                              }
                                            >
                                              {desa.data}{" "}
                                            </span>
                                            <span
                                              className={`px-2 py-0.5 rounded-full text-white text-xs ${getStatusColor(desa.query.confidence)}`}
                                            >
                                              {desa.query.confidence ?? "Confidence"}
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
                                              Total: {desa.total}
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
              ))}
          </div>
        </div>

        {/* Right Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Map Section */}
          <div className="h-[50vh] md:h-[70%] relative text-black">
            <div className="absolute inset-0">
              <Map
                bounds={mapBounds ?? undefined}
                selectedLocation={selectedLocation}
                olapData={olapData}
                drillDownLevel={drillDownLevel}
                onDrillDownChange={handleDrillDownChange}
                style={{ height: "100%", width: "100%", margin: 0, padding: 0 }}
                filters={{
                  confidence: globalFilters.confidence?.toLowerCase(),
                  satelite: globalFilters.satelite?.toLowerCase(),
                  time: globalFilters.time,
                }}
              />
            </div>
          </div>

          {/* Chart Section */}
          <div className="h-[50vh] md:h-[30%] bg-white border-t border-gray-200 z-20 overflow-hidden">
            <div className="h-full p-3 flex flex-col">
              <div className="flex justify-between items-center mb-2">
                <h2 className="font-semibold text-gray-700">Hotspot Chart</h2>
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                    {drillDownLevel
                      ? `Level: ${
                          drillDownLevel.charAt(0).toUpperCase() +
                          drillDownLevel.slice(1)
                        }`
                      : "Level: Nasional"}
                  </span>
                </div>
              </div>
              <div className="flex-1 min-h-0">
                {barChartData ? (
                  <Bar
                    data={barChartData}
                    options={{
                      ...barChartOptions,
                      maintainAspectRatio: false,
                      responsive: true,
                      onClick: handleChartClick,
                      plugins: {
                        legend: {
                          position: "top",
                          labels: {
                            font: {
                              size: 11,
                            },
                            boxWidth: 12,
                          },
                        },
                        tooltip: {
                          bodyFont: {
                            size: 11,
                          },
                          titleFont: {
                            size: 12,
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
                          },
                        },
                        y: {
                          ticks: {
                            font: {
                              size: 10,
                            },
                            precision: 0,
                          },
                        },
                      },
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                    <div className="animate-pulse">Loading chart data...</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Time */}
      {modalTime.isOpen && (
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