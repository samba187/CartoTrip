// src/map/themes.js
export const THEMES = {
  dark:     { bg: "#0e1117", gold: "#d4af37", text: "#e9d8a6" },
  darkGold: { bg: "#0b0c10", gold: "#d4af37", text: "#f1e4b0" },
};

// Si tu gardes un fallback Google plus tard
export const GOOGLE_DARK_GOLD_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#0b0c10" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0b0c10" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#f1e4b0" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0a0a0a" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#d4af37" }, { weight: 1.2 }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#0e0f13" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#15161a" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#20222a" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#bfb073" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];
