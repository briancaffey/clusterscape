"use client";

// Node islands v2: hexagonal floating platforms with real hardware on deck —
// RAM and disk tanks (fill = utilization), a reactor core tinted by GPU
// temperature, a CPU-load glow ring, and a golden halo crown on the control
// plane. Namespace pads are clickable.

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Billboard, Text } from "@react-three/drei";
import { useStore, nsColor } from "@/state/store";
import { ids, type NodeInfo, type NodeMetrics } from "@/model/types";
import { PALETTES, tempColor } from "./palette";

export function Islands() {
  const snapshot = useStore((s) => s.snapshot)!;
  const layout = useStore((s) => s.layout)!;
  const theme = useStore((s) => s.theme);
  const hovered = useStore((s) => s.hovered);
  const setHovered = useStore((s) => s.setHovered);
  const setSelected = useStore((s) => s.setSelected);
  const pal = PALETTES[theme];

  const byName = useMemo(() => new Map(snapshot.nodes.map((n) => [n.name, n])), [snapshot]);

  return (
    <group>
      {layout.islands.map((island) => {
        const node = byName.get(island.node)!;
        const metrics = snapshot.metrics?.nodes?.[node.name] ?? null;
        const id = ids.node(node.name);
        const hot = hovered === id;
        const controlPlane = node.roles.includes("control-plane");
        return (
          <group key={island.node} position={island.position}>
            {/* deck */}
            <mesh
              position={[0, -1.1, 0]}
              onPointerOver={(e) => (e.stopPropagation(), setHovered(id))}
              onPointerOut={() => setHovered(null)}
              onClick={(e) => (e.stopPropagation(), setSelected(id))}
            >
              <cylinderGeometry args={[island.radius, island.radius * 0.82, 2.2, 6]} />
              <meshPhysicalMaterial
                color={node.ready ? pal.deck : pal.deckNotReady}
                roughness={0.32}
                metalness={0.25}
                clearcoat={0.6}
                clearcoatRoughness={0.4}
              />
            </mesh>
            {/* glowing rim */}
            <mesh position={[0, -0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[island.radius * 0.985, island.radius * 1.02, 6]} />
              <meshBasicMaterial
                color={node.ready ? (hot ? pal.rimHot : controlPlane ? "#d8a94a" : pal.rim) : pal.rimNotReady}
                toneMapped={false}
                transparent
                opacity={hot ? 1 : 0.85}
              />
            </mesh>
            <pointLight
              position={[0, -4, 0]}
              intensity={22}
              distance={26}
              color={node.ready ? pal.underglow : "#7c2f3f"}
            />

            {/* namespace pads (clickable) */}
            {island.pads.map((pad) => {
              const nsId = `namespace:${pad.ns}`;
              const nsHot = hovered === nsId;
              return (
                <mesh
                  key={pad.ns}
                  position={[pad.center[0] - island.position[0], 0.02, pad.center[2] - island.position[2]]}
                  rotation={[-Math.PI / 2, 0, 0]}
                  onPointerOver={(e) => (e.stopPropagation(), setHovered(nsId))}
                  onPointerOut={() => setHovered(null)}
                  onClick={(e) => (e.stopPropagation(), setSelected(nsId))}
                >
                  <circleGeometry args={[pad.radius, 40]} />
                  <meshStandardMaterial
                    color={nsColor(pad.ns)}
                    transparent
                    opacity={nsHot ? Math.min(pal.padOpacity + 0.25, 0.6) : pal.padOpacity}
                    emissive={nsColor(pad.ns)}
                    emissiveIntensity={nsHot ? 0.35 : 0.06}
                  />
                </mesh>
              );
            })}

            {/* reactor core — GPU boxes; tint follows GPU temperature */}
            {node.capacity.gpus > 0 && (
              <Reactor
                temp={metrics?.gpuTempC ?? null}
                util={metrics?.gpuUtilPct ?? null}
                nodeId={id}
              />
            )}

            {/* hardware gauges */}
            {metrics && <Gauges island={island} node={node} metrics={metrics} />}

            {/* control-plane crown */}
            {controlPlane && <Crown radius={island.radius} />}

            {/* CPU load ring at the deck edge */}
            {metrics?.cpuPct != null && (
              <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[island.radius * 0.955, island.radius * 0.975, 48]} />
                <meshBasicMaterial
                  color={tempColor(30 + (metrics.cpuPct / 100) * 50)}
                  toneMapped={false}
                  transparent
                  opacity={0.12 + Math.min(metrics.cpuPct / 100, 1) * 0.88}
                />
              </mesh>
            )}

            {/* label */}
            <Billboard position={[0, node.capacity.gpus > 0 ? 4.6 : 3.4, 0]}>
              <Text fontSize={0.95} color={pal.text} outlineWidth={0.02} outlineColor={pal.bg}>
                {node.box}
              </Text>
              <Text position={[0, -0.85, 0]} fontSize={0.42} color={pal.subtext}>
                {node.arch}
                {node.gpuModel ? ` · ${node.gpuModel.replace("NVIDIA ", "")}` : ""}
                {controlPlane ? " · control-plane" : ""}
              </Text>
            </Billboard>
          </group>
        );
      })}
    </group>
  );
}

