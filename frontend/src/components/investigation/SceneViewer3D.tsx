'use client';

import React, { useRef, Suspense, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { Box as BoxIcon, Layers, Eye, Target } from 'lucide-react';

// ── Evidence markers data ─────────────────────────────────────────────────────
interface EvidenceMarker3D {
  id: string;
  label: string;
  type: 'weapon' | 'object' | 'person' | 'location';
  position: [number, number, number];
  confidence: number;
}

const EVIDENCE_MARKERS: EvidenceMarker3D[] = [
  { id: 'ev-001', label: 'Firearm', type: 'weapon',   position: [5, 0, 0],    confidence: 89 },
  { id: 'ev-002', label: 'Backpack', type: 'object',  position: [3, 0, 0.5],  confidence: 92 },
  { id: 'ev-003', label: 'Phone',   type: 'object',   position: [1, 0, 0.8],  confidence: 74 },
  { id: 'ev-004', label: 'Victim',  type: 'location', position: [4.5, 0, -1], confidence: 97 },
];

// ── Types ─────────────────────────────────────────────────────────────────────
interface Camera3DData {
  id: string;
  label: string;
  position: [number, number, number];
  rotationY: number;
  active: boolean;
}

const CAMERAS: Camera3DData[] = [
  { id: 'CAM-STN-004', label: 'Platform 4',    position: [5, 3.5, 2],   rotationY: -0.8, active: true  },
  { id: 'CAM-STN-002', label: 'Concourse',     position: [-5, 3.5, -3], rotationY: 0.6,  active: false },
  { id: 'CAM-STN-001', label: 'South Entrance',position: [-9, 3.5, 6],  rotationY: 0.4,  active: false },
  { id: 'CAM-STN-005', label: 'North Exit',    position: [9, 3.5, -5],  rotationY: -0.5, active: false },
];

const ALPHA_PATH: [number,number,number][] = [
  [-9,0,6],[-5,0,3],[-1,0,1],[2,0,0.5],[5,0,0],[9,0,-5],
];
const BETA_PATH: [number,number,number][] = [
  [-9,0,6.5],[-4.5,0,3.5],[-0.5,0,1.5],[2.5,0,1],[5.5,0,0.6],[9.5,0,-4.5],
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function lerpPath(waypoints: [number,number,number][], t: number): THREE.Vector3 {
  if (waypoints.length === 0) return new THREE.Vector3();
  const segments = waypoints.length - 1;
  const scaled = Math.max(0, Math.min(1, t)) * segments;
  const idx = Math.min(Math.floor(scaled), segments - 1);
  const frac = scaled - idx;
  const a = new THREE.Vector3(...waypoints[idx]);
  const b = new THREE.Vector3(...waypoints[Math.min(idx + 1, waypoints.length - 1)]);
  return a.lerp(b, frac);
}

// ── Camera model ──────────────────────────────────────────────────────────────
function CameraModel({ cam }: { cam: Camera3DData }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(() => {
    if (groupRef.current && cam.active) {
      groupRef.current.rotation.y = Math.sin(Date.now() * 0.0008) * 0.3 + cam.rotationY;
    }
  });
  return (
    <group ref={groupRef} position={cam.position} rotation={[0, cam.rotationY, 0]}>
      {/* Body */}
      <mesh castShadow>
        <boxGeometry args={[0.5, 0.3, 0.7]} />
        <meshStandardMaterial color={cam.active ? '#1a2a40' : '#111820'} metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Lens */}
      <mesh position={[0, 0, 0.4]}>
        <cylinderGeometry args={[0.09, 0.12, 0.22, 16]} />
        <meshStandardMaterial color="#0a0a0a" metalness={0.95} roughness={0.05} />
      </mesh>
      {/* Mount */}
      <mesh position={[0, -1.75, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 3.5, 8]} />
        <meshStandardMaterial color="#111820" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Status LED */}
      <mesh position={[0.26, 0.17, 0]}>
        <sphereGeometry args={[0.045]} />
        <meshStandardMaterial
          color={cam.active ? '#f59e0b' : '#22c55e'}
          emissive={cam.active ? '#f59e0b' : '#22c55e'}
          emissiveIntensity={cam.active ? 3 : 1.5}
        />
      </mesh>
      {/* FOV cone when active */}
      {cam.active && (
        <mesh position={[0, -0.4, 2.5]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[2, 5, 16, 1, true]} />
          <meshStandardMaterial color="#f59e0b" transparent opacity={0.04} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}
      {/* HTML label */}
      <Html position={[0, 1.2, 0]} center distanceFactor={14}>
        <div style={{
          fontSize: '10px', fontFamily: 'monospace', whiteSpace: 'nowrap',
          background: 'rgba(0,0,0,0.75)', color: cam.active ? '#f59e0b' : '#00b4d8',
          padding: '2px 6px', borderRadius: '4px',
          border: `1px solid ${cam.active ? '#f59e0b44' : '#00b4d844'}`,
          pointerEvents: 'none',
        }}>
          {cam.id}
        </div>
      </Html>
    </group>
  );
}

// ── Suspect figure ────────────────────────────────────────────────────────────
function SuspectFigure({ position, color, label }: { position: THREE.Vector3; color: string; label: string }) {
  const planeRef = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (planeRef.current) {
      planeRef.current.position.y = 0.8 + Math.sin(Date.now() * 0.003) * 0.1;
    }
  });
  return (
    <group position={[position.x, 0, position.z]}>
      {/* Flat rectangular marker plane */}
      <mesh ref={planeRef} position={[0, 0.8, 0]} castShadow>
        <planeGeometry args={[0.5, 0.8]} />
        <meshStandardMaterial 
          color={color} 
          metalness={0.3} 
          roughness={0.6} 
          emissive={color} 
          emissiveIntensity={0.2}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Ground pulse ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[0.3, 0.42, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} />
      </mesh>
      {/* Label */}
      <Html position={[0, 2.0, 0]} center distanceFactor={12}>
        <div style={{
          fontSize: '11px', fontFamily: 'monospace', fontWeight: 'bold',
          whiteSpace: 'nowrap', pointerEvents: 'none',
          padding: '2px 8px', borderRadius: '4px',
          background: color + '33', color, border: `1px solid ${color}66`,
        }}>
          {label}
        </div>
      </Html>
    </group>
  );
}

