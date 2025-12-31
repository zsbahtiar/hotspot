import { useMap } from "react-leaflet";
import { Plus, Minus, Home } from "lucide-react";
import { useEffect, useRef } from "react";
import L from "leaflet";

interface MapZoomControlsProps {
  isMobile?: boolean;
  isFullscreen?: boolean;
}

export default function MapZoomControls({
  isMobile = false,
  isFullscreen = false,
}: MapZoomControlsProps) {
  const map = useMap();
  const controlRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (controlRef.current) {
      L.DomEvent.disableClickPropagation(controlRef.current);
      L.DomEvent.disableScrollPropagation(controlRef.current);
    }
  }, []);

  const handleZoomIn = () => {
    map.zoomIn();
  };

  const handleZoomOut = () => {
    map.zoomOut();
  };

  const handleReset = () => {
    const indonesiaBounds = L.latLngBounds(L.latLng(-11, 94), L.latLng(6, 141));

    map.fitBounds(indonesiaBounds, {
      animate: true,
      duration: 0.8,
      padding: isMobile ? [5, 5] : [10, 10],
    });
  };

  return (
    <div
      ref={controlRef}
      className="leaflet-top leaflet-left"
      style={{
        position: "absolute",
        top: isFullscreen ? "4.5rem" : isMobile ? "0.5rem" : "2rem",
        left: "0.5rem",
        zIndex: 1000,
      }}
    >
      <div className="leaflet-control leaflet-bar bg-background border border-border rounded overflow-hidden">
        <button
          onClick={handleZoomIn}
          className="w-8 h-8 flex items-center justify-center border-b border-border hover:bg-accent transition-colors text-foreground"
          aria-label="Zoom in"
          title="Zoom in"
          type="button"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          onClick={handleZoomOut}
          className="w-8 h-8 flex items-center justify-center border-b border-border hover:bg-accent transition-colors text-foreground"
          aria-label="Zoom out"
          title="Zoom out"
          type="button"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          onClick={handleReset}
          className="w-8 h-8 flex items-center justify-center hover:bg-accent transition-colors text-foreground"
          aria-label="Reset ke posisi awal"
          title="Reset ke posisi awal"
          type="button"
        >
          <Home className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
