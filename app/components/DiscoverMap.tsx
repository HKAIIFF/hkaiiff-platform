"use client";

import { useEffect, useRef } from "react";

export interface MapNode {
  id: string | number;
  lat: number;
  lng: number;
  title: string;
  state: "unlocked" | "locked_geo" | "locked_cond";
  city: string;
}

interface DiscoverMapProps {
  nodes: MapNode[];
  selectedId: string | number | null;
  onMarkerClick: (id: string | number) => void;
}

const STATE_COLORS: Record<string, string> = {
  unlocked: "#CCFF00",
  locked_geo: "#ef4444",
  locked_cond: "#f59e0b",
};

export default function DiscoverMap({ nodes, selectedId, onMarkerClick }: DiscoverMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leafletMapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<Record<string | number, any>>({});

  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return;

    // Dynamic import to avoid SSR issues
    import("leaflet").then((L) => {
      // Fix default marker icon paths for webpack/Next.js
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(mapRef.current!, {
        center: [22.32, 114.17],
        zoom: 11,
        zoomControl: false,
        attributionControl: false,
      });

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        { subdomains: "abcd", maxZoom: 20 }
      ).addTo(map);

      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.control.attribution({ position: "bottomleft", prefix: false }).addTo(map);

      leafletMapRef.current = map;

      // Add markers
      nodes.forEach((node) => {
        if (!node.lat || !node.lng) return;
        const color = STATE_COLORS[node.state] ?? "#888";
        const isSelected = node.id === selectedId;

        const icon = L.divIcon({
          className: "",
          html: `
            <div style="
              width:${isSelected ? 20 : 14}px;
              height:${isSelected ? 20 : 14}px;
              background:${color};
              border-radius:50%;
              border:2px solid ${isSelected ? "#fff" : "rgba(0,0,0,0.5)"};
              box-shadow:0 0 ${isSelected ? 16 : 8}px ${color}99;
              transition:all 0.3s;
              cursor:pointer;
            "></div>
          `,
          iconSize: [isSelected ? 20 : 14, isSelected ? 20 : 14],
          iconAnchor: [isSelected ? 10 : 7, isSelected ? 10 : 7],
        });

        const marker = L.marker([node.lat, node.lng], { icon })
          .addTo(map)
          .on("click", () => onMarkerClick(node.id));

        marker.bindTooltip(node.title, {
          permanent: false,
          direction: "top",
          className: "leaflet-tooltip-dark",
          offset: [0, -8],
        });

        markersRef.current[node.id] = marker;
      });
    });

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
        markersRef.current = {};
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update marker sizes when selectedId changes
  useEffect(() => {
    if (!leafletMapRef.current) return;
    import("leaflet").then((L) => {
      nodes.forEach((node) => {
        const marker = markersRef.current[node.id];
        if (!marker) return;
        const color = STATE_COLORS[node.state] ?? "#888";
        const isSelected = node.id === selectedId;
        const icon = L.divIcon({
          className: "",
          html: `
            <div style="
              width:${isSelected ? 22 : 14}px;
              height:${isSelected ? 22 : 14}px;
              background:${color};
              border-radius:50%;
              border:2px solid ${isSelected ? "#fff" : "rgba(0,0,0,0.5)"};
              box-shadow:0 0 ${isSelected ? 20 : 8}px ${color}99;
              transition:all 0.3s;
              cursor:pointer;
            "></div>
          `,
          iconSize: [isSelected ? 22 : 14, isSelected ? 22 : 14],
          iconAnchor: [isSelected ? 11 : 7, isSelected ? 11 : 7],
        });
        marker.setIcon(icon);

        if (isSelected && leafletMapRef.current) {
          leafletMapRef.current.panTo([node.lat, node.lng], { animate: true, duration: 0.6 });
        }
      });
    });
  }, [selectedId, nodes]);

  return (
    <>
      {/* Leaflet CSS */}
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      />
      <style>{`
        .leaflet-container { background: #050505; }
        .leaflet-tooltip-dark {
          background: rgba(0,0,0,0.9);
          border: 1px solid #333;
          color: #fff;
          font-family: 'Space Mono', monospace;
          font-size: 10px;
          padding: 4px 8px;
          border-radius: 4px;
          white-space: nowrap;
          box-shadow: none;
        }
        .leaflet-tooltip-dark::before { display: none; }
        .leaflet-control-zoom a {
          background: #111 !important;
          color: #888 !important;
          border: 1px solid #333 !important;
        }
        .leaflet-control-zoom a:hover { color: #CCFF00 !important; background: #1a1a1a !important; }
        .leaflet-control-attribution { background: transparent !important; color: #333 !important; }
        /* Push zoom controls above BottomNav on mobile */
        @media (max-width: 767px) {
          .leaflet-bottom.leaflet-right { bottom: 90px !important; }
          .leaflet-bottom.leaflet-left { bottom: 90px !important; }
        }
      `}</style>
      <div ref={mapRef} className="w-full h-full" />
    </>
  );
}
