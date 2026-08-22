import { useState, useCallback } from "react";
import { decompressGzip } from "@/core/utils/formatters";
import type { FeatureCollection, Feature } from "geojson";

type GeoJsonFeature = Feature;
type GeoJsonFeatureCollection = FeatureCollection;

export interface CachedGeoJsonData {
  island: GeoJsonFeatureCollection | null;
  province: GeoJsonFeatureCollection | null;
  city: GeoJsonFeatureCollection | null;
  district: GeoJsonFeatureCollection | null;
  subdistrict: GeoJsonFeatureCollection | null;
  timestamp: number;
}

const DB_NAME = "HotspotGeoCache";
const DB_VERSION = 1;
const STORE_NAME = "geojson";
const CACHE_EXPIRY = 24 * 60 * 60 * 1000;
const LOCALSTORAGE_KEY = "hotspot_geojson_cache";

const isIndexedDBAvailable = async (): Promise<boolean> => {
  if (typeof window === "undefined" || !window.indexedDB) {
    return false;
  }

  try {
    const testDB = await new Promise<boolean>((resolve) => {
      const request = indexedDB.open("__test__", 1);
      request.onsuccess = () => {
        request.result.close();
        indexedDB.deleteDatabase("__test__");
        resolve(true);
      };
      request.onerror = () => resolve(false);
      request.onblocked = () => resolve(false);
    });
    return testDB;
  } catch (error) {
    console.warn("IndexedDB test failed:", error);
    return false;
  }
};

const storeDataLocalStorage = async (key: string, data: any): Promise<void> => {
  try {
    const jsonString = JSON.stringify(data);
    const sizeInMB = new Blob([jsonString]).size / (1024 * 1024);
    if (sizeInMB > 4) {
      console.warn(
        `[Cache] Data too large (${sizeInMB.toFixed(2)}MB), skipping localStorage cache`,
      );
      throw new Error("Data too large for localStorage");
    }

    localStorage.setItem(`${LOCALSTORAGE_KEY}_${key}`, jsonString);
  } catch (error: any) {
    if (
      error.name === "QuotaExceededError" ||
      error.message?.includes("quota")
    ) {
      console.warn("[Cache] localStorage quota exceeded, clearing old cache");
      Object.keys(localStorage).forEach((storageKey) => {
        if (storageKey.startsWith(LOCALSTORAGE_KEY)) {
          localStorage.removeItem(storageKey);
        }
      });
      console.warn("[Cache] Skipping cache due to storage constraints");
    } else {
      console.error("[Cache] localStorage error:", error);
    }
  }
};

const getDataLocalStorage = async (key: string): Promise<any> => {
  try {
    const data = localStorage.getItem(`${LOCALSTORAGE_KEY}_${key}`);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error("Error reading from localStorage:", error);
    return null;
  }
};

const removeDataLocalStorage = async (key: string): Promise<void> => {
  try {
    localStorage.removeItem(`${LOCALSTORAGE_KEY}_${key}`);
  } catch (error) {
    console.error("Error removing from localStorage:", error);
  }
};

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
};

const storeData = async (key: string, data: any): Promise<void> => {
  const hasIndexedDB = await isIndexedDBAvailable();

  if (hasIndexedDB) {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(data, key);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          resolve();
        };
      });
    } catch (error) {
      console.warn(
        "[Cache] IndexedDB store failed, trying localStorage:",
        error,
      );
      return storeDataLocalStorage(key, data);
    }
  } else {
    return storeDataLocalStorage(key, data);
  }
};

const getData = async (key: string): Promise<any> => {
  const hasIndexedDB = await isIndexedDBAvailable();

  if (hasIndexedDB) {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          if (request.result) {
          }
          resolve(request.result);
        };
      });
    } catch (error) {
      console.warn("[Cache] IndexedDB get failed, trying localStorage:", error);
      return getDataLocalStorage(key);
    }
  } else {
    return getDataLocalStorage(key);
  }
};

const removeData = async (key: string): Promise<void> => {
  const hasIndexedDB = await isIndexedDBAvailable();

  if (hasIndexedDB) {
    try {
      const db = await openDB();
      await new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(key);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(undefined);
      });
    } catch (error) {
      console.warn("[Cache] IndexedDB delete failed:", error);
    }
  }

  await removeDataLocalStorage(key);
};

