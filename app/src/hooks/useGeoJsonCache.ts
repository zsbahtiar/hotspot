import { useState, useCallback } from "react";
import { decompressGzip } from "@/core/utils/formatters";

interface GeoJsonProperty {
  KDPPUM?: string;
  WADMPR?: string;
  WADMKK?: string;
  WADMKC?: string;
  WADMKD?: string;
  PULAU?: string;
  PROVINSI?: string;
  KAB_KOTA?: string;
  KECAMATAN?: string;
  DESA_KELUR?: string;
}

interface GeoJsonFeature extends GeoJSON.Feature {
  type: "Feature";
  properties: GeoJsonProperty;
  geometry: GeoJSON.MultiPolygon;
}

interface GeoJsonFeatureCollection extends GeoJSON.FeatureCollection {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
}

export interface CachedGeoJsonData {
  island: GeoJsonFeatureCollection;
  province: GeoJsonFeatureCollection;
  city: GeoJsonFeatureCollection;
  district: GeoJsonFeatureCollection;
  subdistrict: GeoJsonFeatureCollection;
  timestamp: number;
}

const DB_NAME = "HotspotGeoCache";
const DB_VERSION = 1;
const STORE_NAME = "geojson";
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
const LOCALSTORAGE_KEY = "hotspot_geojson_cache";

// Check if IndexedDB is available and working
const isIndexedDBAvailable = async (): Promise<boolean> => {
  if (typeof window === "undefined" || !window.indexedDB) {
    return false;
  }

  try {
    // Test if IndexedDB actually works (some browsers lie about support)
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

// LocalStorage helper functions (fallback when IndexedDB not available)
const storeDataLocalStorage = async (key: string, data: any): Promise<void> => {
  try {
    const jsonString = JSON.stringify(data);
    const sizeInMB = new Blob([jsonString]).size / (1024 * 1024);
    console.log(`[Cache] Attempting to store ${sizeInMB.toFixed(2)}MB in localStorage`);

    // Check if data is too large for localStorage (> 4MB is risky)
    if (sizeInMB > 4) {
      console.warn(`[Cache] Data too large (${sizeInMB.toFixed(2)}MB), skipping localStorage cache`);
      throw new Error("Data too large for localStorage");
    }

    localStorage.setItem(`${LOCALSTORAGE_KEY}_${key}`, jsonString);
    console.log(`[Cache] Successfully stored ${sizeInMB.toFixed(2)}MB in localStorage`);
  } catch (error: any) {
    if (error.name === 'QuotaExceededError' || error.message?.includes('quota')) {
      console.warn("[Cache] localStorage quota exceeded, clearing old cache");
      // Clear all cache items to free up space
      Object.keys(localStorage).forEach(storageKey => {
        if (storageKey.startsWith(LOCALSTORAGE_KEY)) {
          localStorage.removeItem(storageKey);
        }
      });
      // Don't retry - just skip caching for now
      console.warn("[Cache] Skipping cache due to storage constraints");
    } else {
      console.error("[Cache] localStorage error:", error);
    }
    // Don't throw - allow app to continue without cache
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

// IndexedDB helper functions
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
  // Try IndexedDB first (works on both desktop and modern mobile browsers)
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
          console.log(`[Cache] Data stored in IndexedDB: ${key}`);
          resolve();
        };
      });
    } catch (error) {
      console.warn("[Cache] IndexedDB store failed, trying localStorage:", error);
      // Fallback to localStorage
      return storeDataLocalStorage(key, data);
    }
  } else {
    console.log("[Cache] IndexedDB not available, using localStorage");
    return storeDataLocalStorage(key, data);
  }
};

const getData = async (key: string): Promise<any> => {
  // Try IndexedDB first
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
            console.log(`[Cache] Data loaded from IndexedDB: ${key}`);
          }
          resolve(request.result);
        };
      });
    } catch (error) {
      console.warn("[Cache] IndexedDB get failed, trying localStorage:", error);
      // Fallback to localStorage
      return getDataLocalStorage(key);
    }
  } else {
    console.log("[Cache] IndexedDB not available, using localStorage");
    return getDataLocalStorage(key);
  }
};

const removeData = async (key: string): Promise<void> => {
  // Try both storages
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

  // Also try localStorage (in case data was stored there)
  await removeDataLocalStorage(key);
};

export const useGeoJsonCache = () => {
  const [cachedData, setCachedData] = useState<CachedGeoJsonData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const getCachedData = async (): Promise<CachedGeoJsonData | null> => {
    try {
      const cached = await getData("geojson_cache");
      if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY) {
        console.log('[GeoJSON Cache] Valid cache found, using cached data');
        return cached;
      }
      console.log('[GeoJSON Cache] No valid cache found, will fetch fresh data');
    } catch (error) {
      console.error("[GeoJSON Cache] Error reading cache:", error);
    }
    return null;
  };

  const saveToCache = async (data: GeoJSON.FeatureCollection[]) => {
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
      console.log("[GeoJSON Cache] All data saved to cache successfully");
    } catch (error) {
      console.error("[GeoJSON Cache] Error saving to cache (continuing without cache):", error);
      // Set cached data anyway so it's available in memory
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
    data: GeoJSON.FeatureCollection,
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
      console.log(`[GeoJSON Cache] Level '${level}' saved to cache successfully`);
    } catch (error) {
      console.error(`[GeoJSON Cache] Error saving ${level} to cache (continuing without cache):`, error);
      // Don't throw - allow app to continue
    }
  };

  const fetchSingleGeoJson = useCallback(
    async (
      level: keyof Omit<CachedGeoJsonData, "timestamp">,
    ): Promise<GeoJSON.FeatureCollection> => {
      try {
        // Use production server directly for both development and production
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

        // Return empty GeoJSON as last resort
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
        console.log("[GeoJSON Cache] Fetching GeoJSON data...", level ? `level: ${level}` : "all levels");
        const cached = await getCachedData();
        if (cached && (!level || cached[level])) {
          console.log("[GeoJSON Cache] Using cached data");
          setCachedData(cached);
          return cached;
        }

        // Load all data if no specific level requested
        if (!level) {
          console.log("[GeoJSON Cache] Loading all levels sequentially...");
          // Load individual files to avoid large parallel requests
          const levels: (keyof Omit<CachedGeoJsonData, "timestamp">)[] = [
            "island",
            "province",
            "city",
            "district",
            "subdistrict",
          ];
          const result = { timestamp: Date.now() } as CachedGeoJsonData;

          for (const lvl of levels) {
            console.log(`[GeoJSON Cache] Fetching ${lvl}...`);
            result[lvl] = await fetchSingleGeoJson(lvl);
          }

          console.log("[GeoJSON Cache] All levels fetched, saving to cache...");
          await storeData("geojson_cache", result);
          setCachedData(result);
          return result;
        }

        // Load specific level
        console.log(`[GeoJSON Cache] Loading specific level: ${level}`);
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
