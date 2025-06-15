"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { MapContainer, TileLayer, GeoJSON, Popup, Marker, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { scaleThreshold } from "d3-scale";
import L, { Map, GeoJSON as LeafletGeoJSON, Layer } from "leaflet";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faExpand,
  faCompress,
  faSpinner,
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
import { monthNames } from "@/app/core/model/time";

interface CustomAttributionControlProps {
  position: L.ControlPosition;
  attributionText: string;
  className?: string;
}

const CustomAttributionControl: React.FC<CustomAttributionControlProps> = ({ position, attributionText, className }) => {
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
    .replace(/^KOTA\s+/i, "")
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
  return features.filter((f) => {
    const geoVal = f.properties[field]?.toUpperCase().trim() ?? "";
    return geoVal === parentVal;
  });
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
}) => {
  const [geoData, setGeoData] = useState<GeoData>({
    pulau: null,
    provinsi: null,
    kota: null,
    kecamatan: null,
    desa: null,
  });
  const [hotspotData, setHotspotData] = useState<HotspotFeatureGeo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateCounts, setDateCounts] = useState<Record<string, number>>({});
  const [showAllData] = useState<boolean>(false);
  const mapRef = useRef<Map | null>(null);
  const geoJsonRef = useRef<LeafletGeoJSON | null>(null);
  const [showJumlahHotspot, setShowJumlahHotspot] = useState(true);
  const [showLokasiHotspot, setShowLokasiHotspot] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isControlPanelCollapsed, setIsControlPanelCollapsed] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");

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

  // Menghitung jumlah hotspot berdasarkan level drill down dan filter
  const calculateHotspotCounts = useMemo(() => {
    const counts: Record<string, number> = {};

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
  }, [hotspotData, drillDownLevel, filters, olapData]);

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

      if (name.includes("YOGYAKARTA") && getFeatureName(f, drillDownLevel)?.toUpperCase().includes("YOGYAKARTA")) {
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
      .range(["#B3D1FF", "#4F8EF7", "#0047AB"]);
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

  useEffect(() => {
    const fetchGeoJSON = async () => {
      try {
        const [pulauRes, provRes, kotRes, kecRes, desaRes] = await Promise.all([
          fetch("/maps/batas_pulau.geojson"),
          fetch("/maps/batas_provinsi.geojson"),
          fetch("/maps/batas_kabkota.geojson"),
          fetch("/maps/batas_kecamatan.geojson"),
          fetch("/maps/batas_keldesa.geojson"),
        ]);
        const [pulauData, provData, kotData, kecData, desaData] =
          await Promise.all([
            pulauRes.json(),
            provRes.json(),
            kotRes.json(),
            kecRes.json(),
            desaRes.json(),
          ]);
        setGeoData({
          pulau: pulauData,
          provinsi: provData,
          kota: kotData,
          kecamatan: kecData,
          desa: desaData,
        });
      } catch (error) {
        console.error("Error loading GeoJSON:", error);
      } finally {
      }
    };
    fetchGeoJSON();
  }, []);

  useEffect(() => {
    const getHotspotData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();

        // Filter confidence & satellite
        if (filters?.confidence)
          params.append("confidence", filters.confidence);
        if (filters?.satelite) params.append("satelite", filters.satelite);

        // Filter waktu berdasarkan mode
        if (filters?.filterMode === "date" && filters?.selectedDate) {
          params.append("tanggal", filters.selectedDate);
        } else if (filters?.filterMode === "period" && filters?.time) {
          if (filters.time.tahun) params.append("tahun", filters.time.tahun);

          if (filters.time.semester)
            params.append("semester", filters.time.semester);
          if (filters.time.kuartal)
            params.append("quartal", filters.time.kuartal.replace("Q", ""));

          if (filters.time.bulan) {
            const monthIndex = monthNames.indexOf(filters.time.bulan) + 1;
            if (monthIndex > 0) {
              params.append("bulan", monthIndex.toString());
            }
          }

          if (filters.time.minggu) params.append("minggu", filters.time.minggu);
        }

        // Fetch data
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/hotspot?${params.toString()}`
        );

        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        if (!data.features)
          throw new Error("Invalid data format: missing 'features'");

        setHotspotData(data.features);
        setDateCounts(calculateDateCounts(data.features));

        const dates = Object.keys(calculateDateCounts(data.features))
          .sort()
          .reverse();
        if (dates.length > 0) setSelectedDate(dates[0]);
        else setSelectedDate("");
      } catch (error) {
        console.error("Error fetching hotspot data:", error);
        setHotspotData([]);
        setDateCounts({});
        setSelectedDate("");
      } finally {
        setLoading(false);
      }
    };

    getHotspotData();
  }, [filters]);

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

  useEffect(() => {
    if (geoJsonRef.current && showJumlahHotspot) {
      const geoJsonLayer = geoJsonRef.current;
      geoJsonLayer.clearLayers();
      if (getFilteredGeoFeatures.length > 0) {
        geoJsonLayer.addData({
          type: "FeatureCollection",
          features: getFilteredGeoFeatures,
        } as GeoJSON.FeatureCollection);
        geoJsonLayer.setStyle(styleFeature);
      }
    }
  }, [getFilteredGeoFeatures, showJumlahHotspot, styleFeature, filters]);

  const filteredHotspots = useMemo(() => {
    return hotspotData.filter((feature) => {
      const coords = feature.geometry?.coordinates;
      const date = feature.properties?.time?.split("T")[0];

      if (showAllData) {
        return coords && coords.length === 2;
      } else {
        return coords && coords.length === 2 && date === selectedDate;
      }
    });
  }, [hotspotData, showAllData, selectedDate]);

  useEffect(() => {
    if (selectedLocation && mapRef.current) {
      mapRef.current.flyTo(selectedLocation, 7);
    }
  }, [selectedLocation]);

  useEffect(() => {
    if (mapRef.current && geoData[drillDownLevel]) {
      const zoomLevel =
        {
          pulau: 5,
          provinsi: 6,
          kota: 7,
          kecamatan: 8,
          desa: 9,
        }[drillDownLevel] || 6;

      mapRef.current.setZoom(zoomLevel);

      if (selectedLocation) {
        mapRef.current.flyTo(selectedLocation, zoomLevel);
      }
    }
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

              const bounds = geoJSONLayer.getBounds();
              mapRef.current?.fitBounds(bounds);
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

      {isMobile && (
        <button
          className={`
            absolute z-[1000] p-2 rounded-full shadow-lg
            ${
              isFullscreen
                ? "top-4 right-4 bg-white text-gray-700"
                : "bottom-4 right-4 bg-blue-500 text-white"
            }
          `}
          onClick={() => setIsFullscreen(!isFullscreen)}
          aria-label={isFullscreen ? "Keluar dari fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? (
            <FontAwesomeIcon icon={faCompress} className="text-sm" />
          ) : (
            <FontAwesomeIcon icon={faExpand} className="text-sm" />
          )}
        </button>
      )}

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
        </div>
      ) : (
        <MapContainer
          bounds={bounds}
          center={[-2.5, 118]}
          zoom={5}
          className="h-full w-full rounded-lg"
          style={{
            minHeight: "600px",
            zIndex: 1,
          }}
          ref={mapRef}
          attributionControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
          />

          {showLokasiHotspot && (
            <CustomAttributionControl
              position="bottomright"
              attributionText="&copy; OpenStreetMap contributors, Tiles style by Humanitarian OpenStreetMap Team hosted by OpenStreetMap France"
              className="attribution-lokasi-hotspot"
            />
          )}

          {showJumlahHotspot && getFilteredGeoFeatures.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-80 z-10">
              <p className="text-gray-700 text-lg font-semibold">Tidak ada data</p>
            </div>
          ) : (
            showJumlahHotspot && geoData[drillDownLevel] && (
              <GeoJSON
                ref={geoJsonRef}
                key={`geojson-${drillDownLevel}-${JSON.stringify(filters)}-${
                  filters.filterMode
                }-${hotspotData.length}`}
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
                      geoJsonRef.current?.resetStyle(e.target);
                    },
                  });
                }}
              />
            )
          )}

          {showLokasiHotspot && filteredHotspots.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-80 z-10">
              <p className="text-gray-700 text-lg font-semibold">Tidak ada data</p>
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
                  const confidence = feature.properties?.confidence || "unknown";
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
                      <Popup className="text-sm">
                        <strong>Confidence:</strong> {confidence}
                        <br />
                        <strong>Satelit:</strong>{" "}
                        {feature.properties?.satellite || "N/A"}
                        <br />
                        <strong>Tanggal:</strong> {date}
                        <br />
                        <strong>Waktu:</strong> {time}
                        <br />
                        <ul className="mt-1 space-y-1">
                          <li>
                            <strong>Pulau:</strong>{" "}
                            {feature.properties?.location?.pulau || "N/A"}
                          </li>
                          <li>
                            <strong>Provinsi:</strong>{" "}
                            {feature.properties?.location?.provinsi || "N/A"}
                          </li>
                          <li>
                            <strong>Kab/kota:</strong>{" "}
                            {feature.properties?.location?.kab_kota || "N/A"}
                          </li>
                          <li>
                            <strong>Kecamatan:</strong>{" "}
                            {feature.properties?.location?.kecamatan || "N/A"}
                          </li>
                          <li>
                            <strong>Desa:</strong>{" "}
                            {feature.properties?.location?.desa || "N/A"}
                          </li>
                        </ul>
                        <strong className="mt-1 block">Koordinat:</strong>{" "}
                        {latitude.toFixed(4)}, {longitude.toFixed(4)}
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

export default dynamic(() => Promise.resolve(MapComponent), { ssr: false });