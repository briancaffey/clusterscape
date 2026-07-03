"use client";

import { Canvas } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { useStore } from "@/state/store";
import { PALETTES } from "./palette";
import { Rig } from "./Rig";
import { Islands } from "./Islands";
import { Pods } from "./Pods";
import { Services } from "./Services";
import { Ingresses } from "./Ingresses";
import { Volumes } from "./Volumes";
import { LogoBadges } from "./LogoBadges";

export function Scene() {
  const snapshot = useStore((s) => s.snapshot);
  const theme = useStore((s) => s.theme);
  const setSelected = useStore((s) => s.setSelected);
  const pal = PALETTES[theme];
  if (!snapshot) return null;

  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true }}
      onPointerMissed={() => setSelected(null)}
      style={{ position: "absolute", inset: 0 }}
    >
      <color attach="background" args={[pal.bg]} />
      <fogExp2 attach="fog" args={[pal.bg, pal.fogDensity]} />

      <ambientLight intensity={pal.ambient} />
      <directionalLight position={[30, 60, 20]} intensity={pal.keyIntensity} color={pal.keyColor} />
      <directionalLight position={[-40, 20, -30]} intensity={0.35} color={pal.fillColor} />
      {!pal.stars && <hemisphereLight intensity={0.5} color="#ffffff" groundColor="#b7c6de" />}

      {pal.stars && (
        <Stars radius={260} depth={60} count={2600} factor={3} saturation={0} fade speed={0.4} />
      )}

      <Rig />
      <Islands />
      <Pods />
      <Services />
      <Ingresses />
      <Volumes />
      <LogoBadges />

      <EffectComposer>
        <Bloom mipmapBlur intensity={pal.bloom} luminanceThreshold={0.32} luminanceSmoothing={0.15} />
        <Vignette eskil={false} offset={0.18} darkness={theme === "night" ? 0.78 : 0.35} />
      </EffectComposer>
    </Canvas>
  );
}
