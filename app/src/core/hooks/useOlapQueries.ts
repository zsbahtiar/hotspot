"use client";

import { useQuery } from "@tanstack/react-query";
import { OlapService } from "@/core/services/olapService";
import type { QueryData } from "@/core/models/query";
import type { HotspotFilters } from "@/core/services/hotspotService";

/**
 * Hook to query OLAP dimension
 */
export function useOlapQuery(dimension: string, query?: QueryData) {
  return useQuery({
    queryKey: ["olap", dimension, query],
    queryFn: () => OlapService.query(dimension, query),
    enabled: !!dimension,
  });
}

/**
 * Hook to fetch map data from OLAP
 */
export function useOlapMapData(query?: QueryData) {
  return useQuery({
    queryKey: ["olap", "map", query],
    queryFn: () => OlapService.fetchMapData(query),
    enabled: true,
  });
}

/**
 * Hook to fetch time data from OLAP
 */
export function useOlapTimeData() {
  return useQuery({
    queryKey: ["olap", "time"],
    queryFn: () => OlapService.fetchTimeData(),
    enabled: true,
  });
}

/**
 * Hook to fetch dashboard data from OLAP (parallel execution)
 */
export function useOlapDashboardData(filters?: HotspotFilters) {
  return useQuery({
    queryKey: ["olap", "dashboard", filters],
    queryFn: () => OlapService.fetchDashboardData(filters),
    enabled: true,
  });
}
