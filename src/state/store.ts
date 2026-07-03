"use client";

import { create } from "zustand";
import type { ClusterSnapshot } from "@/model/types";
import { layoutScene, type SceneLayout } from "@/model/layout";

export type CameraMode = "iso" | "fps";

interface Store {
  snapshot: ClusterSnapshot | null;
  layout: SceneLayout | null;
  hovered: string | null; // entity id
  selected: string | null;
  cameraMode: CameraMode;
  setSnapshot: (s: ClusterSnapshot) => void;
  setHovered: (id: string | null) => void;
  setSelected: (id: string | null) => void;
  setCameraMode: (m: CameraMode) => void;
}

export const useStore = create<Store>((set) => ({
  snapshot: null,
  layout: null,
  hovered: null,
  selected: null,
  cameraMode: "iso",
  setSnapshot: (snapshot) => set({ snapshot, layout: layoutScene(snapshot) }),
  setHovered: (hovered) => set({ hovered }),
  setSelected: (selected) => set({ selected }),
  setCameraMode: (cameraMode) => set({ cameraMode, selected: null, hovered: null }),
}));

/** Stable, tasteful namespace hues (golden-ratio walk around the wheel). */
export function nsColor(ns: string): string {
  let h = 0;
  for (let i = 0; i < ns.length; i++) h = (h * 31 + ns.charCodeAt(i)) >>> 0;
  const hue = (h % 360) * 0.618033 * 360 % 360;
  return `hsl(${hue.toFixed(0)}, 62%, 62%)`;
}
