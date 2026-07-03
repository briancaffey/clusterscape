"use client";

import { Canvas } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { useStore } from "@/state/store";
import { Rig } from "./Rig";
import { Islands } from "./Islands";
import { Pods } from "./Pods";
import { Services } from "./Services";
import { Ingresses } from "./Ingresses";
import { Volumes } from "./Volumes";

export function Scene() {
  const snapshot = useStore((s) => s.snapshot);
  const setSelected = useStore((s) => s.setSelected);
  if (!snapshot) return null;

  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true }}
      onPointerMissed={() => setSelected(null)}
      style={{ position: "absolute", inset: 0 }}
    >
      <color attach="background" args={["#070b14"]} />
      <fogExp2 attach="fog" args={["#070b14", 0.0085]} />

      <ambientLight intensity={0.35} />
      <directionalLight position={[30, 60, 20]} intensity={1.1} color="#cfe0ff" />
      <directionalLight position={[-40, 20, -30]} intensity={0.35} color="#7f9cff" />

      <Stars radius={260} depth={60} count={2600} factor={3} saturation={0} fade speed={0.4} />

      <Rig />
      <Islands />
      <Pods />
      <Services />
      <Ingresses />
      <Volumes />

      <EffectComposer>
        <Bloom mipmapBlur intensity={0.9} luminanceThreshold={0.32} luminanceSmoothing={0.15} />
        <Vignette eskil={false} offset={0.18} darkness={0.78} />
      </EffectComposer>
    </Canvas>
  );
}