function Reactor({ temp, util, nodeId }: { temp: number | null; util: number | null; nodeId: string }) {
  const color = tempColor(temp);
  const setHovered = useStore((s) => s.setHovered);
  const setSelected = useStore((s) => s.setSelected);
  return (
    <group position={[0, 1.4, 0]}>
      <mesh
        onPointerOver={(e) => (e.stopPropagation(), setHovered(nodeId))}
        onPointerOut={() => setHovered(null)}
        onClick={(e) => (e.stopPropagation(), setSelected(nodeId))}
      >
        <cylinderGeometry args={[0.28, 0.28, 2.8, 20]} />
        <meshStandardMaterial
          color="#0b2530"
          emissive={color}
          emissiveIntensity={1.2 + (util ?? 0) / 60}
          roughness={0.2}
        />
      </mesh>
      <pointLight intensity={9} distance={14} color={color} />
    </group>
  );
}

/** RAM + disk utilization tanks — glass pillars with a glowing fill level. */
function Gauges({
  island,
  node,
  metrics,
}: {
  island: { position: [number, number, number]; radius: number };
  node: NodeInfo;
  metrics: NodeMetrics;
}) {
  const tanks: { key: string; label: string; used: number | null; total: number | null; color: string; angle: number }[] = [
    { key: "ram", label: "RAM", used: metrics.memUsedBytes, total: metrics.memTotalBytes, color: "#4da3ff", angle: Math.PI * 0.32 },
    { key: "disk", label: "disk", used: metrics.diskUsedBytes, total: metrics.diskTotalBytes, color: "#58d68d", angle: Math.PI * 0.18 },
  ];
  const setHovered = useStore((s) => s.setHovered);
  const setSelected = useStore((s) => s.setSelected);
  const nodeId = ids.node(node.name);
  return (
    <group>
      {tanks.map((t) => {
        if (t.used == null || t.total == null || t.total === 0) return null;
        const pct = Math.min(t.used / t.total, 1);
        const r = island.radius * 0.72;
        const x = Math.cos(t.angle) * r;
        const z = Math.sin(t.angle) * r;
        const H = 2.4;
        const hue = pct > 0.9 ? "#ff5468" : t.color;
        return (
          <group
            key={t.key}
            position={[x, H / 2, z]}
            onPointerOver={(e) => (e.stopPropagation(), setHovered(nodeId))}
            onPointerOut={() => setHovered(null)}
            onClick={(e) => (e.stopPropagation(), setSelected(nodeId))}
          >
            {/* glass shell */}
            <mesh>
              <cylinderGeometry args={[0.34, 0.34, H, 18]} />
              <meshPhysicalMaterial color={hue} transparent opacity={0.16} roughness={0.1} />
            </mesh>
            {/* fill */}
            <mesh position={[0, (-H / 2) + (H * pct) / 2, 0]}>
              <cylinderGeometry args={[0.27, 0.27, Math.max(H * pct, 0.04), 18]} />
              <meshStandardMaterial color={hue} emissive={hue} emissiveIntensity={0.9} roughness={0.3} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/** Golden rotating halo marking the control-plane node. */
function Crown({ radius }: { radius: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.y = clock.elapsedTime * 0.35;
    ref.current.position.y = 5.6 + Math.sin(clock.elapsedTime * 0.9) * 0.12;
  });
  return (
    <group ref={ref} position={[0, 5.6, 0]}>
      <mesh rotation={[Math.PI / 2.6, 0, 0]}>
        <torusGeometry args={[Math.min(radius * 0.35, 2.4), 0.06, 10, 60]} />
        <meshStandardMaterial color="#d8a94a" emissive="#ffcf6e" emissiveIntensity={1.6} metalness={0.8} roughness={0.25} />
      </mesh>
      <mesh rotation={[Math.PI / 2.1, 0, Math.PI / 3]}>
        <torusGeometry args={[Math.min(radius * 0.24, 1.7), 0.045, 10, 50]} />
        <meshStandardMaterial color="#d8a94a" emissive="#ffcf6e" emissiveIntensity={1.2} metalness={0.8} roughness={0.25} />
      </mesh>
    </group>
  );
}
