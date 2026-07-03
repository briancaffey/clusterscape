"use client";

// Three ways to inhabit the cluster:
//   iso — orthographic god-view with map-style pan/zoom (the default)
//   fps — pointer-lock free-fly: WASD/IJKL + mouse, E/Q up/down; hold SHIFT
//         to free the cursor and inspect (release to re-lock)
//   tp  — third person: a little explorer runs the islands; A/D (J/L) turn,
//         W/S (I/K) move, cursor stays free for hovering
// All camera behavior lives here so scene entities never know how they're
// being looked at.

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { MapControls, OrthographicCamera, PerspectiveCamera, PointerLockControls } from "@react-three/drei";
import * as THREE from "three";
import { useStore, type CameraMode } from "@/state/store";
import { PALETTES } from "./palette";

export function Rig() {
  const mode = useStore((s) => s.cameraMode);
  return mode === "iso" ? <IsoRig /> : mode === "fps" ? <FpsRig /> : <TpRig />;
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

// -- shared key state ---------------------------------------------------------

const keys: Record<string, boolean> = {};
function useKeys() {
  useEffect(() => {
    const down = (e: KeyboardEvent) => (keys[e.code] = true);
    const up = (e: KeyboardEvent) => (keys[e.code] = false);
    const blur = () => Object.keys(keys).forEach((k) => (keys[k] = false));
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);
}
const axis = () => ({
  fwd: (keys["KeyW"] || keys["KeyI"] ? 1 : 0) - (keys["KeyS"] || keys["KeyK"] ? 1 : 0),
  strafe: (keys["KeyD"] || keys["KeyL"] ? 1 : 0) - (keys["KeyA"] || keys["KeyJ"] ? 1 : 0),
  lift: (keys["KeyE"] ? 1 : 0) - (keys["KeyQ"] ? 1 : 0),
});

// -- first person -------------------------------------------------------------

function FpsRig() {
  useKeys();
  const { camera } = useThree();
  const vel = useRef(new THREE.Vector3());
  const controls = useRef<React.ComponentRef<typeof PointerLockControls>>(null);
  const setPointerLocked = useStore((s) => s.setPointerLocked);

  // hold shift: free the cursor to inspect; release: dive back in
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "Shift") controls.current?.unlock();
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "Shift") controls.current?.lock();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useFrame((_, dt) => {
    const { fwd, strafe, lift } = axis();
    const dir = new THREE.Vector3(strafe, 0, -fwd);
    dir.normalize().applyQuaternion(camera.quaternion);
    dir.y = 0;
    dir.y += lift * 0.8;
    vel.current.lerp(dir.multiplyScalar(13), 1 - Math.exp(-8 * dt));
    camera.position.addScaledVector(vel.current, dt);
    camera.position.y = Math.max(camera.position.y, 0.8);
  });

  return (
    <>
      <PerspectiveCamera makeDefault fov={68} position={[0, 2.2, 26]} near={0.1} far={600} />
      <PointerLockControls
        ref={controls}
        makeDefault
        onLock={() => setPointerLocked(true)}
        onUnlock={() => setPointerLocked(false)}
      />
    </>
  );
}

// -- third person -------------------------------------------------------------

function TpRig() {
  useKeys();
  const theme = useStore((s) => s.theme);
  const pal = PALETTES[theme];
  const char = useRef<THREE.Group>(null);
  const heading = useRef(Math.PI); // face the islands
  const pos = useRef(new THREE.Vector3(0, 0.65, 30));
  const camRef = useRef<THREE.PerspectiveCamera>(null);
  const bob = useRef(0);

  useFrame((state, dt) => {
    const { fwd, strafe } = axis();
    heading.current -= strafe * 2.2 * dt;
    const speed = 10;
    const dir = new THREE.Vector3(Math.sin(heading.current), 0, Math.cos(heading.current));
    pos.current.addScaledVector(dir, fwd * speed * dt);
    const moving = fwd !== 0;
    bob.current += (moving ? 10 : 4) * dt;

    if (char.current) {
      char.current.position.copy(pos.current);
      char.current.position.y = 0.65 + (moving ? Math.abs(Math.sin(bob.current)) * 0.14 : Math.sin(bob.current) * 0.04);
      char.current.rotation.y = heading.current;
    }
    const cam = state.camera;
    const behind = pos.current
      .clone()
      .addScaledVector(dir, -8.5)
      .add(new THREE.Vector3(0, 4.4, 0));
    cam.position.lerp(behind, 1 - Math.exp(-4 * dt));
    cam.lookAt(pos.current.x, pos.current.y + 1.2, pos.current.z);
  });

  return (
    <>
      <PerspectiveCamera ref={camRef} makeDefault fov={58} position={[0, 5, 40]} near={0.1} far={600} />
      <group ref={char}>
        {/* the little explorer */}
        <mesh position={[0, 0.55, 0]}>
          <capsuleGeometry args={[0.32, 0.6, 6, 14]} />
          <meshStandardMaterial color={theme === "night" ? "#e8eefc" : "#3a4c6e"} roughness={0.35} metalness={0.15} />
        </mesh>
        {/* visor */}
        <mesh position={[0, 0.85, 0.24]} rotation={[0.12, 0, 0]}>
          <boxGeometry args={[0.34, 0.16, 0.12]} />
          <meshStandardMaterial color="#12263f" emissive="#39e6ff" emissiveIntensity={1.8} roughness={0.1} />
        </mesh>
        {/* headlamp */}
        <pointLight position={[0, 1.2, 0.6]} intensity={pal.stars ? 6 : 2} distance={10} color="#cfe8ff" />
        {/* ground puck so you can find your feet */}
        <mesh position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.42, 0.55, 28]} />
          <meshBasicMaterial color="#39e6ff" toneMapped={false} transparent opacity={0.7} />
        </mesh>
      </group>
    </>
  );
}
