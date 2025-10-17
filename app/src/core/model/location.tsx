import type { FeatureCollection, GeoJSON } from 'geojson';
import type { Layer } from 'leaflet';

export type DrillDownLevel = 'pulau' | 'provinsi' | 'kota' | 'kecamatan' | 'desa';

export interface LocationInfo {
  pulau?: string;
  provinsi?: string;
  kab_kota?: string;
  kecamatan?: string;
  desa?: string;
}

export interface LocationData {
  lat: number;
  lng: number;
  pulau?: string;
  provinsi?: string;
  kab_kota?: string;
  kecamatan?: string;
  desa?: string;
}

export interface GeoData {
  pulau: FeatureCollection | null;
  provinsi: FeatureCollection | null;
  kota: FeatureCollection | null;
  kecamatan: FeatureCollection | null;
  desa: FeatureCollection | null;
}

export interface CustomFeature extends GeoJSON.Feature {
  __layer?: Layer;
  properties: {
    PULAU?: string;
    WADMPR?: string;
    WADMKK?: string;
    WADMKC?: string;
    NAMOBJ?: string;
    [key: string]: string | undefined;
  };
}

export interface CustomFeatureCollection extends FeatureCollection {
  features: CustomFeature[];
}