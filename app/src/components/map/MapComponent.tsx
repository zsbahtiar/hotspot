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
import { formatNumber, extractTime, translateWeatherCondition } from "@/core/utils/formatters";
import MapControlPanel from "@/components/map/MapControls";
import MapLegend from "@/components/map/MapLegend";
import MapZoomControls from "@/components/map/ZoomControls";
import { monthNames } from "@/core/models/time";
import { mockHotspotData } from "@/mocks/hotspotData";
import { hotspotService } from "@/core/services/hotspotService";

const USE_MOCK_DATA = false;

const toLocalRFC3339 = (date: Date): string => {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const hours = Math.floor(Math.abs(offset) / 60);
  const minutes = Math.abs(offset) % 60;

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${sign}${pad(hours)}:${pad(minutes)}`;
};

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
  province_code?: string;
  city_code?: string;
  district_code?: string;
  subdistrict_code?: string;
}) => {
  if (USE_MOCK_DATA) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return mockHotspotData;
  }

  const apiFilters: any = {
    limit: 50000,
    ...filters,
  };

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
      iconColor = "grey";
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
  activeLayer = "hotspot-count",
  locationData,
  defaultZoom = 5,
  onHotspotDataChange,
  onLoadingChange,
}) => {
  const mapRef = useRef<Map | null>(null);
  const geoJsonRef = useRef<LeafletGeoJSON | null>(null);
  const [showJumlahHotspot, setShowJumlahHotspot] = useState(true);
  const [showLokasiHotspot, setShowLokasiHotspot] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isControlPanelCollapsed, setIsControlPanelCollapsed] = useState(false);
  const [dateRange, setDateRange] = useState<{ from: Date; to?: Date } | undefined>(
    () => ({ from: new Date(), to: new Date() }),
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

  const apiFilterParams = useMemo(() => {
    const params: any = {};

    if (filters?.confidence) {
      params.confidence = filters.confidence;
    }

    if (filters?.satelite) {
      params.satellite = filters.satelite;
    }

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

    if (filters?.filterMode === "date" && filters?.dateRange?.from) {
      const startOfDay = new Date(filters.dateRange.from);
      startOfDay.setHours(0, 0, 0, 0);

      const endDate = filters.dateRange.to || filters.dateRange.from;
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);

      params.start_date = toLocalRFC3339(startOfDay);
      params.end_date = toLocalRFC3339(endOfDay);
    } else if (activeLayer === "hotspot-locations" && dateRange?.from) {
      const startOfDay = new Date(dateRange.from);
      startOfDay.setHours(0, 0, 0, 0);

      const endDate = dateRange.to || dateRange.from;
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);

      params.start_date = toLocalRFC3339(startOfDay);
      params.end_date = toLocalRFC3339(endOfDay);
    }

    if (filters?.province_code) {
      params.province_code = filters.province_code;
    }
    if (filters?.city_code) {
      params.city_code = filters.city_code;
    }
    if (filters?.district_code) {
      params.district_code = filters.district_code;
    }
    if (filters?.subdistrict_code) {
      params.subdistrict_code = filters.subdistrict_code;
    }

    return params;
  }, [filters, activeLayer, dateRange]);

  const {
    data: hotspotApiResponse,
    error: hotspotError,
    isLoading: isHotspotLoading,
  } = useQuery({
    queryKey: ["map-hotspots", apiFilterParams],
    queryFn: () => fetchHotspotData(apiFilterParams),
    retry: 1,
    refetchOnWindowFocus: false,
    enabled: activeLayer === "hotspot-locations",
  });

  const hotspotData: HotspotFeatureGeo[] = useMemo(() => {
    return hotspotApiResponse?.features || [];
  }, [hotspotApiResponse]);


  useEffect(() => {
    if (onHotspotDataChange) {
      onHotspotDataChange(hotspotData);
    }
  }, [hotspotData, onHotspotDataChange]);

  useEffect(() => {
    if (onLoadingChange) {
      onLoadingChange(isHotspotLoading);
    }
  }, [isHotspotLoading, onLoadingChange]);

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
    if (initialSelectedDate && !dateRange) {
      const date = new Date(initialSelectedDate);
      setDateRange({ from: date, to: date });
    }
  }, [initialSelectedDate]);

  useEffect(() => {
    if (showLokasiHotspot && !dateRange) {
      const today = new Date();
      const todayString = today.toISOString().split("T")[0];
      if (dateCounts[todayString] && dateCounts[todayString] > 0) {
        setDateRange({ from: today, to: today });
      } else if (initialSelectedDate) {
        const date = new Date(initialSelectedDate);
        setDateRange({ from: date, to: date });
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

  useEffect(() => {
    if (activeLayer === "hotspot-locations") {
      setShowLokasiHotspot(true);
      setShowJumlahHotspot(false);
    } else {
      setShowLokasiHotspot(false);
      setShowJumlahHotspot(true);
    }
  }, [activeLayer]);

  const calculateHotspotCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    const hasActiveFilters =
      filters?.confidence ||
      filters?.satelite ||
      filters?.dateRange?.from ||
      (filters?.time && Object.keys(filters.time).length > 0) ||
      filters?.province_code ||
      filters?.city_code ||
      filters?.district_code;

    const shouldUseLocationData =
      activeLayer === "hotspot-count" ||
      (!hasActiveFilters && locationData && locationData.length > 0);

    if (shouldUseLocationData && locationData && locationData.length > 0) {
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

      if (filters?.filterMode === "date" && filters.dateRange?.from) {
        const hotspotDate = new Date(hotspot.properties?.time || "");
        hotspotDate.setHours(0, 0, 0, 0);

        const startDate = new Date(filters.dateRange.from);
        startDate.setHours(0, 0, 0, 0);

        const endDate = filters.dateRange.to
          ? new Date(filters.dateRange.to)
          : new Date(filters.dateRange.from);
        endDate.setHours(23, 59, 59, 999);

        if (hotspotDate < startDate || hotspotDate > endDate) {
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
  }, [
    activeLayer,
    locationData,
    hotspotData,
    drillDownLevel,
    filters,
    olapData,
  ]);

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
    return {
      minHotspot: 0,
      threshold1: 10000,
      threshold2: 100000,
    };
  }, []);

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
      return coords && coords.length === 2;
    });
  }, [hotspotData, showLokasiHotspot]);

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
      } else if (
        selectedLocation &&
        typeof selectedLocation.lat === "number" &&
        typeof selectedLocation.lng === "number" &&
        !isNaN(selectedLocation.lat) &&
        !isNaN(selectedLocation.lng)
      ) {
        mapRef.current.flyTo([selectedLocation.lat, selectedLocation.lng], zoomLevel, {
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
        dateRange={dateRange}
        setDateRange={setDateRange}
        totalCount={hotspotData.length}
        onLayerChange={onLayerChange}
      />

      {loading ? (
        <div
          className="flex flex-col items-center justify-center h-full w-full bg-muted rounded-lg"
          style={{ minHeight: "600px" }}
        >
          <RefreshCw
            width="48"
            height="48"
            className="text-muted-foreground mb-4"
            style={{ animation: "spin 1s linear infinite" }}
          />
          <p className="text-foreground text-center">
            Memuat peta Indonesia...
            <br />
            <span className="text-sm text-muted-foreground">
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
            <div className="absolute inset-0 flex items-center justify-center bg-muted bg-opacity-80 dark:bg-opacity-80 z-10">
              <p className="text-foreground text-lg font-semibold">
                Tidak ada data
              </p>
            </div>
          ) : (
            showJumlahHotspot &&
            geoData[drillDownLevel] && (
              <GeoJSON
                ref={geoJsonRef}
                key={`geojson-${drillDownLevel}-${JSON.stringify(olapData?.query || {})}-${JSON.stringify(filters)}-${hotspotData.length}-${JSON.stringify(locationData)}`}
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
            <div className="absolute inset-0 flex items-center justify-center bg-muted bg-opacity-80 dark:bg-opacity-80 z-10">
              <p className="text-foreground text-lg font-semibold">
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
                  const utcTime = feature.properties?.time;
                  const date = utcTime
                    ? new Date(utcTime).toLocaleDateString("id-ID", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                      })
                    : "Unknown";
                  const time = utcTime
                    ? new Date(utcTime).toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })
                    : extractTime(
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
                            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
                              <div className="w-3 h-3 bg-foreground rounded-full"></div>
                              <h4 className="font-semibold text-sm text-foreground">
                                Detail Hotspot
                              </h4>
                              <div className="ml-auto">
                                <span className="text-xs text-muted-foreground mr-1">
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
                                  <span className="text-muted-foreground block">
                                    Satelit
                                  </span>
                                  <span className="font-medium text-foreground">
                                    {feature.properties?.satellite || "-"}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground block">
                                    Tanggal
                                  </span>
                                  <span className="font-medium text-foreground">
                                    {utcTime
                                      ? new Date(utcTime).toLocaleDateString(
                                          "id-ID",
                                          {
                                            weekday: "long",
                                            day: "numeric",
                                            month: "long",
                                            year: "numeric",
                                          },
                                        )
                                      : date}
                                  </span>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <span className="text-muted-foreground block">
                                    Waktu
                                  </span>
                                  <span className="font-medium text-foreground">
                                    {time}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground block">
                                    Koordinat
                                  </span>
                                  <a
                                    href={`https://www.google.com/maps?q=${latitude},${longitude}`}
                                    target="_blank"
                                    rel="nofollow noopener noreferrer"
                                    className="font-medium text-primary hover:text-primary/80 hover:underline cursor-pointer"
                                    title="Lihat lokasi di Google Maps"
                                  >
                                    {latitude.toFixed(4)},{" "}
                                    {longitude.toFixed(4)}
                                  </a>
                                </div>
                              </div>
                            </div>

                            <div className="mt-3 pt-3 border-t border-border">
                              <h4 className="font-bold text-foreground mb-2 flex items-center">
                                <Loader2 className="text-foreground mr-2" />
                                Lokasi
                              </h4>
                              <ul className="space-y-1.5 text-sm">
                                <li className="flex justify-between">
                                  <span className="text-muted-foreground">
                                    Desa/Kel:
                                  </span>
                                  <strong className="text-foreground text-right font-medium">
                                    {feature.properties?.location?.desa ||
                                      "N/A"}
                                  </strong>
                                </li>
                                <li className="flex justify-between">
                                  <span className="text-muted-foreground">
                                    Kecamatan:
                                  </span>
                                  <strong className="text-foreground text-right font-medium">
                                    {feature.properties?.location?.kecamatan ||
                                      "N/A"}
                                  </strong>
                                </li>
                                <li className="flex justify-between">
                                  <span className="text-muted-foreground">
                                    Kab/Kota:
                                  </span>
                                  <strong className="text-foreground text-right font-medium">
                                    {feature.properties?.location?.kab_kota ||
                                      "N/A"}
                                  </strong>
                                </li>
                                <li className="flex justify-between">
                                  <span className="text-muted-foreground">
                                    Provinsi:
                                  </span>
                                  <strong className="text-foreground text-right font-medium">
                                    {feature.properties?.location?.provinsi ||
                                      "N/A"}
                                  </strong>
                                </li>
                                <li className="flex justify-between">
                                  <span className="text-muted-foreground">
                                    Pulau:
                                  </span>
                                  <strong className="text-foreground text-right font-medium">
                                    {feature.properties?.location?.pulau ||
                                      "N/A"}
                                  </strong>
                                </li>
                              </ul>
                            </div>

                            {(feature.properties?.frp !== undefined || feature.properties?.brightness !== undefined) && (
                              <div className="mt-3 pt-3 border-t border-border">
                                <h4 className="font-bold text-foreground mb-2 flex items-center">
                                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                  </svg>
                                  Pengukuran
                                </h4>
                                <ul className="space-y-1.5 text-sm">
                                  {feature.properties?.frp !== undefined && feature.properties.frp > 0 && (
                                    <li className="flex justify-between">
                                      <span className="text-muted-foreground">FRP:</span>
                                      <strong className="text-foreground text-right font-medium">
                                        {feature.properties.frp.toFixed(2)} MW
                                      </strong>
                                    </li>
                                  )}
                                  {feature.properties?.brightness !== undefined && feature.properties.brightness > 0 && (
                                    <li className="flex justify-between">
                                      <span className="text-muted-foreground">Brightness:</span>
                                      <strong className="text-foreground text-right font-medium">
                                        {feature.properties.brightness.toFixed(2)} K
                                      </strong>
                                    </li>
                                  )}
                                  {feature.properties?.bright_t31 !== undefined && feature.properties.bright_t31 > 0 && (
                                    <li className="flex justify-between">
                                      <span className="text-muted-foreground">Bright T31:</span>
                                      <strong className="text-foreground text-right font-medium">
                                        {feature.properties.bright_t31.toFixed(2)} K
                                      </strong>
                                    </li>
                                  )}
                                  {feature.properties?.bright_ti4 !== undefined && feature.properties.bright_ti4 > 0 && (
                                    <li className="flex justify-between">
                                      <span className="text-muted-foreground">Bright TI4:</span>
                                      <strong className="text-foreground text-right font-medium">
                                        {feature.properties.bright_ti4.toFixed(2)} K
                                      </strong>
                                    </li>
                                  )}
                                  {feature.properties?.bright_ti5 !== undefined && feature.properties.bright_ti5 > 0 && (
                                    <li className="flex justify-between">
                                      <span className="text-muted-foreground">Bright TI5:</span>
                                      <strong className="text-foreground text-right font-medium">
                                        {feature.properties.bright_ti5.toFixed(2)} K
                                      </strong>
                                    </li>
                                  )}
                                </ul>
                              </div>
                            )}

                            {(feature.properties?.temperature !== undefined || feature.properties?.weather_conditions) && (
                              <div className="mt-3 pt-3 border-t border-border">
                                <h4 className="font-bold text-foreground mb-2 flex items-center">
                                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                                  </svg>
                                  Cuaca
                                </h4>
                                <ul className="space-y-1.5 text-sm">
                                  {feature.properties?.weather_conditions && (
                                    <li className="flex justify-between">
                                      <span className="text-muted-foreground">Kondisi:</span>
                                      <strong className="text-foreground text-right font-medium">
                                        {translateWeatherCondition(feature.properties.weather_conditions)}
                                      </strong>
                                    </li>
                                  )}
                                  {feature.properties?.temperature !== undefined && (
                                    <li className="flex justify-between">
                                      <span className="text-muted-foreground">Suhu:</span>
                                      <strong className="text-foreground text-right font-medium">
                                        {feature.properties.temperature}°C
                                      </strong>
                                    </li>
                                  )}
                                  {feature.properties?.humidity !== undefined && (
                                    <li className="flex justify-between">
                                      <span className="text-muted-foreground">Kelembaban:</span>
                                      <strong className="text-foreground text-right font-medium">
                                        {feature.properties.humidity.toFixed(1)}%
                                      </strong>
                                    </li>
                                  )}
                                  {feature.properties?.wind_speed !== undefined && (
                                    <li className="flex justify-between">
                                      <span className="text-muted-foreground">Angin:</span>
                                      <strong className="text-foreground text-right font-medium">
                                        {feature.properties.wind_speed} km/h
                                        {feature.properties?.wind_degree !== undefined && ` (${feature.properties.wind_degree}°)`}
                                      </strong>
                                    </li>
                                  )}
                                  {feature.properties?.cloud_coverage !== undefined && (
                                    <li className="flex justify-between">
                                      <span className="text-muted-foreground">Awan:</span>
                                      <strong className="text-foreground text-right font-medium">
                                        {feature.properties.cloud_coverage}%
                                      </strong>
                                    </li>
                                  )}
                                  {feature.properties?.pressure !== undefined && feature.properties.pressure > 0 && (
                                    <li className="flex justify-between">
                                      <span className="text-muted-foreground">Tekanan:</span>
                                      <strong className="text-foreground text-right font-medium">
                                        {feature.properties.pressure} hPa
                                      </strong>
                                    </li>
                                  )}
                                  {feature.properties?.uv_index !== undefined && feature.properties.uv_index > 0 && (
                                    <li className="flex justify-between">
                                      <span className="text-muted-foreground">UV Index:</span>
                                      <strong className="text-foreground text-right font-medium">
                                        {feature.properties.uv_index}
                                      </strong>
                                    </li>
                                  )}
                                  {feature.properties?.precipitation !== undefined && feature.properties.precipitation > 0 && (
                                    <li className="flex justify-between">
                                      <span className="text-muted-foreground">Curah Hujan:</span>
                                      <strong className="text-foreground text-right font-medium">
                                        {feature.properties.precipitation} mm
                                      </strong>
                                    </li>
                                  )}
                                </ul>
                              </div>
                            )}
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

      {isHotspotLoading && !loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-[1000] rounded-lg">
          <div className="bg-card rounded-lg px-6 py-4 flex items-center gap-3 shadow-lg">
            <RefreshCw
              width="24"
              height="24"
              className="text-primary animate-spin"
            />
            <span className="text-sm font-medium text-foreground">
              Memuat data...
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapComponent;
