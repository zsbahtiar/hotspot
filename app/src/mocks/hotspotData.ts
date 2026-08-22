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
        time: "2025-09-15T11:45:00Z",
        hotspot_time: "2025-09-15T11:45:00Z",
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
        time: "2025-08-20T09:20:00Z",
        hotspot_time: "2025-08-20T09:20:00Z",
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
        time: "2024-12-10T08:15:00Z",
        hotspot_time: "2024-12-10T08:15:00Z",
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
        time: "2024-11-05T12:00:00Z",
        hotspot_time: "2024-11-05T12:00:00Z",
        hotspot_count: 1,
        location: {
          pulau: "KALIMANTAN",
          provinsi: "KALIMANTAN TIMUR",
          kab_kota: "SAMARINDA",
          kecamatan: "SAMARINDA ULU",
          desa: "AIR HITAM"
        }
      }
    },
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [119.4327, -5.1477]
      },
      properties: {
        confidence: "high",
        satellite: "VIIRS",
        time: "2024-09-25T14:30:00Z",
        hotspot_time: "2024-09-25T14:30:00Z",
        hotspot_count: 1,
        location: {
          pulau: "SULAWESI",
          provinsi: "SULAWESI SELATAN",
          kab_kota: "MAKASSAR",
          kecamatan: "TAMALATE",
          desa: "JONGAYA"
        }
      }
    },
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [140.6719, -2.5924]
      },
      properties: {
        confidence: "medium",
        satellite: "MODIS",
        time: "2024-07-18T10:00:00Z",
        hotspot_time: "2024-07-18T10:00:00Z",
        hotspot_count: 1,
        location: {
          pulau: "PAPUA",
          provinsi: "PAPUA",
          kab_kota: "JAYAPURA",
          kecamatan: "JAYAPURA UTARA",
          desa: "GURABESI"
        }
      }
    },
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [106.8271, -6.1751]
      },
      properties: {
        confidence: "high",
        satellite: "VIIRS",
        time: "2023-10-12T13:20:00Z",
        hotspot_time: "2023-10-12T13:20:00Z",
        hotspot_count: 1,
        location: {
          pulau: "JAWA",
          provinsi: "DKI JAKARTA",
          kab_kota: "JAKARTA PUSAT",
          kecamatan: "MENTENG",
          desa: "GONDANGDIA"
        }
      }
    },
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [107.6191, -6.9175]
      },
      properties: {
        confidence: "medium",
        satellite: "MODIS",
        time: "2023-08-05T09:45:00Z",
        hotspot_time: "2023-08-05T09:45:00Z",
        hotspot_count: 1,
        location: {
          pulau: "JAWA",
          provinsi: "JAWA BARAT",
          kab_kota: "BANDUNG",
          kecamatan: "COBLONG",
          desa: "DAGO"
        }
      }
    },
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [113.9213, -0.7893]
      },
      properties: {
        confidence: "high",
        satellite: "VIIRS",
        time: "2023-06-20T11:30:00Z",
        hotspot_time: "2023-06-20T11:30:00Z",
        hotspot_count: 1,
        location: {
          pulau: "KALIMANTAN",
          provinsi: "KALIMANTAN TENGAH",
          kab_kota: "PALANGKA RAYA",
          kecamatan: "JEKAN RAYA",
          desa: "MENTENG"
        }
      }
    },
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [98.6722, 3.5952]
      },
      properties: {
        confidence: "high",
        satellite: "VIIRS",
        time: "2022-11-30T08:00:00Z",
        hotspot_time: "2022-11-30T08:00:00Z",
        hotspot_count: 1,
        location: {
          pulau: "SUMATERA",
          provinsi: "SUMATERA UTARA",
          kab_kota: "MEDAN",
          kecamatan: "MEDAN BARU",
          desa: "BABURA"
        }
      }
    },
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [115.2126, -8.6705]
      },
      properties: {
        confidence: "medium",
        satellite: "MODIS",
        time: "2022-09-14T12:15:00Z",
        hotspot_time: "2022-09-14T12:15:00Z",
        hotspot_count: 1,
        location: {
          pulau: "BALI",
          provinsi: "BALI",
          kab_kota: "DENPASAR",
          kecamatan: "DENPASAR SELATAN",
          desa: "SANUR"
        }
      }
    },
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [120.3085, -2.2180]
      },
      properties: {
        confidence: "high",
        satellite: "VIIRS",
        time: "2022-07-22T10:45:00Z",
        hotspot_time: "2022-07-22T10:45:00Z",
        hotspot_count: 1,
        location: {
          pulau: "SULAWESI",
          provinsi: "SULAWESI TENGAH",
          kab_kota: "PALU",
          kecamatan: "PALU BARAT",
          desa: "PANTOLOAN"
        }
      }
    },
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [104.7754, -2.9761]
      },
      properties: {
        confidence: "high",
        satellite: "VIIRS",
        time: "2021-12-08T14:00:00Z",
        hotspot_time: "2021-12-08T14:00:00Z",
        hotspot_count: 1,
        location: {
          pulau: "SUMATERA",
          provinsi: "SUMATERA SELATAN",
          kab_kota: "PALEMBANG",
          kecamatan: "ILIR TIMUR I",
          desa: "BUKIT BARU"
        }
      }
    },
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [117.1436, -0.5022]
      },
      properties: {
        confidence: "medium",
        satellite: "MODIS",
        time: "2021-10-17T09:30:00Z",
        hotspot_time: "2021-10-17T09:30:00Z",
        hotspot_count: 1,
        location: {
          pulau: "KALIMANTAN",
          provinsi: "KALIMANTAN TIMUR",
          kab_kota: "BALIKPAPAN",
          kecamatan: "BALIKPAPAN UTARA",
          desa: "GUNUNG BAHAGIA"
        }
      }
    },
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [109.1403, -6.8818]
      },
      properties: {
        confidence: "high",
        satellite: "VIIRS",
        time: "2021-08-29T11:00:00Z",
        hotspot_time: "2021-08-29T11:00:00Z",
        hotspot_count: 1,
        location: {
          pulau: "JAWA",
          provinsi: "JAWA TENGAH",
          kab_kota: "TEGAL",
          kecamatan: "TEGAL SELATAN",
          desa: "PANGGUNG"
        }
      }
    },
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [106.6894, -6.1162]
      },
      properties: {
        confidence: "high",
        satellite: "VIIRS",
        time: "2020-11-25T13:45:00Z",
        hotspot_time: "2020-11-25T13:45:00Z",
        hotspot_count: 1,
        location: {
          pulau: "JAWA",
          provinsi: "BANTEN",
          kab_kota: "TANGERANG",
          kecamatan: "CIPONDOH",
          desa: "PORIS PLAWAD"
        }
      }
    },
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [124.8405, 1.4748]
      },
      properties: {
        confidence: "medium",
        satellite: "MODIS",
        time: "2020-09-03T10:20:00Z",
        hotspot_time: "2020-09-03T10:20:00Z",
        hotspot_count: 1,
        location: {
          pulau: "SULAWESI",
          provinsi: "SULAWESI UTARA",
          kab_kota: "MANADO",
          kecamatan: "WENANG",
          desa: "CALACA"
        }
      }
    },
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [100.3543, -0.9471]
      },
      properties: {
        confidence: "high",
        satellite: "VIIRS",
        time: "2020-07-11T08:30:00Z",
        hotspot_time: "2020-07-11T08:30:00Z",
        hotspot_count: 1,
        location: {
          pulau: "SUMATERA",
          provinsi: "SUMATERA BARAT",
          kab_kota: "PADANG",
          kecamatan: "PADANG UTARA",
          desa: "LOLONG BELANTI"
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
