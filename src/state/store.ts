"use client";

import { create } from "zustand";
import type { ClusterSnapshot, LogoManifest } from "@/model/types";
import { layoutScene, type SceneLayout } from "@/model/layout";
import type { Theme } from "@/scene/palette";

export type CameraMode = "iso" | "fps" | "tp";
export type DataMode = "static" | "live";

interface Store {
  snapshot: ClusterSnapshot | null;
  layout: SceneLayout | null;
  logos: LogoManifest | null;
  hovered: string | null; // entity id
  selected: string | null;
  cameraMode: CameraMode;
  theme: Theme;
  pointerLocked: boolean;
  dataMode: DataMode;
  showWelcome: boolean;
  setSnapshot: (s: ClusterSnapshot) => void;
  setLogos: (m: LogoManifest) => void;
  setHovered: (id: string | null) => void;
  setSelected: (id: string | null) => void;
  setCameraMode: (m: CameraMode) => void;
  setTheme: (t: Theme) => void;
  setPointerLocked: (v: boolean) => void;
  setDataMode: (m: DataMode) => void;
  setShowWelcome: (v: boolean) => void;
}

export const useStore = create<Store>((set) => ({
  snapshot: null,
  layout: null,
  logos: null,
  hovered: null,
  selected: null,
  cameraMode: "iso",
  theme: "night",
  pointerLocked: false,
  dataMode: "static",
  showWelcome: false,
  setSnapshot: (snapshot) => set({ snapshot, layout: layoutScene(snapshot) }),
  setLogos: (logos) => set({ logos }),
  setHovered: (hovered) => set({ hovered }),
  setSelected: (selected) => set({ selected }),
  setCameraMode: (cameraMode) => set({ cameraMode, selected: null, hovered: null }),
  setTheme: (theme) => set({ theme }),
  setPointerLocked: (pointerLocked) => set({ pointerLocked }),
  setDataMode: (dataMode) => set({ dataMode }),
  setShowWelcome: (showWelcome) => set({ showWelcome }),
}));

/** Stable, tasteful namespace hues (golden-ratio walk around the wheel). */
export function nsColor(ns: string): string {
  let h = 0;
  for (let i = 0; i < ns.length; i++) h = (h * 31 + ns.charCodeAt(i)) >>> 0;
  const hue = (h % 360) * 0.618033 * 360 % 360;
  return `hsl(${hue.toFixed(0)}, 62%, 62%)`;
}
