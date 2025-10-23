import { useMap } from "react-leaflet";
import { Plus, Minus, Home } from "lucide-react";
import { useEffect, useRef } from "react";
import L from "leaflet";

interface MapZoomControlsProps {
  initialCenter?: L.LatLngExpression;
  initialZoom?: number;
}

export default function MapZoomControls({
  initialCenter = [-2.5, 118],
  initialZoom = 5,
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
    map.setView(initialCenter, initialZoom, {
      animate: true,
      duration: 0.5,
    });
  };

  return (
    <div
      ref={controlRef}
      className="leaflet-top leaflet-left"
      style={{
        position: "absolute",
        top: "120px",
        left: "10px",
        zIndex: 1000,
      }}
    >
      <div className="leaflet-control leaflet-bar bg-card shadow-lg rounded overflow-hidden">
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
