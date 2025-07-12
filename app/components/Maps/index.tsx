import dynamic from "next/dynamic";

const MapComponent = dynamic(() => import("./MapComponent"), { 
  ssr: false,
  loading: () => null
});

export default MapComponent;
