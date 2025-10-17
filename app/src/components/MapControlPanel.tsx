"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft, faChevronRight } from "@fortawesome/free-solid-svg-icons";
import { Tooltip } from "react-tooltip";
import { formatNumber } from "../../core/utilities/formatters";

interface MapControlPanelProps {
  isMobile: boolean;
  isFullscreen: boolean;
  isControlPanelCollapsed: boolean;
  setIsControlPanelCollapsed: (collapsed: boolean) => void;
  showJumlahHotspot: boolean;
  setShowJumlahHotspot: (show: boolean) => void;
  showLokasiHotspot: boolean;
  setShowLokasiHotspot: (show: boolean) => void;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  dateCounts: Record<string, number>;
  onLayerChange: ((layer: 'hotspot-count' | 'hotspot-locations') => void) | undefined;
}

export default function MapControlPanel({
  isMobile,
  isFullscreen,
  isControlPanelCollapsed,
  setIsControlPanelCollapsed,
  showJumlahHotspot,
  setShowJumlahHotspot,
  showLokasiHotspot,
  setShowLokasiHotspot,
  selectedDate,
  setSelectedDate,
  dateCounts,
  onLayerChange,
}: MapControlPanelProps) {
  return (
    <>
      <Tooltip id="layer-info" className="!z-[1001] !max-w-[250px] !break-words !whitespace-pre-line" />
      <Tooltip id="filter-date-info" className="!z-[1001] !max-w-[250px] !break-words !whitespace-pre-line" />
      <div
        className={`
          absolute z-[1000] bg-white rounded-lg shadow-lg transition-all duration-300
          ${isMobile 
            ? isControlPanelCollapsed 
              ? "top-4 right-2 w-10 h-10 p-0 flex items-center justify-center" 
              : "top-4 right-2 max-w-[calc(100%-20px)] w-[260px] p-3"
            : "top-4 right-4 w-auto p-3"
          }
          ${isFullscreen ? "bg-white/90" : "bg-white"}
          ${isControlPanelCollapsed ? "overflow-hidden" : ""}
        `}
      >
        <button
          className={`${isControlPanelCollapsed ? "w-full h-full" : "absolute top-2 right-2"} 
          cursor-pointer text-gray-500 hover:text-gray-700`}
          onClick={() => setIsControlPanelCollapsed(!isControlPanelCollapsed)}
          aria-label={isControlPanelCollapsed ? "Expand panel" : "Collapse panel"}
        >
          {isControlPanelCollapsed ? (
            <FontAwesomeIcon icon={faChevronLeft} className="text-gray-600" />
          ) : (
            <FontAwesomeIcon icon={faChevronRight} className="text-gray-600" />
          )}
        </button>

        {!isControlPanelCollapsed && (
          <>
            <div className="mb-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-sm mb-2">Pilih Layer</h3>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center">
                  <input
                    checked={showJumlahHotspot}
                    className="mr-2 h-4 w-4"
                    id="hotspot-count"
                    type="radio"
                    name="layer"
                    onChange={() => {
                      onLayerChange?.('hotspot-count');
                      setShowJumlahHotspot(true);
                      setShowLokasiHotspot(false);
                    }}
                  />
                  <label htmlFor="hotspot-count" className="text-sm whitespace-nowrap">
                    Jumlah Hotspot
                  </label>
                  <span
                    className="ml-1 text-gray-700 cursor-help text-xs font-medium"
                    data-tooltip-id="layer-info"
                    data-tooltip-content="Menampilkan persebaran jumlah hotspot dengan pewarnaan."
                    data-tooltip-place="left"
                  >
                    {" "}ⓘ
                  </span>
                </div>
                <div className="flex items-center">
                  <input
                    checked={showLokasiHotspot}
                    className="mr-2 h-4 w-4"
                    id="hotspot-locations"
                    type="radio"
                    name="layer"
                    onChange={() => {
                      onLayerChange?.('hotspot-locations');
                      setShowJumlahHotspot(false);
                      setShowLokasiHotspot(true);
                    }}
                  />
                  <label htmlFor="hotspot-locations" className="text-sm whitespace-nowrap">
                    Lokasi Hotspot
                  </label>
                  <span
                    className="ml-1 text-gray-700 cursor-help text-xs font-medium"
                    data-tooltip-id="layer-info"
                    data-tooltip-content="Menampilkan titik lokasi hotspot individual."
                    data-tooltip-place="left"
                  >
                    {" "}ⓘ
                  </span>
                </div>
              </div>
            </div>
          
          {showLokasiHotspot && (
            <div className="border-t pt-3">
              <h3 className="font-medium text-sm mb-2">
                Pilih Tanggal
                <span
                  className="ml-1 text-gray-700 cursor-help text-xs font-medium"
                  data-tooltip-id="filter-date-info"
                  data-tooltip-content="Menampilkan titik lokasi hotspot sesuai tanggal yang dipilih."
                  data-tooltip-place="left"
                >
                  {" "}ⓘ
                </span>
              </h3>
              <div className="space-y-2">
                <label htmlFor="date-filter" className="block text-xs font-medium">Tanggal:</label>
                <div className="flex items-center">
                  <input
                    id="date-filter"
                    type="date"
                    value={selectedDate || ""}
                    onChange={(e) => setSelectedDate(e.target.value || "")}
                    className="border rounded p-1 text-xs w-full"
                    max={new Date().toISOString().split("T")[0]}
                    disabled={!showLokasiHotspot}
                  />
                </div>
                {selectedDate && dateCounts[selectedDate] !== undefined && (
                  <div id="date-filter-help" className="text-xs font-medium">
                    Total: {formatNumber(dateCounts[selectedDate])} hotspot
                  </div>
                )}
              </div>
            </div>
          )}
          </>
        )}
      </div>
    </>
  );
}