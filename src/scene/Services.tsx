"use client";

// Services: slim luminous rings hovering over the pods they select. Hover or
// select one to reveal its beams — X-ray vision on demand keeps the resting
// scene calm.

import { useMemo } from "react";
import { Line } from "@react-three/drei";
import { useStore, nsColor } from "@/state/store";
import { ids } from "@/model/types";

export function Services() {
  const snapshot = useStore((s) => s.snapshot)!;
  const layout = useStore((s) => s.layout)!;
  const hovered = useStore((s) => s.hovered);
  const selected = useStore((s) => s.selected);
  const setHovered = useStore((s) => s.setHovered);
  const setSelected = useStore((s) => s.setSelected);

  const selectEdges = useMemo(() => snapshot.edges.filter((e) => e.type === "selects"), [snapshot]);

  return (
    <group>
      {snapshot.services.map((svc) => {
        const id = ids.service(svc.ns, svc.name);
        const place = layout.placements.get(id);
        if (!place) return null;
        const active = hovered === id || selected === id;
        const color = nsColor(svc.ns);
        const beams = active
          ? selectEdges
              .filter((e) => e.from === id)
              .map((e) => layout.placements.get(e.to)?.position)
              .filter((p): p is [number, number, number] => !!p)
          : [];
        return (
          <group key={id}>
            <mesh
              position={place.position}
              rotation={[Math.PI / 2, 0, 0]}
              onPointerOver={(e) => (e.stopPropagation(), setHovered(id))}
              onPointerOut={() => setHovered(null)}
              onClick={(e) => (e.stopPropagation(), setSelected(id))}
            >
              <torusGeometry args={[0.9, 0.07, 12, 48]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={active ? 2.2 : 0.9}
                transparent
                opacity={active ? 1 : 0.75}
              />
            </mesh>
            {beams.map((to, i) => (
              <Line
                key={i}
                points={[place.position, to]}
                color={color}
                lineWidth={1.4}
                transparent
                opacity={0.65}
              />
            ))}
          </group>
        );
      })}
    </group>
  );
}
