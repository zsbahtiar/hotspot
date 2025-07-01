import { GeoJSON } from 'geojson';
import { LocationInfo } from './location';

export type ConfidenceLevel = "low" | "medium" | "high";

export interface HotspotFeatureGeo extends GeoJSON.Feature {
  geometry: GeoJSON.Point;
  properties: {
    minggu: string;
    confidence: ConfidenceLevel;
    satellite: string;
    time: string;
    location: LocationInfo;
    hotspot_count: number;
    hotspot_time: string;
  };
}

export interface HotspotDataGeo {
  features: HotspotFeatureGeo[];
  type: "FeatureCollection";
}

export type HotspotFeature = {
  geometry: {
    coordinates: [number, number];
    type: string;
  };
  properties: {
    confidence: ConfidenceLevel;
    satellite: string;
    time: string;
    hotspot_time: string;
    hotspot_count: number;
    location: {
      pulau: string;
      provinsi: string;
      kecamatan: string;
      kab_kota: string;
      desa: string;
    };
  };
};

export type HotspotData = {
  features: HotspotFeature[];
};

export type AccumulatedData = {
  tanggal: string;
  satelit: string;
  confidence: ConfidenceLevel;
  provinsi: string;
  kota: string;
  jumlah: number;
};