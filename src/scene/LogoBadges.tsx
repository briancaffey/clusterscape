"use client";

// Service identity, floating above each namespace pad: a slowly-turning
// "holo-coin" bearing the service's logo. When scripts/trellis-pipeline.mjs
// has produced a real 3D lift (manifest entry `model: true`), the GLB
// replaces the coin — same slot, richer object.

import { Suspense, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useTexture, useGLTF } from "@react-three/drei";
import { useStore, nsColor } from "@/state/store";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function LogoBadges() {
  const layout = useStore((s) => s.layout)!;
  const logos = useStore((s) => s.logos);
  if (!logos) return null;

  const seen = new Set<string>();
  return (
    <group>
      {layout.islands.flatMap((island) =>
        island.pads.map((pad) => {
          const entry = logos.namespaces[pad.ns];
          if (!entry) return null;
          // one badge per pad (a namespace spanning nodes gets one per island)
          const key = `${island.node}/${pad.ns}`;
          if (seen.has(key)) return null;
          seen.add(key);
          return (
            <Suspense key={key} fallback={null}>
              <Badge
                ns={pad.ns}
                slug={entry.slug}
                model={!!entry.model}
                position={[pad.center[0], pad.center[1] + 2.1, pad.center[2]]}
              />
            </Suspense>
          );
        }),
      )}
    </group>
  );
}

function Badge({
  ns,
  slug,
  model,
  position,
}: {
  ns: string;
  slug: string;
  model: boolean;
  position: [number, number, number];
}) {
  const id = `namespace:${ns}`;
  const hovered = useStore((s) => s.hovered === id);
  const setHovered = useStore((s) => s.setHovered);
  const setSelected = useStore((s) => s.setSelected);
  const ref = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.y = clock.elapsedTime * 0.55;
    ref.current.position.y = position[1] + Math.sin(clock.elapsedTime * 1.1 + position[0]) * 0.09;
  });

  return (
    <group
      ref={ref}
      position={position}
      onPointerOver={(e) => (e.stopPropagation(), setHovered(id))}
      onPointerOut={() => setHovered(null)}
      onClick={(e) => (e.stopPropagation(), setSelected(id))}
    >
      {model ? <ModelBadge slug={slug} /> : <CoinBadge slug={slug} ns={ns} hovered={hovered} />}
    </group>
  );
}

function CoinBadge({ slug, ns, hovered }: { slug: string; ns: string; hovered: boolean }) {
  const tex = useTexture(`${BASE}/logos/${slug}.png`);
  tex.colorSpace = THREE.SRGBColorSpace;
  const rim = nsColor(ns);
  return (
    <group>
      {/* rim */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.8, 0.06, 10, 40]} />
        <meshStandardMaterial color={rim} emissive={rim} emissiveIntensity={hovered ? 2.2 : 0.8} />
      </mesh>
      {/* faces */}
      {[0.045, -0.045].map((z, i) => (
        <mesh key={i} position={[0, 0, z]} rotation={[0, i === 1 ? Math.PI : 0, 0]}>
          <circleGeometry args={[0.74, 40]} />
          <meshBasicMaterial map={tex} transparent toneMapped={false} side={THREE.FrontSide} />
        </mesh>
      ))}
      {/* glass slab between faces */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.77, 0.77, 0.06, 40]} />
        <meshPhysicalMaterial color="#ffffff" transparent opacity={0.12} roughness={0.1} />
      </mesh>
    </group>
  );
}

function ModelBadge({ slug }: { slug: string }) {
  const { scene } = useGLTF(`${BASE}/models/${slug}.glb`);
  return <primitive object={scene.clone()} scale={1.1} />;
}
