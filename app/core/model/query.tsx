export interface QueryData {
    point?: string,
    dimension?: string,
    pulau?: string,
    provinsi?: string,
    kota?: string,
    kecamatan?: string,
    desa?: string,
    tahun?: string,
    semester?: string,
    kuartal?: string,
    bulan?: string,
    hari?: string,
    confidence?: string,
    satelite?: string,
    [key: string]: any;
}

export interface IChart {
    labels: (string | number)[];
    values: number[]
}

export type DrillDownLevel = "pulau" | "provinsi" | "kabupaten" | "kecamatan" | "desa";
