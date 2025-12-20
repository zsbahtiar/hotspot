import type { LocationInfo } from "@/core/models/location";

export type ConfidenceLevel =
  | "low"
  | "medium"
  | "high"
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "NOMINAL";

export interface LocationInfo {
  province_name?: string;
  city_name?: string;
  district_name?: string;
  subdistrict_name?: string;
  pulau?: string;
  provinsi?: string;
  kota?: string;
  kecamatan?: string;
  desa?: string;
  kab_kota?: string;
}

export interface MeasurementInfo {
  frp?: number;
  brightness?: number;
  bright_t31?: number;
  bright_ti4?: number;
  bright_ti5?: number;
}

export interface WeatherInfo {
  temperature?: number;
  humidity?: number;
  wind_speed?: number;
  wind_degree?: number;
  visibility?: number;
  cloud_coverage?: number;
  pressure?: number;
  uv_index?: number;
  precipitation?: number;
  solar_radiation?: number;
  weather_conditions?: string;
  weather_icon?: string;
}

export interface HotspotFeatureGeo extends GeoJSON.Feature {
  geometry: GeoJSON.Point;
  properties: {
    id: string;
    acquired_at: string;
    confidence: ConfidenceLevel;
    satellite_name: string;
    instrument: string;
    location: LocationInfo;
    time?: string;
    satellite?: string;
    hotspot_count?: number;
    hotspot_time?: string;
    minggu?: string;
  } & MeasurementInfo & WeatherInfo;
}

export interface Pagination {
  total_count: number;
  has_next: boolean;
  next_cursor?: string;
  limit: number;
}

export interface HotspotDataGeo {
  features: HotspotFeatureGeo[];
  type: "FeatureCollection";
  pagination?: Pagination;
}

export type HotspotFeature = {
  type: string;
  geometry: {
    coordinates: [number, number];
    type: string;
  };
  properties: {
    id: string;
    acquired_at: string;
    confidence: ConfidenceLevel;
    satellite_name: string;
    instrument: string;
    location: LocationInfo;
    time?: string;
    satellite?: string;
    hotspot_count?: number;
    hotspot_time?: string;
  } & MeasurementInfo & WeatherInfo;
  hotspot?: {
    id: string;
    acquired_at: string;
    confidence: ConfidenceLevel;
    satellite_name: string;
    instrument: string;
    location: LocationInfo;
    time?: string;
    satellite?: string;
    hotspot_count?: number;
    hotspot_time?: string;
  } & MeasurementInfo;
};

export type HotspotData = {
  features: HotspotFeature[];
};

export interface BackendHotspotData {
  id: string;
  latitude: number;
  longitude: number;
  acquired_at: string;
  confidence: ConfidenceLevel;
  satellite_name: string;
  instrument: string;
  frp: number;
  brightness: number;
  location: LocationInfo;
}

export interface BackendHotspotListResponse {
  message: string;
  success: boolean;
  data: {
    items: BackendHotspotData[];
    total: number;
  };
}

export interface BackendHotspotSummary {
  total_count: number;
  date_range: {
    start_date: string;
    end_date: string;
  };
  top_provinces: Array<{
    name: string;
    count: number;
  }>;
  top_cities: Array<{
    name: string;
    count: number;
  }>;
  confidence: Record<string, number>;
  satellites: Record<string, number>;
  monthly: Array<{
    month: string;
    count: number;
  }>;
  daily_avg: number;
}

export interface BackendHotspotSummaryResponse {
  message: string;
  success: boolean;
  data: BackendHotspotSummary;
}

export interface BackendGeoJSONResponse {
  message: string;
  success: boolean;
  data: HotspotDataGeo;
}

export type AccumulatedData = {
  tanggal: string;
  satelit: string;
  confidence: ConfidenceLevel;
  provinsi: string;
  kota: string;
  jumlah: number;
};
