"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/state/store";
import { DetailPanel } from "./DetailPanel";

export function Hud() {
  const snapshot = useStore((s) => s.snapshot);
  const hovered = useStore((s) => s.hovered);
  const mode = useStore((s) => s.cameraMode);
  const setCameraMode = useStore((s) => s.setCameraMode);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const mm = (e: MouseEvent) => setMouse({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", mm);
    return () => window.removeEventListener("mousemove", mm);
  }, []);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.code === "Digit1") setCameraMode("iso");
      if (e.code === "Digit2") setCameraMode("fps");
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [setCameraMode]);

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
        <p className="dim">snapshot {new Date(snapshot.meta.capturedAt).toLocaleString()}</p>
      </header>

      <nav className="hud hud-top-right">
        <button className={mode === "iso" ? "on" : ""} onClick={() => setCameraMode("iso")}>
          1 · isometric
        </button>
        <button className={mode === "fps" ? "on" : ""} onClick={() => setCameraMode("fps")}>
          2 · first person
        </button>
        {mode === "fps" && <p className="dim">click to lock · WASD move · E/Q up/down · shift run</p>}
      </nav>

      {hovered && (
        <div className="tooltip" style={{ left: mouse.x + 14, top: mouse.y + 14 }}>
          <span className="kind">{hovered.split(":")[0]}</span> {hovered.split(":")[1]}
        </div>
      )}

      <DetailPanel />
    </>
  );
}
