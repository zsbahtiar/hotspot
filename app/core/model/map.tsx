import { LatLngBoundsExpression, Layer } from 'leaflet';
import { DrillDownLevel } from './location';
import React from 'react';

export interface MapComponentProps {
  bounds?: LatLngBoundsExpression;
  selectedLocation?: { lat: number; lng: number } | null;
  drillDownLevel: DrillDownLevel;
  olapData?: {
    query?: {
      pulau?: string;
      provinsi?: string;
      kota?: string;
      kecamatan?: string;
      desa?: string;
      minggu?: string;
    };
  };
  onDrillDownChange?: (newLevel: DrillDownLevel) => void;
  className?: string;
  style?: React.CSSProperties;
  filters?: {
    confidence?: string | null;
    satelite?: string | null;
    time?: {
      tahun?: string;
      semester?: string;
      kuartal?: string;
      bulan?: string;
      minggu?: string;
    };
    selectedDate?: string;
    filterMode?: 'period' | 'date';
  };
  onLayerChange?: (layer: 'hotspot-count' | 'hotspot-locations') => void;
}

export interface MarkerClusterType {
  getChildCount(): number;
}