// ── Path trail ────────────────────────────────────────────────────────────────
function PathTrail({ waypoints, color, progress }: {
  waypoints: [number,number,number][];
  color: string;
  progress: number;
}) {
  const position = lerpPath(waypoints, progress);
  const segments = waypoints.length - 1;
  const scaled = Math.max(0, Math.min(1, progress)) * segments;
  const idx = Math.min(Math.floor(scaled), segments - 1);

  const travelledPoints = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= idx; i++) pts.push(new THREE.Vector3(...waypoints[i]));
    pts.push(position);
    return pts;
  }, [idx, position, waypoints]);

  const allPoints = useMemo(() =>
    waypoints.map(p => new THREE.Vector3(...p)),
    [waypoints]
  );

  return (
    <>
      {/* Ghost path */}
      <Line points={allPoints} color={color} lineWidth={1} opacity={0.2} transparent />
      {/* Travelled */}
      {travelledPoints.length >= 2 && (
        <Line points={travelledPoints} color={color} lineWidth={3} opacity={0.9} transparent />
      )}
      {/* Moving figure */}
      <SuspectFigure position={position} color={color} label={color === '#f59e0b' ? 'Suspect α' : 'Suspect β'} />
    </>
  );
}

// ── Evidence Marker ───────────────────────────────────────────────────────────
function EvidenceMarker3D({ marker }: { marker: EvidenceMarker3D }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const typeColor: Record<string, string> = {
    weapon: '#ef4444', object: '#00b4d8', person: '#f59e0b', location: '#22c55e',
  };
  const col = typeColor[marker.type];

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.02;
      meshRef.current.position.y = 0.5 + Math.sin(Date.now() * 0.002 + marker.position[0]) * 0.12;
    }
  });

  return (
    <group position={marker.position}>
      {/* Diamond shape (octahedron) */}
      <mesh ref={meshRef} position={[0, 0.5, 0]} castShadow>
        <octahedronGeometry args={[0.28, 0]} />
        <meshStandardMaterial color={col} metalness={0.6} roughness={0.3}
          emissive={col} emissiveIntensity={0.4} />
      </mesh>
      {/* Vertical beam */}
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.5, 6]} />
        <meshBasicMaterial color={col} transparent opacity={0.5} />
      </mesh>
      {/* Ground ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[0.22, 0.32, 32]} />
        <meshBasicMaterial color={col} transparent opacity={0.7} />
      </mesh>
      {/* Label */}
      <Html position={[0, 1.3, 0]} center distanceFactor={14}>
        <div style={{
          fontSize: '10px', fontFamily: 'monospace', fontWeight: 'bold', whiteSpace: 'nowrap',
          background: `${col}22`, color: col, padding: '2px 6px', borderRadius: '4px',
          border: `1px solid ${col}55`, pointerEvents: 'none',
        }}>
          ▲ {marker.label} {marker.confidence}%
        </div>
      </Html>
    </group>
  );
}

