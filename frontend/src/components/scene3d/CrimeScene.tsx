"use client";

import { useState, useMemo, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

import Room from "./Room";
import EvidenceMarker from "./EvidenceMarker";
import { Grid } from "@react-three/drei";

/** A marker to place in the 3D scene */
export interface SceneMarker {
  id: string;
  label: string;
  position: [number, number, number];
  type?: "person" | "object" | "evidence";
  confidence?: number;
  timestamp?: number;
  evidenceId?: string;
  color?: string;
  metadata?: Record<string, unknown>;
}

interface CrimeSceneProps {
  /** Dynamic markers from API data */
  markers?: SceneMarker[];
  /** Currently highlighted marker ID (e.g. from timeline click) */
  highlightedId?: string | null;
  /** Camera target position for fly-to animation */
  cameraTarget?: [number, number, number] | null;
  /** Callback when a marker is selected */
  onMarkerSelect?: (marker: SceneMarker | null) => void;
}

// Default demo markers when no API data is provided
const DEFAULT_MARKERS: SceneMarker[] = [
  { id: "knife", label: "Knife", position: [0, 0.25, 0], type: "evidence", confidence: 92 },
  { id: "phone", label: "Phone", position: [3, 0.25, 2], type: "evidence", confidence: 88 },
  { id: "backpack", label: "Backpack", position: [-2, 0.25, -4], type: "evidence", confidence: 96 },
];

export default function CrimeScene({
  markers,
  highlightedId,
  cameraTarget,
  onMarkerSelect,
}: CrimeSceneProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const activeMarkers = markers && markers.length > 0 ? markers : DEFAULT_MARKERS;

  const selectedMarker = useMemo(
    () => activeMarkers.find((m) => m.id === selectedId) ?? null,
    [activeMarkers, selectedId]
  );

  const handleSelect = useCallback(
    (id: string) => {
      const marker = activeMarkers.find((m) => m.id === id) ?? null;
      setSelectedId(id);
      onMarkerSelect?.(marker);
    },
    [activeMarkers, onMarkerSelect]
  );

  const handleDeselect = useCallback(() => {
    setSelectedId(null);
    onMarkerSelect?.(null);
  }, [onMarkerSelect]);

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden bg-black">
      <Canvas
        shadows
        camera={{
          position: [8, 5, 8],
          fov: 50,
        }}
      >
        <ambientLight intensity={1.2} />
        <directionalLight position={[5, 10, 5]} intensity={1.8} castShadow />
        <pointLight position={[0, 4, 0]} intensity={0.8} color="#88ccff" />

        <Room />

        {activeMarkers.map((marker) => (
          <EvidenceMarker
            key={marker.id}
            id={marker.id}
            label={marker.label}
            position={marker.position}
            type={marker.type}
            confidence={marker.confidence}
            isHighlighted={marker.id === highlightedId || marker.id === selectedId}
            color={marker.color}
            onSelect={handleSelect}
          />
        ))}

        <OrbitControls
          minDistance={4}
          maxDistance={25}
          maxPolarAngle={Math.PI / 2.1}
          target={cameraTarget ?? undefined}
        />
        <Grid
          position={[0, 0.01, 0]}
          args={[20, 20]}
          cellSize={1}
          cellThickness={0.5}
          sectionSize={5}
          sectionThickness={1}
          fadeDistance={30}
          fadeStrength={1}
        />
      </Canvas>

      {/* Selected marker detail panel */}
      {selectedMarker && (
        <div className="absolute top-4 right-4 bg-black/90 backdrop-blur-sm border border-slate-700 rounded-lg p-4 w-64 text-sm text-white shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-accent">{selectedMarker.label}</h3>
            <button
              onClick={handleDeselect}
              className="text-slate-400 hover:text-white transition-colors text-xs"
            >
              ✕
            </button>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Type</span>
              <span className="capitalize">{selectedMarker.type ?? "evidence"}</span>
            </div>
            {selectedMarker.confidence != null && (
              <div className="flex justify-between">
                <span className="text-slate-400">Confidence</span>
                <span className="text-accent font-mono">{selectedMarker.confidence}%</span>
              </div>
            )}
            {selectedMarker.timestamp != null && (
              <div className="flex justify-between">
                <span className="text-slate-400">Timestamp</span>
                <span className="font-mono">{selectedMarker.timestamp.toFixed(1)}s</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-400">Position</span>
              <span className="font-mono text-slate-300">
                [{selectedMarker.position.map((v) => v.toFixed(1)).join(", ")}]
              </span>
            </div>
            {selectedMarker.evidenceId && (
              <div className="flex justify-between">
                <span className="text-slate-400">Evidence ID</span>
                <span className="font-mono text-xs truncate ml-2">{selectedMarker.evidenceId}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Marker count indicator */}
      <div className="absolute bottom-3 left-3 flex items-center gap-2 px-2.5 py-1 rounded-lg bg-black/70 border border-slate-700/50 text-xs text-slate-300">
        <span className="w-1.5 h-1.5 rounded-full bg-accent" />
        {activeMarkers.length} marker{activeMarkers.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
