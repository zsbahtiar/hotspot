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

  // Time Period Filters
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
}

export class HotspotService {
  constructor(private httpClient: HttpClient) {}

  /**
   * Get hotspots
   */
  async getHotspots(filters?: HotspotFilters): Promise<BackendHotspotListResponse> {
    return this.httpClient.get<BackendHotspotListResponse>("/api/v1/hotspots", {
      limit: 100,
      ...filters,
    });
  }

  /**
   * Get hotspots summary
   */
  async getHotspotsSummary(
    filters?: HotspotFilters,
  ): Promise<BackendHotspotSummaryResponse> {
    return this.httpClient.get<BackendHotspotSummaryResponse>(
      "/api/v1/hotspots/summary",
      filters,
    );
  }

  /**
   * Get hotspots as GeoJSON with filters
   */
  async getHotspotsGeoJSON(
    filters?: HotspotFilters,
  ): Promise<BackendGeoJSONResponse> {
    const params: Record<string, any> = {
      limit: filters?.limit || 10000,
    };

    // Add date range (RFC3339 format)
    if (filters?.start_date) {
      params.start_date = filters.start_date;
    }
    if (filters?.end_date) {
      params.end_date = filters.end_date;
    }

    // Add time period filters
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

    // Add confidence filter
    if (filters?.confidence) {
      params.confidence = filters.confidence;
    }

    // Add satellite filter
    if (filters?.satellite) {
      params.satellite = filters.satellite;
    }

    // Add location filters
    if (filters?.province_name) {
      params.province_code = filters.province_name;
    }
    if (filters?.city_name) {
      params.city_code = filters.city_name;
    }

    return this.httpClient.get<BackendGeoJSONResponse>(
      "/api/v1/hotspots/geojson",
      params,
    );
  }

  /**
   * Fetch map data (legacy method for backward compatibility)
   */
  async fetchMapData(filters?: HotspotFilters): Promise<HotspotDataGeo> {
    const response = await this.getHotspotsGeoJSON(filters);
    return response.data;
  }

  /**
   * Fetch summary data (legacy method for backward compatibility)
   */
  async fetchSummaryData(
    filters?: HotspotFilters,
  ): Promise<BackendHotspotSummaryResponse["data"]> {
    const response = await this.getHotspotsSummary(filters);
    return response.data;
  }

  /**
   * Get latest hotspots (optimized endpoint for homepage "Data Terbaru" section)
   */
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

  /**
   * Get filter options (confidence and satellite lists)
   */
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

  /**
   * Get time periods (years, semesters, quarters, months, weeks)
   * Returns available periods based on provided filters
   */
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

  /**
   * Get all dashboard summary data in single request (optimized with concurrent queries)
   * Replaces multiple individual API calls with one endpoint
   */
  async getSummary(params?: { province_limit?: number; city_limit?: number }): Promise<{
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

/**
 * Singleton instance for backward compatibility
 */
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

/**
 * Export default instance
 */
export const hotspotService = getHotspotService();
