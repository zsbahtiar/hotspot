import type { LatLngBoundsExpression } from "leaflet";
import type { DrillDownLevel } from "@/core/models/location";
import type { HotspotFeatureGeo } from "@/core/models/hotspot";
import type React from "react";

export interface MapComponentProps {
  bounds?: LatLngBoundsExpression;
  selectedLocation?: { lat: number; lng: number } | null;
  drillDownLevel: DrillDownLevel;
  olapData?: {
    query?: {
      pulau?: string;
      provinsi?: string;
      kota?: string;
      kecamatan?: string;
      desa?: string;
      minggu?: string;
    };
  };
  onDrillDownChange?: (newLevel: DrillDownLevel) => void;
  onDateChange?: (date: string) => void;
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
      minggu?: string;
    };
    dateRange?: { from: Date; to?: Date };
    filterMode?: "period" | "date";
    province_code?: string;
    city_code?: string;
    district_code?: string;
    subdistrict_code?: string;
  };
  onLayerChange?: (layer: "hotspot-count" | "hotspot-locations") => void;
  activeLayer?: "hotspot-count" | "hotspot-locations";
  locationData?: [string, number][];
  defaultZoom?: number;
  onHotspotDataChange?: (data: HotspotFeatureGeo[]) => void;
  onLoadingChange?: (isLoading: boolean) => void;
}

export interface MarkerClusterType {
  getChildCount(): number;
}