// ── Trajectory Smoke ──────────────────────────────────────────────────────────
function TrajectorySmoke({ waypoints, color }: {
  waypoints: [number, number, number][];
  color: string;
}) {
  const points = useMemo(() => waypoints.map(p => new THREE.Vector3(...p)), [waypoints]);
  return (
    <>
      {/* Dashed ghost trajectory at low level */}
      <Line points={points} color={color} lineWidth={0.5} opacity={0.15} transparent />
      {/* Arrow heads at each waypoint */}
      {waypoints.slice(1).map((wp, i) => (
        <mesh key={i} position={[wp[0], 0.08, wp[2]]}>
          <coneGeometry args={[0.12, 0.25, 8]} />
          <meshBasicMaterial color={color} transparent opacity={0.5} />
        </mesh>
      ))}
    </>
  );
}

// ── Station floor ─────────────────────────────────────────────────────────────
function StationFloor() {
  return (
    <group>
      {/* Main floor */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[32, 26]} />
        <meshStandardMaterial color="#0a0f1e" metalness={0.05} roughness={0.95} />
      </mesh>
      {/* Platform raised area */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[4, 0.01, 0]}>
        <planeGeometry args={[10, 7]} />
        <meshStandardMaterial color="#111825" />
      </mesh>
      {/* Platform edge line */}
      <mesh position={[-1, 0.02, 0]}>
        <boxGeometry args={[0.1, 0.04, 7]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.8} />
      </mesh>
      {/* Pillars */}
      {[-2.5, 0, 2.5, 5, 7.5].map((x, i) => (
        <mesh key={i} position={[x, 1.5, -2.5]} castShadow>
          <cylinderGeometry args={[0.18, 0.18, 3.2, 10]} />
          <meshStandardMaterial color="#141d2f" metalness={0.5} roughness={0.6} />
        </mesh>
      ))}
      {/* Walls */}
      <mesh position={[0, 2, -13]} rotation={[0, 0, 0]}>
        <boxGeometry args={[32, 4, 0.15]} />
        <meshStandardMaterial color="#080d1a" />
      </mesh>
      <mesh position={[0, 2, 13]} rotation={[0, Math.PI, 0]}>
        <boxGeometry args={[32, 4, 0.15]} />
        <meshStandardMaterial color="#080d1a" />
      </mesh>
      {/* Grid overlay */}
      <Grid
        position={[0, 0, 0]}
        args={[32, 26]}
        cellSize={2}
        cellThickness={0.4}
        cellColor="#00b4d815"
        sectionSize={8}
        sectionThickness={0.8}
        sectionColor="#00b4d830"
        fadeDistance={35}
        fadeStrength={1}
        infiniteGrid={false}
      />
      {/* Zone label planes */}
      {[
        { text: 'PLATFORM 4',    pos: [4, 0.05, 0]  as [number,number,number] },
        { text: 'CONCOURSE',     pos: [-5, 0.05, 0] as [number,number,number] },
        { text: 'SOUTH ENTRANCE',pos: [-9, 0.05, 5] as [number,number,number] },
      ].map(({ text, pos }) => (
        <Html key={text} position={pos} rotation={[-Math.PI / 2, 0, 0]} center distanceFactor={20}>
          <div style={{
            fontSize: '9px', fontFamily: 'monospace', letterSpacing: '0.2em',
            color: 'rgba(0,180,216,0.35)', pointerEvents: 'none',
          }}>
            {text}
          </div>
        </Html>
      ))}
    </group>
  );
}

