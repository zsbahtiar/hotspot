"use client";

import { useQuery } from "@tanstack/react-query";
import { hotspotService, type HotspotFilters } from "@/core/services/hotspotService";

export function useHotspots(filters?: HotspotFilters) {
  return useQuery({
    queryKey: ["hotspots", filters],
    queryFn: () => hotspotService.getHotspots(filters),
    enabled: true,
  });
}

export function useHotspotsSummary(filters?: HotspotFilters) {
  return useQuery({
    queryKey: ["hotspots", "summary", filters],
    queryFn: () => hotspotService.getHotspotsSummary(filters),
    enabled: true,
  });
}

export function useHotspotsGeoJSON(filters?: HotspotFilters) {
  return useQuery({
    queryKey: ["hotspots", "geojson", filters],
    queryFn: () => hotspotService.getHotspotsGeoJSON(filters),
    enabled: true,
  });
}

export function useMapData(filters?: HotspotFilters) {
  return useQuery({
    queryKey: ["hotspots", "map", filters],
    queryFn: () => hotspotService.fetchMapData(filters),
    enabled: true,
  });
}

export function useLatestHotspots(limit: number = 5) {
  return useQuery({
    queryKey: ["hotspots", "latest", limit],
    queryFn: () => hotspotService.getLatestHotspots(limit),
    enabled: true,
  });
}

export function useSummary(params?: { province_limit?: number; city_limit?: number; start_date?: string; end_date?: string }) {
  return useQuery({
    queryKey: ["hotspots", "summary", params],
    queryFn: () => hotspotService.getSummary(params),
    enabled: true,
  });
}

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
