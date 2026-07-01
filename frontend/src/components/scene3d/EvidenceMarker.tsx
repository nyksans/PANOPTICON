"use client";

import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import * as THREE from "three";

interface Props {
  id: string;
  label: string;
  position: [number, number, number];
  type?: "person" | "object" | "evidence";
  confidence?: number;
  isHighlighted?: boolean;
  color?: string;
  onSelect?: (id: string) => void;
}

const TYPE_COLORS: Record<string, string> = {
  person: "#FF6B35",
  object: "#22C55E",
  evidence: "#FFD60A",
};

export default function EvidenceMarker({
  id,
  label,
  position,
  type = "evidence",
  confidence,
  isHighlighted = false,
  color,
  onSelect,
}: Props) {
  const meshRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const baseColor = color ?? TYPE_COLORS[type] ?? TYPE_COLORS.evidence;
  const emissiveColor = isHighlighted ? "#ffffff" : baseColor;
  const emissiveIntensity = isHighlighted ? 1.2 : hovered ? 0.8 : 0.5;

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const amplitude = isHighlighted ? 0.15 : 0.08;
    const speed = isHighlighted ? 3 : 2;
    const scale = 1 + Math.sin(clock.elapsedTime * speed) * amplitude;
    meshRef.current.scale.set(scale, scale, scale);

    if (ringRef.current && isHighlighted) {
      ringRef.current.rotation.y += 0.02;
    }
  });

  return (
    <group position={position}>
      {/* Main marker disc */}
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.(id);
        }}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        castShadow
      >
        <cylinderGeometry args={[0.35, 0.35, 0.08, type === "person" ? 8 : 6]} />
        <meshStandardMaterial
          color={baseColor}
          emissive={emissiveColor}
          emissiveIntensity={emissiveIntensity}
          metalness={0.3}
          roughness={0.4}
        />
      </mesh>

      {/* Highlight ring (only when selected/highlighted) */}
      {isHighlighted && (
        <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[0.5, 0.65, 32]} />
          <meshBasicMaterial color={baseColor} transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Vertical beam for highlighted markers */}
      {isHighlighted && (
        <mesh position={[0, 1.5, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 3, 8]} />
          <meshBasicMaterial color={baseColor} transparent opacity={0.3} />
        </mesh>
      )}

      {/* HTML label */}
      <Html distanceFactor={8} center position={[0, 0.6, 0]}>
        <div
          className={`px-2 py-1 rounded text-xs border whitespace-nowrap transition-all duration-200 ${
            isHighlighted
              ? "bg-black/90 text-white border-white/60 shadow-lg scale-110"
              : hovered
                ? "bg-black/80 text-white border-white/30"
                : "bg-black/70 text-white/90 border-white/15"
          }`}
        >
          <span className="font-medium">{label}</span>
          {confidence != null && (
            <span className="ml-1.5 text-[10px] opacity-70 font-mono">{confidence}%</span>
          )}
        </div>
      </Html>

      {/* Point light for glow effect */}
      <pointLight
        color={baseColor}
        intensity={isHighlighted ? 4 : hovered ? 3 : 2}
        distance={isHighlighted ? 5 : 3}
      />
    </group>
  );
}
