"use client";

// Ingresses: a gateway rail at the front of the scene — one portal per
// ingress. Hover/select to fire the beam to its backend service ring.

import { useMemo } from "react";
import { Billboard, Line, Text } from "@react-three/drei";
import { useStore } from "@/state/store";
import { ids } from "@/model/types";

export function Ingresses() {
  const snapshot = useStore((s) => s.snapshot)!;
  const layout = useStore((s) => s.layout)!;
  const hovered = useStore((s) => s.hovered);
  const selected = useStore((s) => s.selected);
  const setHovered = useStore((s) => s.setHovered);
  const setSelected = useStore((s) => s.setSelected);

  const routeEdges = useMemo(() => snapshot.edges.filter((e) => e.type === "routes-to"), [snapshot]);

  return (
    <group>
      {snapshot.ingresses.map((ing) => {
        const id = ids.ingress(ing.ns, ing.name);
        const place = layout.placements.get(id);
        if (!place) return null;
        const active = hovered === id || selected === id;
        const tailscale = ing.className === "tailscale";
        const color = tailscale ? "#b48cff" : "#69d2a8";
        const beams = active
          ? routeEdges
              .filter((e) => e.from === id)
              .map((e) => layout.placements.get(e.to)?.position)
              .filter((p): p is [number, number, number] => !!p)
          : [];
        return (
          <group key={id} position={place.position}>
            <mesh
              onPointerOver={(e) => (e.stopPropagation(), setHovered(id))}
              onPointerOut={() => setHovered(null)}
              onClick={(e) => (e.stopPropagation(), setSelected(id))}
            >
              <torusGeometry args={[0.85, 0.08, 10, 40]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={active ? 2.4 : 0.8}
                transparent
                opacity={active ? 1 : 0.7}
              />
            </mesh>
            {active && (
              <Billboard position={[0, 1.5, 0]}>
                <Text fontSize={0.55} color="#e8f2ff" outlineWidth={0.02} outlineColor="#0a0f1c">
                  {ing.hosts[0] ?? ing.name}
                </Text>
              </Billboard>
            )}
            {beams.map((to, i) => (
              <Line
                key={i}
                points={[[0, 0, 0], [to[0] - place.position[0], to[1] - place.position[1], to[2] - place.position[2]]]}
                color={color}
                lineWidth={1.6}
                transparent
                opacity={0.7}
              />
            ))}
          </group>
        );
      })}
    </group>
  );
}
