"use client";

import type { QueryData } from "@/core/models/query";
import { getHotspotService, type HotspotFilters } from "./hotspotService";

type MappedHotspotData = QueryData & { lat: number; lng: number };

/**
 * OLAP Service for analytics queries
 */
export const OlapService = {
  /**
   * Query dimension data
   */
  async query(dimension: string, query?: QueryData): Promise<unknown[]> {
    // Mock implementation for now
    return [];
  },

  /**
   * Fetch map data
   */
  async fetchMapData(query?: QueryData): Promise<MappedHotspotData[]> {
    try {
      const response = await getHotspotService().getLatestHotspots(1000);

      if (!response || !response.data || !response.data.features) {
        console.error("Invalid response structure from GetLatestHotspots");
        return [];
      }

      return response.data.features.map((feature) => ({
        id: feature.properties.id,
        lat: feature.geometry.coordinates[1],
        lng: feature.geometry.coordinates[0],
        confidence: feature.properties.confidence,
        satellite: feature.properties.satellite,
        time: feature.properties.time,
        hotspot_time: feature.properties.hotspot_time,
        hotspot_count: feature.properties.hotspot_count || 1,
        location: feature.properties.location || {
          province_name: "",
          city_name: "",
          district_name: "",
          subdistrict_name: "",
          pulau: "",
          provinsi: "",
          kota: "",
          kecamatan: "",
          desa: "",
          kab_kota: "",
        },
      }));
    } catch (error) {
      console.error("Failed to fetch map data:", error);
      return [];
    }
  },

  /**
   * Fetch time data
   */
  async fetchTimeData(): Promise<{ value: string; label: string }[]> {
    // Mock implementation
    return [];
  },

  /**
   * Fetch dashboard data
   */
  async fetchDashboardData(filters?: HotspotFilters) {
    try {
      const [geoData, summaryData] = await Promise.all([
        getHotspotService().getHotspotsGeoJSON({ limit: 1000, ...filters }),
        getHotspotService().getHotspotsSummary(filters),
      ]);

      return {
        geoData: geoData.data,
        summaryData: summaryData.data,
      };
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
      throw error;
    }
  },
};
