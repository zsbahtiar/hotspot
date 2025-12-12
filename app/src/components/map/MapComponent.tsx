import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useGeoJsonCache } from "@/hooks/useGeoJsonCache";
import type { CachedGeoJsonData } from "@/hooks/useGeoJsonCache";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  Popup,
  Marker,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { scaleThreshold } from "d3-scale";
import L from "leaflet";
import type { Map, GeoJSON as LeafletGeoJSON, Layer } from "leaflet";
import { RefreshCw, X, Loader2 } from "lucide-react";
import type { DrillDownLevel } from "@/core/models/location";
import type { FeatureCollection, Feature } from "geojson";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import MarkerClusterGroup from "react-leaflet-markercluster";
import type { MapComponentProps, MarkerClusterType } from "@/core/models/map";
import type { CustomFeature, GeoData } from "@/core/models/location";
import type { HotspotFeatureGeo } from "@/core/models/hotspot";
import { formatNumber, extractTime } from "@/core/utils/formatters";
import MapControlPanel from "@/components/map/MapControls";
import MapLegend from "@/components/map/MapLegend";
import MapZoomControls from "@/components/map/ZoomControls";
import { monthNames } from "@/core/models/time";
import { mockHotspotData } from "@/mocks/hotspotData";
import { hotspotService } from "@/core/services/hotspotService";

const USE_MOCK_DATA = false;

const fetchHotspotData = async (filters?: {
  confidence?: string | null;
  satellite?: string | null;
  year?: number;
  semester?: number;
  quarter?: number;
  month?: number;
  week?: number;
  start_date?: string;
  end_date?: string;
}) => {
  if (USE_MOCK_DATA) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return mockHotspotData;
  }

  // Build filter parameters for API call
  const apiFilters: any = {};

  if (filters?.confidence) {
    apiFilters.confidence = filters.confidence.toUpperCase();
  }

  if (filters?.satellite) {
    apiFilters.satellite = filters.satellite;
  }

  if (filters?.year) {
    apiFilters.year = filters.year;
  }

  if (filters?.semester) {
    apiFilters.semester = filters.semester;
  }

  if (filters?.quarter) {
    apiFilters.quarter = filters.quarter;
  }

  if (filters?.month) {
    apiFilters.month = filters.month;
  }

  if (filters?.week) {
    apiFilters.week = filters.week;
  }

  if (filters?.start_date) {
    apiFilters.start_date = filters.start_date;
  }

  if (filters?.end_date) {
    apiFilters.end_date = filters.end_date;
  }

  // Use backend GeoJSON endpoint with filters
  const response = await hotspotService.getHotspotsGeoJSON(apiFilters);
  return response.data;
};

interface CustomAttributionControlProps {
  position: L.ControlPosition;
  attributionText: string;
  className?: string;
}

const CustomAttributionControl: React.FC<CustomAttributionControlProps> = ({
  position,
  attributionText,
  className,
}) => {
  const map = useMap();
  const attributionRef = useRef<L.Control.Attribution | null>(null);

  useEffect(() => {
    if (attributionRef.current) {
      map.removeControl(attributionRef.current);
    }
    const attribution = L.control.attribution({ position: position });
    attribution.setPrefix(attributionText);

    attribution.addTo(map);
    attributionRef.current = attribution;

    const controlContainer = attribution.getContainer();
    if (controlContainer && className) {
      controlContainer.classList.add(className);
    }
    return () => {
      if (attributionRef.current) {
        map.removeControl(attributionRef.current);
        attributionRef.current = null;
      }
    };
  }, [map, position, attributionText, className]);
  return null;
};

