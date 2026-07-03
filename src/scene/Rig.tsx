"use client";

// Two ways to inhabit the cluster:
//   iso — orthographic god-view with map-style pan/zoom (the default)
//   fps — pointer-lock free-fly: WASD + mouse, E/Q for up/down
// Architecture note: keep every camera behavior here so scene entities never
// know how they're being looked at.

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { MapControls, OrthographicCamera, PerspectiveCamera, PointerLockControls } from "@react-three/drei";
import * as THREE from "three";
import { useStore } from "@/state/store";

export function Rig() {
  const mode = useStore((s) => s.cameraMode);
  return mode === "iso" ? <IsoRig /> : <FpsRig />;
}

function IsoRig() {
  return (
    <>
      <OrthographicCamera makeDefault position={[46, 44, 46]} zoom={11} near={-500} far={800} />
      <MapControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        screenSpacePanning={false}
        minZoom={5}
        maxZoom={60}
        maxPolarAngle={Math.PI / 2.3}
      />
    </>
  );
}

const keys: Record<string, boolean> = {};

function FpsRig() {
  const camRef = useRef<THREE.PerspectiveCamera>(null);
  const { camera } = useThree();
  const vel = useRef(new THREE.Vector3());

  useEffect(() => {
    const down = (e: KeyboardEvent) => (keys[e.code] = true);
    const up = (e: KeyboardEvent) => (keys[e.code] = false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useFrame((_, dt) => {
    const speed = keys["ShiftLeft"] ? 26 : 11;
    const dir = new THREE.Vector3();
    if (keys["KeyW"]) dir.z -= 1;
    if (keys["KeyS"]) dir.z += 1;
    if (keys["KeyA"]) dir.x -= 1;
    if (keys["KeyD"]) dir.x += 1;
    dir.normalize().applyQuaternion(camera.quaternion);
    dir.y = 0;
    if (keys["KeyE"]) dir.y += 0.8;
    if (keys["KeyQ"]) dir.y -= 0.8;
    vel.current.lerp(dir.multiplyScalar(speed), 1 - Math.exp(-8 * dt));
    camera.position.addScaledVector(vel.current, dt);
    camera.position.y = Math.max(camera.position.y, 0.8);
  });

  return (
    <>
      <PerspectiveCamera ref={camRef} makeDefault fov={68} position={[0, 2.2, 26]} near={0.1} far={600} />
      <PointerLockControls makeDefault />
    </>
  );
}
