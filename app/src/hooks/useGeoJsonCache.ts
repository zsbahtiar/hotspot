import { decompressGzip } from '@/core/utils/formatters';

const GEOJSON_CACHE_KEY = 'geojson_cache';
const CACHE_VERSION_KEY = 'geojson_cache_version';
const CACHE_VERSION = '1.0.0';

interface CachedGeoJsonData {
  pulau: any;
  provinsi: any;
  kota: any;
  kecamatan: any;
  desa: any;
  timestamp: number;
  version: string;
}

const geoJsonUrls = [
  "/maps/batas_pulau.geojson.gz",
  "/maps/batas_provinsi.geojson.gz",
  "/maps/batas_kabkota.geojson.gz",
  "/maps/batas_kecamatan.geojson.gz",
  "/maps/batas_keldesa.geojson.gz",
];

export const useGeoJsonCache = () => {
  const [isPreloading, setIsPreloading] = useState(false);
  const [preloadProgress, setPreloadProgress] = useState(0);
  const [cachedData, setCachedData] = useState<CachedGeoJsonData | null>(null);

  const getCachedData = (): CachedGeoJsonData | null => {
    try {
      const cached = localStorage.getItem(GEOJSON_CACHE_KEY);
      const version = localStorage.getItem(CACHE_VERSION_KEY);

      if (cached && version === CACHE_VERSION) {
        const data = JSON.parse(cached);
        const maxAge = 24 * 60 * 60 * 1000;
        if (Date.now() - data.timestamp < maxAge) {
          return data;
        }
      }
    } catch (error) {
      console.error('Error reading cache:', error);
    }
    return null;
  };

  const saveToCache = (data: any[]) => {
    try {
      const cacheData: CachedGeoJsonData = {
        pulau: data[0],
        provinsi: data[1],
        kota: data[2],
        kecamatan: data[3],
        desa: data[4],
        timestamp: Date.now(),
        version: CACHE_VERSION,
      };

      localStorage.setItem(GEOJSON_CACHE_KEY, JSON.stringify(cacheData));
      localStorage.setItem(CACHE_VERSION_KEY, CACHE_VERSION);
      setCachedData(cacheData);
    } catch (error) {
      console.error('Error saving to cache:', error);
      try {
        localStorage.clear();
        const cacheData: CachedGeoJsonData = {
          pulau: data[0],
          provinsi: data[1],
          kota: data[2],
          kecamatan: data[3],
          desa: data[4],
          timestamp: Date.now(),
          version: CACHE_VERSION,
        };
        localStorage.setItem(GEOJSON_CACHE_KEY, JSON.stringify(cacheData));
        localStorage.setItem(CACHE_VERSION_KEY, CACHE_VERSION);
        setCachedData(cacheData);
      } catch (retryError) {
        console.error('Failed to save cache even after clearing:', retryError);
      }
    }
  };

  const preloadGeoJson = async (): Promise<CachedGeoJsonData> => {
    setIsPreloading(true);
    setPreloadProgress(0);

    try {
      const responses = await Promise.all(geoJsonUrls.map((url) => fetch(url)));

      for (const response of responses) {
        if (!response.ok) {
          throw new Error(
            `Failed to fetch ${response.url}: ${response.statusText}`,
          );
        }
      }

      const decompressedPromises = responses.map(async (res) => {
        return decompressGzip(res);
      });

      const geoJsonData = await Promise.all(decompressedPromises);
      saveToCache(geoJsonData);
      setPreloadProgress(100);

      const result: CachedGeoJsonData = {
        pulau: geoJsonData[0],
        provinsi: geoJsonData[1],
        kota: geoJsonData[2],
        kecamatan: geoJsonData[3],
        desa: geoJsonData[4],
        timestamp: Date.now(),
        version: CACHE_VERSION,
      };

      return result;
    } catch (error) {
      console.error('Error preloading GeoJSON:', error);
      throw error;
    } finally {
      setIsPreloading(false);
    }
  };

  const getGeoJsonData = async (): Promise<CachedGeoJsonData> => {
    const cached = getCachedData();
    if (cached) {
      setCachedData(cached);
      return cached;
    }

    return preloadGeoJson();
  };

  const clearCache = () => {
    localStorage.removeItem(GEOJSON_CACHE_KEY);
    localStorage.removeItem(CACHE_VERSION_KEY);
    setCachedData(null);
  };

  return {
    isPreloading,
    preloadProgress,
    cachedData,
    getGeoJsonData,
    preloadGeoJson,
    clearCache,
  };
};