import { formatNumber } from "../../core/utilities/formatters";

interface MapLegendProps {
  showJumlahHotspot: boolean;
  showLokasiHotspot: boolean;
  minHotspot: number;
  threshold1: number;
  threshold2: number;
}

export default function MapLegend({
  showJumlahHotspot,
  showLokasiHotspot,
  threshold1,
  threshold2,
}: MapLegendProps) {
  return (
    <>
      {showJumlahHotspot && (
      <div className="legend-box absolute bottom-80 left-2 z-[1200] bg-white p-2 rounded-lg shadow-md max-w-[200px] text-xs
        md:bottom-40 md:left-5 md:z-[1000] md:p-3 md:max-w-none md:text-xs">
        <strong>Persebaran Jumlah Hotspot</strong><br />
        <div>
          <span style={{
            background: "#FFCDD2",
            display: "inline-block",
            width: 18,
            height: 18,
            marginRight: 8,
            borderRadius: 4
          }}></span>
          Rendah (&lt; {formatNumber(Math.round(threshold1))})
        </div>
        <div>
          <span style={{
            background: "#EF5350",
            display: "inline-block",
            width: 18,
            height: 18,
            marginRight: 8,
            borderRadius: 4
          }}></span>
          Sedang ({formatNumber(Math.round(threshold1))} - {formatNumber(Math.round(threshold2))})
        </div>
        <div>
          <span style={{
            background: "#B71C1C",
            display: "inline-block",
            width: 18,
            height: 18,
            marginRight: 8,
            borderRadius: 4
          }}></span>
          Tinggi (&gt; {formatNumber(Math.round(threshold2))})
        </div>
      </div>
    )}

      {showLokasiHotspot && (
        <div className="legend-box absolute bottom-20 left-5 z-[1000] bg-white p-3 rounded-lg shadow-md">
          <strong>Level Confidence Hotspot</strong><br />
          <div className="mt-2 text-xs text-gray-800">
            <i>Klik dan zoom in marker untuk melihat titik hotspot individual</i>
          </div>
          <div>
            <span style={{
              background: "red",
              display: "inline-block",
              width: 18,
              height: 18,
              marginRight: 8,
              borderRadius: 4
            }}></span>
            High
          </div>
          <div>
            <span style={{
              background: "yellow",
              display: "inline-block",
              width: 18,
              height: 18,
              marginRight: 8,
              borderRadius: 4,
              border: "1px solid #aaa"
            }}></span>
            Medium
          </div>
          <div>
            <span style={{
              background: "green",
              display: "inline-block",
              width: 18,
              height: 18,
              marginRight: 8,
              borderRadius: 4
            }}></span>
            Low
          </div>
        </div>
      )}
    </>
  );
}