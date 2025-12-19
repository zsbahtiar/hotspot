"use client";

import type {
  BackendHotspotListResponse,
  BackendHotspotSummaryResponse,
  BackendGeoJSONResponse,
  HotspotDataGeo,
} from "@/core/models/hotspot";
import { HttpClient } from "./httpClient";

export interface HotspotFilters {
  start_date?: string;
  end_date?: string;

  year?: number;
  semester?: number;
  quarter?: number;
  month?: number;
  week?: number;

  province_name?: string;
  city_name?: string;
  district_name?: string;
  subdistrict_name?: string;
  confidence?: string;
  satellite?: string;
  min_lat?: number;
  max_lat?: number;
  min_lng?: number;
  max_lng?: number;
  limit?: number;
  offset?: number;
  cursor?: string;
}

export class HotspotService {
  constructor(private httpClient: HttpClient) {}

  async getHotspots(
    filters?: HotspotFilters,
  ): Promise<BackendHotspotListResponse> {
    return this.httpClient.get<BackendHotspotListResponse>("/api/v1/hotspots", {
      limit: 100,
      ...filters,
    });
  }

  async getHotspotsSummary(
    filters?: HotspotFilters,
  ): Promise<BackendHotspotSummaryResponse> {
    return this.httpClient.get<BackendHotspotSummaryResponse>(
      "/api/v1/hotspots/summary",
      filters,
    );
  }

  async getHotspotsGeoJSON(
    filters?: HotspotFilters,
  ): Promise<BackendGeoJSONResponse> {
    const params: Record<string, any> = {};

    if (filters?.limit) {
      params.limit = filters.limit;
    }

    if (filters?.start_date) {
      params.start_date = filters.start_date;
    }
    if (filters?.end_date) {
      params.end_date = filters.end_date;
    }

    if (filters?.year) {
      params.year = filters.year;
    }
    if (filters?.semester) {
      params.semester = filters.semester;
    }
    if (filters?.quarter) {
      params.quarter = filters.quarter;
    }
    if (filters?.month) {
      params.month = filters.month;
    }
    if (filters?.week) {
      params.week = filters.week;
    }

    if (filters?.confidence) {
      params.confidence = filters.confidence;
    }

    if (filters?.satellite) {
      params.satellite = filters.satellite;
    }

    if (filters?.province_name) {
      params.province_code = filters.province_name;
    }
    if (filters?.city_name) {
      params.city_code = filters.city_name;
    }

    if (filters?.cursor) {
      params.cursor = filters.cursor;
    }

    return this.httpClient.get<BackendGeoJSONResponse>(
      "/api/v1/hotspots/geojson",
      params,
    );
  }

  async fetchMapData(filters?: HotspotFilters): Promise<HotspotDataGeo> {
    const response = await this.getHotspotsGeoJSON(filters);
    return response.data;
  }

  async fetchSummaryData(
    filters?: HotspotFilters,
  ): Promise<BackendHotspotSummaryResponse["data"]> {
    const response = await this.getHotspotsSummary(filters);
    return response.data;
  }

  async getLatestHotspots(limit: number = 5): Promise<{
    data: {
      hotspots: Array<{
        id: string;
        acquired_at: string;
        latitude: string;
        longitude: string;
        frp: number;
        brightness: number;
        confidence_class: string;
        satellite_name: string;
        province_name: string;
        city_name: string;
        district_name: string;
        subdistrict_name: string;
        temperature: number;
        humidity: number;
        wind_speed: number;
        precipitation: number;
        weather_conditions: string;
        weather_icon: string;
      }>;
    };
  }> {
    return this.httpClient.get<{
      data: {
        hotspots: Array<{
          id: string;
          acquired_at: string;
          latitude: string;
          longitude: string;
          frp: number;
          brightness: number;
          confidence_class: string;
          satellite_name: string;
          province_name: string;
          city_name: string;
          district_name: string;
          subdistrict_name: string;
          temperature: number;
          humidity: number;
          wind_speed: number;
          precipitation: number;
          weather_conditions: string;
          weather_icon: string;
        }>;
      };
    }>("/api/v1/hotspots", { limit });
  }

  async getFilterOptions(): Promise<{
    data: {
      confidence: Array<{ id: string; name: string }>;
      satellites: Array<{ id: string; name: string }>;
    };
  }> {
    return this.httpClient.get<{
      data: {
        confidence: Array<{ id: string; name: string }>;
        satellites: Array<{ id: string; name: string }>;
      };
    }>("/api/v1/hotspots/filter-options");
  }

