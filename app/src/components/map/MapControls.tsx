"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Tooltip } from "react-tooltip";
import { formatNumber } from "@/core/utils/formatters";
import { DateRangePicker } from "@/components/ui/date-range-picker-final";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface DateRange {
  from: Date;
  to?: Date;
}

interface MapControlPanelProps {
  isMobile: boolean;
  isFullscreen: boolean;
  isControlPanelCollapsed: boolean;
  setIsControlPanelCollapsed: (collapsed: boolean) => void;
  showJumlahHotspot: boolean;
  setShowJumlahHotspot: (show: boolean) => void;
  showLokasiHotspot: boolean;
  setShowLokasiHotspot: (show: boolean) => void;
  dateRange: DateRange | undefined;
  setDateRange: (range: DateRange | undefined) => void;
  totalCount: number;
  onLayerChange:
    | ((layer: "hotspot-count" | "hotspot-locations") => void)
    | undefined;
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
  dateRange,
  setDateRange,
  totalCount,
  onLayerChange,
}: MapControlPanelProps) {

  return (
    <>
      <Tooltip
        id="layer-info"
        className="!max-w-[250px] !break-words !whitespace-pre-line"
        style={{ zIndex: 99999 }}
      />
      <Tooltip
        id="filter-date-info"
        className="!max-w-[250px] !break-words !whitespace-pre-line"
        style={{ zIndex: 99999 }}
      />
      <div
        style={{
          position: "absolute",
          top: isFullscreen ? "4.5rem" : isMobile ? "0.5rem" : "2rem",
          right: "0.5rem",
          zIndex: 1000,
          width: isControlPanelCollapsed
            ? "2.5rem"
            : isMobile
              ? "260px"
              : "280px",
          height: isControlPanelCollapsed ? "2.5rem" : "auto",
          maxWidth:
            isMobile && !isControlPanelCollapsed
              ? "calc(100% - 20px)"
              : undefined,
          padding: isControlPanelCollapsed ? 0 : "0.75rem",
        }}
        className={`
          bg-card rounded-lg shadow-lg transition-all duration-300 text-card-foreground
          ${isControlPanelCollapsed ? "flex items-center justify-center" : ""}
          ${isFullscreen ? "bg-card/90" : "bg-card"}
          ${isControlPanelCollapsed ? "overflow-hidden" : ""}
        `}
      >
        <button
          style={
            isControlPanelCollapsed
              ? {
                  width: "100%",
                  height: "100%",
                  cursor: "pointer",
                  color: "hsl(var(--muted-foreground))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "none",
                  background: "transparent",
                  padding: 0,
                }
              : {
                  position: "absolute",
                  top: "0.5rem",
                  right: "0.5rem",
                  cursor: "pointer",
                  color: "hsl(var(--muted-foreground))",
                  border: "none",
                  background: "transparent",
                  padding: 0,
                }
          }
          onMouseEnter={(e) =>
            (e.currentTarget.style.color = "hsl(var(--foreground))")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.color = "hsl(var(--muted-foreground))")
          }
          onClick={() => setIsControlPanelCollapsed(!isControlPanelCollapsed)}
          aria-label={
            isControlPanelCollapsed ? "Expand panel" : "Collapse panel"
          }
        >
          {isControlPanelCollapsed ? (
            <ChevronLeft style={{ width: "16px", height: "16px" }} />
          ) : (
            <ChevronRight style={{ width: "16px", height: "16px" }} />
          )}
        </button>

        {!isControlPanelCollapsed && (
          <>
            <div className="mb-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-sm mb-2">Pilih Layer</h3>
              </div>
              <RadioGroup
                value={
                  showJumlahHotspot ? "hotspot-count" : "hotspot-locations"
                }
                onValueChange={(value) => {
                  if (value === "hotspot-count") {
                    onLayerChange?.("hotspot-count");
                    setShowJumlahHotspot(true);
                    setShowLokasiHotspot(false);
                  } else {
                    onLayerChange?.("hotspot-locations");
                    setShowJumlahHotspot(false);
                    setShowLokasiHotspot(true);
                  }
                }}
                className="flex flex-col gap-2"
              >
                <div className="flex items-center">
                  <RadioGroupItem
                    value="hotspot-count"
                    id="hotspot-count"
                    className="mr-2"
                  />
                  <Label
                    htmlFor="hotspot-count"
                    className="text-sm whitespace-nowrap cursor-pointer"
                  >
                    Jumlah Hotspot
                  </Label>
                  <span
                    style={{
                      marginLeft: "0.25rem",
                      color: "hsl(var(--muted-foreground))",
                      cursor: "help",
                      fontSize: "0.75rem",
                      fontWeight: 500,
                    }}
                    data-tooltip-id="layer-info"
                    data-tooltip-content="Menampilkan persebaran jumlah hotspot dengan pewarnaan."
                    data-tooltip-place="left"
                  >
                    {" "}
                    ⓘ
                  </span>
                </div>
                <div className="flex items-center">
                  <RadioGroupItem
                    value="hotspot-locations"
                    id="hotspot-locations"
                    className="mr-2"
                  />
                  <Label
                    htmlFor="hotspot-locations"
                    className="text-sm whitespace-nowrap cursor-pointer"
                  >
                    Lokasi Hotspot
                  </Label>
                  <span
                    style={{
                      marginLeft: "0.25rem",
                      color: "hsl(var(--muted-foreground))",
                      cursor: "help",
                      fontSize: "0.75rem",
                      fontWeight: 500,
                    }}
                    data-tooltip-id="layer-info"
                    data-tooltip-content="Menampilkan titik lokasi hotspot individual."
                    data-tooltip-place="left"
                  >
                    {" "}
                    ⓘ
                  </span>
                </div>
              </RadioGroup>
            </div>

            {showLokasiHotspot && (
              <div
                style={{
                  borderTop: "1px solid #E5E7EB",
                  paddingTop: "0.75rem",
                }}
              >
                <h3
                  style={{
                    fontWeight: 500,
                    fontSize: "0.875rem",
                    marginBottom: "0.5rem",
                  }}
                >
                  Pilih Rentang Tanggal
                  <span
                    style={{
                      marginLeft: "0.25rem",
                      color: "hsl(var(--muted-foreground))",
                      cursor: "help",
                      fontSize: "0.75rem",
                      fontWeight: 500,
                    }}
                    data-tooltip-id="filter-date-info"
                    data-tooltip-content="Menampilkan titik lokasi hotspot sesuai rentang tanggal yang dipilih."
                    data-tooltip-place="left"
                  >
                    {" "}
                    ⓘ
                  </span>
                </h3>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                  }}
                >
                  <Label htmlFor="date-range-filter" className="text-xs font-medium">
                    Rentang Tanggal
                  </Label>
                  <DateRangePicker
                    id="date-range-filter"
                    value={dateRange}
                    onChange={(range) => {
                      if (!range) {
                        const today = new Date();
                        setDateRange({ from: today, to: today });
                      } else {
                        setDateRange(range);
                      }
                    }}
                    placeholder="Pilih rentang tanggal"
                    className="text-sm"
                  />
                  {dateRange?.from && (
                    <div
                      id="date-filter-help"
                      style={{ fontSize: "0.75rem", fontWeight: 500 }}
                    >
                      Total: {formatNumber(totalCount)} hotspot
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
