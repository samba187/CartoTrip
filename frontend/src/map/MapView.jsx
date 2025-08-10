// src/map/MapView.jsx
import React from "react";
import MapLibreView from "./providers/MapLibreView";
// (optionnel) fallback Google plus tard
// import GoogleMapView from "./providers/GoogleMapView";

export default function MapView(props) {
  const provider = (process.env.REACT_APP_MAP_PROVIDER || "maplibre").toLowerCase();
  if (provider === "maplibre") return <MapLibreView {...props} />;
  // return <GoogleMapView {...props} />;
  return <MapLibreView {...props} />;
}
