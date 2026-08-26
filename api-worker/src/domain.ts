// Response/request shapes mirroring api/domain/hotspot.go (JSON field names must match).

export interface HotspotFilters {
  startDate: Date | null;
  endDate: Date | null;
  year: number;
  semester: number;
  quarter: number;
  month: number;
  week: number;
  provinceCode: string;
  cityCode: string;
  districtCode: string;
  subdistrictCode: string;
  satelliteId: string; // satellite_name
  productId: string; // product
  confidenceId: string; // confidence_class
  limit: number;
  cursor: string;
}

export interface Pagination {
  total_count: number;
  has_next: boolean;
  next_cursor?: string;
  limit: number;
}

export interface HotspotDetail {
  id: string;
  acquired_at: string;
  latitude: string;
  longitude: string;
  frp: number;
  brightness: number;
  bright_t31: number;
  bright_ti4: number;
  bright_ti5: number;
  confidence_class: string;
  satellite_name: string;
  product: string;
  province_code: string;
  province_name: string;
  city_code: string;
  city_name: string;
  district_code: string;
  district_name: string;
  subdistrict_code: string;
  subdistrict_name: string;
  temperature: number;
  humidity: number;
  wind_speed: number;
  wind_degree: number;
  visibility: number;
  cloud_coverage: number;
  pressure: number;
  uv_index: number;
  precipitation: number;
  solar_radiation: number;
  weather_conditions: string;
  weather_icon: string;
}

export interface GetHotspotsResponse {
  hotspots: HotspotDetail[];
  pagination?: Pagination;
}

export interface LocationCount {
  name: string;
  count: number;
}

export interface DistributionCount {
  name: string;
  count: number;
}

export interface MonthlyStats {
  month: string;
  total: number;
  high_confidence: number;
}

export interface StatsResponse {
  total_hotspots: number;
  high_confidence: number;
  affected_provinces: number;
}

export interface TodayStatsResponse {
  today_hotspots: number;
  today_affected_provinces: number;
  today_high_confidence: number;
}

export interface YesterdayStatsResponse {
  yesterday_hotspots: number;
  yesterday_affected_provinces: number;
  yesterday_high_confidence: number;
}

export interface SummaryResponse {
  top_provinces: LocationCount[];
  top_cities: LocationCount[];
  satellite_distribution: DistributionCount[];
  stats: StatsResponse | null;
  monthly_stats: MonthlyStats[];
  today_stats: TodayStatsResponse | null;
  // Same tz-aware day window as today_stats but for yesterday, so the home counter
  // can show a real "vs kemarin" delta regardless of the queried range.
  yesterday_stats: YesterdayStatsResponse | null;
  confidence_distribution: DistributionCount[];
}

export interface FilterOption {
  id: string;
  name: string;
}

export interface FilterOptionsResponse {
  confidence: FilterOption[];
  satellites: FilterOption[];
  products: FilterOption[];
}

export interface PeriodValue {
  value: string;
  label: string;
}

export interface PeriodsResponse {
  years?: PeriodValue[];
  semesters?: PeriodValue[];
  quarters?: PeriodValue[];
  months?: PeriodValue[];
  weeks?: PeriodValue[];
}

export interface LocationHierarchyItem {
  code: string;
  name: string;
  pulau?: string;
  count: number;
  lat: number;
  lng: number;
}

export interface IslandGroup {
  name: string;
  count: number;
  lat: number;
  lng: number;
  provinces: LocationHierarchyItem[];
}

export interface LocationsResponse {
  islands?: IslandGroup[];
  provinces?: LocationHierarchyItem[];
  cities?: LocationHierarchyItem[];
  districts?: LocationHierarchyItem[];
  subdistricts?: LocationHierarchyItem[];
}

// GeoJSON
export interface GeoJSON {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
  pagination?: Pagination;
}

export interface GeoJSONFeature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: Record<string, unknown>;
}
