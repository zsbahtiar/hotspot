const today = new Date().toISOString().split('T')[0];

export const mockHotspotData = {
  query: {},
  features: [
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [106.8456, -6.2088]
      },
      properties: {
        confidence: "high",
        satellite: "VIIRS",
        time: `${today}T10:30:00Z`,
        hotspot_time: `${today}T10:30:00Z`,
        hotspot_count: 1,
        location: {
          pulau: "JAWA",
          provinsi: "DKI JAKARTA",
          kab_kota: "JAKARTA SELATAN",
          kecamatan: "KEBAYORAN BARU",
          desa: "SENAYAN"
        }
      }
    },
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [110.3695, -7.7972]
      },
      properties: {
        confidence: "medium",
        satellite: "MODIS",
        time: `${today}T11:45:00Z`,
        hotspot_time: `${today}T11:45:00Z`,
        hotspot_count: 1,
        location: {
          pulau: "JAWA",
          provinsi: "JAWA TENGAH",
          kab_kota: "SLEMAN",
          kecamatan: "MLATI",
          desa: "SENDANGADI"
        }
      }
    },
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [112.7508, -7.2575]
      },
      properties: {
        confidence: "high",
        satellite: "VIIRS",
        time: `${today}T09:20:00Z`,
        hotspot_time: `${today}T09:20:00Z`,
        hotspot_count: 1,
        location: {
          pulau: "JAWA",
          provinsi: "JAWA TIMUR",
          kab_kota: "SURABAYA",
          kecamatan: "SUKOLILO",
          desa: "KEPUTIH"
        }
      }
    },
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [101.4478, 0.5071]
      },
      properties: {
        confidence: "high",
        satellite: "VIIRS",
        time: `${today}T08:15:00Z`,
        hotspot_time: `${today}T08:15:00Z`,
        hotspot_count: 1,
        location: {
          pulau: "SUMATERA",
          provinsi: "RIAU",
          kab_kota: "PEKANBARU",
          kecamatan: "TAMPAN",
          desa: "SIDOMULYO BARAT"
        }
      }
    },
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [116.0753, -1.2707]
      },
      properties: {
        confidence: "medium",
        satellite: "MODIS",
        time: `${today}T12:00:00Z`,
        hotspot_time: `${today}T12:00:00Z`,
        hotspot_count: 1,
        location: {
          pulau: "KALIMANTAN",
          provinsi: "KALIMANTAN TIMUR",
          kab_kota: "SAMARINDA",
          kecamatan: "SAMARINDA ULU",
          desa: "AIR HITAM"
        }
      }
    }
  ]
};

export const mockLocationData = [
  { pulau: "JAWA", provinsi: "DKI JAKARTA", kab_kota: "JAKARTA SELATAN", kecamatan: "KEBAYORAN BARU", desa: "SENAYAN", lat: -6.2088, lng: 106.8456 },
  { pulau: "JAWA", provinsi: "JAWA TENGAH", kab_kota: "SLEMAN", kecamatan: "MLATI", desa: "SENDANGADI", lat: -7.7972, lng: 110.3695 },
  { pulau: "JAWA", provinsi: "JAWA TIMUR", kab_kota: "SURABAYA", kecamatan: "SUKOLILO", desa: "KEPUTIH", lat: -7.2575, lng: 112.7508 },
  { pulau: "SUMATERA", provinsi: "RIAU", kab_kota: "PEKANBARU", kecamatan: "TAMPAN", desa: "SIDOMULYO BARAT", lat: 0.5071, lng: 101.4478 },
  { pulau: "KALIMANTAN", provinsi: "KALIMANTAN TIMUR", kab_kota: "SAMARINDA", kecamatan: "SAMARINDA ULU", desa: "AIR HITAM", lat: -1.2707, lng: 116.0753 },
  { pulau: "SULAWESI", provinsi: "SULAWESI SELATAN", kab_kota: "MAKASSAR", kecamatan: "TAMALATE", desa: "JONGAYA", lat: -5.1477, lng: 119.4327 },
  { pulau: "PAPUA", provinsi: "PAPUA", kab_kota: "JAYAPURA", kecamatan: "JAYAPURA UTARA", desa: "GURABESI", lat: -2.5924, lng: 140.6719 },
];

export const mockOlapData = {
  pulau: [
    ["JAWA", 45],
    ["SUMATERA", 32],
    ["KALIMANTAN", 28],
    ["SULAWESI", 15],
    ["PAPUA", 10],
    ["MALUKU", 5],
    ["BALI", 8],
    ["NUSA TENGGARA", 12]
  ],
  provinsi_jawa: [
    ["DKI JAKARTA", 12],
    ["JAWA BARAT", 15],
    ["JAWA TENGAH", 10],
    ["JAWA TIMUR", 8]
  ],
  confidence: [
    ["high", 85],
    ["medium", 45],
    ["low", 25]
  ],
  satelite: [
    ["VIIRS", 95],
    ["MODIS", 60]
  ]
};
