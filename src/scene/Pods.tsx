"use client";

// Pods: small luminous crystals standing on their namespace pad. Color =
// namespace; red pulse = not running; cyan spike = holds a GPU.

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RoundedBox } from "@react-three/drei";
import { useStore, nsColor } from "@/state/store";
import { ids } from "@/model/types";

export function Pods() {
  const snapshot = useStore((s) => s.snapshot)!;
  const layout = useStore((s) => s.layout)!;
  return (
    <group>
      {snapshot.pods.map((p) => {
        const place = layout.placements.get(ids.pod(p.ns, p.name));
        if (!place) return null;
        return <Pod key={`${p.ns}/${p.name}`} pod={p} position={place.position} />;
      })}
    </group>
  );
}

function Pod({
  pod,
  position,
}: {
  pod: { ns: string; name: string; phase: string; ready: boolean; gpu: boolean; ownerKind: string | null };
  position: [number, number, number];
}) {
  const id = ids.pod(pod.ns, pod.name);
  const hovered = useStore((s) => s.hovered === id);
  const selected = useStore((s) => s.selected === id);
  const setHovered = useStore((s) => s.setHovered);
  const setSelected = useStore((s) => s.setSelected);
  const mat = useRef<THREE.MeshPhysicalMaterial>(null);

  const healthy = pod.phase === "Running" && pod.ready;
  const color = healthy ? nsColor(pod.ns) : pod.phase === "Succeeded" ? "#5a6a85" : "#ff5468";

  useFrame(({ clock }) => {
    if (!mat.current) return;
    const base = hovered || selected ? 1.9 : healthy ? 0.6 : 0.9;
    const pulse = healthy ? 0 : Math.sin(clock.elapsedTime * 4) * 0.45 + 0.45;
    mat.current.emissiveIntensity = base + pulse;
  });

  // silhouette = workload kind: box (Deployment/ReplicaSet), pillar
  // (StatefulSet), spike (DaemonSet), gem (bare pods / jobs)
  const kind = pod.ownerKind === "ReplicaSet" ? "Deployment" : pod.ownerKind;
  const material = (
    <meshPhysicalMaterial
      ref={mat}
      color={color}
      emissive={color}
      emissiveIntensity={0.6}
      roughness={kind === "StatefulSet" ? 0.45 : 0.25}
      metalness={kind === "DaemonSet" ? 0.5 : 0.1}
      transparent
      opacity={0.92}
    />
  );
  const events = {
    onPointerOver: (e: { stopPropagation: () => void }) => (e.stopPropagation(), setHovered(id)),
    onPointerOut: () => setHovered(null),
    onClick: (e: { stopPropagation: () => void }) => (e.stopPropagation(), setSelected(id)),
  };

  return (
    <group position={position}>
      {kind === "StatefulSet" ? (
        <mesh {...events}>
          <cylinderGeometry args={[0.3, 0.34, 0.85, 18]} />
          {material}
        </mesh>
      ) : kind === "DaemonSet" ? (
        <mesh {...events}>
          <octahedronGeometry args={[0.42]} />
          {material}
        </mesh>
      ) : kind === "Deployment" ? (
        <RoundedBox args={[0.62, 0.72, 0.62]} radius={0.09} {...events}>
          {material}
        </RoundedBox>
      ) : (
        <mesh {...events}>
          <icosahedronGeometry args={[0.38]} />
          {material}
        </mesh>
      )}
      {pod.gpu && (
        <mesh position={[0, 0.62, 0]}>
          <coneGeometry args={[0.12, 0.34, 4]} />
          <meshBasicMaterial color="#39e6ff" toneMapped={false} />
        </mesh>
      )}
      {(hovered || selected) && (
        <mesh position={[0, -0.34, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.5, 0.62, 28]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} transparent opacity={0.9} />
        </mesh>
      )}
    </group>
  );
}