// ── Heatmap ───────────────────────────────────────────────────────────────────
function HeatmapPlane() {
  const texture = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, size, size);
    const addHot = (cx: number, cy: number, r: number, opacity: number, colorStop: string) => {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, `rgba(${colorStop},${opacity})`);
      g.addColorStop(0.5, `rgba(${colorStop},${opacity * 0.4})`);
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
    };
    addHot(175, 128, 55, 0.7, '239,68,68');
    addHot(90, 110, 38, 0.35, '245,158,11');
    addHot(30, 145, 28, 0.2, '245,158,11');
    return new THREE.CanvasTexture(canvas);
  }, []);

  if (!texture) return null;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
      <planeGeometry args={[32, 26]} />
      <meshBasicMaterial map={texture} transparent opacity={0.45} depthWrite={false} />
    </mesh>
  );
}

// ── Scene ─────────────────────────────────────────────────────────────────────
function Scene({ 
  progress, 
  showEvidenceMarkers, 
  showTrajectories, 
  showHeatmap,
  evidenceMarkers,
  trajectories 
}: {
  progress: number;
  showEvidenceMarkers: boolean;
  showTrajectories: boolean;
  showHeatmap: boolean;
  evidenceMarkers: EvidenceMarker3D[];
  trajectories: any[];
}) {
  return (
    <>
      <ambientLight intensity={1.8} color="#c8d8f0" />
      <directionalLight position={[10, 20, 10]} intensity={2.5} color="#ffffff" castShadow
        shadow-mapSize={[2048, 2048]} />
      <directionalLight position={[-10, 15, -10]} intensity={1.2} color="#daeaf8" />
      <pointLight position={[5, 5, 0]} intensity={3.0} color="#fbbf24" distance={18} />
      <pointLight position={[-5, 4, 0]} intensity={2.0} color="#38e1ff" distance={20} />
      <pointLight position={[9, 3, -4]} intensity={1.5} color="#4ade80" distance={14} />
      <StationFloor />
      {showHeatmap && <HeatmapPlane />}
      {CAMERAS.map(cam => <CameraModel key={cam.id} cam={cam} />)}
      {showTrajectories && trajectories.map((traj, idx) => (
        <TrajectorySmoke key={`smoke-${idx}`} waypoints={traj.waypoints} color={traj.color} />
      ))}
      {trajectories.map((traj, idx) => (
        <PathTrail key={`trail-${idx}`} waypoints={traj.waypoints} color={traj.color} progress={progress} />
      ))}
      {showEvidenceMarkers && evidenceMarkers.map(m => (
        <EvidenceMarker3D key={m.id} marker={m} />
      ))}
      <OrbitControls
        enableDamping dampingFactor={0.06}
        minPolarAngle={0.1} maxPolarAngle={Math.PI / 2.1}
        minDistance={5} maxDistance={40}
        makeDefault
      />
    </>
  );
}

