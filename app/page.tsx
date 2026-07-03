"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { StaticProvider, LiveProvider } from "@/model/types";
import { useStore } from "@/state/store";
import { Hud } from "@/ui/Hud";
import { Welcome } from "@/ui/Welcome";

const Scene = dynamic(() => import("@/scene/Scene").then((m) => m.Scene), { ssr: false });

const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

export default function Page() {
  const snapshot = useStore((s) => s.snapshot);
  const setSnapshot = useStore((s) => s.setSnapshot);
  const setLogos = useStore((s) => s.setLogos);
  const setDataMode = useStore((s) => s.setDataMode);
  const setShowWelcome = useStore((s) => s.setShowWelcome);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    const params = new URLSearchParams(window.location.search);
    const wantStatic = params.get("static") === "1";
    const wantLive = params.get("live") === "1";
    let unsub: (() => void) | undefined;

    (async () => {
      // Live first (same-origin bridge or NEXT_PUBLIC_BRIDGE_URL): quick probe
      // unless explicitly forced. GitHub Pages has no /api → falls to static.
      if (!wantStatic) {
        const live = new LiveProvider(process.env.NEXT_PUBLIC_BRIDGE_URL ?? "");
        try {
          const snap = await withTimeout(live.getSnapshot(), wantLive ? 20000 : 3000);
          setDataMode("live");
          setSnapshot(snap);
          unsub = live.subscribe?.(setSnapshot);
          return;
        } catch (e) {
          if (wantLive) {
            setError(`live bridge unreachable: ${e}`);
            return;
          }
        }
      }
      try {
        const snap = await new StaticProvider(`${base}/data/cluster.json`).getSnapshot();
        setDataMode("static");
        setSnapshot(snap);
      } catch (e) {
        setError(String(e));
      }
    })();

    fetch(`${base}/logos/manifest.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => m && setLogos(m))
      .catch(() => {});

    if (!window.localStorage.getItem("clusterscape-welcome-seen")) setShowWelcome(true);

    return () => unsub?.();
  }, [setSnapshot, setLogos, setDataMode, setShowWelcome]);

  return (
    <main>
      {snapshot ? (
        <Scene />
      ) : (
        <div className="loading">
          {error ? (
            <div>
              <p>failed to load snapshot: {error}</p>
              <p className="dim">
                expected a live bridge at /api/snapshot or a static file at /data/cluster.json —
                run `npm run snapshot`, and make sure you&apos;re on the right port
              </p>
            </div>
          ) : (
            "loading cluster…"
          )}
        </div>
      )}
      <Hud />
      <Welcome />
    </main>
  );
}
