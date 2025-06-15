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
    minggu?: string,
    hari?: string,
    confidence?: string,
    satelite?: string,
    date?: string,
}

export interface IChart {
    labels: (string | number)[];
    values: number[]
}
