"use client";

import { useQuery } from "@tanstack/react-query";
import { OlapService } from "@/core/services/olapService";
import type { QueryData } from "@/core/models/query";
import type { HotspotFilters } from "@/core/services/hotspotService";

export function useOlapQuery(dimension: string, query?: QueryData) {
  return useQuery({
    queryKey: ["olap", dimension, query],
    queryFn: () => OlapService.query(dimension, query),
    enabled: !!dimension,
  });
}

export function useOlapMapData(query?: QueryData) {
  return useQuery({
    queryKey: ["olap", "map", query],
    queryFn: () => OlapService.fetchMapData(query),
    enabled: true,
  });
}

export function useOlapTimeData() {
  return useQuery({
    queryKey: ["olap", "time"],
    queryFn: () => OlapService.fetchTimeData(),
    enabled: true,
  });
}

export function useOlapDashboardData(filters?: HotspotFilters) {
  return useQuery({
    queryKey: ["olap", "dashboard", filters],
    queryFn: () => OlapService.fetchDashboardData(filters),
    enabled: true,
  });
}