  async getPeriods(params?: {
    year?: number;
    semester?: number;
    quarter?: number;
    month?: number;
  }): Promise<{
    data: {
      years?: Array<{ value: string; label: string }>;
      semesters?: Array<{ value: string; label: string }>;
      quarters?: Array<{ value: string; label: string }>;
      months?: Array<{ value: string; label: string }>;
      weeks?: Array<{ value: string; label: string }>;
    };
  }> {
    return this.httpClient.get<{
      data: {
        years?: Array<{ value: string; label: string }>;
        semesters?: Array<{ value: string; label: string }>;
        quarters?: Array<{ value: string; label: string }>;
        months?: Array<{ value: string; label: string }>;
        weeks?: Array<{ value: string; label: string }>;
      };
    }>("/api/v1/hotspots/periods", params);
  }

  async getLocations(params?: {
    province_code?: string;
    city_code?: string;
    district_code?: string;
    confidence?: string;
    satellite?: string;
    year?: number;
    semester?: number;
    quarter?: number;
    month?: number;
    week?: number;
    start_date?: string;
    end_date?: string;
  }): Promise<{
    data: {
      islands?: Array<{
        name: string;
        count: number;
        lat: number;
        lng: number;
        provinces: Array<{
          code: string;
          name: string;
          pulau: string;
          count: number;
          lat: number;
          lng: number;
        }>;
      }>;
      provinces?: Array<{
        code: string;
        name: string;
        pulau: string;
        count: number;
        lat: number;
        lng: number;
      }>;
      cities?: Array<{
        code: string;
        name: string;
        count: number;
        lat: number;
        lng: number;
      }>;
      districts?: Array<{
        code: string;
        name: string;
        count: number;
        lat: number;
        lng: number;
      }>;
      subdistricts?: Array<{
        code: string;
        name: string;
        count: number;
        lat: number;
        lng: number;
      }>;
    };
  }> {
    return this.httpClient.get<{
      data: {
        islands?: Array<{
          name: string;
          count: number;
          lat: number;
          lng: number;
          provinces: Array<{
            code: string;
            name: string;
            pulau: string;
            count: number;
            lat: number;
            lng: number;
          }>;
        }>;
        provinces?: Array<{
          code: string;
          name: string;
          pulau: string;
          count: number;
          lat: number;
          lng: number;
        }>;
        cities?: Array<{
          code: string;
          name: string;
          count: number;
          lat: number;
          lng: number;
        }>;
        districts?: Array<{
          code: string;
          name: string;
          count: number;
          lat: number;
          lng: number;
        }>;
        subdistricts?: Array<{
          code: string;
          name: string;
          count: number;
          lat: number;
          lng: number;
        }>;
      };
    }>("/api/v1/hotspots/locations", params);
  }

  async getSummary(params?: {
    province_limit?: number;
    city_limit?: number;
    start_date?: string;
    end_date?: string;
  }): Promise<{
    data: {
      top_provinces: Array<{ name: string; count: number }>;
      top_cities: Array<{ name: string; count: number }>;
      satellite_distribution: Array<{ name: string; count: number }>;
      stats: {
        total_hotspots: number;
        high_confidence: number;
        affected_provinces: number;
      };
      monthly_stats: Array<{
        month: string;
        total: number;
        high_confidence: number;
      }>;
      today_stats: {
        today_hotspots: number;
        today_affected_provinces: number;
        today_high_confidence: number;
      };
      confidence_distribution: Array<{ name: string; count: number }>;
    };
  }> {
    return this.httpClient.get<{
      data: {
        top_provinces: Array<{ name: string; count: number }>;
        top_cities: Array<{ name: string; count: number }>;
        satellite_distribution: Array<{ name: string; count: number }>;
        stats: {
          total_hotspots: number;
          high_confidence: number;
          affected_provinces: number;
        };
        monthly_stats: Array<{
          month: string;
          total: number;
          high_confidence: number;
        }>;
        today_stats: {
          today_hotspots: number;
          today_affected_provinces: number;
          today_high_confidence: number;
        };
        confidence_distribution: Array<{ name: string; count: number }>;
      };
    }>("/api/v1/hotspots/summary", params);
  }
}

let _hotspotServiceInstance: HotspotService | null = null;

export const getHotspotService = (): HotspotService => {
  if (!_hotspotServiceInstance) {
    const baseUrl =
      typeof import.meta !== "undefined"
        ? import.meta.env.PUBLIC_API_URL || "http://localhost:8080"
        : "http://localhost:8080";

    const httpClient = new HttpClient({ baseUrl });
    _hotspotServiceInstance = new HotspotService(httpClient);
  }
  return _hotspotServiceInstance;
};

export const hotspotService = getHotspotService();
