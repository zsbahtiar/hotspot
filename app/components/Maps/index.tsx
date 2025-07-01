import dynamic from "next/dynamic";

const MapComponent = dynamic(() => import("./MapComponent"), { 
  ssr: false, 
  loading: () => <p>Memuat data...</p>
});

export default MapComponent;
