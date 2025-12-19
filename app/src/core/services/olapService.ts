"use client";

import type { QueryData } from "@/core/models/query";
import { getHotspotService, type HotspotFilters } from "./hotspotService";

type MappedHotspotData = QueryData & { lat: number; lng: number };

let islandsCache: Array<{
  name: string;
  count: number;
  lat: number;
  lng: number;
  provinces: Array<{ code: string; name: string; pulau: string; count: number; lat: number; lng: number }>;
}> = [];

let cityCache: Array<{
  code: string;
  name: string;
  count: number;
}> = [];
let cityCacheKey = "";

let districtCache: Array<{
  code: string;
  name: string;
  count: number;
}> = [];
let districtCacheKey = "";

const findProvinceFromCache = (provinceName: string) => {
  for (const island of islandsCache) {
    const found = island.provinces.find((p) => p.name === provinceName);
    if (found) return found;
  }
  return null;
};

export const getProvinceCodeByName = (provinceName: string): string | undefined => {
  const province = findProvinceFromCache(provinceName);
  return province?.code;
};

export const getCityCodeByName = (cityName: string): string | undefined => {
  const city = cityCache.find((c) => c.name === cityName);
  return city?.code;
};

export const getDistrictCodeByName = (districtName: string): string | undefined => {
  const district = districtCache.find((d) => d.name === districtName);
  return district?.code;
};

export interface LocationFilters {
  confidence?: string;
  satellite?: string;
  year?: number;
  semester?: number;
  quarter?: number;
  month?: number;
  week?: number;
  start_date?: string;
  end_date?: string;
}

const buildFilterParams = (filters?: LocationFilters) => {
  if (!filters) return {};
  const params: Record<string, any> = {};
  if (filters.confidence) params.confidence = filters.confidence;
  if (filters.satellite) params.satellite = filters.satellite;
  if (filters.year) params.year = filters.year;
  if (filters.semester) params.semester = filters.semester;
  if (filters.quarter) params.quarter = filters.quarter;
  if (filters.month) params.month = filters.month;
  if (filters.week) params.week = filters.week;
  if (filters.start_date) params.start_date = filters.start_date;
  if (filters.end_date) params.end_date = filters.end_date;
  return params;
};

const hasFilters = (filters?: LocationFilters) => {
  if (!filters) return false;
  return !!(
    filters.confidence ||
    filters.satellite ||
    filters.year ||
    filters.semester ||
    filters.quarter ||
    filters.month ||
    filters.week ||
    filters.start_date ||
    filters.end_date
  );
};

export const OlapService = {
  async query(dimension: string, query?: QueryData, filters?: LocationFilters): Promise<unknown[]> {
    if (dimension === "location") {
      try {
        const hotspotService = getHotspotService();
        const tipe = (query as QueryData & { tipe?: string })?.tipe;
        const filterParams = buildFilterParams(filters);
        const useCache = !hasFilters(filters);

        if (islandsCache.length === 0) {
          const response = await hotspotService.getLocations();
          islandsCache = response.data.islands || [];
        }

        if (tipe === "provinsi" && query?.pulau) {
          if (useCache) {
            const island = islandsCache.find((i) => i.name === query.pulau);
            if (!island) return [];
            return island.provinces
              .map((p) => [p.name, p.count] as [string, number])
              .sort((a, b) => b[1] - a[1]);
          } else {
            const response = await hotspotService.getLocations(filterParams);
            const islands = response.data.islands || [];
            const island = islands.find((i) => i.name === query.pulau);
            if (!island) return [];
            return island.provinces
              .map((p) => [p.name, p.count] as [string, number])
              .sort((a, b) => b[1] - a[1]);
          }
        }

        if (tipe === "kota" && query?.provinsi) {
          const province = findProvinceFromCache(query.provinsi);
          if (!province) return [];

          const response = await hotspotService.getLocations({
            province_code: province.code,
            ...filterParams,
          });
          const cities = response.data.cities || [];

          if (useCache) {
            if (cityCacheKey !== province.code) {
              districtCache = [];
              districtCacheKey = "";
            }
            cityCache = cities;
            cityCacheKey = province.code;
          }

          return cities
            .map((c) => [c.name, c.count] as [string, number])
            .sort((a, b) => b[1] - a[1]);
        }

        if (tipe === "kecamatan" && query?.kota) {
          const province = findProvinceFromCache(query.provinsi || "");
          if (!province) return [];

          let cityCode = "";
          if (useCache && cityCache.length > 0 && cityCacheKey === province.code) {
            const city = cityCache.find((c) => c.name === query.kota);
            cityCode = city?.code || "";
          } else {
            const cityResponse = await hotspotService.getLocations({
              province_code: province.code,
            });
            const cities = cityResponse.data.cities || [];
            if (useCache) {
              cityCache = cities;
              cityCacheKey = province.code;
              districtCache = [];
              districtCacheKey = "";
            }
            const city = cities.find((c) => c.name === query.kota);
            cityCode = city?.code || "";
          }

          if (!cityCode) return [];

          const response = await hotspotService.getLocations({
            province_code: province.code,
            city_code: cityCode,
            ...filterParams,
          });
          const districts = response.data.districts || [];

          if (useCache) {
            districtCache = districts;
            districtCacheKey = cityCode;
          }

          return districts
            .map((d) => [d.name, d.count] as [string, number])
            .sort((a, b) => b[1] - a[1]);
        }

        if (tipe === "desa" && query?.kecamatan) {
          const province = findProvinceFromCache(query.provinsi || "");
          if (!province) return [];

          let cityCode = "";
          if (useCache && cityCache.length > 0 && cityCacheKey === province.code) {
            const city = cityCache.find((c) => c.name === query.kota);
            cityCode = city?.code || "";
          } else {
            const cityResponse = await hotspotService.getLocations({
              province_code: province.code,
            });
            const cities = cityResponse.data.cities || [];
            if (useCache) {
              cityCache = cities;
              cityCacheKey = province.code;
            }
            const city = cities.find((c) => c.name === query.kota);
            cityCode = city?.code || "";
          }
          if (!cityCode) return [];

          let districtCode = "";
          if (useCache && districtCache.length > 0 && districtCacheKey === cityCode) {
            const district = districtCache.find((d) => d.name === query.kecamatan);
            districtCode = district?.code || "";
          } else {
            const distResponse = await hotspotService.getLocations({
              province_code: province.code,
              city_code: cityCode,
            });
            const districts = distResponse.data.districts || [];
            if (useCache) {
              districtCache = districts;
              districtCacheKey = cityCode;
            }
            const district = districts.find((d) => d.name === query.kecamatan);
            districtCode = district?.code || "";
          }
          if (!districtCode) return [];

          const response = await hotspotService.getLocations({
            province_code: province.code,
            city_code: cityCode,
            district_code: districtCode,
            ...filterParams,
          });
          const subdistricts = response.data.subdistricts || [];
          return subdistricts
            .map((s) => [s.name, s.count] as [string, number])
            .sort((a, b) => b[1] - a[1]);
        }

        if (useCache) {
          return islandsCache
            .map((island) => [island.name, island.count] as [string, number])
            .sort((a, b) => b[1] - a[1]);
        } else {
          const response = await hotspotService.getLocations(filterParams);
          const islands = response.data.islands || [];
          return islands
            .map((island) => [island.name, island.count] as [string, number])
            .sort((a, b) => b[1] - a[1]);
        }
      } catch (error) {
        console.error("Failed to fetch location data:", error);
        return [];
      }
    }
    return [];
  },

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

  async fetchTimeData(): Promise<{ value: string; label: string }[]> {
    return [];
  },

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
