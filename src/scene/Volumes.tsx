"use client";

// PVCs: crystal slabs docked at the rim of the island their data lives on
// (local-path storage pins every volume to one machine — the slabs make that
// visible at a glance). Height scales with capacity (log).

import { useStore, nsColor } from "@/state/store";
import { ids } from "@/model/types";

export function Volumes() {
  const snapshot = useStore((s) => s.snapshot)!;
  const layout = useStore((s) => s.layout)!;
  const hovered = useStore((s) => s.hovered);
  const setHovered = useStore((s) => s.setHovered);
  const setSelected = useStore((s) => s.setSelected);

  return (
    <group>
      {snapshot.pvcs.map((pvc) => {
        const id = ids.pvc(pvc.ns, pvc.name);
        const place = layout.placements.get(id);
        if (!place) return null;
        const hot = hovered === id;
        const color = nsColor(pvc.ns);
        const h = 1.1 * place.scale;
        return (
          <mesh
            key={id}
            position={[place.position[0], place.position[1] + h / 2, place.position[2]]}
            rotation={[0, Math.PI / 5, 0]}
            onPointerOver={(e) => (e.stopPropagation(), setHovered(id))}
            onPointerOut={() => setHovered(null)}
            onClick={(e) => (e.stopPropagation(), setSelected(id))}
          >
            <boxGeometry args={[0.9, h, 0.5]} />
            <meshPhysicalMaterial
              color={color}
              transparent
              opacity={0.55}
              roughness={0.15}
              metalness={0.05}
              emissive={color}
              emissiveIntensity={hot ? 1.4 : 0.35}
            />
          </mesh>
        );
      })}
    </group>
  );
}
