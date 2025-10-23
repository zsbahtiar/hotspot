import { formatNumber } from "@/core/utils/formatters";
import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronLeft,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";

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
  const [isCollapsedJumlah, setIsCollapsedJumlah] = useState(false);
  const [isCollapsedLokasi, setIsCollapsedLokasi] = useState(false);

  return (
    <>
      {showJumlahHotspot && (
        <div
          className={`legend-box absolute bottom-5 z-[1200] bg-card rounded-lg shadow-md text-xs text-card-foreground transition-all duration-300
        md:bottom-30 md:z-[1000] md:text-xs ${
          isCollapsedJumlah ? "w-8 h-10" : "w-[200px] md:w-auto"
        }`}
          style={{ left: "1.25rem" }}
        >
          {isCollapsedJumlah ? (
            <button
              onClick={() => setIsCollapsedJumlah(false)}
              className="w-full h-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Expand legend"
            >
              <FontAwesomeIcon icon={faChevronRight} className="w-3 h-3" />
            </button>
          ) : (
            <>
              <div className="flex items-center justify-between p-2 md:p-3 border-b border-border">
                <strong>Persebaran Jumlah Hotspot</strong>
                <button
                  onClick={() => setIsCollapsedJumlah(true)}
                  className="ml-2 text-muted-foreground hover:text-foreground transition-colors p-1"
                  aria-label="Collapse legend"
                >
                  <FontAwesomeIcon icon={faChevronLeft} className="w-3 h-3" />
                </button>
              </div>
              <div className="p-2 md:p-3 pt-2 space-y-1">
                <div className="flex items-center">
                  <span
                    style={{
                      background: "#FFCDD2",
                      display: "inline-block",
                      width: 18,
                      height: 18,
                      marginRight: 8,
                      borderRadius: 4,
                    }}
                  ></span>
                  <span>Rendah (&lt; {formatNumber(Math.round(threshold1))})</span>
                </div>
                <div className="flex items-center">
                  <span
                    style={{
                      background: "#EF5350",
                      display: "inline-block",
                      width: 18,
                      height: 18,
                      marginRight: 8,
                      borderRadius: 4,
                    }}
                  ></span>
                  <span>Sedang ({formatNumber(Math.round(threshold1))} -{" "}
                  {formatNumber(Math.round(threshold2))})</span>
                </div>
                <div className="flex items-center">
                  <span
                    style={{
                      background: "#B71C1C",
                      display: "inline-block",
                      width: 18,
                      height: 18,
                      marginRight: 8,
                      borderRadius: 4,
                    }}
                  ></span>
                  <span>Tinggi (&gt; {formatNumber(Math.round(threshold2))})</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {showLokasiHotspot && (
        <div
          className={`legend-box absolute bottom-5 z-[1000] bg-card rounded-lg shadow-md text-card-foreground transition-all duration-300 ${
            isCollapsedLokasi ? "w-10 h-10" : "w-auto"
          }`}
          style={{ left: "0.5rem" }}
        >
          {isCollapsedLokasi ? (
            <button
              onClick={() => setIsCollapsedLokasi(false)}
              className="w-full h-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Expand legend"
            >
              <FontAwesomeIcon icon={faChevronRight} className="w-3 h-3" />
            </button>
          ) : (
            <>
              <div className="flex items-center justify-between p-3 border-b border-border">
                <strong>Level Confidence Hotspot</strong>
                <button
                  onClick={() => setIsCollapsedLokasi(true)}
                  className="ml-2 text-muted-foreground hover:text-foreground transition-colors p-1"
                  aria-label="Collapse legend"
                >
                  <FontAwesomeIcon icon={faChevronLeft} className="w-3 h-3" />
                </button>
              </div>
              <div className="p-3 pt-2 space-y-1">
                <div className="mt-2 text-xs text-muted-foreground">
                  <i>
                    Klik dan zoom in marker untuk melihat titik hotspot
                    individual
                  </i>
                </div>
                <div className="flex items-center">
                  <span
                    style={{
                      background: "red",
                      display: "inline-block",
                      width: 18,
                      height: 18,
                      marginRight: 8,
                      borderRadius: 4,
                    }}
                  ></span>
                  <span>High</span>
                </div>
                <div className="flex items-center">
                  <span
                    style={{
                      background: "yellow",
                      display: "inline-block",
                      width: 18,
                      height: 18,
                      marginRight: 8,
                      borderRadius: 4,
                      border: "1px solid #aaa",
                    }}
                  ></span>
                  <span>Medium</span>
                </div>
                <div className="flex items-center">
                  <span
                    style={{
                      background: "green",
                      display: "inline-block",
                      width: 18,
                      height: 18,
                      marginRight: 8,
                      borderRadius: 4,
                    }}
                  ></span>
                  <span>Low</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
