"use client";

import { useQuery } from "@tanstack/react-query";
import { hotspotService, type HotspotFilters } from "@/core/services/hotspotService";

/**
 * Hook to fetch hotspots list
 */
export function useHotspots(filters?: HotspotFilters) {
  return useQuery({
    queryKey: ["hotspots", filters],
    queryFn: () => hotspotService.getHotspots(filters),
    enabled: true,
  });
}

/**
 * Hook to fetch hotspots summary
 */
export function useHotspotsSummary(filters?: HotspotFilters) {
  return useQuery({
    queryKey: ["hotspots", "summary", filters],
    queryFn: () => hotspotService.getHotspotsSummary(filters),
    enabled: true,
  });
}

/**
 * Hook to fetch hotspots as GeoJSON
 */
export function useHotspotsGeoJSON(filters?: HotspotFilters) {
  return useQuery({
    queryKey: ["hotspots", "geojson", filters],
    queryFn: () => hotspotService.getHotspotsGeoJSON(filters),
    enabled: true,
  });
}

/**
 * Hook to fetch map data (GeoJSON format for map)
 */
export function useMapData(filters?: HotspotFilters) {
  return useQuery({
    queryKey: ["hotspots", "map", filters],
    queryFn: () => hotspotService.fetchMapData(filters),
    enabled: true,
  });
}

/**
 * Hook to fetch latest hotspots (optimized for homepage)
 */
export function useLatestHotspots(limit: number = 5) {
  return useQuery({
    queryKey: ["hotspots", "latest", limit],
    queryFn: () => hotspotService.getLatestHotspots(limit),
    enabled: true,
  });
}

/**
 * Hook to fetch all dashboard summary in single request (optimized with concurrent backend queries)
 * Replaces individual hooks: useMonthlyStats, useTopProvinces, useTopCities, useConfidenceDistribution,
 * useSatelliteDistribution, useStats, useTodayStats
 */
export function useSummary(params?: { province_limit?: number; city_limit?: number }) {
  return useQuery({
    queryKey: ["hotspots", "summary", params],
    queryFn: () => hotspotService.getSummary(params),
    enabled: true,
  });
}

/**
 * Hook to fetch dashboard data (parallel fetch of geo + summary)
 * This combines multiple queries for the dashboard view
 */
export function useDashboardData(filters?: HotspotFilters) {
  const geoData = useHotspotsGeoJSON({ limit: 1000, ...filters });
  const summaryData = useHotspotsSummary(filters);

  return {
    geoData: geoData.data?.data,
    summaryData: summaryData.data?.data,
    isLoading: geoData.isLoading || summaryData.isLoading,
    error: geoData.error || summaryData.error,
    refetch: () => {
      geoData.refetch();
      summaryData.refetch();
    },
  };
}
