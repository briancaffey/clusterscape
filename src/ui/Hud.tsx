"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/state/store";
import { DetailPanel } from "./DetailPanel";

export function Hud() {
  const snapshot = useStore((s) => s.snapshot);
  const hovered = useStore((s) => s.hovered);
  const mode = useStore((s) => s.cameraMode);
  const theme = useStore((s) => s.theme);
  const pointerLocked = useStore((s) => s.pointerLocked);
  const dataMode = useStore((s) => s.dataMode);
  const setShowWelcome = useStore((s) => s.setShowWelcome);
  const setCameraMode = useStore((s) => s.setCameraMode);
  const setTheme = useStore((s) => s.setTheme);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const mm = (e: MouseEvent) => setMouse({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", mm);
    return () => window.removeEventListener("mousemove", mm);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.code === "Digit1") setCameraMode("iso");
      if (e.code === "Digit2") setCameraMode("fps");
      if (e.code === "Digit3") setCameraMode("tp");
      if (e.code === "KeyT") setTheme(theme === "night" ? "day" : "night");
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [setCameraMode, setTheme, theme]);

  if (!snapshot) return null;
  const c = snapshot.meta.counts;

  return (
    <>
      <header className="hud hud-top-left">
        <h1>clusterscape</h1>
        <p>
          {snapshot.meta.clusterName} · {c.nodes} nodes · {c.pods} pods · {c.services} services ·{" "}
          {c.pvcs} volumes
        </p>
        <p className={`mode-pill ${dataMode === "live" ? "live" : "dim"}`}>
          {dataMode === "live" ? "● live" : "◼ static snapshot"} ·{" "}
          {new Date(snapshot.meta.capturedAt).toLocaleString()}
        </p>
      </header>

      <nav className="hud hud-top-right">
        <button className={mode === "iso" ? "on" : ""} onClick={() => setCameraMode("iso")}>
          1 · isometric
        </button>
        <button className={mode === "fps" ? "on" : ""} onClick={() => setCameraMode("fps")}>
          2 · first person
        </button>
        <button className={mode === "tp" ? "on" : ""} onClick={() => setCameraMode("tp")}>
          3 · third person
        </button>
        <button onClick={() => setTheme(theme === "night" ? "day" : "night")}>
          T · {theme === "night" ? "day mode" : "night mode"}
        </button>
        <button onClick={() => setShowWelcome(true)}>? · about</button>
        {mode === "fps" && (
          <p className="dim">
            click to lock · WASD / IJKL move · E/Q up/down · hold SHIFT to inspect with the cursor
          </p>
        )}
        {mode === "tp" && <p className="dim">W/S (I/K) walk · A/D (J/L) turn · cursor free to inspect</p>}
      </nav>

      {mode === "fps" && pointerLocked && <div className="crosshair" />}

      {hovered && (!pointerLocked || mode !== "fps") && (
        <div className="tooltip" style={{ left: mouse.x + 14, top: mouse.y + 14 }}>
          <span className="kind">{hovered.split(":")[0]}</span> {hovered.split(":")[1]}
        </div>
      )}
      {hovered && pointerLocked && mode === "fps" && (
        <div className="tooltip tooltip-center">
          <span className="kind">{hovered.split(":")[0]}</span> {hovered.split(":")[1]}
        </div>
      )}

      <DetailPanel />
    </>
  );
}