export const useGeoJsonCache = () => {
  const [cachedData, setCachedData] = useState<CachedGeoJsonData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const getCachedData = async (): Promise<CachedGeoJsonData | null> => {
    try {
      const cached = await getData("geojson_cache");
      if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY) {
        return cached;
      }
    } catch (error) {}
    return null;
  };

  const saveToCache = async (data: GeoJsonFeatureCollection[]) => {
    try {
      const cacheData: CachedGeoJsonData = {
        island: data[0],
        province: data[1],
        city: data[2],
        district: data[3],
        subdistrict: data[4],
        timestamp: Date.now(),
      };
      await storeData("geojson_cache", cacheData);
      setCachedData(cacheData);
    } catch (error) {
      console.error(
        "[GeoJSON Cache] Error saving to cache (continuing without cache):",
        error,
      );
      setCachedData({
        island: data[0],
        province: data[1],
        city: data[2],
        district: data[3],
        subdistrict: data[4],
        timestamp: Date.now(),
      });
    }
  };

  const saveSingleToCache = async (
    level: keyof Omit<CachedGeoJsonData, "timestamp">,
    data: GeoJsonFeatureCollection,
  ) => {
    try {
      const existing =
        (await getCachedData()) ||
        ({
          island: null,
          province: null,
          city: null,
          district: null,
          subdistrict: null,
          timestamp: Date.now(),
        } as CachedGeoJsonData);

      existing[level] = data;
      existing.timestamp = Date.now();

      await storeData("geojson_cache", existing);
      setCachedData(existing);
    } catch (error) {
      console.error(
        `[GeoJSON Cache] Error saving ${level} to cache (continuing without cache):`,
        error,
      );
    }
  };

  const fetchSingleGeoJson = useCallback(
    async (
      level: keyof Omit<CachedGeoJsonData, "timestamp">,
    ): Promise<GeoJsonFeatureCollection> => {
      try {
        const urls: Record<string, string> = {
          island: "https://hotspot.zsbahtiar.com/maps/batas_pulau.geojson.gz",
          province:
            "https://hotspot.zsbahtiar.com/maps/batas_provinsi.geojson.gz",
          city: "https://hotspot.zsbahtiar.com/maps/batas_kabkota.geojson.gz",
          district:
            "https://hotspot.zsbahtiar.com/maps/batas_kecamatan.geojson.gz",
          subdistrict:
            "https://hotspot.zsbahtiar.com/maps/batas_keldesa.geojson.gz",
        };

        const response = await fetch(urls[level]);

        if (!response.ok) {
          throw new Error(
            `Failed to fetch ${urls[level]}: ${response.statusText}`,
          );
        }

        const data = await decompressGzip(response);
        return data;
      } catch (error) {
        console.error(`Error fetching ${level} GeoJSON:`, error);

        return {
          type: "FeatureCollection",
          features: [],
        };
      }
    },
    [],
  );

  const fetchAndCacheGeoJson = useCallback(
    async (
      level?: keyof Omit<CachedGeoJsonData, "timestamp">,
    ): Promise<CachedGeoJsonData> => {
      setIsLoading(true);
      try {
        const cached = await getCachedData();

        if (cached) {
          const cacheAge = Date.now() - cached.timestamp;

          if (!level) {
            setCachedData(cached);
            return cached;
          }

          if (cached[level] !== null && cached[level] !== undefined) {
            setCachedData(cached);
            return cached;
          }
        }

        if (!level) {
          const levels: (keyof Omit<CachedGeoJsonData, "timestamp">)[] = [
            "island",
            "province",
            "city",
            "district",
            "subdistrict",
          ];
          const result = { timestamp: Date.now() } as CachedGeoJsonData;

          for (const lvl of levels) {
            result[lvl] = await fetchSingleGeoJson(lvl);
          }

          await storeData("geojson_cache", result);
          setCachedData(result);
          return result;
        }

        const existingCache =
          cached ||
          ({
            island: null,
            province: null,
            city: null,
            district: null,
            subdistrict: null,
            timestamp: Date.now(),
          } as CachedGeoJsonData);

        const specificData = await fetchSingleGeoJson(level);
        existingCache[level] = specificData;
        existingCache.timestamp = Date.now();

        await saveSingleToCache(level, specificData);
        return existingCache;
      } catch (error) {
        console.error("[GeoJSON Cache] Error fetching GeoJSON:", error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchSingleGeoJson],
  );

  const clearCache = async () => {
    try {
      await removeData("geojson_cache");
      setCachedData(null);
    } catch (error) {
      console.error("Error clearing cache:", error);
    }
  };

  return {
    cachedData,
    isLoading,
    fetchAndCacheGeoJson,
    clearCache,
  };
};