const customMarker = (confidence: string) => {
  let iconColor: string;
  switch (confidence.toLowerCase()) {
    case "high":
      iconColor = "red";
      break;
    case "medium":
      iconColor = "yellow";
      break;
    case "low":
      iconColor = "green";
      break;
    default:
      iconColor = "gray";
  }
  return new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${iconColor}.png`,
    iconSize: [12, 20],
    iconAnchor: [6, 20],
    popupAnchor: [0, -18],
    shadowSize: [20, 20],
  });
};

function getFeatureName(
  feature: CustomFeature,
  level: DrillDownLevel,
): string | undefined;
function getFeatureName(
  feature: Feature,
  level: DrillDownLevel,
): string | undefined;
function getFeatureName(
  feature: CustomFeature | Feature,
  level: DrillDownLevel,
): string | undefined {
  const props = feature.properties;
  if (!props) return undefined;

  if (
    "PULAU" in props ||
    "WADMPR" in props ||
    "WADMKK" in props ||
    "WADMKC" in props ||
    "NAMOBJ" in props
  ) {
    const customProps = props as CustomFeature["properties"];
    switch (level) {
      case "pulau":
        return customProps?.PULAU;
      case "provinsi":
        return customProps?.WADMPR;
      case "kota":
        return customProps?.WADMKK;
      case "kecamatan":
        return customProps?.WADMKC;
      case "desa":
        return customProps?.NAMOBJ;
      default:
        return undefined;
    }
  }

  const genericProps = props as Record<string, unknown>;
  switch (level) {
    case "pulau":
      return genericProps.PULAU?.toString();
    case "provinsi":
      return genericProps.WADMPR?.toString();
    case "kota":
      return genericProps.WADMKK?.toString();
    case "kecamatan":
      return genericProps.WADMKC?.toString();
    case "desa":
      return genericProps.NAMOBJ?.toString();
    default:
      return undefined;
  }
}

function normalizeRegionName(name: string): string {
  if (!name) return "";

  const normalized = name.toUpperCase().trim();
  if (normalized.includes("YOGYAKARTA") || normalized.includes("JOGJAKARTA")) {
    return "DAERAH ISTIMEWA YOGYAKARTA";
  }
  return name
    .replace(/^DESA\s+/i, "")
    .replace(/^KELURAHAN\s+/i, "")
    .replace(/^KABUPATEN\s+/i, "")
    .trim()
    .toUpperCase();
}

const getParentFieldAndValue = (
  drillDownLevel: DrillDownLevel,
  olapData?: MapComponentProps["olapData"],
): { field: string; value: string | undefined } | null => {
  if (!olapData?.query) return null;
  switch (drillDownLevel) {
    case "provinsi":
      return { field: "PULAU", value: olapData.query.pulau };
    case "kota":
      return { field: "WADMPR", value: olapData.query.provinsi };
    case "kecamatan":
      return { field: "WADMKK", value: olapData.query.kota };
    case "desa":
      return { field: "WADMKC", value: olapData.query.kecamatan };
    default:
      return null;
  }
};

function filterGeoJsonFeatures(
  features: Feature[],
  drillDownLevel: DrillDownLevel,
  olapData?: MapComponentProps["olapData"],
): Feature[] {
  if (drillDownLevel === "pulau" || !olapData?.query) return features;
  const parent = getParentFieldAndValue(drillDownLevel, olapData);
  if (!parent || !parent.value) {
    return features;
  }
  const { field, value } = parent;
  const parentVal = value.toUpperCase().trim();
  const filtered = features.filter((f) => {
    const geoVal = f.properties?.[field]?.toString().toUpperCase().trim() ?? "";
    const matches = geoVal === parentVal;
    return matches;
  });
  return filtered;
}

const MapComponent: React.FC<MapComponentProps> = ({
  bounds,
  selectedLocation,
  drillDownLevel,
  olapData = {},
  className = "",
  style = {},
  filters = {},
  onLayerChange,
  locationData,
  defaultZoom = 5,
}) => {
  const mapRef = useRef<Map | null>(null);
  const geoJsonRef = useRef<LeafletGeoJSON | null>(null);
  const [showJumlahHotspot, setShowJumlahHotspot] = useState(true);
  const [showLokasiHotspot, setShowLokasiHotspot] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isControlPanelCollapsed, setIsControlPanelCollapsed] = useState(false);
  const [selectedDate, setSelectedDate] = useState(
    () => new Date().toISOString().split("T")[0],
  );
  const [loadingLevel, setLoadingLevel] = useState<string | null>(null);

  const {
    cachedData: geoJsonCacheData,
    isLoading: isGeoJsonLoading,
    fetchAndCacheGeoJson,
  } = useGeoJsonCache();

  const hasFetchedInitialGeoJson = useRef(false);
  const fetchedLevels = useRef<Set<string>>(new Set());

  const swrRetryConfig = {
    revalidateOnFocus: false,
    errorRetryCount: 3,
    errorRetryInterval: 1000,
    dedupingInterval: 2000,
    shouldRetryOnError: true,
    onErrorRetry: (
      error: unknown,
      key: string,
      config: unknown,
      revalidate: Function,
      { retryCount }: { retryCount: number },
    ) => {
      if (retryCount >= 3) return;
      setTimeout(() => revalidate({ retryCount }), 1000 * (retryCount + 1));
    },
  };

  const geoData: GeoData = useMemo(
    () => ({
      pulau: geoJsonCacheData?.island || null,
      provinsi: geoJsonCacheData?.province || null,
      kota: geoJsonCacheData?.city || null,
      kecamatan: geoJsonCacheData?.district || null,
      desa: geoJsonCacheData?.subdistrict || null,
    }),
    [geoJsonCacheData],
  );

  useEffect(() => {
    if (!geoJsonCacheData?.island && !hasFetchedInitialGeoJson.current) {
      hasFetchedInitialGeoJson.current = true;
      fetchAndCacheGeoJson("island").catch((error) => {
        console.error("Failed to fetch initial GeoJSON data:", error);
        hasFetchedInitialGeoJson.current = false;
      });
    }
  }, [geoJsonCacheData?.island, fetchAndCacheGeoJson]);

  useEffect(() => {
    const levelMap: Record<
      DrillDownLevel,
      keyof Omit<CachedGeoJsonData, "timestamp">
    > = {
      pulau: "island",
      provinsi: "province",
      kota: "city",
      kecamatan: "district",
      desa: "subdistrict",
    };

    const currentLevel = levelMap[drillDownLevel];

    if (
      geoJsonCacheData &&
      !geoJsonCacheData[currentLevel] &&
      !fetchedLevels.current.has(currentLevel)
    ) {
      fetchedLevels.current.add(currentLevel);
      setLoadingLevel(currentLevel);

      const levelNames = {
        province: "provinsi",
        city: "kabupaten/kota",
        district: "kecamatan",
        subdistrict: "desa/kelurahan",
      };

      fetchAndCacheGeoJson(currentLevel)
        .catch((error) => {
          console.error(`Failed to fetch ${currentLevel} GeoJSON data:`, error);
          fetchedLevels.current.delete(currentLevel);
        })
        .finally(() => {
          setLoadingLevel(null);
        });
    }
  }, [drillDownLevel, geoJsonCacheData, fetchAndCacheGeoJson]);

  const getHotspotData = useMemo(() => {
    if (USE_MOCK_DATA) {
      return "/hotspot";
    }

    const baseUrl = `${import.meta.env.PUBLIC_API_URL || ""}/hotspot`;
    const queryParams = new URLSearchParams();

    if (showLokasiHotspot) {
      if (selectedDate) {
        queryParams.append("selectedDate", selectedDate);
      } else {
        const today = new Date().toISOString().split("T")[0];
        queryParams.append("selectedDate", today);
      }

      if (olapData?.query) {
        Object.entries(olapData.query).forEach(([key, value]) => {
          if (
            value &&
            key !== "lat" &&
            key !== "lng" &&
            key !== "dimension" &&
            key !== "tipe"
          ) {
            queryParams.append(key, value.toString());
          }
        });
      }
      return queryParams.toString()
        ? `${baseUrl}?${queryParams.toString()}`
        : baseUrl;
    }

    if (showJumlahHotspot) {
      if (filters?.confidence) {
        queryParams.append("confidence", filters.confidence);
      }
      if (filters?.satelite) {
        queryParams.append("satelite", filters.satelite);
      }

      if (filters?.filterMode === "date" && filters?.selectedDate) {
        queryParams.append("selectedDate", filters.selectedDate);
      } else if (filters?.filterMode === "period" && filters?.time) {
        Object.entries(filters.time).forEach(([key, value]) => {
          if (value) {
            queryParams.append(key, value.toString());
          }
        });
      }

      if (olapData?.query) {
        Object.entries(olapData.query).forEach(([key, value]) => {
          if (
            value &&
            key !== "lat" &&
            key !== "lng" &&
            key !== "dimension" &&
            key !== "tipe"
          ) {
            queryParams.append(key, value.toString());
          }
        });
      }
    }

    return queryParams.toString()
      ? `${baseUrl}?${queryParams.toString()}`
      : baseUrl;
  }, [filters, olapData, showJumlahHotspot, showLokasiHotspot, selectedDate]);

  // Build filter params for API query
  const apiFilterParams = useMemo(() => {
    const params: any = {};

    if (filters?.confidence) {
      params.confidence = filters.confidence;
    }

    if (filters?.satelite) {
      params.satellite = filters.satelite;
    }

    // Time period filters
    if (filters?.filterMode === "period" && filters?.time) {
      if (filters.time.tahun) {
        params.year = parseInt(filters.time.tahun);
      }
      if (filters.time.semester) {
        params.semester = parseInt(filters.time.semester);
      }
      if (filters.time.kuartal) {
        params.quarter = parseInt(filters.time.kuartal);
      }
      if (filters.time.bulan) {
        params.month = parseInt(filters.time.bulan);
      }
      if (filters.time.minggu) {
        params.week = parseInt(filters.time.minggu);
      }
    }

    // Specific date filter
    if (filters?.filterMode === "date" && filters?.selectedDate) {
      // Convert YYYY-MM-DD to RFC3339 format for start and end of day
      const date = new Date(filters.selectedDate);
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
      const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);

      params.start_date = startOfDay.toISOString();
      params.end_date = endOfDay.toISOString();
    }

    return params;
  }, [filters]);

  const {
    data: hotspotApiResponse,
    error: hotspotError,
    isLoading: isHotspotLoading,
  } = useQuery({
    queryKey: ["map-hotspots", apiFilterParams],
    queryFn: () => fetchHotspotData(apiFilterParams),
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const hotspotData: HotspotFeatureGeo[] = useMemo(() => {
    return hotspotApiResponse?.features || [];
  }, [hotspotApiResponse]);

  const calculateDateCounts = (data: HotspotFeatureGeo[]) => {
    const counts: Record<string, number> = {};
    data.forEach((feature) => {
      const date = feature.properties?.time?.split("T")[0] || "Unknown";
      if (date) {
        counts[date] = (counts[date] || 0) + 1;
      }
    });
    return counts;
  };

  const { dateCounts, initialSelectedDate } = useMemo(() => {
    if (!hotspotData || hotspotData.length === 0) {
      return { dateCounts: {}, initialSelectedDate: "" };
    }
    const counts = calculateDateCounts(hotspotData);
    const dates = Object.keys(counts).sort().reverse();
    const initialDate = dates.length > 0 ? dates[0] : "";
    return { dateCounts: counts, initialSelectedDate: initialDate };
  }, [hotspotData]);

  useEffect(() => {
    if (initialSelectedDate && !selectedDate) {
      setSelectedDate(initialSelectedDate);
    }
  }, [initialSelectedDate]);

  useEffect(() => {
    if (showLokasiHotspot && !selectedDate) {
      const today = new Date().toISOString().split("T")[0];
      if (dateCounts[today] && dateCounts[today] > 0) {
        setSelectedDate(today);
      } else if (initialSelectedDate) {
        setSelectedDate(initialSelectedDate);
      }
    }
  }, [showLokasiHotspot]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (showLokasiHotspot) {
      setIsFullscreen(true);
    } else {
      setIsFullscreen(false);
    }
  }, [showLokasiHotspot]);

  const calculateHotspotCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    if (locationData && locationData.length > 0) {
      locationData.forEach(([location, total]) => {
        const normalizedLocation = normalizeRegionName(location);
        counts[normalizedLocation] = total;
      });
      return counts;
    }

    hotspotData.forEach((hotspot) => {
      if (
        filters?.confidence &&
        hotspot.properties?.confidence?.toLowerCase() !==
          filters.confidence?.toLowerCase()
      ) {
        return;
      }

      if (
        filters?.satelite &&
        hotspot.properties?.satellite?.toLowerCase() !==
          filters.satelite?.toLowerCase()
      ) {
        return;
      }

      if (filters?.filterMode === "date" && filters.selectedDate) {
        const hotspotDate = new Date(hotspot.properties?.time || "");
        const filterDate = new Date(filters.selectedDate);

        if (
          hotspotDate.getFullYear() !== filterDate.getFullYear() ||
          hotspotDate.getMonth() !== filterDate.getMonth() ||
          hotspotDate.getDate() !== filterDate.getDate()
        ) {
          return;
        }
      } else if (filters?.filterMode === "period" && filters?.time) {
        const hotspotDate = new Date(hotspot.properties?.time || "");
        if (
          filters.time.tahun &&
          hotspotDate.getFullYear().toString() !== filters.time.tahun
        ) {
          return;
        }
        if (filters.time.semester) {
          const semester = Math.ceil((hotspotDate.getMonth() + 1) / 6);
          if (semester.toString() !== filters.time.semester) {
            return;
          }
        }
        if (filters.time.kuartal) {
          const quarter = Math.ceil((hotspotDate.getMonth() + 1) / 3);
          if (`Q${quarter}` !== filters.time.kuartal) {
            return;
          }
        }
        if (filters.time.bulan) {
          const monthIndex = monthNames.indexOf(filters.time.bulan);
          if (monthIndex !== -1 && hotspotDate.getMonth() !== monthIndex) {
            return;
          }
        }
        if (
          filters.time.minggu &&
          hotspot.properties?.minggu !== filters.time.minggu
        ) {
          return;
        }
      }
      const location = hotspot.properties?.location;
      if (!location) return;

      let key: string | undefined;
      switch (drillDownLevel) {
        case "pulau":
          key = (location.pulau ?? "").toUpperCase().trim();
          break;
        case "provinsi":
          if (
            olapData?.query?.pulau &&
            location.pulau !== olapData.query.pulau
          ) {
            return;
          }
          key = (location.provinsi ?? "").toUpperCase().trim();
          break;
        case "kota":
          if (
            olapData?.query?.provinsi &&
            location.provinsi !== olapData.query.provinsi
          ) {
            return;
          }
          key = normalizeRegionName(location.kab_kota ?? "");
          break;
        case "kecamatan":
          if (
            olapData?.query?.kota &&
            location.kab_kota !== olapData.query.kota
          ) {
            return;
          }
          key = normalizeRegionName(location.kecamatan ?? "");
          break;
        case "desa":
          if (
            olapData?.query?.kecamatan &&
            location.kecamatan !== olapData.query.kecamatan
          ) {
            return;
          }
          key = normalizeRegionName(location.desa ?? "");
          break;
      }
      if (key) {
        counts[key] =
          (counts[key] || 0) + (hotspot.properties?.hotspot_count || 0);
      }
    });
    return counts;
  }, [locationData, hotspotData, drillDownLevel, filters, olapData]);

  const getFilteredGeoFeatures = useMemo(() => {
    if (!geoData[drillDownLevel]) return [];
    const features = geoData[drillDownLevel]?.features ?? [];
    let filtered = filterGeoJsonFeatures(features, drillDownLevel, olapData);

    if (
      drillDownLevel === "provinsi" &&
      olapData?.query?.pulau &&
      olapData.query.pulau.toUpperCase().includes("JAWA")
    ) {
      const hasYogyakarta = filtered.some((f) => {
        const name = getFeatureName(f, "provinsi");
        return (
          name && (name.includes("Yogyakarta") || name.includes("Jogjakarta"))
        );
      });

      if (!hasYogyakarta) {
        const yogyaFeature = features.find((f) => {
          const name = getFeatureName(f, "provinsi");
          return (
            name && (name.includes("Yogyakarta") || name.includes("Jogjakarta"))
          );
        });

        if (yogyaFeature) {
          filtered.push(yogyaFeature);
        }
      }
    }

    filtered = filtered.filter((f) => {
      const name = normalizeRegionName(getFeatureName(f, drillDownLevel) ?? "");
      const count = calculateHotspotCounts[name] ?? 0;

      if (
        name.includes("YOGYAKARTA") &&
        getFeatureName(f, drillDownLevel)?.toUpperCase().includes("YOGYAKARTA")
      ) {
        return true;
      }
      return count > 0;
    });

    return filtered;
  }, [geoData, drillDownLevel, olapData, calculateHotspotCounts]);

  const { minHotspot, threshold1, threshold2 } = useMemo(() => {
    const hotspotValues = Object.values(calculateHotspotCounts).filter(
      (count) => count > 0,
    );
    const min = hotspotValues.length > 0 ? Math.min(...hotspotValues) : 0;
    const max = hotspotValues.length > 0 ? Math.max(...hotspotValues) : 1;

    if (max - min < 3) {
      const step = Math.ceil((max - min) / 3) || 1;
      return {
        minHotspot: min,
        threshold1: min + step,
        threshold2: min + step * 2,
      };
    } else {
      const range = max - min;
      const t1 = min + range / 3;
      const t2 = min + (range * 2) / 3;
      return { minHotspot: min, threshold1: t1, threshold2: t2 };
    }
  }, [calculateHotspotCounts]);

  const colorScale = useMemo(() => {
    return scaleThreshold<number, string>()
      .domain([threshold1, threshold2])
      .range(["#FFCDD2", "#EF5350", "#B71C1C"]);
  }, [threshold1, threshold2]);

  const styleFeature = useCallback(
    (feature?: CustomFeature): L.PathOptions => {
      if (!feature) return {};
      const featureName = normalizeRegionName(
        getFeatureName(feature, drillDownLevel) ?? "",
      );

      const totalHotspot = featureName
        ? calculateHotspotCounts[featureName] || 0
        : 0;

      return {
        fillColor: colorScale(totalHotspot),
        color: "white",
        weight: 0.8,
        fillOpacity: 0.8,
      };
    },
    [drillDownLevel, calculateHotspotCounts, colorScale],
  );

  const filteredHotspots = useMemo(() => {
    if (!showLokasiHotspot) return [];

    return hotspotData.filter((feature) => {
      const coords = feature.geometry?.coordinates;
      const date = feature.properties?.time?.split("T")[0];

      if (selectedDate) {
        return coords && coords.length === 2 && date === selectedDate;
      } else {
        const today = new Date().toISOString().split("T")[0];
        return coords && coords.length === 2 && date === today;
      }
    });
  }, [hotspotData, showLokasiHotspot, selectedDate]);

  const mapStyle = useMemo(
    () => ({
      height: "100%",
      width: "100%",
      zIndex: 1,
    }),
    [],
  );

  useEffect(() => {
    const performZoom = () => {
      if (!mapRef.current || !geoData[drillDownLevel]) {
        return;
      }
      const zoomLevel =
        {
          pulau: 5,
          provinsi: 6,
          kota: 7,
          kecamatan: 8,
          desa: 9,
        }[drillDownLevel] || 6;

      if (drillDownLevel === "pulau") {
        const indonesiaBounds = L.latLngBounds(
          L.latLng(-11, 94),
          L.latLng(6, 141),
        );
        mapRef.current.fitBounds(indonesiaBounds, {
          maxZoom: 6,
          animate: true,
          duration: 0.8,
        });
      } else if (selectedLocation) {
        mapRef.current.flyTo(selectedLocation, zoomLevel, {
          animate: true,
          duration: 1.0,
        });
      } else {
        mapRef.current.setZoom(zoomLevel);
      }
    };

    const timers = [
      setTimeout(performZoom, 100),
      setTimeout(performZoom, 300),
      setTimeout(performZoom, 500),
    ];

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [drillDownLevel, geoData, selectedLocation]);

  const getCurrentFeatureName = useCallback(() => {
    if (!olapData?.query) return null;

    switch (drillDownLevel) {
      case "pulau":
        return olapData.query.pulau || null;
      case "provinsi":
        return olapData.query.provinsi || null;
      case "kota":
        return olapData.query.kota || null;
      case "kecamatan":
        return olapData.query.kecamatan || null;
      case "desa":
        return olapData.query.desa || null;
      default:
        return null;
    }
  }, [olapData, drillDownLevel]);

  useEffect(() => {
    if (mapRef.current && olapData?.query && geoJsonRef.current) {
      const currentName = getCurrentFeatureName();

      if (currentName) {
        const features = geoData[drillDownLevel]?.features || [];
        const selectedFeature = features.find((feature) => {
          return getFeatureName(feature, drillDownLevel) === currentName;
        });

        if (selectedFeature) {
          geoJsonRef.current.resetStyle();
          geoJsonRef.current.eachLayer((layer) => {
            const geoJSONLayer = layer as L.GeoJSON & {
              feature?: CustomFeature;
            };
            if (geoJSONLayer.feature === selectedFeature) {
              geoJSONLayer.setStyle({
                weight: 2,
                color: "#0000FF",
                fillOpacity: 0.9,
              });
              geoJSONLayer.bringToFront();
            }
          });
        }
      }
    }
  }, [olapData, drillDownLevel, geoData, getCurrentFeatureName]);

  useEffect(() => {
    if (mapRef.current) {
      // Multiple recalculations to ensure proper sizing after layout changes
      const timers = [
        setTimeout(() => {
          if (mapRef.current) {
            mapRef.current.invalidateSize(true);
          }
        }, 100),
        setTimeout(() => {
          if (mapRef.current) {
            mapRef.current.invalidateSize(true);
          }
        }, 300),
        setTimeout(() => {
          if (mapRef.current) {
            mapRef.current.invalidateSize(true);
          }
        }, 600),
      ];
      return () => {
        timers.forEach((timer) => clearTimeout(timer));
      };
    }
  }, [
    isFullscreen,
    isControlPanelCollapsed,
    showLokasiHotspot,
    showJumlahHotspot,
  ]);

  // More lenient loading condition - only show loading if actively fetching
  const loading =
    (isGeoJsonLoading || isHotspotLoading) && !geoData[drillDownLevel];
  const error = hotspotError;

  return (
    <div
      className={`${isFullscreen ? "fixed inset-0 z-[9999]" : "relative"} ${className}`}
      style={style}
    >
      <MapControlPanel
        isMobile={isMobile}
        isFullscreen={isFullscreen}
        isControlPanelCollapsed={isControlPanelCollapsed}
        setIsControlPanelCollapsed={setIsControlPanelCollapsed}
        showJumlahHotspot={showJumlahHotspot}
        setShowJumlahHotspot={setShowJumlahHotspot}
        showLokasiHotspot={showLokasiHotspot}
        setShowLokasiHotspot={setShowLokasiHotspot}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        dateCounts={dateCounts}
        onLayerChange={onLayerChange}
      />

      {loading ? (
        <div
          className="flex flex-col items-center justify-center h-full w-full bg-gray-100 dark:bg-gray-800 rounded-lg"
          style={{ minHeight: "600px" }}
        >
          <RefreshCw
            width="48"
            height="48"
            className="text-gray-600 dark:text-gray-400 mb-4"
            style={{ animation: "spin 1s linear infinite" }}
          />
          <p className="text-gray-700 dark:text-gray-300 text-center">
            Memuat peta Indonesia...
            <br />
            <span className="text-sm text-gray-500">
              {loadingLevel
                ? `Mengunduh batas ${
                    loadingLevel === "province"
                      ? "provinsi"
                      : loadingLevel === "city"
                        ? "kabupaten/kota"
                        : loadingLevel === "district"
                          ? "kecamatan"
                          : loadingLevel === "subdistrict"
                            ? "desa/kelurahan"
                            : loadingLevel
                  }...`
                : isGeoJsonLoading
                  ? "Mengunduh batas wilayah..."
                  : "Menginisialisasi peta..."}
            </span>
          </p>
        </div>
      ) : error ? (
        <div
          className="flex flex-col items-center justify-center h-full w-full bg-red-50 rounded-lg"
          style={{ minHeight: "600px" }}
        >
          <X width="48" height="48" className="text-red-500 mb-4" />
          <p className="text-red-700 font-semibold">Gagal memuat peta</p>
          <p className="text-red-600 text-sm mt-1">{error.message}</p>
        </div>
      ) : (
        <MapContainer
          bounds={bounds || undefined}
          center={bounds ? undefined : [-2.5, 118]}
          zoom={bounds ? undefined : defaultZoom}
          className="h-full w-full rounded-lg"
          style={mapStyle}
          ref={mapRef}
          attributionControl={false}
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            subdomains="abcd"
            maxZoom={20}
            minZoom={3}
            keepBuffer={2}
            updateWhenZooming={false}
            updateWhenIdle={true}
            tileSize={256}
          />
          <MapZoomControls isMobile={isMobile} isFullscreen={isFullscreen} />

          {showLokasiHotspot && (
            <CustomAttributionControl
              position="bottomright"
              attributionText="&copy; OpenStreetMap contributors &copy; CARTO"
              className="attribution-lokasi-hotspot"
            />
          )}

          {showJumlahHotspot &&
          getFilteredGeoFeatures.length === 0 &&
          !isHotspotLoading &&
          geoData[drillDownLevel] ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 bg-opacity-80 dark:bg-opacity-80 z-10">
              <p className="text-gray-700 dark:text-gray-300 text-lg font-semibold">
                Tidak ada data
              </p>
            </div>
          ) : (
            showJumlahHotspot &&
            geoData[drillDownLevel] && (
              <GeoJSON
                ref={geoJsonRef}
                key={`geojson-${drillDownLevel}-${JSON.stringify(olapData?.query || {})}-${getHotspotData}`}
                data={
                  {
                    type: "FeatureCollection",
                    features: getFilteredGeoFeatures,
                  } as FeatureCollection
                }
                style={styleFeature}
                onEachFeature={(feature: CustomFeature, layer: Layer) => {
                  feature.__layer = layer;
                  const featureName = normalizeRegionName(
                    getFeatureName(feature, drillDownLevel) ?? "",
                  );
                  const totalHotspot = featureName
                    ? calculateHotspotCounts[featureName] || 0
                    : 0;
                  layer.bindTooltip(`
                    <div class="tooltip-content text-sm">
                      <strong>
                        ${
                          drillDownLevel === "kota"
                            ? "Kabupaten/Kota"
                            : drillDownLevel.charAt(0).toUpperCase() +
                              drillDownLevel.slice(1)
                        }:
                      </strong> ${featureName || "N/A"}<br />
                      <strong>Jumlah Hotspot:</strong> ${formatNumber(
                        totalHotspot,
                      )}
                    </div>
                  `);
                  layer.on({
                    mouseover: (e) => {
                      const layer = e.target;
                      layer.setStyle({
                        weight: 2,
                        color: "#666",
                        fillOpacity: 0.9,
                      });
                      layer.bringToFront();
                    },
                    mouseout: (e) => {
                      if (
                        geoJsonRef.current &&
                        geoJsonRef.current.hasLayer(e.target)
                      ) {
                        geoJsonRef.current?.resetStyle(e.target);
                      }
                    },
                  });
                }}
              />
            )
          )}

          {showLokasiHotspot && filteredHotspots.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 bg-opacity-80 dark:bg-opacity-80 z-10">
              <p className="text-gray-700 dark:text-gray-300 text-lg font-semibold">
                Tidak ada data
              </p>
            </div>
          ) : (
            showLokasiHotspot && (
              <MarkerClusterGroup
                chunkedLoading
                spiderfyOnMaxZoom={true}
                disableClusteringAtZoom={13}
                maxClusterRadius={50}
                iconCreateFunction={(cluster: MarkerClusterType) => {
                  const count = cluster.getChildCount();
                  let className = "marker-cluster-";

                  if (count > 100) {
                    className += "large";
                  } else if (count > 20) {
                    className += "medium";
                  } else {
                    className += "small";
                  }

                  return new L.DivIcon({
                    html: `<div><span>${formatNumber(count)}</span></div>`,
                    className: `marker-cluster ${className}`,
                    iconSize: new L.Point(40, 40),
                  });
                }}
              >
                {filteredHotspots.map((feature, index) => {
                  const [longitude, latitude] = feature.geometry.coordinates;
                  const confidence =
                    feature.properties?.confidence || "unknown";
                  const date =
                    feature.properties?.time?.split("T")[0] || "Unknown";
                  const time = extractTime(
                    feature.properties?.hotspot_time ||
                      feature.properties?.time ||
                      "",
                  );

                  return (
                    <Marker
                      key={index}
                      position={[latitude, longitude]}
                      icon={customMarker(confidence)}
                    >
                      <Popup>
                        <div
                          className="hotspot-popup"
                          style={{ maxWidth: 320, minWidth: 280 }}
                        >
                          <div className="p-2">
                            <div className="flex items-center gap-2 mb-3 pb-2 border-b dark:border-gray-600">
                              <div className="w-3 h-3 bg-black dark:bg-white rounded-full"></div>
                              <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-200">
                                Detail Hotspot
                              </h4>
                              <div className="ml-auto">
                                <span className="text-xs text-gray-500 dark:text-gray-400 mr-1">
                                  Confidence:
                                </span>
                                <span
                                  className={`px-2 py-1 text-xs font-semibold rounded ${
                                    confidence.toLowerCase() === "high"
                                      ? "bg-red-300 text-black"
                                      : confidence.toLowerCase() === "medium"
                                        ? "bg-yellow-200 text-black"
                                        : "bg-green-300 text-black"
                                  }`}
                                >
                                  {confidence}
                                </span>
                              </div>
                            </div>

                            <div className="space-y-2 text-sm">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <span className="text-gray-500 dark:text-gray-400 block">
                                    Satelit
                                  </span>
                                  <span className="font-medium dark:text-gray-200">
                                    {feature.properties?.satellite || "-"}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-600 dark:text-gray-400 block">
                                    Tanggal
                                  </span>
                                  <span className="font-medium dark:text-gray-200">
                                    {new Date(date).toLocaleDateString(
                                      "id-ID",
                                      {
                                        weekday: "long",
                                        day: "numeric",
                                        month: "long",
                                        year: "numeric",
                                      },
                                    )}
                                  </span>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <span className="text-gray-500 dark:text-gray-400 block">
                                    Waktu
                                  </span>
                                  <span className="font-medium dark:text-gray-200">
                                    {time}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-500 dark:text-gray-400 block">
                                    Koordinat
                                  </span>
                                  <a
                                    href={`https://www.google.com/maps?q=${latitude},${longitude}`}
                                    target="_blank"
                                    rel="nofollow noopener noreferrer"
                                    className="font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                                    title="Lihat lokasi di Google Maps"
                                  >
                                    {latitude.toFixed(4)},{" "}
                                    {longitude.toFixed(4)}
                                  </a>
                                </div>
                              </div>
                            </div>

                            {/* Detail Lokasi */}
                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                              <h4 className="font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                                <Loader2 className="text-black dark:text-white mr-2" />
                                Lokasi
                              </h4>
                              <ul className="space-y-1.5 text-sm">
                                <li className="flex justify-between">
                                  <span className="text-gray-500 dark:text-gray-400">
                                    Desa/Kel:
                                  </span>
                                  <strong className="text-gray-800 dark:text-gray-200 text-right font-medium">
                                    {feature.properties?.location?.desa ||
                                      "N/A"}
                                  </strong>
                                </li>
                                <li className="flex justify-between">
                                  <span className="text-gray-500 dark:text-gray-400">
                                    Kecamatan:
                                  </span>
                                  <strong className="text-gray-800 dark:text-gray-200 text-right font-medium">
                                    {feature.properties?.location?.kecamatan ||
                                      "N/A"}
                                  </strong>
                                </li>
                                <li className="flex justify-between">
                                  <span className="text-gray-500 dark:text-gray-400">
                                    Kab/Kota:
                                  </span>
                                  <strong className="text-gray-800 dark:text-gray-200 text-right font-medium">
                                    {feature.properties?.location?.kab_kota ||
                                      "N/A"}
                                  </strong>
                                </li>
                                <li className="flex justify-between">
                                  <span className="text-gray-500 dark:text-gray-400">
                                    Provinsi:
                                  </span>
                                  <strong className="text-gray-800 dark:text-gray-200 text-right font-medium">
                                    {feature.properties?.location?.provinsi ||
                                      "N/A"}
                                  </strong>
                                </li>
                                <li className="flex justify-between">
                                  <span className="text-gray-500 dark:text-gray-400">
                                    Pulau:
                                  </span>
                                  <strong className="text-gray-800 dark:text-gray-200 text-right font-medium">
                                    {feature.properties?.location?.pulau ||
                                      "N/A"}
                                  </strong>
                                </li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MarkerClusterGroup>
            )
          )}

          <MapLegend
            showJumlahHotspot={showJumlahHotspot}
            showLokasiHotspot={showLokasiHotspot}
            minHotspot={minHotspot}
            threshold1={threshold1}
            threshold2={threshold2}
          />
        </MapContainer>
      )}
    </div>
  );
};

export default MapComponent;
