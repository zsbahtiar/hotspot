import dynamic from "next/dynamic";

const MapComponent = dynamic(() => import("./MapComponent"), { 
  ssr: false, 
  loading: () => <p>Loading map...</p>
});

export default MapComponent;
