// src/map/providers/MapLibreView.jsx
import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { THEMES } from "../themes";

export default function MapLibreView({
  markers = [],                 // [{ lat, lng, title }]
  onMarkerClick,
  initialCenter = { lat: 20, lng: 0 },
  initialZoom = 3,
  theme = "darkGold",
  fitToMarkers = true,
  style = { width: "100%", height: "100%" },
}) {
  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const htmlMarkersRef = useRef([]);
  const [styleReady, setStyleReady] = useState(false);

  // 1) Crée la carte
  useEffect(() => {
    const key = process.env.REACT_APP_MAPTILER_KEY;
    const styleUrl = `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${key}`;

    const map = new maplibregl.Map({
      container: mapDivRef.current,
      style: styleUrl,
      center: [initialCenter.lng, initialCenter.lat],
      zoom: initialZoom,
      attributionControl: true,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    mapRef.current = map;

    map.on("load", () => {
      setStyleReady(true); // le style est prêt, on pourra placer les markers

      // thème “black & gold”
      const gold = THEMES[theme]?.gold || "#d4af37";
      try {
        if (map.getLayer("background")) {
          map.setPaintProperty("background", "background-color", "#0b0c10");
        }
        ["admin-0-boundary", "admin-0-boundary-disputed", "admin-1-boundary"].forEach((id) => {
          if (map.getLayer(id)) {
            map.setPaintProperty(id, "line-color", gold);
            map.setPaintProperty(id, "line-width", 1.2);
          }
        });
      } catch {}
    });

    return () => { try { map.remove(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ne recrée pas la carte inutilement

  // 2) Met à jour les marqueurs quand la liste change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;

    // Supprimer les anciens
    htmlMarkersRef.current.forEach((mk) => { try { mk.remove(); } catch {} });
    htmlMarkersRef.current = [];

    const gold = THEMES[theme]?.gold || "#d4af37";
    const bounds = new maplibregl.LngLatBounds();
    let count = 0;

    (markers || []).forEach((m) => {
      const lat = Number(m?.lat);
      const lng = Number(m?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const el = document.createElement("div");
      el.title = m?.title || "";
      el.style.cssText = `
        width:14px;height:14px;border-radius:50%;
        background:${gold};border:2px solid #0b0c10;
        box-shadow:0 0 0 2px rgba(212,175,55,.2);cursor:pointer;
      `;
      const mk = new maplibregl.Marker(el).setLngLat([lng, lat]).addTo(map);
      htmlMarkersRef.current.push(mk);

      if (onMarkerClick) el.addEventListener("click", () => onMarkerClick({ ...m, lat, lng }));
      bounds.extend([lng, lat]);
      count++;
    });

    if (count > 0 && fitToMarkers) {
      map.fitBounds(bounds, { padding: 60, animate: true, maxZoom: 8 });
    }
  }, [markers, theme, styleReady, onMarkerClick, fitToMarkers]);

  return <div ref={mapDivRef} style={style} />;
}
