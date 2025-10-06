'use client';

import { QueryData } from '../../core/model/query';
import wkx from 'wkx';

type MappedHotspotData = QueryData & { lat: number; lng: number };
type ResponseItem = {
  geom_desa?: string;
  pulau?: string;
  provinsi?: string;
  kota?: string;
  kecamatan?: string;
  desa?: string;
  hotspot_count?: number; 
};

export const OlapService = {
  query: async (dimension: string, query?: QueryData): Promise<unknown[]> => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!baseUrl) {
        throw new Error("API base URL not configured");
      }

      const url = new URL(`${baseUrl}/api/query/${dimension}`);

      if (query) {
        Object.entries(query).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            url.searchParams.append(key, String(value));
          }
        });
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        cache: 'no-store'
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText || 'No error message'}`);
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        console.warn("API response is not an array:", data);
        return [];
      }

      return data;
    } catch (error: unknown) {
      console.error(`Error in OlapService.query (${dimension}):`, {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw new Error(`Failed to fetch ${dimension} data: ${error instanceof Error ? error.message : String(error)}`);
    }
  },

  fetchMapData: async (): Promise<MappedHotspotData[]> => {
    try {
      const res = await OlapService.query('location', {}) as ResponseItem[];
      if (!Array.isArray(res)) {
        throw new Error('Invalid response format');
      }

      const mappedResults: (MappedHotspotData | null)[] = res.map((d, index) => {
        if (!d.geom_desa || typeof d.geom_desa !== 'string') {
          console.warn(`Skipping invalid geom_desa at index ${index}`);
          return null;
        }
        try {
          const buffer = Buffer.from(d.geom_desa, 'hex');
          const geometry = wkx.Geometry.parse(buffer);
          if (geometry instanceof wkx.Point) {
            return {
              ...d,
              lat: geometry.y,
              lng: geometry.x,
            } as MappedHotspotData;
          }
          return null;
        } catch (error: unknown) { 
          console.warn(`Error parsing geom_desa at index ${index}`, error);
          return null;
        }
      });
      return mappedResults.filter((item): item is MappedHotspotData => item !== null);
    } catch (error: unknown) { 
      console.error('Error fetching map data:', error);
      return [];
    }
  },

  fetchTimeData: async (): Promise<{ value: string; label: string }[]> => {
    try {
      const rawData = await OlapService.query("time") as { value?: string; label?: string; }[];
      return rawData.filter((item): item is { value: string; label: string } =>
        typeof item.value === 'string' && typeof item.label === 'string'
      );
    } catch (error: unknown) { 
      console.error("Error fetching dim_time data:", error);
      throw error;
    }
  },
};