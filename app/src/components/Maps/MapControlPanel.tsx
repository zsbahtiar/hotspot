"use client";

import { RefreshCw, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, X, Loader2 } from 'lucide-react';
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
  const today = new Date().toISOString().split('T')[0];

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
          position: 'absolute',
          top: isMobile ? '1rem' : '1rem',
          right: isMobile ? '0.5rem' : '1rem',
          zIndex: 1000,
          width: isMobile
            ? (isControlPanelCollapsed ? '2.5rem' : '260px')
            : 'auto',
          height: isMobile && isControlPanelCollapsed ? '2.5rem' : 'auto',
          maxWidth: isMobile && !isControlPanelCollapsed ? 'calc(100% - 20px)' : undefined,
          padding: isControlPanelCollapsed && isMobile ? 0 : '0.75rem',
        }}
        className={`
          bg-white rounded-lg shadow-lg transition-all duration-300
          ${isMobile
            ? isControlPanelCollapsed
              ? "flex items-center justify-center"
              : ""
            : ""
          }
          ${isFullscreen ? "bg-white/90" : "bg-white"}
          ${isControlPanelCollapsed ? "overflow-hidden" : ""}
        `}
      >
        <button
          style={isControlPanelCollapsed ? {
            width: '100%',
            height: '100%',
            cursor: 'pointer',
            color: '#6B7280',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            background: 'transparent',
            padding: 0
          } : {
            position: 'absolute',
            top: '0.5rem',
            right: '0.5rem',
            cursor: 'pointer',
            color: '#6B7280',
            border: 'none',
            background: 'transparent',
            padding: 0
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#374151'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#6B7280'}
          onClick={() => setIsControlPanelCollapsed(!isControlPanelCollapsed)}
          aria-label={isControlPanelCollapsed ? "Expand panel" : "Collapse panel"}
        >
          {isControlPanelCollapsed ? (
            <ChevronLeft style={{ color: '#4B5563', width: '16px', height: '16px' }} />
          ) : (
            <ChevronRight style={{ color: '#4B5563', width: '16px', height: '16px' }} />
          )}
        </button>

        {!isControlPanelCollapsed && (
          <>
            <div className="mb-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-sm mb-2">Pilih Layer</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <input
                    checked={showJumlahHotspot}
                    style={{ marginRight: '0.5rem', height: '1rem', width: '1rem' }}
                    id="hotspot-count"
                    type="radio"
                    name="layer"
                    onChange={() => {
                      onLayerChange?.('hotspot-count');
                      setShowJumlahHotspot(true);
                      setShowLokasiHotspot(false);
                    }}
                  />
                  <label htmlFor="hotspot-count" style={{ fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
                    Jumlah Hotspot
                  </label>
                  <span
                    style={{
                      marginLeft: '0.25rem',
                      color: '#374151',
                      cursor: 'help',
                      fontSize: '0.75rem',
                      fontWeight: 500
                    }}
                    data-tooltip-id="layer-info"
                    data-tooltip-content="Menampilkan persebaran jumlah hotspot dengan pewarnaan."
                    data-tooltip-place="left"
                  >
                    {" "}ⓘ
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <input
                    checked={showLokasiHotspot}
                    style={{ marginRight: '0.5rem', height: '1rem', width: '1rem' }}
                    id="hotspot-locations"
                    type="radio"
                    name="layer"
                    onChange={() => {
                      onLayerChange?.('hotspot-locations');
                      setShowJumlahHotspot(false);
                      setShowLokasiHotspot(true);
                    }}
                  />
                  <label htmlFor="hotspot-locations" style={{ fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
                    Lokasi Hotspot
                  </label>
                  <span
                    style={{
                      marginLeft: '0.25rem',
                      color: '#374151',
                      cursor: 'help',
                      fontSize: '0.75rem',
                      fontWeight: 500
                    }}
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
            <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '0.75rem' }}>
              <h3 style={{ fontWeight: 500, fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                Pilih Tanggal
                <span
                  style={{
                    marginLeft: '0.25rem',
                    color: '#374151',
                    cursor: 'help',
                    fontSize: '0.75rem',
                    fontWeight: 500
                  }}
                  data-tooltip-id="filter-date-info"
                  data-tooltip-content="Menampilkan titik lokasi hotspot sesuai tanggal yang dipilih."
                  data-tooltip-place="left"
                >
                  {" "}ⓘ
                </span>
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label htmlFor="date-filter" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500 }}>Tanggal:</label>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <input
                    id="date-filter"
                    type="date"
                    value={selectedDate || today}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    style={{
                      border: '1px solid #D1D5DB',
                      borderRadius: '0.25rem',
                      padding: '0.25rem',
                      fontSize: '0.75rem',
                      width: '100%'
                    }}
                    max={today}
                    disabled={!showLokasiHotspot}
                  />
                </div>
                {selectedDate && dateCounts[selectedDate] !== undefined && (
                  <div id="date-filter-help" style={{ fontSize: '0.75rem', fontWeight: 500 }}>
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