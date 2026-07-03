"use client";

// Node islands: hexagonal floating platforms. GPU machines get a glowing
// "reactor" core; namespace pads are tinted discs inset into the deck.

import { useMemo } from "react";
import { Billboard, Text } from "@react-three/drei";
import { useStore, nsColor } from "@/state/store";
import { ids } from "@/model/types";

export function Islands() {
  const snapshot = useStore((s) => s.snapshot)!;
  const layout = useStore((s) => s.layout)!;
  const hovered = useStore((s) => s.hovered);
  const setHovered = useStore((s) => s.setHovered);
  const setSelected = useStore((s) => s.setSelected);

  const byName = useMemo(() => new Map(snapshot.nodes.map((n) => [n.name, n])), [snapshot]);

  return (
    <group>
      {layout.islands.map((island) => {
        const node = byName.get(island.node)!;
        const id = ids.node(node.name);
        const hot = hovered === id;
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
                color={node.ready ? "#0e1626" : "#2a1420"}
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
                color={node.ready ? (hot ? "#9fd8ff" : "#3d6fa8") : "#a8434f"}
                toneMapped={false}
                transparent
                opacity={hot ? 1 : 0.85}
              />
            </mesh>
            {/* underglow */}
            <pointLight position={[0, -4, 0]} intensity={22} distance={26} color={node.ready ? "#2f5f9e" : "#7c2f3f"} />

            {/* namespace pads */}
            {island.pads.map((pad) => (
              <mesh
                key={pad.ns}
                position={[pad.center[0] - island.position[0], 0.02, pad.center[2] - island.position[2]]}
                rotation={[-Math.PI / 2, 0, 0]}
              >
                <circleGeometry args={[pad.radius, 40]} />
                <meshStandardMaterial
                  color={nsColor(pad.ns)}
                  transparent
                  opacity={0.13}
                  emissive={nsColor(pad.ns)}
                  emissiveIntensity={0.06}
                />
              </mesh>
            ))}

            {/* GPU reactor core */}
            {node.capacity.gpus > 0 && (
              <group position={[0, 1.4, 0]}>
                <mesh>
                  <cylinderGeometry args={[0.28, 0.28, 2.8, 20]} />
                  <meshStandardMaterial
                    color="#0b2530"
                    emissive="#39e6ff"
                    emissiveIntensity={1.6}
                    roughness={0.2}
                  />
                </mesh>
                <pointLight intensity={9} distance={14} color="#39e6ff" />
              </group>
            )}

            {/* label */}
            <Billboard position={[0, node.capacity.gpus > 0 ? 4.2 : 3.1, 0]}>
              <Text fontSize={0.95} color="#dbe7ff" outlineWidth={0.02} outlineColor="#0a0f1c">
                {node.box}
              </Text>
              <Text position={[0, -0.85, 0]} fontSize={0.42} color="#7e93b8">
                {node.arch}
                {node.gpuModel ? ` · ${node.gpuModel.replace("NVIDIA ", "")}` : ""}
                {node.roles.includes("control-plane") ? " · control-plane" : ""}
              </Text>
            </Billboard>
          </group>
        );
      })}
    </group>
  );
}
