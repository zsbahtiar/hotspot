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
  minHotspot,
  threshold1,
  threshold2,
}: MapLegendProps) {
  return (
    <>
      {showJumlahHotspot && (
        <div className="legend-box absolute bottom-40 left-5 z-[1000] bg-white p-3 rounded-lg shadow-md">
          <strong>Persebaran Jumlah Hotspot</strong><br />
          <div>
            <span style={{
              background: "#B3D1FF",
              display: "inline-block",
              width: 18,
              height: 18,
              marginRight: 8,
              borderRadius: 4
            }}></span>
            Rendah ({formatNumber(Math.round(minHotspot))}-{formatNumber(Math.round(threshold1))})
          </div>
          <div>
            <span style={{
              background: "#4F8EF7",
              display: "inline-block",
              width: 18,
              height: 18,
              marginRight: 8,
              borderRadius: 4
            }}></span>
            Sedang ({formatNumber(Math.round(threshold1) + 1)}-{formatNumber(Math.round(threshold2))})
          </div>
          <div>
            <span style={{
              background: "#0047AB",
              display: "inline-block",
              width: 18,
              height: 18,
              marginRight: 8,
              borderRadius: 4
            }}></span>
            Tinggi ({formatNumber(Math.round(threshold2) + 1)}+)
          </div>
        </div>
      )}

      {showLokasiHotspot && (
        <div className="legend-box absolute bottom-20 left-5 z-[1000] bg-white p-3 rounded-lg shadow-md">
          <strong>Confidence Hotspot</strong><br />
          <div className="mt-2 text-xs text-gray-800">
            <i>Klik / zoom in untuk melihat titik hotspot individual</i>
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