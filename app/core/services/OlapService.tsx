import { QueryData } from '../../core/model/query';
import wkx from 'wkx';

export const OlapService = {
  query: async (dimension: string, query?: QueryData): Promise<any[]> => {
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
      console.log("Making request to:", url.toString());

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
    } catch (error) {
      console.error(`Error in OlapService.query (${dimension}):`, {
        error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw new Error(`Failed to fetch ${dimension} data: ${error instanceof Error ? error.message : String(error)}`);
    }
  },

  fetchMapData: async () => {
    try {
      const res = await OlapService.query('location', {}); 
      if (!Array.isArray(res)) {
        throw new Error('Invalid response format');
      }
      return res.map((d, index) => {
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
            };
          }
          return null;
        } catch (error) {
          console.warn(`Error parsing geom_desa at index ${index}`);
          return null;
        }
      }).filter(Boolean);
    } catch (error) {
      console.error('Error fetching map data:', error);
      return [];
    }
  },
  
  fetchTimeData: async (): Promise<any[]> => {
    try {
      return await OlapService.query("time");
    } catch (error) {
      console.error("Error fetching dim_time data:", error);
      throw error;
    }
  },
};

const generateParams = (query?: QueryData): string => {
  if (!query) return "";

  const params = new URLSearchParams();

  // Location parameters
  if (query.point) params.append("point", query.point);
  if (query.dimension) params.append("dimension", query.dimension);
  if (query.pulau) params.append("pulau", query.pulau);
  if (query.provinsi) params.append("provinsi", query.provinsi);
  if (query.kota) params.append("kota", query.kota);
  if (query.kecamatan) params.append("kecamatan", query.kecamatan);

  // Time parameters
  if (query.tahun) params.append("tahun", query.tahun.toString());
  if (query.semester) params.append("semester", query.semester.toString());
  if (query.kuartal) params.append("kuartal", query.kuartal.toString());
  if (query.bulan) params.append("bulan", query.bulan.toString());
  if (query.minggu) params.append("minggu", query.minggu.toString().padStart(2, "0"));
  if (query.hari) params.append("hari", query.hari.toString());

  // Filter parameters
  if (query.confidence) params.append("confidence", query.confidence);
  if (query.satelite) params.append("satelite", query.satelite);

  return `?${params.toString()}`;
};