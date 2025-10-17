import useSWR from "swr";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
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
import L, { Map, GeoJSON as LeafletGeoJSON, Layer } from "leaflet";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSpinner,
  faExclamationTriangle,
  faMapMarkerAlt,
} from "@fortawesome/free-solid-svg-icons";
import { DrillDownLevel } from "../../core/model/location";
import { FeatureCollection } from "geojson";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import MarkerClusterGroup from "react-leaflet-markercluster";
import { MapComponentProps, MarkerClusterType } from "../../core/model/map";
import {
  CustomFeature,
  CustomFeatureCollection,
  GeoData,
} from "../../core/model/location";
import { HotspotFeatureGeo } from "../../core/model/hotspot";
import { formatNumber, extractTime } from "../../core/utilities/formatters";
import MapControlPanel from "./MapControlPanel";
import MapLegend from "./MapLegend";
import { monthNames } from "../../core/model/time";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const geoJsonUrls = [
  "/maps/batas_pulau.geojson",
  "/maps/batas_provinsi.geojson",
  "/maps/batas_kabkota.geojson",
  "/maps/batas_kecamatan.geojson",
  "/maps/batas_keldesa.geojson",
];
const geoJsonFetcher = async (urls: string[]) => {
  const responses = await Promise.all(urls.map((url) => fetch(url)));
  for (const response of responses) {
    if (!response.ok) {
      throw new Error(`Failed to fetch ${response.url}: ${response.statusText}`);
    }
  }
  return Promise.all(responses.map((res) => res.json()));
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

const getFeatureName = (
  feature: CustomFeature,
  level: DrillDownLevel
): string | undefined => {
  switch (level) {
    case "pulau":
      return feature.properties?.PULAU;
    case "provinsi":
      return feature.properties?.WADMPR;
    case "kota":
      return feature.properties?.WADMKK;
    case "kecamatan":
      return feature.properties?.WADMKC;
    case "desa":
      return feature.properties?.NAMOBJ;
    default:
      return undefined;
  }
};

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
  olapData?: MapComponentProps["olapData"]
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
  features: CustomFeature[],
  drillDownLevel: DrillDownLevel,
  olapData?: MapComponentProps["olapData"]
): CustomFeature[] {
  if (drillDownLevel === "pulau" || !olapData?.query) return features;
  const parent = getParentFieldAndValue(drillDownLevel, olapData);
  if (!parent || !parent.value) {
    return features;
  }
  const { field, value } = parent;
  const parentVal = value.toUpperCase().trim();
  const filtered = features.filter((f) => {
      const geoVal = f.properties[field]?.toUpperCase().trim() ?? "";
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
}) => {
  const mapRef = useRef<Map | null>(null);
  const geoJsonRef = useRef<LeafletGeoJSON | null>(null);
  const [showJumlahHotspot, setShowJumlahHotspot] = useState(true);
  const [showLokasiHotspot, setShowLokasiHotspot] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isControlPanelCollapsed, setIsControlPanelCollapsed] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");

  const { 
    data: geoJsonData, 
    error: geoJsonError, 
    isLoading: isGeoJsonLoading 
  } = useSWR('geoJsonData', () => geoJsonFetcher(geoJsonUrls));

  const geoData: GeoData = useMemo(() => ({
    pulau: geoJsonData?.[0] || null,
    provinsi: geoJsonData?.[1] || null,
    kota: geoJsonData?.[2] || null,
    kecamatan: geoJsonData?.[3] || null,
    desa: geoJsonData?.[4] || null,
  }), [geoJsonData]);

   const getHotspotData = useMemo(() => {
    const baseUrl = `${import.meta.env.PUBLIC_API_URL}/api/hotspot`;
    const queryParams = new URLSearchParams();

    // Untuk layer lokasi hotspot
    if (showLokasiHotspot) {
      // Jika user sudah pilih tanggal
      if (selectedDate) {
        queryParams.append('selectedDate', selectedDate);
      } 
      // Jika belum pilih tanggal
      else {
        const today = new Date().toISOString().split("T")[0];
        queryParams.append('selectedDate', today);
      }
      
      // Filter berdasarkan drill down level
      if (olapData?.query) {
        Object.entries(olapData.query).forEach(([key, value]) => {
          if (value && key !== 'lat' && key !== 'lng' && key !== 'dimension' && key !== 'tipe') {
            queryParams.append(key, value.toString());
          }
        });
      }
      return queryParams.toString() ? `${baseUrl}?${queryParams.toString()}` : baseUrl;
    }

      // Untuk layer jumlah hotspot gunakan filters dari props
      if (showJumlahHotspot) {
        if (filters?.confidence) {
          queryParams.append('confidence', filters.confidence);
        }
        if (filters?.satelite) {
          queryParams.append('satelite', filters.satelite);
        }

        // Filter waktu
        if (filters?.filterMode === "date" && filters?.selectedDate) {
          queryParams.append('selectedDate', filters.selectedDate);
        } else if (filters?.filterMode === "period" && filters?.time) {
          Object.entries(filters.time).forEach(([key, value]) => {
            if (value) {
              queryParams.append(key, value.toString());
            }
          });
        }

        // Filter berdasarkan drill down level
        if (olapData?.query) {
          Object.entries(olapData.query).forEach(([key, value]) => {
            if (value && key !== 'lat' && key !== 'lng' && key !== 'dimension' && key !== 'tipe') {
              queryParams.append(key, value.toString());
            }
          });
        }
      }

      return queryParams.toString() ? `${baseUrl}?${queryParams.toString()}` : baseUrl;
  }, [filters, olapData, showJumlahHotspot, showLokasiHotspot, selectedDate]);

   const { 
    data: hotspotApiResponse, 
    error: hotspotError, 
    isLoading: isHotspotLoading 
  } = useSWR(
    getHotspotData,
    fetcher,
    { revalidateOnFocus: false }
  );

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
    if (initialSelectedDate && (!selectedDate || !dateCounts[selectedDate])) {
        setSelectedDate(initialSelectedDate);
      }
  }, [initialSelectedDate, dateCounts, selectedDate]);

  useEffect(() => {
    if (showLokasiHotspot && !selectedDate) {
      const today = new Date().toISOString().split("T")[0];
      if (dateCounts[today] && dateCounts[today] > 0) {
        setSelectedDate(today);
      } else if (initialSelectedDate) {
        setSelectedDate(initialSelectedDate);
      }
    }
  }, [showLokasiHotspot, selectedDate, dateCounts, initialSelectedDate]);

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
    // Filter confidence
    if (
      filters?.confidence &&
      hotspot.properties?.confidence?.toLowerCase() !==
        filters.confidence?.toLowerCase()
    ) {
      return;
    }

    // Filter satellite
    if (
      filters?.satelite &&
      hotspot.properties?.satellite?.toLowerCase() !==
        filters.satelite?.toLowerCase()
    ) {
      return;
    }

    // Pilih filter waktu berdasarkan mode
    if (filters?.filterMode === "date" && filters.selectedDate) {
      // Filter berdasarkan tanggal spesifik
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
    const features =
      (geoData[drillDownLevel] as CustomFeatureCollection)?.features ?? [];
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

  // Perhitungan threshold untuk pewarnaan hotspot
  const { minHotspot, threshold1, threshold2 } = useMemo(() => {
    const hotspotValues = Object.values(calculateHotspotCounts).filter(
      (count) => count > 0
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
        getFeatureName(feature, drillDownLevel) ?? ""
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
    [drillDownLevel, calculateHotspotCounts, colorScale]
  );

  const filteredHotspots = useMemo(() => {
    if (!showLokasiHotspot) return [];

    return hotspotData.filter((feature) => {
      const coords = feature.geometry?.coordinates;
      const date = feature.properties?.time?.split("T")[0];

      if (selectedDate) {
            return coords && coords.length === 2 && date === selectedDate;
          } 
          else {
            const today = new Date().toISOString().split("T")[0];
            return coords && coords.length === 2 && date === today;
          }
        });
  }, [hotspotData, showLokasiHotspot, selectedDate]);

  const mapStyle = useMemo(
    () => ({
      minHeight: "600px",
      zIndex: 1,
    }),
    []
  );

  useEffect(() => {
    const performZoom = () => {
      if (!mapRef.current || !geoData[drillDownLevel]) {
        return;
      }
      const zoomLevel = {
        pulau: 5,
        provinsi: 6,
        kota: 7,
        kecamatan: 8,
        desa: 9,
      }[drillDownLevel] || 6;

      if (drillDownLevel === "pulau") {
        const indonesiaBounds = L.latLngBounds(
          L.latLng(-11, 94),
          L.latLng(6, 141)
        );
        mapRef.current.fitBounds(indonesiaBounds, {
          maxZoom: 6,
          animate: true,
          duration: 0.8
        });
      }
      else if (selectedLocation) {
        mapRef.current.flyTo(selectedLocation, zoomLevel, {
          animate: true,
          duration: 1.0,
        });
      }
      else {
        mapRef.current.setZoom(zoomLevel);
      }
    };

    const timers = [
      setTimeout(performZoom, 100),
      setTimeout(performZoom, 300),
      setTimeout(performZoom, 500)
    ];

    return () => {
      timers.forEach(timer => clearTimeout(timer));
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
        const features =
          (geoData[drillDownLevel] as CustomFeatureCollection)?.features || [];
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
      const timer = setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize(true);
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [
    isFullscreen,
    isControlPanelCollapsed,
    showLokasiHotspot,
    showJumlahHotspot,
  ]);

  const loading = isGeoJsonLoading || isHotspotLoading;
  const error = geoJsonError || hotspotError;

  return (
    <div
      className={`relative ${className} ${
        isFullscreen ? "fixed inset-0 z-[9999]" : ""
      }`}
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
          className="flex flex-col items-center justify-center h-full w-full bg-gray-100 rounded-lg"
          style={{ minHeight: "600px" }}
        >
          <FontAwesomeIcon
            icon={faSpinner}
            spin
            size="3x"
            className="text-green-600 mb-4"
          />
          <p className="text-gray-700">Memuat peta...</p>
        </div>
      ) : error ? (
         <div
          className="flex flex-col items-center justify-center h-full w-full bg-red-50 rounded-lg"
          style={{ minHeight: "600px" }}
        >
          <FontAwesomeIcon
            icon={faExclamationTriangle}
            size="3x"
            className="text-red-500 mb-4"
          />
          <p className="text-red-700 font-semibold">Gagal memuat peta</p>
          <p className="text-red-600 text-sm mt-1">{error.message}</p>
        </div>
      ) : (
        <MapContainer
          bounds={bounds}
          center={[-2.5, 118]}
          zoom={5}
          className="h-full w-full rounded-lg"
          style={mapStyle}
          ref={mapRef}
          attributionControl={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png" />

          {showLokasiHotspot && (
            <CustomAttributionControl
              position="bottomright"
              attributionText="&copy; OpenStreetMap contributors, Tiles style by Humanitarian OpenStreetMap Team hosted by OpenStreetMap France"
              className="attribution-lokasi-hotspot"
            />
          )}

          {showJumlahHotspot && getFilteredGeoFeatures.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-80 z-10">
              <p className="text-gray-700 text-lg font-semibold">
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
                    getFeatureName(feature, drillDownLevel) ?? ""
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
                        totalHotspot
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
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-80 z-10">
              <p className="text-gray-700 text-lg font-semibold">
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
                      ""
                  );

                  return (
                    <Marker
                      key={index}
                      position={[latitude, longitude]}
                      icon={customMarker(confidence)}
                    >
                      <Popup>
                        <div className="hotspot-popup" style={{ maxWidth: 320, minWidth: 280 }}>
                          <div className="p-2">
                            <div className="flex items-center gap-2 mb-3 pb-2 border-b">
                              <div className="w-3 h-3 bg-black rounded-full"></div>
                              <h4 className="font-semibold text-sm text-gray-800">Detail Hotspot</h4>
                              <div className="ml-auto">
                                <span className="text-xs text-gray-500 mr-1">Confidence:</span>
                                <span className={`px-2 py-1 text-xs font-semibold rounded ${
                                  confidence.toLowerCase() === 'high' ? 'bg-red-300 text-black' :
                                  confidence.toLowerCase() === 'medium' ? 'bg-yellow-200 text-black' :
                                  'bg-green-300 text-black'
                                }`}>
                                  {confidence}
                                </span>
                              </div>
                            </div>
                            
                            <div className="space-y-2 text-sm">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <span className="text-gray-500 block">Satelit</span>
                                  <span className="font-medium">{feature.properties?.satellite || "-"}</span>
                                </div>
                                <div>
                                  <span className="text-gray-600 block">Tanggal</span>
                                  <span className="font-medium">
                                    {new Date(date).toLocaleDateString('id-ID', {
                                      weekday: 'long',
                                      day: 'numeric', 
                                      month: 'long',
                                      year: 'numeric'
                                    })}
                                  </span>
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <span className="text-gray-500 block">Waktu</span>
                                  <span className="font-medium">{time}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500 block">Koordinat</span>
                                  <a 
                                    href={`https://www.google.com/maps?q=${latitude},${longitude}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                                  >
                                    {latitude.toFixed(4)}, {longitude.toFixed(4)}
                                  </a>
                                </div>
                              </div>
                            </div>

                            {/* Detail Lokasi */}
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <h4 className="font-bold text-gray-700 mb-2 flex items-center">
                                <FontAwesomeIcon icon={faMapMarkerAlt} className="text-black mr-2" />
                                Lokasi
                              </h4>
                              <ul className="space-y-1.5 text-sm">
                                <li className="flex justify-between">
                                  <span className="text-gray-500">Desa/Kel:</span> 
                                  <strong className="text-gray-800 text-right font-medium">{feature.properties?.location?.desa || "N/A"}</strong>
                                </li>
                                <li className="flex justify-between">
                                  <span className="text-gray-500">Kecamatan:</span> 
                                  <strong className="text-gray-800 text-right font-medium">{feature.properties?.location?.kecamatan || "N/A"}</strong>
                                </li>
                                <li className="flex justify-between">
                                  <span className="text-gray-500">Kab/Kota:</span> 
                                  <strong className="text-gray-800 text-right font-medium">{feature.properties?.location?.kab_kota || "N/A"}</strong>
                                </li>
                                <li className="flex justify-between">
                                  <span className="text-gray-500">Provinsi:</span> 
                                  <strong className="text-gray-800 text-right font-medium">{feature.properties?.location?.provinsi || "N/A"}</strong>
                                </li>
                                <li className="flex justify-between">
                                  <span className="text-gray-500">Pulau:</span> 
                                  <strong className="text-gray-800 text-right font-medium">{feature.properties?.location?.pulau || "N/A"}</strong>
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