// ── Legend overlay ────────────────────────────────────────────────────────────
function SceneLegend() {
  return (
    <div className="absolute top-3 left-3 z-10 space-y-1.5 pointer-events-none">
      {[
        { color: '#f59e0b', label: 'Suspect α — Primary' },
        { color: '#fb923c', label: 'Suspect β — Lookout' },
        { color: '#00b4d8', label: 'Camera node' },
        { color: '#ef4444', label: 'High dwell zone' },
        { color: '#22c55e', label: 'Evidence marker' },
      ].map(item => (
        <div key={item.label} className="flex items-center gap-2 text-2xs font-mono bg-black/65 text-white/70 px-2 py-1 rounded-md backdrop-blur-sm">
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: item.color, boxShadow: `0 0 6px ${item.color}` }} />
          {item.label}
        </div>
      ))}
    </div>
  );
}

// ── Public export ─────────────────────────────────────────────────────────────
interface SceneViewerProps { 
  currentTime: number; 
  className?: string; 
  evidenceMarkers?: EvidenceMarker3D[];
  trajectories?: any[];
}

export function SceneViewer3D({ 
  currentTime, 
  className = '',
  evidenceMarkers = [],
  trajectories = []
}: SceneViewerProps) {
  const [ready, setReady] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showEvidenceMarkers, setShowEvidenceMarkers] = useState(true);
  const [showTrajectories, setShowTrajectories] = useState(true);

  useEffect(() => { setReady(true); }, []);

  if (!ready) {
    return (
      <div className={`relative w-full h-full rounded-xl bg-[#050911] border border-border flex items-center justify-center ${className}`}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-muted-foreground font-mono">Initialising 3D engine...</p>
        </div>
      </div>
    );
  }

  const toggleBtn = (active: boolean, onClick: () => void, label: string) => (
    <button onClick={onClick}
      className="flex items-center gap-1 px-2 py-1 rounded-md text-2xs font-mono transition-all"
      style={{
        background: active ? 'rgba(0,180,216,0.15)' : 'rgba(0,0,0,0.5)',
        border: active ? '1px solid rgba(0,180,216,0.4)' : '1px solid rgba(255,255,255,0.1)',
        color: active ? '#00b4d8' : 'rgba(255,255,255,0.4)',
        backdropFilter: 'blur(8px)',
      }}>
      {label}
    </button>
  );

  return (
    <div className={`relative w-full h-full rounded-xl overflow-hidden bg-[#050911] border border-border ${className}`}>
      <SceneLegend />

      {/* Layer toggles */}
      <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-1.5 text-2xs font-mono bg-black/65 text-accent px-2.5 py-1 rounded-md border border-accent/25 backdrop-blur-sm">
          <BoxIcon className="w-3 h-3" /> 3D RECONSTRUCTION
        </div>
        <div className="flex items-center gap-1">
          {toggleBtn(showHeatmap, () => setShowHeatmap(v => !v), '🌡 Heat')}
          {toggleBtn(showTrajectories, () => setShowTrajectories(v => !v), '→ Path')}
          {toggleBtn(showEvidenceMarkers, () => setShowEvidenceMarkers(v => !v), '◆ Evidence')}
        </div>
      </div>

      {/* Evidence count badge */}
      {showEvidenceMarkers && (
        <div className="absolute bottom-8 left-3 z-10 flex items-center gap-1.5 text-2xs font-mono bg-black/65 px-2 py-1 rounded-md backdrop-blur-sm"
          style={{ color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)' }}>
          <Target className="w-3 h-3" /> {evidenceMarkers.length} evidence markers
        </div>
      )}

      {/* Controls hint */}
      <div className="absolute bottom-3 right-3 z-10 text-2xs text-white/30 font-mono pointer-events-none">
        Drag · Scroll · Right-click
      </div>

      <Canvas
        shadows
        camera={{ position: [0, 16, 22], fov: 42, near: 0.1, far: 200 }}
        gl={{ antialias: true, alpha: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.4 }}
        dpr={typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 1.5) : 1}
        onCreated={({ gl }) => { gl.setClearColor('#0d1525'); }}
      >
        <Suspense fallback={null}>
          <Scene
            progress={currentTime}
            showEvidenceMarkers={showEvidenceMarkers}
            showTrajectories={showTrajectories}
            showHeatmap={showHeatmap}
            evidenceMarkers={evidenceMarkers}
            trajectories={trajectories}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
