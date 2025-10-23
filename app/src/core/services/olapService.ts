"use client";

import type { QueryData } from "@/core/models/query";
import { Buffer } from "buffer";
import wkx from "wkx";

if (typeof window !== "undefined") {
  (window as any).Buffer = Buffer;
}

const USE_MOCK_DATA = true;

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

// Mock time data generator
const getMockTimeData = (query?: QueryData): unknown[] => {
  const { tahun, semester, kuartal, bulan } = query || {};

  // Return tahun (years)
  if (!tahun) {
    return [
      ["2020"],
      ["2021"],
      ["2022"],
      ["2023"],
      ["2024"],
      ["2025"],
    ];
  }

  // Return semester (1, 2)
  if (tahun && !semester) {
    return [
      ["1"],
      ["2"],
    ];
  }

  // Return kuartal (Q1, Q2, Q3, Q4)
  if (tahun && semester && !kuartal) {
    if (semester === "1") {
      return [["Q1"], ["Q2"]];
    } else {
      return [["Q3"], ["Q4"]];
    }
  }

  // Return bulan (month names)
  if (tahun && semester && kuartal && !bulan) {
    const monthMap: Record<string, string[][]> = {
      Q1: [["Januari"], ["Februari"], ["Maret"]],
      Q2: [["April"], ["Mei"], ["Juni"]],
      Q3: [["Juli"], ["Agustus"], ["September"]],
      Q4: [["Oktober"], ["November"], ["Desember"]],
    };
    return monthMap[kuartal] || [];
  }

  // Return minggu (weeks 1-4)
  if (tahun && semester && kuartal && bulan) {
    return [["1"], ["2"], ["3"], ["4"]];
  }

  return [];
};

export const OlapService = {
  query: async (dimension: string, query?: QueryData): Promise<unknown[]> => {
    // Return mock data for time dimension in mock mode
    if (USE_MOCK_DATA && dimension === "time") {
      await new Promise((resolve) => setTimeout(resolve, 300)); // Simulate API delay
      return getMockTimeData(query);
    }
    try {
      const baseUrl = import.meta.env.PUBLIC_API_URL;
      if (!baseUrl) {
        throw new Error("API base URL not configured");
      }

      const url = new URL(`${baseUrl}/api/query/${dimension}`);

      if (query) {
        Object.entries(query).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== "") {
            url.searchParams.append(key, String(value));
          }
        });
      }

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP ${response.status}: ${errorText || "No error message"}`,
        );
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        return [];
      }

      return data;
    } catch (error: unknown) {
      throw new Error(`Failed to fetch ${dimension} data`);
    }
  },

  fetchMapData: async (): Promise<MappedHotspotData[]> => {
    try {
      const res = (await OlapService.query("location", {})) as ResponseItem[];
      if (!Array.isArray(res)) {
        throw new Error("Invalid response format");
      }

      const mappedResults: (MappedHotspotData | null)[] = res.map(
        (d, index) => {
          if (!d.geom_desa || typeof d.geom_desa !== "string") {
            return null;
          }
          try {
            const buffer = Buffer.from(d.geom_desa, "hex");
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
            return null;
          }
        },
      );
      return mappedResults.filter(
        (item): item is MappedHotspotData => item !== null,
      );
    } catch (error: unknown) {
      return [];
    }
  },

  fetchTimeData: async (): Promise<{ value: string; label: string }[]> => {
    try {
      const rawData = (await OlapService.query("time")) as {
        value?: string;
        label?: string;
      }[];
      return rawData.filter(
        (item): item is { value: string; label: string } =>
          typeof item.value === "string" && typeof item.label === "string",
      );
    } catch (error: unknown) {
      throw error;
    }
  },
};
