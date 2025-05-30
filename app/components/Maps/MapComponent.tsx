"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useRef, useMemo } from "react";
import { MapContainer, TileLayer, GeoJSON, Popup, Marker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { scaleThreshold } from "d3-scale";
import L, { LatLngBoundsExpression, Map, GeoJSON as LeafletGeoJSON, Control, Layer } from "leaflet";
import { Tooltip } from "react-tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft, faChevronRight, faExpand, faCompress } from "@fortawesome/free-solid-svg-icons";
import { DrillDownLevel } from "../../core/model/query";

//Interfaces
interface MapComponentProps {
  bounds?: LatLngBoundsExpression;
  selectedLocation?: { lat: number; lng: number } | null;
  drillDownLevel: DrillDownLevel;
  olapData?: {
    query?: {
      pulau?: string;
      provinsi?: string;
      kota?: string;
      kabupaten?: string;
      kecamatan?: string;
      desa?: string;
    };
  };
  onDrillDownChange?: (newLevel: DrillDownLevel) => void;
  className?: string;
  style?: React.CSSProperties;
  filters?: {
    confidence?: string | null;
    satelite?: string | null;
    time?: {
      tahun?: string;
      semester?: string;
      kuartal?: string;
      bulan?: string;
      hari?: string;
    };
  };
}

interface GeoData {
  pulau: GeoJSON.FeatureCollection | null;
  provinsi: GeoJSON.FeatureCollection | null;
  kabupaten: GeoJSON.FeatureCollection | null;
  kecamatan: GeoJSON.FeatureCollection | null;
  desa: GeoJSON.FeatureCollection | null;
}

interface HotspotFeature extends GeoJSON.Feature {
  geometry: GeoJSON.Point;
  properties: {
    confidence?: "low" | "medium" | "high";
    satellite?: string;
    time?: string;
    location?: {
      pulau?: string;
      provinsi?: string;
      kab_kota?: string;
      kecamatan?: string;
      desa?: string;
    };
    hotspot_count?: number;
  };
}

interface CustomFeature extends GeoJSON.Feature {
  __layer?: Layer;
  properties: {
    PULAU?: string;
    WADMPR?: string;
    WADMKK?: string;
    WADMKC?: string;
    NAMOBJ?: string;
  };
}

interface CustomFeatureCollection extends GeoJSON.FeatureCollection {
  features: CustomFeature[];
}

//Helper
const monthNames = [
  "Januari", "Februari", "Maret", "April",
  "Mei", "Juni", "Juli", "Agustus",
  "September", "Oktober", "November", "Desember",
];

const dayNames = [
  "Minggu", "Senin", "Selasa", "Rabu", 
  "Kamis","Jumat", "Sabtu"
];

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

const getFeatureName = (feature: CustomFeature, level: MapComponentProps['drillDownLevel']): string | undefined => {
    switch (level) {
      case "pulau": 
    return feature.properties?.PULAU;
      case "provinsi": 
    return feature.properties?.WADMPR;
      case "kabupaten": 
    return feature.properties?.WADMKK;
      case "kecamatan": 
    return feature.properties?.WADMKC;
      case "desa": 
    return feature.properties?.NAMOBJ;
      default: 
    return undefined;
  }
};

const MapComponent: React.FC<MapComponentProps> = ({
  bounds,
  selectedLocation,
  drillDownLevel,
  olapData = {},
  className = "",
  style = {},
  filters = {},
}) => {
  const [geoData, setGeoData] = useState<GeoData>({
    pulau: null,
    provinsi: null,
    kabupaten: null,
    kecamatan: null,
    desa: null,
  });
  const [hotspotData, setHotspotData] = useState<HotspotFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateCounts, setDateCounts] = useState<Record<string, number>>({});
  const [showAllData, setShowAllData] = useState<boolean>(false);
  const mapRef = useRef<Map | null>(null);
  const geoJsonRef = useRef<LeafletGeoJSON | null>(null);
  const [showOLAPHotspot, setShowOLAPHotspot] = useState(true);
  const [showTitikPanas, setShowTitikPanas] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isControlPanelCollapsed, setIsControlPanelCollapsed] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const calculateHotspotCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    hotspotData.forEach((hotspot) => {
      if (
        filters?.confidence &&
        hotspot.properties?.confidence?.toLowerCase() !== filters.confidence?.toLowerCase()
      ) {
        return;
      }
      if (
        filters?.satelite &&
        hotspot.properties?.satellite?.toLowerCase() !== filters.satelite?.toLowerCase()
      ) {
        return;
      }
      if (filters?.time) {
        const hotspotDate = new Date(hotspot.properties?.time || "");
        if (
          filters.time.tahun && hotspotDate.getFullYear().toString() !== filters.time.tahun
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
        if (filters.time.hari) {
          const hotspotDay = dayNames[hotspotDate.getDay()];
          if (hotspotDay !== filters.time.hari) {
            return;
          }
        }
      }

      const location = hotspot.properties?.location;
      if (!location) return;

      let key: string | undefined;
      switch (drillDownLevel) {
        case "pulau":
          key = location.pulau;
          break;
        case "provinsi":
          key = location.provinsi;
          break;
        case "kabupaten":
          key = location.kab_kota;
          break;
        case "kecamatan":
          key = location.kecamatan;
          break;
        case "desa":
          key = location.desa;
          break;
      }
      if (key) {
        counts[key] =
          (counts[key] || 0) + (hotspot.properties?.hotspot_count || 0);
      }
    });
    return counts;
  }, [hotspotData, drillDownLevel, filters]);

  //hitung hotspot

  const { minHotspot, maxHotspot, threshold1, threshold2 } = useMemo(() => {
    const hotspotValues = Object.values(calculateHotspotCounts);
    const min = hotspotValues.length > 0 ? Math.min(...hotspotValues) : 0;
    const max = hotspotValues.length > 0 ? Math.max(...hotspotValues) : 1;

    const t1 = max / 3;
    const t2 = (max / 3) * 2;
    return { minHotspot: min, maxHotspot: max, threshold1: t1, threshold2: t2};
  }, [calculateHotspotCounts]);


  const colorScale = useMemo(() => {
    return scaleThreshold<number, string>()
      .domain([threshold1, threshold2])
      .range(["green", "yellow", "red"]);
  }, [threshold1, threshold2]);

  const styleFeature = (feature?: CustomFeature): L.PathOptions => {
    if (!feature) return {};
    const featureName = getFeatureName(feature, drillDownLevel);
    
    const totalHotspot = featureName
      ? calculateHotspotCounts[featureName] || 0
      : 0;

    return {
      fillColor: colorScale(totalHotspot),
      color: "black",
      weight: 0.8,
      fillOpacity: 0.7,
    };
  };

  useEffect(() => {
    const fetchGeoJSON = async () => {
      try {
        const [pulauRes, provRes, kabRes, kecRes, desaRes] = await Promise.all([
          fetch("/maps/batas_pulau.geojson"),
          fetch("/maps/batas_provinsi.geojson"),
          fetch("/maps/batas_kabkota.geojson"),
          fetch("/maps/batas_kecamatan.geojson"),
          fetch("/maps/batas_keldesa.geojson"),
        ]);

        const [pulauData, provData, kabData, kecData, desaData] =
          await Promise.all([
            pulauRes.json(),
            provRes.json(),
            kabRes.json(),
            kecRes.json(),
            desaRes.json(),
          ]);

        setGeoData({
          pulau: pulauData,
          provinsi: provData,
          kabupaten: kabData,
          kecamatan: kecData,
          desa: desaData,
        });
      } catch (error) {
        console.error("Error loading GeoJSON:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchGeoJSON();
  }, []);

  useEffect(() => {
    const fetchHotspotData = async () => {
      try {
        const params = new URLSearchParams();

        if (filters?.confidence)
          params.append("confidence", filters.confidence);
        if (filters?.satelite) params.append("satelite", filters.satelite);
        if (filters?.time?.tahun) params.append("tahun", filters.time.tahun);
        if (filters?.time?.semester)
          params.append("semester", filters.time.semester);
        if (filters?.time?.kuartal) {
          params.append("kuartal", filters.time.kuartal.replace("Q", ""));
        }
        if (filters?.time?.bulan) {
          const monthIndex = monthNames.indexOf(filters.time.bulan) + 1;
          if (monthIndex > 0) {
            params.append("bulan", monthIndex.toString());
          }
        }
        if (filters?.time?.hari) {
          const dayIndex = dayNames.indexOf(filters.time.hari);
          if (dayIndex !== -1) {
            params.append("hari", (dayIndex + 1).toString());
          }
        }

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
      } catch (error) {
        console.error("Error fetching hotspot data:", error);
      }
    };
    fetchHotspotData();
  }, [filters]);

  const calculateDateCounts = (data: HotspotFeature[]) => {
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
    if (geoJsonRef.current && geoData[drillDownLevel] && showOLAPHotspot) {
      const geoJsonLayer = geoJsonRef.current;
      geoJsonLayer.clearLayers();
      geoJsonLayer.addData(
        geoData[drillDownLevel] as GeoJSON.FeatureCollection
      );
      geoJsonLayer.setStyle(styleFeature);
    }
  }, [geoData, drillDownLevel, calculateHotspotCounts, showOLAPHotspot]);

  const filteredHotspots = hotspotData.filter((feature) => {
    const coords = feature.geometry?.coordinates;
    const date = feature.properties?.time?.split("T")[0];

    if (showAllData) {
      return coords && coords.length === 2;
    } else {
      return coords && coords.length === 2 && date === selectedDate;
    }
  });

  useEffect(() => {
    if (selectedLocation && mapRef.current) {
      mapRef.current.flyTo(selectedLocation, 7);
    }
  }, [selectedLocation]);

  useEffect(() => {
    if (mapRef.current && showOLAPHotspot) {
      const map = mapRef.current;
      const existingLegend = document.querySelector(".legend");
      if (existingLegend) existingLegend.remove();

      const legend = new Control({ position: "bottomright" });
      legend.onAdd = function () {
        const div = L.DomUtil.create(
          "div",
          "info leaflet-control legend bg-white p-3 rounded-lg shadow-md z-[1000] mb-[30px] mr-[10px]"
        );
        div.innerHTML = `<strong>Persebaran Jumlah Hotspot</strong><br>`;

        const categories = [
          {
            label: `Rendah (${Math.round(minHotspot)}-${Math.round(threshold1)})`, color: "green",
          },
          {
            label: `Sedang (${Math.round(threshold1) + 1}-${Math.round(threshold2)})`, color: "yellow",
          },
          { label: `Tinggi (${Math.round(threshold2) + 1}+)`, color: "red" },
        ];

        categories.forEach(({ label, color }) => {
          div.innerHTML += `<i style="background:${color}; width:18px; height:18px; display:inline-block;"></i> ${label}<br>`;
        });
        return div;
      };
      legend.addTo(map);
    }
  }, [calculateHotspotCounts, showOLAPHotspot]);

  useEffect(() => {
    if (mapRef.current && geoData[drillDownLevel]) {
      const zoomLevel =
        {
          pulau: 5,
          provinsi: 7,
          kabupaten: 9,
          kecamatan: 11,
          desa: 13,
        }[drillDownLevel] || 7;

      mapRef.current.setZoom(zoomLevel);

      if (selectedLocation) {
        mapRef.current.flyTo(selectedLocation, zoomLevel);
      }
    }
  }, [drillDownLevel, geoData, selectedLocation]);

  const getCurrentFeatureName = () => {
    if (!olapData?.query) return null;

    switch (drillDownLevel) {
      case "pulau":
        return olapData.query.pulau || null;
      case "provinsi":
        return olapData.query.provinsi || null;
      case "kabupaten":
        return olapData.query.kota || olapData.query.kabupaten || null;
      case "kecamatan":
        return olapData.query.kecamatan || null;
      case "desa":
        return olapData.query.desa || null;
      default:
        return null;
    }
  };

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
  }, [olapData, drillDownLevel, geoData]);

  return (
    <div
      className={`relative ${className} ${
        isFullscreen ? "fixed inset-0 z-[9999]" : ""
      }`}
    >
      <Tooltip id="layer-info" />
      <Tooltip id="filter-date-info" />
      <Tooltip id="all-hotspot-info" />

      {/* Control Panel */}
      <div
        className={`
        absolute z-[1000] bg-white p-3 rounded-lg shadow-lg transition-all duration-300
        ${
          isMobile
            ? isFullscreen
              ? "top-4 right-4 w-auto"
              : "top-2 right-2 w-[calc(100%-20px)]"
            : "top-4 right-4 w-auto"
        }
        ${isFullscreen ? "bg-white/90 backdrop-blur-sm" : ""}
        ${
          isControlPanelCollapsed
            ? "w-[40px] h-[40px] overflow-hidden"
            : "max-w-[300px]"
        }
      `}
      >
        <button
          className="absolute top-2 right-2 cursor-pointer text-gray-500 hover:text-gray-700"
          onClick={() => setIsControlPanelCollapsed(!isControlPanelCollapsed)}
          aria-label={
            isControlPanelCollapsed ? "Expand panel" : "Collapse panel"
          }
        >
          {isControlPanelCollapsed ? (
            <FontAwesomeIcon icon={faChevronLeft} className="text-gray-600" />
          ) : (
            <FontAwesomeIcon icon={faChevronRight} className="text-gray-600" />
          )}
        </button>

        {!isControlPanelCollapsed && (
          <>
            <div className="mb-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-sm mb-2">Pilih Layer</h3>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center">
                  <input
                    checked={showOLAPHotspot}
                    className="mr-2 h-4 w-4"
                    id="olap-hotspot"
                    type="checkbox"
                    onChange={() => setShowOLAPHotspot(!showOLAPHotspot)}
                  />
                  <label
                    htmlFor="olap-hotspot"
                    className="text-sm whitespace-nowrap"
                  >
                    Jumlah Hotspot
                  </label>
                  <span
                    className="ml-1 text-gray-500 cursor-help text-xs"
                    data-tooltip-id="layer-info"
                    data-tooltip-content="Menampilkan persebaran hotspot dengan pewarnaan berdasarkan filter periode waktu di panel kiri."
                    data-tooltip-place="right"
                  >
                    {" "}
                    ⓘ
                  </span>
                </div>
                <div className="flex items-center">
                  <input
                    checked={showTitikPanas}
                    className="mr-2 h-4 w-4"
                    id="titik-panas"
                    type="checkbox"
                    onChange={() => setShowTitikPanas(!showTitikPanas)}
                  />
                  <label
                    htmlFor="titik-panas"
                    className="text-sm whitespace-nowrap"
                  >
                    Lokasi Hotspot
                  </label>
                  <span
                    className="ml-1 text-gray-500 cursor-help text-xs"
                    data-tooltip-id="layer-info"
                    data-tooltip-content="Menampilkan titik lokasi hotspot individual. Filter tanggal di bawah hanya berlaku untuk layer ini."
                    data-tooltip-place="right"
                  >
                    {" "}
                    ⓘ
                  </span>
                </div>
              </div>
            </div>

            <div className="border-t pt-3">
              <h3 className="font-medium text-sm mb-2">
                Pilih Tanggal
                <span
                  className="ml-1 text-gray-500 cursor-help text-xs"
                  data-tooltip-id="filter-date-info"
                  data-tooltip-content="Filter ini hanya mempengaruhi tampilan layer titik lokasi hotspot di peta."
                  data-tooltip-place="right"
                >
                  {" "}
                  ⓘ
                </span>
              </h3>
              <div className="flex items-center mb-2">
                <input
                  type="checkbox"
                  id="showAllData"
                  checked={showAllData}
                  onChange={(e) => setShowAllData(e.target.checked)}
                  className="mr-2 h-4 w-4"
                />
                <label
                  htmlFor="showAllData"
                  className="text-sm whitespace-nowrap"
                >
                  Semua Lokasi Hotspot
                </label>
                <span
                  className="ml-1 text-gray-500 cursor-help text-xs"
                  data-tooltip-id="all-hotspot-info"
                  data-tooltip-content="Menampilkan semua titik lokasi hotspot tanpa pemfilteran tanggal."
                  data-tooltip-place="right"
                >
                  {" "}
                  ⓘ
                </span>
              </div>

              {!showAllData && (
                <div className="space-y-2">
                  <label className="block text-xs font-medium">Tanggal:</label>
                  <div className="flex items-center">
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="border rounded p-1 text-xs w-full"
                      max={new Date().toISOString().split("T")[0]}
                    />
                  </div>
                  {selectedDate && dateCounts[selectedDate] !== undefined && (
                    <div className="text-xs font-medium">
                      Total: {dateCounts[selectedDate]} hotspot
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

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
        <div className="flex items-center justify-center h-full w-full bg-gray-100 rounded-lg">
          <div className="animate-pulse text-gray-500">Loading map...</div>
        </div>
      ) : (
        <MapContainer
          bounds={bounds}
          center={[-2.5, 118]}
          zoom={5}
          className={`h-full w-full rounded-lg ${
            isFullscreen ? "rounded-none" : ""
          }`}
          style={{
            minHeight: isMobile ? (isFullscreen ? "100vh" : "300px") : "600px",
            zIndex: 1,
            ...style,
          }}
          ref={mapRef}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          {showOLAPHotspot && geoData[drillDownLevel] && (
            <GeoJSON
              ref={geoJsonRef}
              key={`geojson-${drillDownLevel}-${Date.now()}`}
              data={geoData[drillDownLevel] as GeoJSON.FeatureCollection}
              style={styleFeature}
              onEachFeature={(feature: CustomFeature, layer: Layer) => {
                feature.__layer = layer;
                const featureName = getFeatureName(feature, drillDownLevel);

                const totalHotspot = featureName ? calculateHotspotCounts[featureName] || 0 : 0;
                layer.bindPopup(`
                  <div class="popup-content text-sm">
                    <strong>${drillDownLevel.toUpperCase()}:</strong> ${featureName || "N/A"}<br />
                    <strong>Jumlah Hotspot:</strong> ${totalHotspot}
                  </div>
                `);
              }}
            />
          )}

          {showTitikPanas &&
            filteredHotspots.map((feature, index) => {
              const [longitude, latitude] = feature.geometry.coordinates;
              const confidence = feature.properties?.confidence || "unknown";
              const date = feature.properties?.time?.split("T")[0] || "Unknown";

              return (
                <Marker
                  key={index}
                  position={[latitude, longitude]}
                  icon={customMarker(confidence)}
                >
                  <Popup className="text-sm">
                    <strong>Confidence:</strong> {confidence}
                    <br />
                    <strong>Satellite:</strong>{" "}
                    {feature.properties?.satellite || "N/A"}
                    <br />
                    <strong>Tanggal:</strong> {date}
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
                        <strong>Kota/Kab:</strong>{" "}
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
        </MapContainer>
      )}
    </div>
  );
};

export default dynamic(() => Promise.resolve(MapComponent), {
  ssr: false,
});